// POST /api/generate/translate
// body: { projectId, language: "en" | "ja" }
// 응답: { ok, translation, newBalance, totalCostKRW }
//
// 책 한 권을 영어 또는 일본어로 번역.
// - 1) topic + audience 번역 (1 호출, ~₩20)
// - 2) 각 챕터 본문 순차 번역 (N 호출, ~₩15/장)
// - 12 챕터 = ~₩200 총비용 (Gemini Flash)
//
// Vercel 60s timeout — 챕터 8장 정도까지 한 번에. 더 길면 클라이언트가 retry 호출 시
// 기존 translation에 누적 (해당 언어 entry 있으면 챕터만 이어서).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServerWithFallback, type AIModel } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { bookTranslateMetaPrompt, bookTranslateChapterPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_BALANCE_KRW = 250;

// 모든 사용자에게 Gemini Flash 사용 (저비용 보장)
const TRANSLATE_CHAIN: AIModel[] = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
];

function parseJSON(text: string): any {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`translate:${userId}`, 3, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId, language } = await req.json().catch(() => ({}));
    if (!projectId || (language !== "en" && language !== "ja")) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "projectId, language(en/ja) 필수" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project: any = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < MIN_BALANCE_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (~₩200 필요, 최소 ₩${MIN_BALANCE_KRW})`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    const chapters = Array.isArray(project.chapters) ? project.chapters : [];
    if (chapters.length === 0) {
      return NextResponse.json({ error: "NO_CHAPTERS", message: "번역할 챕터가 없습니다." }, { status: 400 });
    }

    // 키 필터링된 chain
    const candidates = TRANSLATE_CHAIN.filter(m => {
      if (m.startsWith("gemini")) return !!process.env.GEMINI_API_KEY;
      return false;
    });
    if (candidates.length === 0) {
      return NextResponse.json({ error: "TIER_UNAVAILABLE", message: "Gemini API 키 없음" }, { status: 503 });
    }

    // 기존 translation 있으면 이어서 (이미 번역된 챕터는 건너뛰기)
    const existingTranslations: any[] = Array.isArray(project.translations) ? project.translations : [];
    const existingForLang = existingTranslations.find((t: any) => t?.language === language);

    let translatedTopic = existingForLang?.topic ?? "";
    let translatedAudience = existingForLang?.audience ?? "";
    const translatedChapters: Array<{ title: string; subtitle?: string; content: string }> =
      Array.isArray(existingForLang?.chapters) ? [...existingForLang.chapters] : [];

    let totalCostKRW = 0;
    let newBalance = user.balance_krw;

    // 1. topic + audience 번역 (없으면)
    if (!translatedTopic || !translatedAudience) {
      try {
        const meta = await callAIServerWithFallback({
          candidates,
          system: "당신은 한국어 → 영어/일본어 출판 전문 번역가입니다. JSON만 출력합니다.",
          user: bookTranslateMetaPrompt(project, language),
          maxTokens: 800,
          temperature: 0.4,
          timeoutMs: 20000,
          retries: 1,
        });
        const parsed = parseJSON(meta.text);
        if (parsed?.topic && parsed?.audience) {
          translatedTopic = String(parsed.topic).slice(0, 500);
          translatedAudience = String(parsed.audience).slice(0, 500);
        }
        const costKRW = Math.ceil(meta.usage.costUSD * USD_TO_KRW);
        totalCostKRW += costKRW;
        const log = await logAIUsage({
          userId, task: "edit", model: meta.actualModel,
          inputTokens: meta.usage.inputTokens,
          outputTokens: meta.usage.outputTokens,
          thoughtsTokens: meta.usage.thoughtsTokens,
          cacheReadTokens: meta.usage.cacheReadTokens,
          cacheWriteTokens: meta.usage.cacheWriteTokens,
          costUSD: meta.usage.costUSD, costKRW,
          durationMs: meta.usage.durationMs,
          projectId, status: "success",
        });
        if (costKRW > 0) {
          const r = await deductBalance({
            userId, amountKRW: costKRW, aiUsageId: log.id,
            reason: `책 번역 (${language === "en" ? "영어" : "일본어"} 메타)`,
          });
          newBalance = r.newBalance;
        }
      } catch (e: any) {
        return NextResponse.json({ error: "META_TRANSLATE_FAILED", message: e?.message || "메타 번역 실패" }, { status: 502 });
      }
    }

    // 2. 챕터 본문 순차 번역 — 이미 번역된 챕터(같은 idx)는 skip
    // Vercel 60s 한계 → 한 번에 최대 8장만, 나머지는 다음 호출.
    const startTime = Date.now();
    const MAX_DURATION_MS = 50_000; // 안전 마진

    for (let i = 0; i < chapters.length; i++) {
      if (translatedChapters[i]) continue; // 이미 번역됨
      if (Date.now() - startTime > MAX_DURATION_MS) break; // 타임아웃 회피

      const ch = chapters[i];
      if (!ch?.content) {
        // 본문 없는 챕터는 제목만 번역(or skip).
        translatedChapters[i] = { title: ch?.title ?? `Chapter ${i + 1}`, subtitle: ch?.subtitle, content: "" };
        continue;
      }

      try {
        const result = await callAIServerWithFallback({
          candidates,
          system: "당신은 한국어 책 본문을 자연스러운 영어/일본어로 번역하는 출판 전문가입니다. JSON만 출력합니다.",
          user: bookTranslateChapterPrompt(language, ch.title ?? `Chapter ${i + 1}`, ch.subtitle, ch.content),
          maxTokens: 8000,
          temperature: 0.5,
          timeoutMs: 40000,
          retries: 1,
        });
        const parsed = parseJSON(result.text);
        if (parsed?.title && typeof parsed.content === "string") {
          translatedChapters[i] = {
            title: String(parsed.title).slice(0, 500),
            subtitle: parsed.subtitle ? String(parsed.subtitle).slice(0, 500) : undefined,
            content: String(parsed.content).slice(0, 50_000),
          };
        }
        const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
        totalCostKRW += costKRW;
        const log = await logAIUsage({
          userId, task: "edit", model: result.actualModel,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          thoughtsTokens: result.usage.thoughtsTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheWriteTokens: result.usage.cacheWriteTokens,
          costUSD: result.usage.costUSD, costKRW,
          durationMs: result.usage.durationMs,
          projectId, chapterIdx: i, status: "success",
        });
        if (costKRW > 0) {
          const r = await deductBalance({
            userId, amountKRW: costKRW, aiUsageId: log.id,
            reason: `챕터 ${i + 1} 번역 (${language === "en" ? "영어" : "일본어"})`,
          });
          newBalance = r.newBalance;
        }
      } catch (e: any) {
        // 한 챕터 실패해도 나머지는 진행 — log는 남기되 throw X
        await logAIUsage({
          userId, task: "edit", model: candidates[0],
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0, costKRW: 0, durationMs: 0,
          projectId, chapterIdx: i,
          status: "failed", errorMessage: e?.message?.slice(0, 500),
        }).catch(() => {});
      }
    }

    // 3. 프로젝트 데이터 업데이트
    const newTranslation = {
      language,
      topic: translatedTopic,
      audience: translatedAudience,
      chapters: translatedChapters,
      generatedAt: Date.now(),
    };

    const updatedTranslations = existingTranslations.filter((t: any) => t?.language !== language);
    updatedTranslations.push(newTranslation);

    await updateProjectData(projectId, userId, {
      ...project,
      translations: updatedTranslations,
    });

    const completed = translatedChapters.filter(Boolean).length;
    const totalChapters = chapters.length;
    return NextResponse.json({
      ok: true,
      translation: newTranslation,
      newBalance,
      totalCostKRW,
      progress: { completed, total: totalChapters, isComplete: completed >= totalChapters },
    });
  } catch (e: any) {
    console.error("[/api/generate/translate]", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

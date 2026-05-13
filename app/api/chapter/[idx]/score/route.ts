// POST /api/chapter/[idx]/score
// 챕터 본문의 한국어 자연성 점수 (0~100) + 개선 제안 2~3개.
// AI (Gemini Flash Lite) 1회 호출 — 비용 ~₩50.
// 결과는 project.data.chapters[idx].qualityScore에 캐시.
//
// v3 Phase 2.1 (2026-05-13).
//
// 응답: { ok, score, suggestions[], generatedAt, cached?, newBalance, costKRW }
//
// 모델 선택 이유 — Gemini Flash Lite:
//  - 한국어 평가는 짧은 in/out 작업 (입력 ≤ 4k chars, 출력 ≤ 400 chars JSON).
//  - Lite 가격 = $0.10 / $0.40 per 1M token. 12 챕터 책 한 권 채점 ~₩50/챕터 × 12 = ₩600.
//  - 자연성 평가는 추론보다 패턴 인식 — Flash Lite로 충분.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { callAIServerWithFallback, type AIModel } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage,
} from "@/lib/server/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const FIXED_COST_KRW = 50;

const SCORE_SYSTEM = `당신은 한국어 실용서·자기계발서를 평가하는 편집자입니다. 본문의 한국어 자연성(번역투·AI 표현·문장 흐름)을 0~100점으로 채점하고, 가장 시급한 개선 제안 2~3개를 구체적으로 제시합니다.`;

function scorePrompt(chapterTitle: string, chapterContent: string): string {
  // 8000자 초과 시 앞 6000자만 — 자연성 평가는 처음 부분만으로도 충분
  const truncated = chapterContent.length > 8000
    ? chapterContent.slice(0, 6000) + "\n\n[...본문 일부 생략...]"
    : chapterContent;
  return `다음은 책 한 챕터의 본문입니다. 한국어 자연성을 채점하고 개선 제안을 작성하세요.

[챕터 제목]
${chapterTitle}

[본문]
${truncated}

[평가 기준]
1. 번역투 ("~할 수 있다", "~라고 할 수 있습니다") 빈도 — 적을수록 점수 ↑
2. AI 특유 표현 ("결론적으로 말하자면", "다음과 같이 살펴보면") — 적을수록 점수 ↑
3. 문장 길이·리듬 — 한 문장 한 호흡, 적절한 단문 섞임 ↑
4. 어휘 자연성 — 일상에서 쓰는 단어 ↑, 한자어·번역체 ↓
5. 톤 일관성 — 본문 안에서 갑자기 격식 바뀌면 ↓

[출력 형식 — 반드시 JSON만, 다른 설명 절대 금지]
{
  "score": <0~100 정수>,
  "suggestions": [
    "<구체적 개선 제안 1 — 본문에서 발견한 문제 + 어떻게 고칠지>",
    "<구체적 개선 제안 2>",
    "<구체적 개선 제안 3 (선택)>"
  ]
}

[채점 기준]
- 90~100: 사람이 쓴 것처럼 자연스러움. 출판 즉시 가능
- 80~89: 매우 자연스럽지만 일부 표현 다듬으면 ↑
- 70~79: 평균. 번역투/AI 표현 일부 보임
- 60~69: AI 티 남. 다듬어야 등록 가능
- 60 미만: 전면 재작성 필요

제안은 본문에서 실제 발견한 문장을 인용하면서 ("'~할 수 있다'를 '~할 수 있어요'로") 구체적으로. 두루뭉술한 조언 금지.`;
}

interface ScoreResult {
  score: number;
  suggestions: string[];
}

function parseScoreResult(text: string): ScoreResult {
  // AI 응답에서 JSON 추출 — ```json ... ``` 또는 raw JSON
  let json = text.trim();
  const fenceMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) json = fenceMatch[1].trim();
  // 첫 { 부터 마지막 } 까지
  const firstBrace = json.indexOf("{");
  const lastBrace = json.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    json = json.slice(firstBrace, lastBrace + 1);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch (e: any) {
    throw new Error(`점수 결과 파싱 실패: ${e?.message ?? "invalid JSON"} — raw: ${text.slice(0, 200)}`);
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed?.score) || 0)));
  const suggestionsRaw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  const suggestions = suggestionsRaw
    .map((s: any) => String(s ?? "").trim())
    .filter((s: string) => s.length >= 5)
    .slice(0, 3);
  return { score, suggestions };
}

export async function POST(req: Request, { params }: { params: { idx: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const idx = Number(params.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx > 99) {
      return NextResponse.json({ error: "INVALID_INDEX" }, { status: 400 });
    }

    // Rate limit — 사용자당 분당 10회 (한 책 12장 + 여유)
    const rl = rateLimit(`score:${userId}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({
        error: "RATE_LIMITED",
        message: `요청이 너무 잦습니다. ${Math.ceil(rl.resetIn / 1000)}초 후 다시 시도하세요.`,
      }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { projectId } = body ?? {};
    if (typeof projectId !== "string" || !projectId) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "projectId required" }, { status: 400 });
    }

    // 프로젝트 + 챕터 검증 (owner check 포함)
    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const project = projectRow.data;
    const ch = project?.chapters?.[idx];
    if (!ch) {
      return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
    }
    const content = typeof ch.content === "string" ? ch.content.trim() : "";
    if (content.length < 200) {
      return NextResponse.json({
        error: "CHAPTER_TOO_SHORT",
        message: "본문이 200자 미만 — 점수 매기기엔 너무 짧습니다. 먼저 본문을 생성하세요.",
      }, { status: 400 });
    }

    // 잔액 체크
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < FIXED_COST_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족. 점수 매기기에 ₩${FIXED_COST_KRW} 필요.`,
        required: FIXED_COST_KRW,
        current: user.balance_krw,
        shortfall: FIXED_COST_KRW - user.balance_krw,
      }, { status: 402 });
    }

    // AI 호출 — Gemini Flash Lite (저비용 평가용)
    // Anthropic/OpenAI 키 가용 시 fallback chain.
    const candidates: AIModel[] = [
      "gemini-flash-lite-latest",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
      "gpt-4o-mini",
    ];
    const availableCandidates = candidates.filter(model => {
      if (model.startsWith("gemini")) return !!process.env.GEMINI_API_KEY;
      if (model.startsWith("gpt")) return !!process.env.OPENAI_API_KEY;
      if (model.startsWith("claude")) return !!process.env.ANTHROPIC_API_KEY;
      return false;
    });
    if (availableCandidates.length === 0) {
      return NextResponse.json({
        error: "NO_AI_AVAILABLE",
        message: "사용 가능한 AI 모델이 없습니다. 관리자에게 문의하세요.",
      }, { status: 503 });
    }

    let aiResult;
    try {
      aiResult = await callAIServerWithFallback({
        candidates: availableCandidates,
        system: SCORE_SYSTEM,
        user: scorePrompt(ch.title ?? "", content),
        maxTokens: 1024,
        temperature: 0.3,  // 평가는 일관성 우선
        timeoutMs: 25_000,
        retries: 1,
      });
    } catch (e: any) {
      await logAIUsage({
        userId, task: "edit", model: availableCandidates[0],
        inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        costUSD: 0, costKRW: 0, durationMs: 0,
        projectId, chapterIdx: idx,
        status: "failed", errorMessage: `chapter-score: ${e?.message?.slice(0, 400)}`,
      }).catch(() => {});
      return NextResponse.json({
        error: "AI_FAILED",
        message: e?.message ?? "AI 호출 실패",
      }, { status: 502 });
    }

    let parsed: ScoreResult;
    try {
      parsed = parseScoreResult(aiResult.text);
    } catch (e: any) {
      return NextResponse.json({
        error: "PARSE_FAILED",
        message: e?.message ?? "결과 파싱 실패",
      }, { status: 502 });
    }
    if (parsed.suggestions.length === 0) {
      parsed.suggestions = ["AI가 구체적 개선점을 제시하지 못했습니다. 다시 시도하면 다른 제안이 나올 수 있어요."];
    }

    // 비용 차감 + 로그 (고정 ₩50 — 가격 정책 안정성)
    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: aiResult.actualModel,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      thoughtsTokens: aiResult.usage.thoughtsTokens,
      cacheReadTokens: aiResult.usage.cacheReadTokens,
      cacheWriteTokens: aiResult.usage.cacheWriteTokens,
      costUSD: aiResult.usage.costUSD,
      costKRW: FIXED_COST_KRW,
      durationMs: aiResult.usage.durationMs,
      projectId, chapterIdx: idx,
      status: "success",
    });
    const { newBalance } = await deductBalance({
      userId, amountKRW: FIXED_COST_KRW, aiUsageId: usageId,
      reason: `${idx + 1}장 자연성 점수 (${aiResult.actualModel})`,
    });

    const generatedAt = new Date().toISOString();
    const qualityScore = {
      score: parsed.score,
      suggestions: parsed.suggestions,
      generatedAt,
    };

    // 프로젝트에 캐시 — 최신 data 다시 불러서 race 보호
    const freshRow = await getProject(projectId, userId);
    if (freshRow) {
      const freshData: any = freshRow.data ?? project;
      const updatedChapters = [...(freshData.chapters ?? project.chapters)];
      if (updatedChapters[idx]) {
        updatedChapters[idx] = { ...updatedChapters[idx], qualityScore };
        await updateProjectData(projectId, userId, { ...freshData, chapters: updatedChapters });
      }
    }

    return NextResponse.json({
      ok: true,
      score: qualityScore.score,
      suggestions: qualityScore.suggestions,
      generatedAt: qualityScore.generatedAt,
      model: aiResult.actualModel,
      newBalance,
      costKRW: FIXED_COST_KRW,
    });
  } catch (e: any) {
    console.error("[/api/chapter/[idx]/score] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

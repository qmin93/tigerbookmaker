// POST /api/book/[id]/generate-chapter-images
// Body: { projectId, maxPerCall?: number }
// 응답: { ok, generated, totalCostKRW, newBalance, failed: [{ chapterIdx, placeholder, message }], remaining }
//
// spec PR #4 (`docs/superpowers/specs/2026-05-13-ai-image-system-design.md` 3.6) — 일괄 본문 이미지 생성.
//
// 동작:
//   - 프로젝트의 모든 챕터를 훑어 본문에 있는 [IMAGE: ...] placeholder 중 dataUrl이 없는 것을 모은다.
//   - Vercel 60s 한계를 피하려 한 호출당 최대 N장 (기본 4)만 생성하고 남으면 클라이언트가 재호출.
//   - 실패한 placeholder는 failed[]에 담아 반환 (다음 호출에서 자동 재시도 가능).
//   - 이미지 생성 자체는 callImageGeneration → 직접 호출. (chapter-image route를 self-HTTP 호출하지 않음 — Vercel cold start 누적·인증 토큰 재전송 부담)
//   - 잔액·로그·placeholder 저장 등 부수효과는 chapter-image route와 동일한 헬퍼로 처리.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callImageGeneration, callAIServer } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MAX_PER_CALL = 4;       // Vercel 60s 안에 안전하게 끝낼 수 있는 장수
const HARD_MAX_PER_CALL = 6;
const PER_IMAGE_EST_KRW = 60;          // 잔액 사전 체크용 — 실제 deductBalance는 정확

interface Job {
  chapterIdx: number;
  placeholder: string;
  caption: string;
}

interface FailedItem {
  chapterIdx: number;
  placeholder: string;
  message: string;
}

function extractPlaceholders(content: string): string[] {
  const m = content.match(/\[IMAGE:[^\]]+\]/g);
  return m ?? [];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`bulk-img:${userId}`, 20, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const projectId = body?.projectId ?? id;
    const maxPerCall = Math.min(
      HARD_MAX_PER_CALL,
      Math.max(1, Number(body?.maxPerCall) || DEFAULT_MAX_PER_CALL),
    );

    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    let project = projectRow.data;

    if (project?.imagesDisabled) {
      return NextResponse.json({
        ok: true,
        generated: 0,
        totalCostKRW: 0,
        newBalance: null,
        failed: [],
        remaining: 0,
        disabled: true,
      });
    }

    // 누락된 placeholder 수집
    const allJobs: Job[] = [];
    project.chapters?.forEach((ch: any, ci: number) => {
      const phs = extractPlaceholders(ch.content || "");
      phs.forEach((ph) => {
        const existing = ch.images?.find((i: any) => i.placeholder === ph);
        if (!existing?.dataUrl) {
          const caption = ph.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "").trim();
          allJobs.push({ chapterIdx: ci, placeholder: ph, caption });
        }
      });
    });

    if (allJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        generated: 0,
        totalCostKRW: 0,
        newBalance: null,
        failed: [],
        remaining: 0,
      });
    }

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    const batch = allJobs.slice(0, maxPerCall);

    // 잔액 사전 체크 — 이번 배치 충분한지
    const batchEst = batch.length * PER_IMAGE_EST_KRW;
    if (user.balance_krw < batchEst) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액이 부족합니다 (이번 배치 약 ₩${batchEst}, 잔액 ₩${user.balance_krw}).`,
        current: user.balance_krw,
        needKRW: batchEst,
      }, { status: 402 });
    }

    const failed: FailedItem[] = [];
    let totalCostKRW = 0;
    let newBalance = user.balance_krw;
    let generated = 0;

    // 책 컨텍스트 (caption → 영문 prompt 번역에 사용. chapter-image route와 같은 시스템 prompt)
    const bookContext = {
      topic: project.topic ?? "",
      audience: project.audience ?? "",
      type: project.type ?? projectRow.type ?? "",
    };

    for (const job of batch) {
      try {
        // chapter-image route와 동일한 흐름: 한글 caption → 영문 prompt → 이미지
        let englishPrompt = job.caption;
        try {
          const promptResult = await callAIServer({
            model: "gemini-flash-latest",
            system: "You convert Korean illustration descriptions into specific, vivid English image generation prompts (for Imagen 4 / Flux). Focus on the actual visual subject — concrete people/objects/scenes, never the book medium itself. Be visually descriptive: mention specific colors, lighting, composition, mood. NEVER output words like 'book', 'document', 'page', 'reading', 'literature' unless the subject literally IS a book on a shelf.",
            user: `[BOOK CONTEXT — for theme understanding only, NEVER mention 'book' in your output]\nTopic: ${bookContext.topic}\nGenre: ${bookContext.type}\nAudience: ${bookContext.audience}\n\n[ILLUSTRATION TO DRAW (Korean)]\n${job.caption}\n\n[YOUR TASK]\nWrite a single vivid English image prompt (60–100 words) for the actual visual subject described above. Include: specific subject, setting, lighting, color palette, composition, art style. Output ONLY the prompt as one line — no preamble, no quotes, no explanation.`,
            maxTokens: 400,
            temperature: 0.6,
            timeoutMs: 12000,
            retries: 0,
          });
          englishPrompt = promptResult.text.trim().replace(/^["']|["']$/g, "");
        } catch {
          // fallback: 한글 caption 그대로 사용
        }

        const prompt = `${englishPrompt}. Editorial magazine illustration, clean modern composition, single clear focal subject, professional lighting, minimalist negative space. Style: Behance / Pinterest editorial design quality. STRICT: NO books, NO documents, NO papers, NO text of any kind, NO letters, NO numbers, NO Korean characters, NO English words, NO captions, NO labels, NO writing, NO speech bubbles, NO logos, NO watermarks. Plain white or theme-colored background. Square 1:1 aspect ratio.`;

        const img = await callImageGeneration({ prompt, timeoutMs: 40000 });

        const costKRW = Math.ceil(img.costUSD * USD_TO_KRW);
        const { id: usageId } = await logAIUsage({
          userId, task: "edit",
          model: img.vendor === "cloudflare" ? "flux-1-schnell"
            : img.vendor === "gemini" ? "imagen-4-fast"
            : img.vendor === "openai" ? "gpt-image-1"
            : "pollinations-flux",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: img.costUSD, costKRW,
          durationMs: img.durationMs,
          projectId, chapterIdx: job.chapterIdx, status: "success",
        });

        if (costKRW > 0) {
          const r = await deductBalance({
            userId, amountKRW: costKRW, aiUsageId: usageId,
            reason: `${job.chapterIdx + 1}장 이미지 일괄 (${img.vendor})`,
          });
          newBalance = r.newBalance;
          totalCostKRW += costKRW;
        }

        // 챕터 images 배열에 추가
        const dataUrl = `data:image/png;base64,${img.base64}`;
        const ch = project.chapters[job.chapterIdx];
        const existingImages = ch.images ?? [];
        const updatedImages = [
          ...existingImages.filter((i: any) => i.placeholder !== job.placeholder),
          { placeholder: job.placeholder, dataUrl, caption: job.caption, alt: job.caption },
        ];
        const updatedChapters = [...project.chapters];
        updatedChapters[job.chapterIdx] = { ...ch, images: updatedImages };
        project = { ...project, chapters: updatedChapters };
        await updateProjectData(projectId, userId, project);

        generated += 1;
      } catch (e: any) {
        failed.push({
          chapterIdx: job.chapterIdx,
          placeholder: job.placeholder,
          message: e?.message?.slice(0, 200) || String(e).slice(0, 200),
        });
        await logAIUsage({
          userId, task: "edit", model: "imagen-4-fast",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0, costKRW: 0, durationMs: 0,
          projectId, chapterIdx: job.chapterIdx, status: "failed",
          errorMessage: e?.message?.slice(0, 500),
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      generated,
      totalCostKRW,
      newBalance,
      failed,
      remaining: Math.max(0, allJobs.length - batch.length + failed.length),
    });
  } catch (e: any) {
    console.error("[/api/book/[id]/generate-chapter-images] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

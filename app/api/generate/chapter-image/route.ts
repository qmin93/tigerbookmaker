// POST /api/generate/chapter-image
// body: { projectId, chapterIdx, placeholder }  ← placeholder = "[IMAGE: 캡션]"
// 응답: { ok, image: {placeholder, dataUrl, alt, caption}, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callImageGeneration, callAIServer, type AIModel } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`img:${userId}`, 20, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId, chapterIdx, placeholder } = await req.json().catch(() => ({}));
    if (!projectId || typeof chapterIdx !== "number" || !placeholder) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;
    const ch = project.chapters?.[chapterIdx];
    if (!ch) return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    // 잔액 사전 체크 — 이미지 1장 약 ₩30~60
    if (user.balance_krw < 100) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액이 부족합니다 (이미지 1장 약 ₩60 예상).`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    // placeholder에서 caption 추출
    const caption = placeholder.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "").trim();

    // 한국어 caption을 영어 image prompt로 변환
    // 모델 강제: gemini-flash-latest (사용자 tier와 무관하게 항상 한국어 잘 이해하는 모델 사용)
    // 이전엔 basic tier 사용자에게 Flash Lite가 적용되어 프롬프트 품질이 떨어졌음.
    let englishPrompt = caption;
    try {
      const promptResult = await callAIServer({
        model: "gemini-flash-latest",
        system: "You convert Korean illustration descriptions into specific, vivid English image generation prompts (for Imagen 4 / Flux). Focus on the actual visual subject — concrete people/objects/scenes, never the book medium itself. Be visually descriptive: mention specific colors, lighting, composition, mood. NEVER output words like 'book', 'document', 'page', 'reading', 'literature' unless the subject literally IS a book on a shelf.",
        user: `[BOOK CONTEXT — for theme understanding only, NEVER mention 'book' in your output]\nTopic: ${project.topic}\nGenre: ${(project as any).type ?? "unknown"}\nAudience: ${(project as any).audience ?? "general"}\n\n[ILLUSTRATION TO DRAW (Korean)]\n${caption}\n\n[YOUR TASK]\nWrite a single vivid English image prompt (60–100 words) for the actual visual subject described above. Include: specific subject, setting, lighting, color palette, composition, art style. Output ONLY the prompt as one line — no preamble, no quotes, no explanation.`,
        maxTokens: 400,
        temperature: 0.6,
        timeoutMs: 15000,
        retries: 1,
      });
      englishPrompt = promptResult.text.trim().replace(/^["']|["']$/g, "");
    } catch {
      // 번역 실패하면 한국어 caption 그대로 사용 (fallback) — 화질 떨어지지만 동작은 유지
    }

    const prompt = `${englishPrompt}. Editorial magazine illustration, clean modern composition, single clear focal subject, professional lighting, minimalist negative space. Style: Behance / Pinterest editorial design quality. STRICT: NO books, NO documents, NO papers, NO text of any kind, NO letters, NO numbers, NO Korean characters, NO English words, NO captions, NO labels, NO writing, NO speech bubbles, NO logos, NO watermarks. Plain white or theme-colored background. Square 1:1 aspect ratio.`;

    let img;
    try {
      img = await callImageGeneration({ prompt, timeoutMs: 45000 });
    } catch (e: any) {
      await logAIUsage({
        userId, task: "edit", model: "imagen-4-fast",
        inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        costUSD: 0, costKRW: 0, durationMs: 0,
        projectId, chapterIdx, status: "failed",
        errorMessage: e?.message?.slice(0, 500),
      }).catch(() => {});
      return NextResponse.json({ error: "IMAGE_FAILED", message: e?.message }, { status: 502 });
    }

    const costKRW = Math.ceil(img.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
      userId, task: "edit",
      model: img.vendor === "cloudflare" ? "flux-1-schnell" : img.vendor === "gemini" ? "imagen-4-fast" : img.vendor === "openai" ? "gpt-image-1" : "pollinations-flux",
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: img.costUSD, costKRW,
      durationMs: img.durationMs,
      projectId, chapterIdx, status: "success",
    });
    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `${chapterIdx + 1}장 이미지 (${img.vendor})`,
      });
      newBalance = r.newBalance;
    }

    // 챕터의 images 배열에 추가 (또는 같은 placeholder면 교체)
    const dataUrl = `data:image/png;base64,${img.base64}`;
    const newImage = {
      placeholder,
      dataUrl,
      caption,
      alt: caption,
    };
    const existingImages = ch.images ?? [];
    const updatedImages = [
      ...existingImages.filter((i: any) => i.placeholder !== placeholder),
      newImage,
    ];
    const updatedChapters = [...project.chapters];
    updatedChapters[chapterIdx] = { ...ch, images: updatedImages };
    await updateProjectData(projectId, userId, { ...project, chapters: updatedChapters });

    return NextResponse.json({
      ok: true,
      image: newImage,
      newBalance,
      costKRW,
    });
  } catch (e: any) {
    console.error("[/api/generate/chapter-image] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

// POST /api/generate/chapter-image
// body: { projectId, chapterIdx, placeholder }  ← placeholder = "[IMAGE: 캡션]"
// 응답: { ok, image: {placeholder, dataUrl, alt, caption}, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callImageGeneration, callAIServer, type AIModel } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
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

    // 한국어 caption을 영어 image prompt로 변환 (Pollinations Flux는 영어만 잘 처리)
    let englishPrompt = caption;
    try {
      const tier: Tier = (project as any).tier ?? "basic";
      const candidates = getModelChain(tier);
      if (candidates.length > 0) {
        const promptResult = await callAIServer({
          model: candidates[0],
          system: "You convert Korean book illustration descriptions into concise English Stable Diffusion prompts.",
          user: `Book topic: ${project.topic}\nKorean illustration request: ${caption}\n\nConvert to a single concise English Stable Diffusion prompt (one sentence, focus on visual subject + style). Output ONLY the English prompt, no explanation.`,
          maxTokens: 256,
          temperature: 0.5,
          timeoutMs: 10000,
          retries: 1,
        });
        englishPrompt = promptResult.text.trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // 번역 실패하면 한국어 caption 그대로 사용 (fallback)
    }

    const prompt = `${englishPrompt}, modern editorial book illustration style, clean minimal premium publishing aesthetic, single subject focus, no text, no captions, no labels, no people in frame unless specified, white or off-white background, square 1:1`;

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

// POST /api/generate/image-refine
// body: { projectId, imageType, currentPrompt?, feedback, aspectRatio? }
// Iterative refinement — 사용자 자연어 피드백 + 이전 prompt → 새 prompt → 새 이미지
// 응답: { ok, newImageBase64, newPrompt, costKRW, newBalance, vendor }

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/auth";
import { callImageGeneration, type AspectRatio } from "@/lib/server/ai-server";
import { generateImagePromptAI, type ImagePurpose } from "@/lib/server/image-prompt-ai";
import { getUser, getProject, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type RefineImageType =
  | "cover"
  | "meta-feed"
  | "meta-story"
  | "meta-link"
  | "infographic"
  | "video-frame";

const PURPOSE_MAP: Record<RefineImageType, ImagePurpose> = {
  "cover": "cover",
  "meta-feed": "meta-feed",
  "meta-story": "meta-story",
  "meta-link": "meta-link",
  "infographic": "infographic-card",
  "video-frame": "video-frame",
};

const AR_MAP: Record<RefineImageType, AspectRatio> = {
  "cover": "1:1",
  "meta-feed": "1:1",
  "meta-story": "9:16",
  "meta-link": "16:9",
  "infographic": "1:1",
  "video-frame": "9:16",
};

const THEME_MAP: Record<string, { hex: string; name: string }> = {
  orange: { hex: "#f97316", name: "warm orange" },
  blue: { hex: "#3b82f6", name: "deep blue" },
  green: { hex: "#10b981", name: "fresh emerald" },
  purple: { hex: "#a855f7", name: "rich violet" },
  red: { hex: "#ef4444", name: "vibrant red" },
  gray: { hex: "#6b7280", name: "neutral gray" },
};

const VALID_TYPES = new Set<RefineImageType>([
  "cover", "meta-feed", "meta-story", "meta-link", "infographic", "video-frame",
]);

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    // 분당 10회 — 대화형 refinement는 빈번 호출 가능
    const rl = rateLimit(`img-refine:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, imageType, currentPrompt, feedback, aspectRatio } = body as {
      projectId?: string;
      imageType?: RefineImageType;
      currentPrompt?: string;
      feedback?: string;
      aspectRatio?: AspectRatio;
    };

    if (!projectId || !imageType || !feedback) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    if (!VALID_TYPES.has(imageType)) {
      return NextResponse.json({ error: "INVALID_IMAGE_TYPE" }, { status: 400 });
    }
    if (typeof feedback !== "string" || feedback.trim().length < 3 || feedback.length > 500) {
      return NextResponse.json({ error: "INVALID_FEEDBACK", message: "피드백은 3~500자로 작성해주세요." }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const project = projectRow.data as any;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 50) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "재생성 약 ₩40 필요",
        current: user.balance_krw,
      }, { status: 402 });
    }

    // RAG context
    const ch1 = project?.chapters?.[0];
    const chapterExcerpt = ch1?.content ? String(ch1.content).slice(0, 300) : undefined;

    let referenceChunks: { content: string; filename: string }[] = [];
    try {
      const { rows } = await sql<{ content: string; filename: string }>`
        SELECT rc.content, br.filename
        FROM reference_chunks rc
        JOIN book_references br ON br.id = rc.reference_id
        WHERE br.project_id = ${projectId}
        LIMIT 2
      `;
      referenceChunks = rows.map(r => ({ content: r.content, filename: r.filename }));
    } catch {
      // ignore
    }

    const themeKey = (project?.themeColor as string | undefined) ?? "orange";
    const theme = THEME_MAP[themeKey] ?? THEME_MAP.orange;
    const ar: AspectRatio = aspectRatio ?? AR_MAP[imageType] ?? "1:1";

    // Generate new prompt with feedback
    const promptResult = await generateImagePromptAI({
      bookTopic: String(project?.topic ?? ""),
      bookAudience: String(project?.audience ?? ""),
      bookType: String(project?.type ?? ""),
      themeColorHex: theme.hex,
      themeColorName: theme.name,
      purpose: PURPOSE_MAP[imageType],
      aspectRatio: ar,
      chapterExcerpt,
      referenceChunks,
      feedback: feedback.trim(),
      previousPrompt: currentPrompt,
    });

    // Generate image
    const img = await callImageGeneration({
      prompt: promptResult.prompt,
      timeoutMs: 30000,
      preferPaid: true,
      aspectRatio: ar,
    });

    const imageCostKRW = Math.ceil(img.costUSD * USD_TO_KRW);
    const totalCostKRW = imageCostKRW + promptResult.costKRW;

    const log = await logAIUsage({
      userId, task: "edit",
      model: img.vendor === "cloudflare" ? "flux-1-schnell"
           : img.vendor === "gemini" ? "imagen-4-fast"
           : img.vendor === "openai" ? "gpt-image-1"
           : "pollinations-flux",
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: img.costUSD, costKRW: totalCostKRW,
      durationMs: img.durationMs,
      projectId, status: "success",
    });

    const r = totalCostKRW > 0
      ? await deductBalance({
          userId, amountKRW: totalCostKRW, aiUsageId: log.id,
          reason: `이미지 재생성 (${imageType})`,
        })
      : { newBalance: user.balance_krw };

    return NextResponse.json({
      ok: true,
      newImageBase64: img.base64,
      newPrompt: promptResult.prompt,
      costKRW: totalCostKRW,
      newBalance: r.newBalance,
      vendor: img.vendor,
    });
  } catch (e: any) {
    console.error("[/api/generate/image-refine] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

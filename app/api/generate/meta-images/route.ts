// POST /api/generate/meta-images
// body: { projectId, regenerateOnly?: ("feed"|"story"|"link")[] }
// 응답: { ok, images: [{ type, base64, aspectRatio, vendor }], newBalance, totalCostKRW }
//
// 3 비율 자동 생성 (Vercel 60s 한도 안에서 순차):
//  - feed:  1:1
//  - story: 9:16
//  - link:  16:9

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callImageGeneration, type AspectRatio } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type MetaImageType = "feed" | "story" | "link";

const TYPE_TO_AR: Record<MetaImageType, AspectRatio> = {
  feed: "1:1",
  story: "9:16",
  link: "16:9",
};

const ALL_TYPES: MetaImageType[] = ["feed", "story", "link"];

function metaImagePrompt(project: any, headline: string, type: MetaImageType): string {
  const layout = type === "story" ? "세로 (9:16)" : type === "link" ? "가로 (16:9)" : "정사각 (1:1)";
  return `한국어 책 광고 이미지. ${layout} 배경. 책 표지 컨셉.

[책 정보]
- 주제: ${project.topic}
- 대상: ${project.audience}
- 유형: ${project.type}

[강조 텍스트 — 가독성 높게 큰 글자로]
"${headline}"

[디자인 가이드]
- 깔끔한 모던 디자인
- 한국어 글자 정확하게 표시
- 책 광고임을 즉시 알 수 있게
- 색상: 따뜻한 톤 또는 책 표지 색상`;
}

function buildHeadline(project: any): string {
  const tagline = project?.marketingMeta?.tagline;
  if (typeof tagline === "string" && tagline.trim().length > 0) return tagline.trim();
  // fallback — 주제 기반 단순 헤드라인
  const topic = String(project?.topic ?? "").trim() || "당신을 위한 책";
  return topic.length > 30 ? topic.slice(0, 28) + "…" : topic;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`meta-img:${userId}`, 3, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, regenerateOnly } = body as {
      projectId?: string;
      regenerateOnly?: MetaImageType[];
    };
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    // Imagen 4 Fast ~₩28/장 × 3 = ~₩90. 잔액 사전 체크.
    if (user.balance_krw < 100) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액이 부족합니다 (Meta 광고 이미지 3장 약 ₩90 필요).",
        current: user.balance_krw,
      }, { status: 402 });
    }

    // 생성할 type 결정 (regenerateOnly 지정되면 그것만, 아니면 전부)
    const targets: MetaImageType[] = (regenerateOnly && regenerateOnly.length > 0)
      ? regenerateOnly.filter((t): t is MetaImageType => ALL_TYPES.includes(t as MetaImageType))
      : ALL_TYPES;

    if (targets.length === 0) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "생성할 type이 없습니다." }, { status: 400 });
    }

    const headline = buildHeadline(project);

    let totalCostKRW = 0;
    const newImages: Array<{
      type: MetaImageType;
      aspectRatio: AspectRatio;
      base64: string;
      vendor: string;
      generatedAt: number;
    }> = [];

    // 순차 생성 (Vercel 60s — 3장 × ~10s = ~30s)
    for (const type of targets) {
      const ar = TYPE_TO_AR[type];
      try {
        const img = await callImageGeneration({
          prompt: metaImagePrompt(project, headline, type),
          timeoutMs: 30000,
          preferPaid: true,    // 한국어 글자 가독성 — Imagen 4 Fast 우선
          aspectRatio: ar,
        });
        const costKRW = Math.ceil(img.costUSD * USD_TO_KRW);
        totalCostKRW += costKRW;

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
          projectId, status: "success",
        });
        if (costKRW > 0) {
          await deductBalance({
            userId, amountKRW: costKRW, aiUsageId: usageId,
            reason: `Meta 광고 ${type} ${ar} (${img.vendor})`,
          });
        }
        newImages.push({
          type, aspectRatio: ar, base64: img.base64, vendor: img.vendor,
          generatedAt: Date.now(),
        });
      } catch (e: any) {
        await logAIUsage({
          userId, task: "edit", model: "image-generation",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0, costKRW: 0, durationMs: 0,
          projectId, status: "failed",
          errorMessage: `meta-img-${type}: ${e?.message?.slice(0, 400)}`,
        }).catch(() => {});
      }
    }

    // 기존 이미지 배열과 병합 (regenerateOnly: 같은 type만 교체)
    const existingImages: any[] = Array.isArray((project as any).metaAdImages)
      ? (project as any).metaAdImages
      : [];
    const replacedTypes = new Set(newImages.map(i => i.type));
    const mergedImages = [
      ...existingImages.filter((i: any) => !replacedTypes.has(i.type)),
      ...newImages,
    ];

    await updateProjectData(projectId, userId, { ...project, metaAdImages: mergedImages });

    const refreshedUser = await getUser(userId);
    return NextResponse.json({
      ok: true,
      images: newImages,
      newBalance: refreshedUser?.balance_krw ?? user.balance_krw - totalCostKRW,
      totalCostKRW,
      generatedTypes: newImages.map(i => i.type),
      failedTypes: targets.filter(t => !newImages.find(i => i.type === t)),
    });
  } catch (e: any) {
    console.error("[/api/generate/meta-images] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

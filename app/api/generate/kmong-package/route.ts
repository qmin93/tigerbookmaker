// POST /api/generate/kmong-package
// body: { projectId, regenerateOnly?: KmongImageType[] }
// 응답: { ok, kmongPackage, newBalance, totalCostKRW, generatedTypes, failedTypes }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callImageGeneration, callAIServer, type AIModel } from "@/lib/server/ai-server";
import {
  imagePrompt, copyPrompt,
  type KmongImageType, type KmongCopy,
} from "@/lib/server/kmong-prompts";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// 가격 정책 (Sang-nim 10x 인상, 2026-05): 표지·썸네일·목차·스펙 이미지 ₩400/장, 카피 5종 ₩500 고정
const FIXED_COST_PER_IMAGE_KRW = 400;
const FIXED_COST_COPY_KRW = 500;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`kmong:${userId}`, 3, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, regenerateOnly, regenerateCopyOnly, dryRun } = body as {
      projectId?: string;
      regenerateOnly?: KmongImageType[];
      regenerateCopyOnly?: boolean;
      dryRun?: boolean;  // true면 DB 저장 X, base64만 응답 (표지 후보 5장 비교용)
    };
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    // Vercel 60s 한도 회피 — frontend가 한 type씩 호출.
    // regenerateCopyOnly: 이미지 안 만들고 카피만.
    const imageTypes: KmongImageType[] = regenerateCopyOnly
      ? []
      : regenerateOnly && regenerateOnly.length > 0
      ? regenerateOnly
      : [];

    // 새 가격 정책: 이미지 ₩400/장, 카피 ₩500. 최소 카피 1회 또는 이미지 1장 가능한 잔액 요구.
    const minRequired = Math.min(FIXED_COST_PER_IMAGE_KRW, FIXED_COST_COPY_KRW);
    if (user.balance_krw < minRequired) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액이 부족합니다 (이미지 ₩${FIXED_COST_PER_IMAGE_KRW}/장, 카피 ₩${FIXED_COST_COPY_KRW}).`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    let totalCostKRW = 0;
    const newImages: any[] = [];

    // 6 이미지 생성 (순차 — Vercel function 60s 한도 안에서)
    // cover/thumb/toc/spec — 한국어 글자·로고가 중요 → Imagen 4 Fast 우선 (Gemini paid, ₩28/장)
    // audience/preview — 분위기 사진·일러스트 → Cloudflare 무료 우선
    const PAID_TYPES = new Set<KmongImageType>(["cover", "thumb", "toc", "spec"]);
    for (const type of imageTypes) {
      try {
        const img = await callImageGeneration({
          prompt: imagePrompt(type, project),
          timeoutMs: 30000,
          preferPaid: PAID_TYPES.has(type),
        });
        // 새 가격 정책: 이미지 ₩400/장 고정 (raw API cost는 cost_usd로만 기록)
        const costKRW = FIXED_COST_PER_IMAGE_KRW;
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
            reason: `크몽 ${type} (${img.vendor})`,
          });
        }
        newImages.push({
          type, base64: img.base64, vendor: img.vendor,
          generatedAt: Date.now(),
        });
      } catch (e: any) {
        await logAIUsage({
          userId, task: "edit", model: "image-generation",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0, costKRW: 0, durationMs: 0,
          projectId, status: "failed",
          errorMessage: `kmong-${type}: ${e?.message?.slice(0, 400)}`,
        }).catch(() => {});
      }
    }

    // 카피 생성 — regenerateOnly(이미지만)일 때는 skip. regenerateCopyOnly 또는 둘 다 없을 때만.
    let copy: KmongCopy | null = (project as any).kmongPackage?.copy ?? null;
    if (!regenerateOnly || regenerateCopyOnly) {
      const tier: Tier = (project as any).tier ?? "basic";
      const candidates = getModelChain(tier);
      if (candidates.length > 0) {
        try {
          const copyResult = await callAIServer({
            model: candidates[0],
            system: "당신은 크몽·인스타·SNS 한국어 카피라이터입니다. 광고 톤이지만 과장 없이.",
            user: copyPrompt(project),
            maxTokens: 2048,
            temperature: 0.7,
            timeoutMs: 30000,
          });
          let txt = copyResult.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
          const parsed = JSON.parse(txt) as KmongCopy;
          if (typeof parsed.kmongDescription === "string" && Array.isArray(parsed.kmongHighlights)) {
            copy = parsed;
            // 새 가격 정책: 카피 5종 ₩500 고정 (raw API cost는 cost_usd로만 기록)
            const copyCostKRW = FIXED_COST_COPY_KRW;
            totalCostKRW += copyCostKRW;
            const { id: copyUsageId } = await logAIUsage({
              userId, task: "edit", model: candidates[0],
              ...copyResult.usage, costKRW: copyCostKRW,
              projectId, status: "success",
            });
            await deductBalance({
              userId, amountKRW: copyCostKRW, aiUsageId: copyUsageId,
              reason: `크몽 카피 5종 (${candidates[0]})`,
            });
          }
        } catch (e: any) {
          await logAIUsage({
            userId, task: "edit", model: "copy-generation",
            inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
            cacheReadTokens: 0, cacheWriteTokens: 0,
            costUSD: 0, costKRW: 0, durationMs: 0,
            projectId, status: "failed", errorMessage: `kmong-copy: ${e?.message?.slice(0, 400)}`,
          }).catch(() => {});
        }
      }
    }

    // dryRun: DB 저장 안 함, 새 이미지/카피만 응답 (표지 후보 5장 비교용)
    if (dryRun) {
      const refreshedUserDry = await getUser(userId);
      return NextResponse.json({
        ok: true,
        dryRun: true,
        newImages,
        copy,
        newBalance: refreshedUserDry?.balance_krw ?? user.balance_krw - totalCostKRW,
        totalCostKRW,
      });
    }

    // 기존 패키지와 병합
    const existingImages: any[] = (project as any).kmongPackage?.images ?? [];
    const mergedImages = regenerateOnly
      ? [...existingImages.filter((i: any) => !regenerateOnly.includes(i.type)), ...newImages]
      : newImages;

    const updatedPackage = {
      images: mergedImages,
      copy: copy ?? {
        kmongDescription: "", kmongHighlights: [], instagram: "", kakao: "", twitter: "",
        blogReview: "", youtubeDescription: "", naverCafe: "",
      },
      generatedAt: Date.now(),
      totalCostKRW: ((project as any).kmongPackage?.totalCostKRW ?? 0) + totalCostKRW,
    };

    await updateProjectData(projectId, userId, { ...project, kmongPackage: updatedPackage });

    const refreshedUser = await getUser(userId);
    return NextResponse.json({
      ok: true,
      kmongPackage: updatedPackage,
      newBalance: refreshedUser?.balance_krw ?? user.balance_krw - totalCostKRW,
      totalCostKRW,
      generatedTypes: newImages.map(i => i.type),
      failedTypes: imageTypes.filter(t => !newImages.find(i => i.type === t)),
    });
  } catch (e: any) {
    console.error("[/api/generate/kmong-package] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

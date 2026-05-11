// POST /api/generate/cover-overlay
// 후킹 카피를 표지 이미지에 텍스트로 합성 (Sharp + Pretendard).
// body: { projectId, headline, subhead?, template? }
// 효과: kmongPackage.images cover에 합성된 결과 저장 + project 갱신.
// 비용: ₩50 (Sharp만 — AI 호출 X)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { overlayTextOnImage, type OverlayTemplate } from "@/lib/server/image-overlay";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const FIXED_COST_KRW = 50;
const VALID_TEMPLATES: OverlayTemplate[] = ["minimal", "bold", "story", "quote", "cta"];

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`cover-overlay:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const projectId = String((body as any)?.projectId ?? "");
    const headline = String((body as any)?.headline ?? "").trim().slice(0, 80);
    const subhead = (body as any)?.subhead ? String((body as any).subhead).trim().slice(0, 100) : undefined;
    const tplRaw = (body as any)?.template;
    const template: OverlayTemplate = VALID_TEMPLATES.includes(tplRaw) ? tplRaw : "bold";

    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (!headline) return NextResponse.json({ error: "INVALID_INPUT", message: "헤드라인 필수" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project: any = projectRow.data;

    // 현재 cover 찾기 — kmongPackage 또는 coverVariations 첫 장
    let baseBase64: string | undefined;
    let coverIdx = -1;
    const kImages = project.kmongPackage?.images;
    if (Array.isArray(kImages)) {
      coverIdx = kImages.findIndex((i: any) => i.type === "cover");
      if (coverIdx >= 0) baseBase64 = kImages[coverIdx].base64;
    }
    if (!baseBase64 && Array.isArray(project.coverVariations) && project.coverVariations[0]) {
      baseBase64 = project.coverVariations[0].base64;
    }
    if (!baseBase64) {
      return NextResponse.json({
        error: "NO_COVER",
        message: "먼저 표지를 생성해주세요. (writing 탭 → 표지 다양화)",
      }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < FIXED_COST_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (₩${FIXED_COST_KRW.toLocaleString()} 필요)`,
        shortfall: FIXED_COST_KRW - user.balance_krw,
      }, { status: 402 });
    }

    // Sharp 합성 (1024x1024 표지 가정 — Imagen 4 Fast 출력 크기)
    let composedBase64: string;
    try {
      composedBase64 = await overlayTextOnImage({
        imageBase64: baseBase64,
        width: 1024,
        height: 1024,
        headline,
        subhead,
        template,
        brandText: " ",  // 표지엔 워터마크 X
      });
    } catch (e: any) {
      console.error("[cover-overlay] sharp failed:", e?.message);
      return NextResponse.json({
        error: "OVERLAY_FAILED",
        message: `합성 실패: ${e?.message ?? "unknown"}`,
      }, { status: 500 });
    }

    // 저장 — kmongPackage.images cover 자리 업데이트 (없으면 새로 추가)
    const newKImages = Array.isArray(kImages) ? [...kImages] : [];
    const coverEntry = {
      type: "cover" as const,
      base64: composedBase64,
      vendor: "sharp-overlay",
      generatedAt: Date.now(),
    };
    if (coverIdx >= 0) {
      newKImages[coverIdx] = { ...newKImages[coverIdx], ...coverEntry };
    } else {
      newKImages.push(coverEntry);
    }
    const newKmongPackage = {
      ...(project.kmongPackage ?? {}),
      images: newKImages,
    };
    // copy 필드가 없으면 빈 객체로 (kmongPackage type 호환)
    if (!newKmongPackage.copy) {
      newKmongPackage.copy = (project.kmongPackage?.copy) ?? {
        kmongDescription: "",
        kmongHighlights: [],
        instagram: "",
        kakao: "",
        twitter: "",
      };
    }
    if (!newKmongPackage.generatedAt) newKmongPackage.generatedAt = Date.now();
    if (typeof newKmongPackage.totalCostKRW !== "number") newKmongPackage.totalCostKRW = 0;

    await updateProjectData(projectId, userId, {
      ...project,
      kmongPackage: newKmongPackage,
    });

    // 비용 차감
    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: "sharp-overlay",
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: 0, costKRW: FIXED_COST_KRW,
      durationMs: 0, projectId, status: "success",
    });
    const { newBalance } = await deductBalance({
      userId, amountKRW: FIXED_COST_KRW, aiUsageId: usageId,
      reason: `표지 텍스트 합성 (${template})`,
    });

    return NextResponse.json({
      ok: true,
      coverBase64: composedBase64,
      newBalance,
      costKRW: FIXED_COST_KRW,
    });
  } catch (e: any) {
    console.error("[/api/generate/cover-overlay] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

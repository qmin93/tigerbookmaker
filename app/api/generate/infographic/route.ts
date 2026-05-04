// POST /api/generate/infographic
// body: { projectId, template?: "minimal" | "bold" | "dark" }
// 응답: { ok, infographics: [{ slideNum, base64 }], newBalance, costKRW }
//
// referencesSummary.keyPoints (Phase 2에서 만든 5 핵심)을 활용해
// 1080x1080 PNG 5장 자동 생성. Sharp만 사용 — AI 호출 X. ~₩50 (compute fee).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { generateInfographicCard, type InfographicTemplate } from "@/lib/server/image-overlay";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_TEMPLATES: InfographicTemplate[] = ["minimal", "bold", "dark"];
const COST_KRW = 50;          // Sharp만 사용 — compute fee
const MIN_BALANCE_KRW = 50;
const TARGET_SLIDES = 5;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`infographic:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, template: templateRaw } = body as { projectId?: string; template?: string };
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const template: InfographicTemplate = VALID_TEMPLATES.includes(templateRaw as InfographicTemplate)
      ? (templateRaw as InfographicTemplate)
      : "bold";

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    // referencesSummary.keyPoints 필요 (Phase 2)
    const keyPoints: string[] = Array.isArray(project?.referencesSummary?.keyPoints)
      ? project.referencesSummary.keyPoints.filter((s: any) => typeof s === "string" && s.trim().length > 0)
      : [];
    if (keyPoints.length === 0) {
      return NextResponse.json({
        error: "MISSING_KEYPOINTS",
        message: "/write/setup에서 'AI가 자료 정리하기'를 먼저 실행하세요. (referencesSummary.keyPoints 필요)",
      }, { status: 400 });
    }

    // 잔액 사전 체크
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < MIN_BALANCE_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (~₩${COST_KRW} 필요)`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    // 5장 메시지 결정 (keyPoints 5개 우선, 부족하면 padding)
    const messages: string[] = [];
    for (let i = 0; i < TARGET_SLIDES; i++) {
      const kp = keyPoints[i];
      if (kp) {
        messages.push(kp);
      } else {
        // keyPoints 부족 시 "더 자세히는 책에서" placeholder
        messages.push(`더 자세히는 책 본문에서 →`);
      }
    }

    const bookTitle = String(project?.marketingMeta?.tagline ?? project?.topic ?? "책").trim() || "책";

    const t0 = Date.now();
    const slides: { slideNum: number; base64: string }[] = [];
    const failures: number[] = [];

    for (let i = 0; i < TARGET_SLIDES; i++) {
      try {
        const base64 = await generateInfographicCard({
          slideNum: i + 1,
          totalSlides: TARGET_SLIDES,
          message: messages[i],
          bookTitle,
          template,
        });
        slides.push({ slideNum: i + 1, base64 });
      } catch (e: any) {
        console.warn(`[infographic] slide ${i + 1} 실패:`, e?.message);
        failures.push(i + 1);
      }
    }

    if (slides.length === 0) {
      return NextResponse.json({
        error: "GENERATE_FAILED",
        message: "5장 모두 생성 실패",
      }, { status: 500 });
    }

    // log + deduct (Sharp compute fee)
    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: "sharp-infographic",
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: 0, costKRW: COST_KRW,
      durationMs: Date.now() - t0,
      projectId, status: "success",
    });
    const { newBalance } = await deductBalance({
      userId, amountKRW: COST_KRW, aiUsageId: usageId,
      reason: `카드뉴스 인포그래픽 ${slides.length}장 (${template})`,
    });

    // DB 저장
    const infographic = {
      template,
      slides,
      generatedAt: Date.now(),
    };
    await updateProjectData(projectId, userId, { ...project, infographic });

    return NextResponse.json({
      ok: true,
      infographics: slides,
      template,
      newBalance,
      costKRW: COST_KRW,
      failedSlides: failures,
    });
  } catch (e: any) {
    console.error("[/api/generate/infographic] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

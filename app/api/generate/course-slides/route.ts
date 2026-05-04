// POST /api/generate/course-slides
// body: { projectId, slideCount?: 8|12|16|20, template?: "minimal"|"bold"|"academic", renderImages?: boolean }
// 응답: { ok, courseSlides, totalCostKRW, newBalance }
//
// 책 본문 → 강사·코치용 강의 슬라이드 outline (10~20장).
// renderImages=true면 각 slide에 1920x1080 PNG 추가 (Sharp 비용 ~₩10/slide).
// 기본은 outline만 생성 (~₩40 AI cost).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { courseSlidesPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import { generateCourseSlide, type CourseSlideTemplate } from "@/lib/server/image-overlay";
import type { CourseSlide } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TEMPLATES: CourseSlideTemplate[] = ["minimal", "bold", "academic"];
const VALID_COUNTS = [8, 12, 16, 20] as const;
// 가격 정책 (Sang-nim 10x 인상, 2026-05): 강의 슬라이드 12장 전체 패키지 ₩2,000 (PNG render 포함)
const FIXED_COST_KRW = 2000;
const MIN_BALANCE_KRW = 2000;
const RENDER_COST_PER_SLIDE_KRW = 0; // PNG render 비용은 ₩2,000 패키지에 포함

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = rateLimit(`course-slides:${userId}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      projectId,
      slideCount: slideCountRaw,
      template: templateRaw,
      renderImages: renderImagesRaw,
    } = body as {
      projectId?: string;
      slideCount?: number;
      template?: string;
      renderImages?: boolean;
    };

    if (!projectId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const slideCount: number = (VALID_COUNTS as readonly number[]).includes(Number(slideCountRaw))
      ? Number(slideCountRaw)
      : 12;
    const template: CourseSlideTemplate = VALID_TEMPLATES.includes(templateRaw as CourseSlideTemplate)
      ? (templateRaw as CourseSlideTemplate)
      : "minimal";
    const renderImages = renderImagesRaw === true;

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const project = projectRow.data;

    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    if (chapters.length === 0) {
      return NextResponse.json({
        error: "NO_CHAPTERS",
        message: "강의 슬라이드 생성 전 챕터를 먼저 작성하세요.",
      }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }
    if (user.balance_krw < MIN_BALANCE_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (강의 슬라이드 ₩${FIXED_COST_KRW.toLocaleString()} 필요)`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });
    }

    const promptText = courseSlidesPrompt(project as any, slideCount);

    let aiResult: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        aiResult = await callAIServer({
          model: candidate,
          system: "당신은 한국어 강의 슬라이드 디자이너입니다. 한국어 JSON만 출력합니다.",
          user: promptText,
          maxTokens: 6144,
          temperature: 0.6,
          timeoutMs: 30000,
          retries: 0,
        });
        actualModel = candidate;
        break;
      } catch (e: any) {
        lastError = e;
        const msg = String(e?.message ?? "");
        const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|시간 초과|429|quota/i.test(msg);
        if (!transient) {
          return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
        }
      }
    }
    if (!aiResult) {
      return NextResponse.json({
        error: "AI_CALL_FAILED",
        message: lastError?.message ?? "all candidates failed",
      }, { status: 502 });
    }

    let parsed: any;
    try {
      const txt = aiResult.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({
        error: "INVALID_AI_OUTPUT",
        raw: aiResult.text.slice(0, 500),
      }, { status: 502 });
    }

    const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
    const slides: CourseSlide[] = rawSlides
      .slice(0, slideCount)
      .map((s: any, i: number): CourseSlide => ({
        slideNum: Number.isFinite(Number(s?.slideNum)) ? Number(s.slideNum) : i + 1,
        title: String(s?.title ?? "").slice(0, 80),
        bullets: (Array.isArray(s?.bullets) ? s.bullets : [])
          .slice(0, 5)
          .map((b: any) => String(b ?? "").slice(0, 80))
          .filter((b: string) => b.length > 0),
        notes: s?.notes ? String(s.notes).slice(0, 800) : undefined,
      }))
      .filter((s: CourseSlide) => s.title.length > 0);

    if (slides.length === 0) {
      return NextResponse.json({
        error: "INSUFFICIENT_OUTPUT",
        message: "AI가 슬라이드를 생성하지 못함",
      }, { status: 502 });
    }

    // 새 가격 정책: 강의 슬라이드 ₩2,000 전체 패키지 (PNG render 포함). raw API cost는 cost_usd로만.
    const aiCostKRW = FIXED_COST_KRW;
    let renderCostKRW = 0;

    // PNG 렌더 (옵션)
    const bookTitle = String(
      (project as any)?.marketingMeta?.tagline ?? project?.topic ?? "책",
    ).trim() || "책";

    if (renderImages) {
      const renderFailures: number[] = [];
      for (let i = 0; i < slides.length; i++) {
        try {
          const png = await generateCourseSlide({
            slideNum: slides[i].slideNum,
            totalSlides: slides.length,
            title: slides[i].title,
            bullets: slides[i].bullets,
            bookTitle,
            template,
          });
          slides[i].pngBase64 = png;
        } catch (e: any) {
          console.warn(`[course-slides] slide ${slides[i].slideNum} render fail:`, e?.message);
          renderFailures.push(slides[i].slideNum);
        }
      }
      const successCount = slides.length - renderFailures.length;
      renderCostKRW = successCount * RENDER_COST_PER_SLIDE_KRW;
    }

    const totalCostKRW = aiCostKRW + renderCostKRW;

    const courseSlides = {
      template,
      slides,
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, {
      ...project,
      courseSlides,
    });

    const log = await logAIUsage({
      userId, task: "edit", model: actualModel,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      thoughtsTokens: aiResult.usage.thoughtsTokens,
      cacheReadTokens: aiResult.usage.cacheReadTokens,
      cacheWriteTokens: aiResult.usage.cacheWriteTokens,
      costUSD: aiResult.usage.costUSD, costKRW: totalCostKRW,
      durationMs: aiResult.usage.durationMs,
      projectId, status: "success",
    });

    let newBalance = user.balance_krw;
    if (totalCostKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: totalCostKRW, aiUsageId: log.id,
        reason: `강의 슬라이드 ${slides.length}장 (${template})${renderImages ? " +PNG" : ""}`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({
      ok: true,
      courseSlides,
      totalCostKRW,
      aiCostKRW,
      renderCostKRW,
      newBalance,
    });
  } catch (e: any) {
    console.error("[/api/generate/course-slides] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

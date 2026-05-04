// POST /api/generate/cover-variations
// body: { projectId, count?: 3 } (default 3, max 5)
// 같은 책 정보로 N개 다른 스타일 표지 생성. 사용자 선택 전까진 메인 cover로 안 들어감.
// 응답: { ok, variations: [{ idx, style, base64, vendor, prompt }], totalCostKRW, newBalance }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callImageGeneration } from "@/lib/server/ai-server";
import { coverPrompt } from "@/lib/server/kmong-prompts";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// 5종 스타일 변형 — 동일 책정보·동일 themeColor + 다른 컴포지션/시점
const STYLE_VARIANTS: { label: string; hint: string }[] = [
  {
    label: "Minimalist",
    hint: "[STYLE: Minimalist editorial] single bold geometric element centered, lots of whitespace, gallery aesthetic, subtle shadow.",
  },
  {
    label: "Bold",
    hint: "[STYLE: Bold typography-style composition] large abstract shape filling most of the frame, dramatic high-contrast, magazine cover energy.",
  },
  {
    label: "Photorealistic",
    hint: "[STYLE: Photorealistic atmospheric] soft natural lighting, mood-setting scene related to the topic, depth of field, editorial photography aesthetic.",
  },
  {
    label: "Painterly",
    hint: "[STYLE: Painterly illustration] hand-painted brush textures, layered washes, expressive but calm, contemporary illustrator aesthetic.",
  },
  {
    label: "Geometric",
    hint: "[STYLE: Geometric pattern] crisp shapes in repeating asymmetric layout, bauhaus-inspired, flat design with subtle gradients.",
  },
];

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    // 분당 2회 — 표지 다양화는 한 번에 N장 호출이라 빈번 호출 방지
    const rl = rateLimit(`cover-var:${userId}`, 2, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId } = body as { projectId?: string };
    const rawCount = Number((body as any)?.count);
    const count = Math.max(1, Math.min(5, Number.isFinite(rawCount) ? Math.floor(rawCount) : 3));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data as any;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    // 사전 비용 체크 — Imagen 4 Fast 1장 ≈ ₩28
    const estimatedKRW = count * 35; // 여유 마진
    if (user.balance_krw < estimatedKRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (예상 ₩${estimatedKRW} 필요).`,
        current: user.balance_krw,
      }, { status: 402 });
    }

    let totalCostKRW = 0;
    const variations: any[] = [];
    const failed: { idx: number; reason: string }[] = [];

    for (let i = 0; i < count; i++) {
      const style = STYLE_VARIANTS[i % STYLE_VARIANTS.length];
      const prompt = coverPrompt(project, style.hint);
      try {
        // preferPaid: Imagen 4 Fast — 한국어 글자 없는 추상이라 가장 안정.
        const img = await callImageGeneration({
          prompt,
          timeoutMs: 30000,
          preferPaid: true,
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
            reason: `표지 다양화 v${i + 1} ${style.label} (${img.vendor})`,
          });
        }

        variations.push({
          idx: i,
          style: style.label,
          base64: img.base64,
          vendor: img.vendor,
          prompt,
          generatedAt: Date.now(),
        });
      } catch (e: any) {
        failed.push({ idx: i, reason: String(e?.message ?? e).slice(0, 200) });
        await logAIUsage({
          userId, task: "edit", model: "image-generation",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0, costKRW: 0, durationMs: 0,
          projectId, status: "failed",
          errorMessage: `cover-variation-${i}: ${e?.message?.slice(0, 400)}`,
        }).catch(() => {});
      }
    }

    // 저장 — 메인 cover 안 건드림. data.coverVariations에만.
    if (variations.length > 0) {
      await updateProjectData(projectId, userId, {
        ...project,
        coverVariations: variations,
      });
    }

    const refreshedUser = await getUser(userId);
    return NextResponse.json({
      ok: variations.length > 0,
      variations,
      failed,
      totalCostKRW,
      newBalance: refreshedUser?.balance_krw ?? user.balance_krw - totalCostKRW,
    });
  } catch (e: any) {
    console.error("[/api/generate/cover-variations] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

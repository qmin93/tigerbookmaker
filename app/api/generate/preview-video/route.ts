// POST /api/generate/preview-video
// body: { projectId }
// 응답: { ok, frames: [{ idx, template, base64 }], newBalance, costKRW }
//
// Wave B6: 챕터 1 첫 1500자 발췌 → 1080x1920 (9:16) PNG 5장.
//   frame 0: cover (책 제목 + tagline)
//   frame 1~3: excerpt (챕터 1 본문 일부 발췌)
//   frame 4: cta ("전체 보기 →")
// FFmpeg 없이 frame 시퀀스만 — 사용자가 본인 영상 편집기에서 1분 영상 조립.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { generateVideoFrame } from "@/lib/server/image-overlay";

export const runtime = "nodejs";
export const maxDuration = 30;

const COST_KRW = 30;          // Sharp만 사용 — compute fee
const MIN_BALANCE_KRW = 30;
const TOTAL_FRAMES = 5;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = rateLimit(`preview-video:${userId}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });
    }

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const project = projectRow.data ?? {};

    // 챕터 1 본문 필요
    const ch1 = (project.chapters ?? [])[0];
    const ch1Content = String(ch1?.content ?? "").trim();
    if (!ch1Content) {
      return NextResponse.json({
        error: "MISSING_CHAPTER_CONTENT",
        message: "챕터 1 본문이 필요합니다 — 먼저 챕터를 집필하세요.",
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

    const bookTitle = String(project.topic ?? "책").trim() || "책";
    const tagline = String(project.marketingMeta?.tagline ?? "").trim();

    // 첫 1500자 발췌 → 3 균등 분할 (excerpt frame 1~3 — frame idx 1,2,3).
    // [IMAGE: ...] placeholder 제거.
    const cleaned = ch1Content
      .replace(/\[IMAGE:[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
    const excerptParts = splitInto(cleaned, 3).map(s => firstSentence(s, 80));

    // 5 frames 명세
    const specs: { idx: number; template: "cover" | "excerpt" | "cta"; text: string }[] = [
      { idx: 0, template: "cover", text: tagline || bookTitle },
      { idx: 1, template: "excerpt", text: excerptParts[0] ?? "" },
      { idx: 2, template: "excerpt", text: excerptParts[1] ?? "" },
      { idx: 3, template: "excerpt", text: excerptParts[2] ?? "" },
      { idx: 4, template: "cta", text: "전체 보기 →" },
    ];

    const t0 = Date.now();
    const frames: { idx: number; template: string; base64: string }[] = [];
    const failures: number[] = [];

    for (const spec of specs) {
      try {
        const base64 = await generateVideoFrame({
          frameIdx: spec.idx,
          totalFrames: TOTAL_FRAMES,
          text: spec.text,
          template: spec.template,
          bookTitle,
        });
        frames.push({ idx: spec.idx, template: spec.template, base64 });
      } catch (e: any) {
        console.warn(`[preview-video] frame ${spec.idx} 실패:`, e?.message);
        failures.push(spec.idx);
      }
    }

    if (frames.length === 0) {
      return NextResponse.json({
        error: "GENERATE_FAILED",
        message: "frame 모두 생성 실패",
      }, { status: 500 });
    }

    // log + deduct (Sharp compute fee)
    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: "sharp-preview-video",
      inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0,
      costUSD: 0, costKRW: COST_KRW,
      durationMs: Date.now() - t0,
      projectId, status: "success",
    });
    const { newBalance } = await deductBalance({
      userId, amountKRW: COST_KRW, aiUsageId: usageId,
      reason: `미리보기 영상 frame ${frames.length}장`,
    });

    // DB 저장
    const previewVideo = {
      frames,
      generatedAt: Date.now(),
    };
    await updateProjectData(projectId, userId, { ...project, previewVideo });

    return NextResponse.json({
      ok: true,
      frames,
      newBalance,
      costKRW: COST_KRW,
      failedFrames: failures,
    });
  } catch (e: any) {
    console.error("[/api/generate/preview-video] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

// 텍스트 N등분
function splitInto(text: string, parts: number): string[] {
  const len = Math.ceil(text.length / parts);
  const out: string[] = [];
  for (let i = 0; i < parts; i++) {
    out.push(text.slice(i * len, (i + 1) * len));
  }
  return out;
}

// 첫 문장 (또는 maxChars까지) — 한국어 .,!?。 기준
function firstSentence(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  // 첫 문장 끝 찾기
  const m = trimmed.match(/[.!?。][^.!?。]*$/);
  let candidate = trimmed;
  if (m && m.index !== undefined && m.index + 1 < maxChars) {
    candidate = trimmed.slice(0, m.index + 1);
  }
  if (candidate.length > maxChars) {
    candidate = candidate.slice(0, maxChars - 1) + "…";
  }
  return candidate;
}

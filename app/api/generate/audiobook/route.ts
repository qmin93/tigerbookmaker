// POST /api/generate/audiobook
// body: { projectId, chapterIdx?: number, regenerateAll?: boolean }
// chapterIdx 있으면 해당 챕터만 / 없고 regenerateAll=true면 전체 / 둘 다 없으면 빈 챕터만
// 응답: { ok, audiobook, newBalance, totalCostKRW }
//
// Vercel 60s timeout 때문에 한 번에 12 챕터 다 못 할 수도 있음 →
// 프론트엔드에서 chapterIdx 지정해 한 챕터씩 순차 호출 권장.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ttsKorean } from "@/lib/server/tts";
import {
  getProject,
  updateProjectData,
  getUser,
  deductBalance,
  logAIUsage,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// 챕터당 비용 (Gemini TTS, ~1500자 본문 기준 — 추정).
// 실제 Gemini TTS pricing은 token 기반이지만 일단 고정값으로 청구.
const COST_PER_CHAPTER_KRW = 50;
const COST_USD_PER_CHAPTER = 0.04;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = rateLimit(`tts:${userId}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "RATE_LIMITED", resetIn: rl.resetIn },
        { status: 429 },
      );
    }

    const { projectId, chapterIdx, regenerateAll } = await req
      .json()
      .catch(() => ({}));
    if (!projectId) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const project = projectRow.data;
    const chapters: any[] = project.chapters ?? [];

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    // 처리할 챕터 결정
    const existing: any[] = project.audiobook?.chapters ?? [];
    let targetIdxs: number[];
    if (typeof chapterIdx === "number") {
      targetIdxs = [chapterIdx];
    } else if (regenerateAll) {
      targetIdxs = chapters.map((_: any, i: number) => i);
    } else {
      const existingSet = new Set(existing.map((c) => c.chapterIdx));
      targetIdxs = chapters
        .map((_: any, i: number) => i)
        .filter((i: number) => !existingSet.has(i));
    }

    if (targetIdxs.length === 0) {
      return NextResponse.json({
        ok: true,
        audiobook: project.audiobook,
        newBalance: user.balance_krw,
        totalCostKRW: 0,
        note: "이미 모든 챕터 생성됨",
      });
    }

    const requiredBalance = COST_PER_CHAPTER_KRW * targetIdxs.length;
    if (user.balance_krw < requiredBalance) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_BALANCE",
          message: `오디오북 ${targetIdxs.length}챕터 약 ₩${requiredBalance} 필요 (현재 ₩${user.balance_krw})`,
          shortfall: requiredBalance - user.balance_krw,
        },
        { status: 402 },
      );
    }

    let totalCostKRW = 0;
    const generated: any[] = [...existing];

    for (const idx of targetIdxs) {
      const ch = chapters[idx];
      if (!ch?.content) continue;
      // 본문 너무 길면 자름 (Gemini TTS 한 번에 ~2000자 안전).
      const text = String(ch.content).slice(0, 2000);
      try {
        const r = await ttsKorean(text);
        const log = await logAIUsage({
          userId,
          task: "edit",
          model: "gemini-2.5-flash-preview-tts",
          inputTokens: 0,
          outputTokens: 0,
          thoughtsTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUSD: COST_USD_PER_CHAPTER,
          costKRW: COST_PER_CHAPTER_KRW,
          durationMs: r.durationMs,
          projectId,
          chapterIdx: idx,
          status: "success",
        });
        await deductBalance({
          userId,
          amountKRW: COST_PER_CHAPTER_KRW,
          aiUsageId: log.id,
          reason: `오디오북 ${idx + 1}장`,
        });
        totalCostKRW += COST_PER_CHAPTER_KRW;

        // existing에서 같은 idx 제거 후 새로 추가 (in-place 갱신).
        const filtered = generated.filter((c) => c.chapterIdx !== idx);
        filtered.push({
          chapterIdx: idx,
          title: ch.title,
          wavBase64: r.wavBase64,
          durationMs: r.durationMs,
          voiceName: r.voiceName,
        });
        generated.length = 0;
        generated.push(...filtered);
      } catch (e: any) {
        // 실패 로그 + 계속 진행 (다른 챕터까지 막지 않음).
        await logAIUsage({
          userId,
          task: "edit",
          model: "gemini-2.5-flash-preview-tts",
          inputTokens: 0,
          outputTokens: 0,
          thoughtsTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUSD: 0,
          costKRW: 0,
          durationMs: 0,
          projectId,
          chapterIdx: idx,
          status: "failed",
          errorMessage: String(e?.message ?? "").slice(0, 500),
        }).catch(() => {});
      }
    }

    generated.sort((a, b) => a.chapterIdx - b.chapterIdx);
    const audiobook = {
      chapters: generated,
      voiceName: "Charon",
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, audiobook });
    const refreshed = await getUser(userId);

    return NextResponse.json({
      ok: true,
      audiobook,
      newBalance: refreshed?.balance_krw ?? 0,
      totalCostKRW,
    });
  } catch (e: any) {
    console.error("[/api/generate/audiobook]", e);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: e?.message || String(e) },
      { status: 500 },
    );
  }
}

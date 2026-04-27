// POST /api/generate/toc — 목차 생성

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateCost } from "@/lib/cost-estimate";
import { callAIServer, type AIModel } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { SYSTEM_WRITER, tocPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 한계

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`toc:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId, model = "gemini-flash-latest" as AIModel } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const estimate = estimateCost("toc", project, model);
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    if (user.balance_krw < estimate.minimumBalanceKRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        required: estimate.minimumBalanceKRW,
        current: user.balance_krw,
        shortfall: estimate.minimumBalanceKRW - user.balance_krw,
      }, { status: 402 });
    }

    let result;
    try {
      result = await callAIServer({
        model,
        system: SYSTEM_WRITER,
        user: tocPrompt(project),
        maxTokens: 2048,
        timeoutMs: 30000,
      });
    } catch (e: any) {
      return NextResponse.json({ error: "AI_CALL_FAILED", message: e?.message }, { status: 502 });
    }

    // 응답 JSON 파싱 (모델이 마크다운 블록을 붙일 수 있으니 제거)
    let toc;
    try {
      let txt = result.text.trim();
      txt = txt.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      toc = JSON.parse(txt);
      if (!Array.isArray(toc)) throw new Error("not array");
    } catch (e) {
      return NextResponse.json({ error: "INVALID_TOC_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
      userId, task: "toc", model,
      ...result.usage, costKRW,
      projectId, status: "success",
    });

    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `목차 생성 (${model})`,
      });
      newBalance = r.newBalance;
    }

    // 프로젝트에 목차 반영
    const chapters = toc.map((c: any) => ({ ...c, content: "", images: [] }));
    await updateProjectData(projectId, userId, { ...project, chapters });

    return NextResponse.json({
      toc,
      usage: { ...result.usage, costKRW },
      newBalance,
    });
  } catch (e: any) {
    // 마지막 안전망 — try 밖 throw 되어 "An error occurred"가 사용자에게 가는 상황 방지
    console.error("[/api/generate/toc] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
      stack: process.env.NODE_ENV === "production" ? undefined : e?.stack,
    }, { status: 500 });
  }
}

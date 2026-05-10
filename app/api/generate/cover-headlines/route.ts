// POST /api/generate/cover-headlines
// 표지에 들어갈 짧은 후킹 문구 5가지 자동 생성 — 후킹 공식 5가지 (숫자/의외/부정/한단어/질문)
// 표지 다양화와 묶어 "이미지 + 카피" 1세트로 활용.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import {
  getUser, getProject,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const FIXED_COST_KRW = 200;

interface CoverHeadline {
  id: string;
  formula: "숫자+결과+기간" | "의외+가능" | "부정+실은" | "한단어+사물" | "질문형";
  title: string;       // 메인 후킹 (10~25자)
  subtitle?: string;   // 보조 부제 (선택, 30자 이내)
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`cover-headlines:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const projectId = String((body as any)?.projectId ?? "");
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project: any = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < FIXED_COST_KRW) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: `잔액 부족 (₩${FIXED_COST_KRW.toLocaleString()} 필요)`,
        shortfall: FIXED_COST_KRW - user.balance_krw,
      }, { status: 402 });
    }

    const ch1Excerpt = project.chapters?.[0]?.content?.slice(0, 200) ?? "";

    const systemPrompt = `당신은 한국 베스트셀러("아주 작은 습관의 힘", "원씽", "나는 LG 트윈스 팬이다") 표지의 후킹 카피를 만드는 카피라이터입니다.

후킹 공식 5가지를 각각 1번씩 적용해 5개 후킹을 만듭니다:
① 숫자+결과+기간 — 예: "30분 만에 끝내는 보고서", "7일이면 인스타 1,000명"
② 의외+가능 — 예: "코딩 한 줄 모르는 직장인의 자동화"
③ 부정+실은 — 예: "노력은 배신한다, 시스템은 배신하지 않는다"
④ 한단어+사물 — 예: "집중의 기술", "거절의 문장"
⑤ 질문형 — 예: "왜 나만 안 되는 걸까", "다음 달 월세, 어떻게 벌지"

출력: JSON 배열만. 각 항목 { formula, title, subtitle? }. 다른 설명 없이.

[규칙]
- title은 10~25자 (표지에 한 줄로 들어감)
- 한국어로. 직설적이고 강하게.
- subtitle은 선택 — title 보조용 (30자 이내). 안 어울리면 빼도 됨.
- 클리셰 금지 ("당신의 인생을 바꾸는", "세상을 변화시키는" 등)
- 책 주제와 직접 연결될 것`;

    const userPrompt = `[책 정보]
주제: ${project.topic ?? ""}
대상 독자: ${project.audience ?? ""}
유형: ${project.type ?? ""}

[1장 발췌 — 분위기 참고]
${ch1Excerpt}

5개 후킹 카피를 JSON 배열로 출력하세요.`;

    const result = await callAIServer({
      model: "gemini-flash-latest",
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 1500,
      temperature: 0.95,
      timeoutMs: 20000,
    });

    let headlines: CoverHeadline[] = [];
    try {
      let txt = result.text.trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(txt);
      if (!Array.isArray(parsed)) throw new Error("not array");
      headlines = parsed.slice(0, 5).map((h: any, i: number) => ({
        id: `h${i}`,
        formula: h.formula ?? "한단어+사물",
        title: String(h.title ?? "").slice(0, 50),
        subtitle: h.subtitle ? String(h.subtitle).slice(0, 60) : undefined,
      })).filter(h => h.title);
    } catch {
      return NextResponse.json({
        error: "INVALID_AI_OUTPUT",
        message: "AI 응답 파싱 실패. 다시 시도해 주세요.",
        raw: result.text.slice(0, 300),
      }, { status: 502 });
    }

    if (headlines.length === 0) {
      return NextResponse.json({ error: "NO_HEADLINES" }, { status: 502 });
    }

    const { id: usageId } = await logAIUsage({
      userId, task: "edit", model: "gemini-flash-latest",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtsTokens: result.usage.thoughtsTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costUSD: result.usage.costUSD,
      costKRW: FIXED_COST_KRW,
      durationMs: result.usage.durationMs,
      projectId, status: "success",
    });
    const { newBalance } = await deductBalance({
      userId, amountKRW: FIXED_COST_KRW, aiUsageId: usageId,
      reason: `표지 후킹 카피 5종`,
    });

    return NextResponse.json({
      ok: true,
      headlines,
      costKRW: FIXED_COST_KRW,
      newBalance,
    });
  } catch (e: any) {
    console.error("[/api/generate/cover-headlines] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

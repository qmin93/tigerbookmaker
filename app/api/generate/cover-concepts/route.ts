// POST /api/generate/cover-concepts
// AI가 책 정보 보고 5가지 시각 컨셉 제안 — 사용자가 1개 선택해서 그 컨셉으로 표지 생성.
// 추상 일변도 → 사용자가 의도 명확히 잡을 수 있게.
//
// 5개 구성: image-driven 2개 + typography-driven 2개 + hybrid 1개
// 각 컨셉: { id, styleDirection, title(KO), description(KO), userConcept(KO short) }
// 사용자가 [선택] 누르면 cover-variations 호출 시 styleDirection·userConcept를 그대로 전달.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { callAIServer } from "@/lib/server/ai-server";
import {
  getUser, getProject,
  deductBalance, logAIUsage,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// 가격: AI 1회 호출 ~₩30. 사용자 부담 ₩200 고정.
const FIXED_COST_KRW = 200;

interface CoverConcept {
  id: string;
  styleDirection: "image" | "typography" | "hybrid";
  title: string;          // 한국어 짧은 이름 (예: "백지 + 만년필")
  description: string;    // 한국어 한 줄 설명
  userConcept: string;    // image generation prompt의 main subject로 들어갈 짧은 묘사 (한국어 OK, AI가 영어로 변환)
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`cover-concepts:${userId}`, 5, 60_000);
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
        current: user.balance_krw,
        shortfall: FIXED_COST_KRW - user.balance_krw,
      }, { status: 402 });
    }

    // RAG 1줄 (있으면 컨셉 정확도 ↑)
    let refSnippet = "";
    try {
      const { rows } = await sql<{ content: string }>`
        SELECT content FROM reference_chunks rc
        JOIN book_references br ON br.id = rc.reference_id
        WHERE br.project_id = ${projectId} LIMIT 1
      `;
      refSnippet = rows[0]?.content?.slice(0, 200) ?? "";
    } catch {}

    const ch1Excerpt = project.chapters?.[0]?.content?.slice(0, 200) ?? "";

    const systemPrompt = `당신은 한국 출판 시장의 표지 디자인 디렉터입니다. 책 정보를 보고 buyer가 책장에서 손이 가는 표지의 시각 컨셉 5가지를 제안합니다.

5개 구성 (반드시 이 분포):
- 2개: 이미지 중심 (image) — 시각 메타포가 메인. 추상이 아닌 구체적 사물·장면·실루엣
- 2개: 타이포그래피 중심 (typography) — 큰 글씨 자체가 디자인의 메인. 한국 베스트셀러("원씽", "아주 작은 습관의 힘") 스타일
- 1개: 하이브리드 (hybrid) — 큰 글씨 + 작은 일러스트 한 점

각 컨셉은 서로 충분히 달라야 합니다 (같은 사물/같은 구도 X).

출력 형식: JSON 배열만. 다른 설명 없이.
[
  {
    "styleDirection": "image",
    "title": "짧은 한국어 이름 (8자 이내)",
    "description": "한 줄로 시각을 설명 (40자 이내)",
    "userConcept": "이미지 모델에 줄 main subject 묘사 (한국어, 1~2문장, 구체적인 사물·구도·색상·분위기 포함)"
  },
  ...
]`;

    const userPrompt = `[책 정보]
주제: ${project.topic ?? ""}
대상 독자: ${project.audience ?? ""}
유형: ${project.type ?? ""}
테마 색상: ${project.themeColor ?? "orange"}

[1장 발췌 — 분위기 참고]
${ch1Excerpt}

${refSnippet ? `[자료 1줄 — 분위기 참고]\n${refSnippet}\n` : ""}

위 책에 대한 표지 시각 컨셉 5가지를 제안하세요. 진부한 클리셰(노트북·책·전구·악수) 피하고, buyer가 "이거 뭐지?" 하고 손이 가는 디자인. JSON 배열만 출력.`;

    const result = await callAIServer({
      model: "gemini-flash-latest",
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 2000,
      temperature: 0.9,
      timeoutMs: 20000,
    });

    let concepts: CoverConcept[] = [];
    try {
      let txt = result.text.trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(txt);
      if (!Array.isArray(parsed)) throw new Error("not array");
      concepts = parsed.slice(0, 5).map((c: any, i: number) => ({
        id: `c${i}`,
        styleDirection:
          c.styleDirection === "typography" || c.styleDirection === "hybrid"
            ? c.styleDirection : "image",
        title: String(c.title ?? "").slice(0, 30),
        description: String(c.description ?? "").slice(0, 80),
        userConcept: String(c.userConcept ?? "").slice(0, 400),
      })).filter(c => c.title && c.userConcept);
    } catch (e: any) {
      return NextResponse.json({
        error: "INVALID_AI_OUTPUT",
        message: "AI 응답 파싱 실패. 다시 시도해 주세요.",
        raw: result.text.slice(0, 500),
      }, { status: 502 });
    }

    if (concepts.length === 0) {
      return NextResponse.json({
        error: "NO_CONCEPTS",
        message: "유효한 컨셉이 생성되지 않았습니다. 다시 시도해 주세요.",
      }, { status: 502 });
    }

    // 차감 + 로그
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
      reason: `표지 컨셉 5종 brainstorming`,
    });

    return NextResponse.json({
      ok: true,
      concepts,
      costKRW: FIXED_COST_KRW,
      newBalance,
    });
  } catch (e: any) {
    console.error("[/api/generate/cover-concepts] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

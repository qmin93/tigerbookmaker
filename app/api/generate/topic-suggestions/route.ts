// POST /api/generate/topic-suggestions
// body: { keyword: string }
// 응답: { suggestions: [{ topic, audience, type }] x5 }
//
// 사용자가 짧은 키워드(예: "재테크") 입력 → AI가 책으로 만들 만한 구체적 주제 5개 추천.
// 무료 (Gemini Flash Lite). rate limit 적용.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const rl = rateLimit(`topic-suggest:${session.user.id}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

    const { keyword } = await req.json().catch(() => ({}));
    const k = String(keyword ?? "").trim().slice(0, 80);
    if (!k) return NextResponse.json({ error: "INVALID_INPUT", message: "키워드를 입력해주세요." }, { status: 400 });

    const prompt = `사용자가 "${k}" 키워드로 책을 쓰고 싶어합니다. 책으로 만들 만한 충분히 구체적인 주제 5개를 제안하세요.

[규칙]
- 주제는 1~2문장으로 충분히 구체적이어야 함 ("재테크 입문" X, "월 50만원 ETF 적립으로 5년에 1억 만들기" O)
- 대상 독자는 구체적인 인구통계·상황 ("일반인" X, "30대 후반 맞벌이 신혼부부" O)
- 유형은 다음 중 하나: "자기계발서" "실용서" "에세이" "매뉴얼" "재테크" "웹소설" "전문서"
- 5개 모두 다른 각도 (예: 한 키워드라도 입문서·심화서·사례집·실전 가이드 등 다양하게)

[출력 형식 — 순수 JSON만]
[
  {"topic":"...","audience":"...","type":"..."},
  ...총 5개
]`;

    const result = await callAIServer({
      model: "gemini-flash-lite-latest",
      system: "당신은 한국 실용 출판 시장을 잘 아는 기획자입니다. 팔리는 책 주제를 잘 잡습니다.",
      user: prompt,
      maxTokens: 2000,
      temperature: 0.85,
      timeoutMs: 25000,
    });

    let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
    let parsed: any[];
    try {
      parsed = JSON.parse(txt);
    } catch {
      // JSON 추출 시도 — [...] 부분만
      const m = txt.match(/\[[\s\S]*\]/);
      if (!m) throw new Error("JSON parse 실패");
      parsed = JSON.parse(m[0]);
    }

    if (!Array.isArray(parsed)) throw new Error("응답이 배열이 아님");
    const suggestions = parsed
      .filter((s: any) => s?.topic && s?.audience && s?.type)
      .slice(0, 5);

    return NextResponse.json({ ok: true, suggestions });
  } catch (e: any) {
    console.error("[/api/generate/topic-suggestions] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

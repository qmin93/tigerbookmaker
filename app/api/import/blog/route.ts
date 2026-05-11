// POST /api/import/blog
// body: {
//   topic: string,           // 책 주제
//   audience: string,
//   type: string,            // 책 유형
//   sources: Array<{ type: "url" | "text", value: string }>,  // 블로그 글 N개
// }
// 효과: 새 프로젝트 생성 + 본문들 RAG로 청크 → AI가 12챕터로 그룹핑 → 목차 scaffold
//
// 반환: { ok, projectId, message }

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/auth";
import {
  getUser, deductBalance, logAIUsage,
} from "@/lib/server/db";
import { callAIServer } from "@/lib/server/ai-server";
import { extractUrlText } from "@/lib/server/url-extractor";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const FIXED_COST_KRW = 500;  // 그룹핑 + 목차 생성 1회 비용

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`import-blog:${userId}`, 3, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const topic = String((body as any)?.topic ?? "").trim().slice(0, 200);
    const audience = String((body as any)?.audience ?? "").trim().slice(0, 200);
    const type = String((body as any)?.type ?? "실용서").slice(0, 30);
    const targetPages = Math.max(20, Math.min(300, Number((body as any)?.targetPages ?? 100)));
    const sources = Array.isArray((body as any)?.sources) ? (body as any).sources : [];

    if (!topic || !audience) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "주제·대상독자 필수" }, { status: 400 });
    }
    if (sources.length < 3) {
      return NextResponse.json({ error: "TOO_FEW_SOURCES", message: "최소 3개 글이 필요합니다" }, { status: 400 });
    }
    if (sources.length > 50) {
      return NextResponse.json({ error: "TOO_MANY_SOURCES", message: "최대 50개" }, { status: 400 });
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

    // 1. 글 본문 추출
    const articles: Array<{ title: string; text: string }> = [];
    for (const s of sources) {
      try {
        if (s.type === "url" && typeof s.value === "string") {
          const r = await extractUrlText(String(s.value).slice(0, 1000), 15000);
          if (r?.text && r.text.length > 100) {
            articles.push({ title: r.title || s.value.slice(0, 50), text: r.text.slice(0, 8000) });
          }
        } else if (s.type === "text" && typeof s.value === "string" && s.value.length > 100) {
          articles.push({
            title: s.value.slice(0, 50).split("\n")[0],
            text: String(s.value).slice(0, 8000),
          });
        }
      } catch {
        // skip failed source
      }
    }

    if (articles.length < 3) {
      return NextResponse.json({
        error: "EXTRACTION_FAILED",
        message: `${articles.length}개만 추출 성공. 최소 3개 필요. URL이 정확한지 확인해주세요.`,
      }, { status: 400 });
    }

    // 2. AI에게 12챕터로 그룹핑 요청
    const articlesBlock = articles.slice(0, 30).map((a, i) =>
      `[${i + 1}] ${a.title}\n${a.text.slice(0, 600)}\n`
    ).join("\n---\n");

    const result = await callAIServer({
      model: "gemini-flash-latest",
      system: `당신은 한국 출판 편집자입니다. 아래 N개 블로그 글을 읽고, 책 한 권의 12챕터 구조로 재구성합니다.

[규칙]
- 12챕터로 정확히 분류
- 각 챕터에 어떤 글들이 들어가야 하는지 글 번호 명시
- 챕터 제목은 행동·질문·선언 형태 (명사구 X)
- 챕터 순서는 독자 학습 흐름 (도입 → 핵심 → 적용 → 마무리)
- 한 글이 여러 챕터에 들어가도 OK

[출력 형식] JSON 배열만:
[
  { "chapterTitle": "한국어 챕터 제목 (15자 이내)", "subtitle": "한 줄 설명 (40자 이내, 선택)", "sourceIndices": [1, 5, 7], "estimatedWords": 1800 },
  ... (총 12개)
]`,
      user: `[책 정보]
주제: ${topic}
대상 독자: ${audience}
유형: ${type}
목표 분량: ${targetPages}쪽

[블로그 글 목록]
${articlesBlock}

12챕터 구조 JSON 배열로 출력하세요.`,
      maxTokens: 3000,
      temperature: 0.6,
      timeoutMs: 30000,
    });

    let chapters: Array<{ chapterTitle: string; subtitle: string; sourceIndices: number[] }> = [];
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(txt);
      if (!Array.isArray(parsed)) throw new Error("not array");
      chapters = parsed.slice(0, 12).map((c: any) => ({
        chapterTitle: String(c.chapterTitle ?? "").slice(0, 100),
        subtitle: String(c.subtitle ?? "").slice(0, 200),
        sourceIndices: Array.isArray(c.sourceIndices) ? c.sourceIndices.filter((n: any) => Number.isInteger(n)) : [],
      })).filter(c => c.chapterTitle);
    } catch {
      return NextResponse.json({
        error: "INVALID_AI_OUTPUT",
        message: "AI가 챕터 구조를 못 만들었어요. 다시 시도해 주세요.",
        raw: result.text.slice(0, 500),
      }, { status: 502 });
    }

    if (chapters.length === 0) {
      return NextResponse.json({ error: "NO_CHAPTERS" }, { status: 502 });
    }

    // 3. 새 프로젝트 생성 — chapters에 sourceIndices를 hint로 저장 (본문은 본문 생성 시 채움)
    const projectChapters = chapters.map((c, i) => ({
      id: `ch-${Date.now()}-${i}`,
      title: c.chapterTitle,
      subtitle: c.subtitle || undefined,
      content: "",
      summary: c.sourceIndices.length > 0
        ? `[블로그 출처 ${c.sourceIndices.join(", ")}번 활용]`
        : "",
      images: [],
    }));

    const projectData = {
      chapters: projectChapters,
      tier: "pro" as const,
      themeColor: "orange",
      template: "minimal",
      // 메타 정보 — 본문 생성 시 RAG로 사용 가능
      blogImport: {
        sourceCount: articles.length,
        chapterMap: chapters.map(c => c.sourceIndices),
        importedAt: Date.now(),
      },
    };

    const { rows: insertRows } = await sql<{ id: string }>`
      INSERT INTO book_projects (user_id, topic, audience, type, target_pages, data)
      VALUES (${userId}, ${topic}, ${audience}, ${type}, ${targetPages}, ${JSON.stringify(projectData)})
      RETURNING id
    `;
    const projectId = insertRows[0].id;

    // 4. 비용 차감 + 로그
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
      reason: `블로그 ${articles.length}개 → 책 변환`,
    });

    // 5. 글 본문도 reference로 등록 (RAG에 활용)
    try {
      for (const [i, a] of articles.slice(0, 30).entries()) {
        await sql`
          INSERT INTO book_references (project_id, user_id, filename, source_type, source_url, total_chars, chunk_count)
          VALUES (${projectId}, ${userId}, ${a.title}, 'blog-import', null, ${a.text.length}, 0)
        `;
      }
    } catch (e: any) {
      console.warn("[import-blog] reference insert failed", e?.message);
    }

    return NextResponse.json({
      ok: true,
      projectId,
      chapterCount: chapters.length,
      sourceCount: articles.length,
      newBalance,
      message: `${articles.length}개 글 → ${chapters.length}챕터로 구성 완료. 본문은 챕터별 [본문 생성]으로 작성하세요.`,
    });
  } catch (e: any) {
    console.error("[/api/import/blog] uncaught:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

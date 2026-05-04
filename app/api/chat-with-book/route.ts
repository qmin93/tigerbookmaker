// POST /api/chat-with-book — 공개 책 챗봇 (독자가 책 내용에 질문)
// body: { bookId, question, history?: [{role, text}] }
//
// 정책:
//  - 인증 X (public). shareEnabled=true 인 책만 챗 허용.
//  - 비용은 책 작가의 잔액에서 차감. 잔액 부족 시 에러.
//  - RAG: 1) 작가가 업로드한 reference_chunks 검색  2) 책의 chapter content 직접 prompt에 포함
//  - 응답 모델: 비용 절감 위해 항상 Gemini Flash Lite (basic 티어)
//  - thread는 transient — 저장 안 함

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { callAIServer, type AIModel } from "@/lib/server/ai-server";
import { getModelChain } from "@/lib/tiers";
import {
  getUser, deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { ragSearch, formatRagContext } from "@/lib/server/rag";

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUESTION_LEN = 500;
const MAX_HISTORY = 10;
const MAX_CHAPTER_CHARS = 2400;   // 챕터당 본문 자르기 (전체 24000자 이하 유지)
const MAX_TOTAL_CHAPTER_CHARS = 24000;

interface HistoryItem { role: "user" | "assistant"; text: string }

export async function POST(req: Request) {
  try {
    const { bookId, question, history } = await req.json().catch(() => ({}));

    if (!bookId || typeof bookId !== "string" || !UUID_RE.test(bookId)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "질문을 입력해주세요." }, { status: 400 });
    }
    const trimmedQuestion = question.trim().slice(0, MAX_QUESTION_LEN);

    // Public rate limit per book — 누구나 접근 가능하므로 generous
    const rl = rateLimit(`chat-with-book:${bookId}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });
    }

    // 책 fetch
    const { rows } = await sql<{
      id: string;
      user_id: string;
      topic: string;
      audience: string;
      type: string;
      data: any;
    }>`
      SELECT id, user_id, topic, audience, type, data
      FROM book_projects WHERE id = ${bookId}
    `;
    const book = rows[0];
    if (!book) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (book.data?.shareEnabled !== true) {
      return NextResponse.json({ error: "NOT_SHARED", message: "비공개 책입니다." }, { status: 403 });
    }

    // 작가 (=cost payer)
    const author = await getUser(book.user_id);
    if (!author) return NextResponse.json({ error: "AUTHOR_NOT_FOUND" }, { status: 404 });

    if (author.balance_krw < 5) {
      return NextResponse.json({
        error: "AUTHOR_INSUFFICIENT_BALANCE",
        message: "이 책의 작가 잔액이 부족하여 챗봇을 사용할 수 없습니다.",
      }, { status: 402 });
    }

    // 모델 선택 — basic 티어로 강제 (비용 절감)
    const candidates = getModelChain("basic");
    if (candidates.length === 0) {
      return NextResponse.json({ error: "MODEL_UNAVAILABLE" }, { status: 503 });
    }

    // RAG: reference_chunks 검색 (실패해도 진행)
    let ragChunks: Awaited<ReturnType<typeof ragSearch>> = [];
    try {
      ragChunks = await ragSearch({
        projectId: bookId,
        query: trimmedQuestion,
        topN: 5,
        maxDistance: 0.7,
      });
    } catch (e: any) {
      console.warn("[chat-with-book] RAG failed:", e?.message);
    }
    const ragContext = formatRagContext(ragChunks);

    // 책 본문(chapters) — 직접 prompt에 포함 (chapter_chunks 없음)
    const chapters: any[] = Array.isArray(book.data?.chapters) ? book.data.chapters : [];
    let chaptersBlock = "";
    let totalChars = 0;
    for (const c of chapters) {
      const content = (c?.content ?? "").toString();
      if (!content.trim()) continue;
      const snippet = content.slice(0, MAX_CHAPTER_CHARS);
      const block = `\n[챕터: ${c.title ?? ""}]\n${snippet}\n`;
      if (totalChars + block.length > MAX_TOTAL_CHAPTER_CHARS) break;
      chaptersBlock += block;
      totalChars += block.length;
    }

    // history (last MAX_HISTORY)
    const safeHistory: HistoryItem[] = Array.isArray(history)
      ? history
          .slice(-MAX_HISTORY)
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
          .map((m: any) => ({ role: m.role, text: String(m.text).slice(0, 1500) }))
      : [];

    const historyText = safeHistory
      .map(m => `${m.role === "user" ? "독자" : "AI"}: ${m.text}`)
      .join("\n");

    const authorName = book.data?.marketingMeta?.authorName || "작가";
    const systemPrompt = `당신은 책 "${book.topic}"의 저자(${authorName}) 챗봇입니다.
독자가 책 내용에 대해 묻는 질문에 친근하고 정중한 한국어로 답변하세요.

규칙:
- 반드시 아래 [책 본문]과 [작가 레퍼런스]에 근거해서만 답변하세요.
- 책에서 다루지 않은 주제는 "그 부분은 이 책에서 다루지 않았습니다."라고 솔직히 답하세요.
- 책 내용을 그대로 베끼지 말고, 핵심을 짚어 자연스럽게 풀어 설명하세요.
- 답변은 3~6문장. 너무 길면 안 됩니다.
- 책의 장점·핵심 메시지를 자연스럽게 강조해 독자가 책에 더 흥미를 갖게 하세요.`;

    const userPrompt = `[책 정보]
- 제목: ${book.topic}
- 대상 독자: ${book.audience}
- 분야: ${book.type}
${chaptersBlock ? `\n[책 본문]${chaptersBlock}` : ""}
${ragContext}

${historyText ? `[지금까지 대화]\n${historyText}\n` : ""}
[독자의 새 질문]
${trimmedQuestion}

위 책 내용을 바탕으로 한국어로 답변하세요.`;

    // AI 호출 (fallback chain)
    let result;
    let actualModel: AIModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: systemPrompt,
          user: userPrompt,
          maxTokens: 700,
          temperature: 0.7,
          timeoutMs: 20_000,
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
    if (!result) {
      return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message ?? "all candidates failed" }, { status: 502 });
    }

    const answer = result.text.trim();

    // 작가 잔액에서 비용 차감
    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
      userId: book.user_id,
      task: "edit",
      model: actualModel,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtsTokens: result.usage.thoughtsTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costUSD: result.usage.costUSD,
      costKRW,
      durationMs: result.usage.durationMs,
      projectId: bookId,
      status: "success",
    });
    if (costKRW > 0) {
      try {
        await deductBalance({
          userId: book.user_id,
          amountKRW: costKRW,
          aiUsageId: usageId,
          reason: `독자 챗봇 응답 (책: ${book.topic.slice(0, 30)})`,
        });
      } catch (e: any) {
        // 차감 실패해도 답변은 이미 생성됨 — 로그만 남김
        console.warn("[chat-with-book] balance deduct failed:", e?.message);
      }
    }

    return NextResponse.json({
      answer,
      bookTitle: book.topic,
      authorName,
    });
  } catch (e: any) {
    console.error("[/api/chat-with-book] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

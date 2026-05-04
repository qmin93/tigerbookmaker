// /book/[id]/chat — 책에 대해 독자가 질문하는 챗봇 페이지 (public, no auth)
// (Wave C2)
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface BookData {
  id: string;
  topic: string;
  audience: string;
  type: string;
  cover?: { base64: string } | null;
  themeColor?: string;
  marketingMeta?: { authorName?: string } | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

const SUGGESTIONS_BY_TYPE: Record<string, string[]> = {
  자기계발서: [
    "이 책에서 가장 핵심이 되는 한 가지는 뭐예요?",
    "오늘부터 바로 실천할 수 있는 첫 단계는?",
    "초보자에게는 무엇부터 추천하시나요?",
  ],
  재테크: [
    "초보자가 첫 투자할 때 주의할 점은?",
    "이 책의 가장 중요한 원칙 한 가지는?",
    "월 50만 원으로 시작한다면 어떻게 해야 하나요?",
  ],
  에세이: [
    "작가가 이 글을 쓴 계기는 뭐예요?",
    "독자에게 가장 전하고 싶은 한 마디는?",
    "이 책에서 가장 인상 깊은 장면을 알려주세요.",
  ],
  실용서: [
    "이 책을 어떻게 활용하면 가장 좋을까요?",
    "가장 빈번한 실수와 피하는 법을 알려주세요.",
    "이 분야가 처음인 사람에게 추천하시나요?",
  ],
  매뉴얼: [
    "처음 시작할 때 가장 중요한 한 가지는?",
    "자주 묻는 질문 정리해 주세요.",
    "이 매뉴얼을 어떤 순서로 읽으면 좋나요?",
  ],
  웹소설: [
    "주인공의 가장 큰 매력은 뭐예요?",
    "스포일러 없이 이 작품의 분위기를 알려주세요.",
    "어떤 독자에게 추천하시나요?",
  ],
  전문서: [
    "이 책을 가장 잘 활용할 수 있는 독자는?",
    "사전 지식이 얼마나 필요한가요?",
    "가장 핵심이 되는 개념 한 가지를 알려주세요.",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "이 책의 핵심 메시지를 한 줄로 알려주세요.",
  "이 책을 읽으면 무엇을 얻을 수 있나요?",
  "어떤 분에게 가장 추천하시나요?",
];

const STORAGE_QUESTION_COUNT = "tigerbookmaker:chat-question-count:";
const MAX_QUESTIONS_PER_SESSION = 20;

export default function BookChatPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [book, setBook] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // load book + initial AI greeting + question count
  useEffect(() => {
    fetch(`/api/book/${id}`)
      .then(async r => {
        if (r.status === 404) throw new Error("책을 찾을 수 없습니다.");
        if (r.status === 403) throw new Error("작가가 비공개로 설정한 책입니다.");
        if (!r.ok) throw new Error("책 정보를 불러올 수 없습니다.");
        return r.json();
      })
      .then((d: BookData) => {
        setBook(d);
        setMessages([{
          role: "assistant",
          text: `안녕하세요. "${d.topic}"에 대해 무엇이든 물어보세요. 제가 책 내용을 바탕으로 답해드릴게요.`,
          ts: Date.now(),
        }]);
      })
      .catch(e => setError(e.message));

    try {
      const stored = Number(localStorage.getItem(STORAGE_QUESTION_COUNT + id) || "0");
      setQuestionCount(stored);
      if (stored >= MAX_QUESTIONS_PER_SESSION) setLimitReached(true);
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (q?: string) => {
    const text = (q ?? input).trim();
    if (!text || sending || limitReached || !book) return;

    const userMsg: ChatMessage = { role: "user", text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const history = messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, text: m.text }));

      const r = await fetch("/api/chat-with-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: id, question: text, history }),
      });
      const d = await r.json();
      if (!r.ok) {
        let msg = d?.message || d?.error || "답변을 받지 못했습니다.";
        if (d?.error === "AUTHOR_INSUFFICIENT_BALANCE") {
          msg = "이 책의 작가 잔액이 부족합니다. 잠시 후 다시 시도해 주세요.";
        } else if (d?.error === "RATE_LIMITED") {
          msg = "잠시 후 다시 시도해주세요.";
        }
        setMessages(prev => [...prev, { role: "assistant", text: `⚠️ ${msg}`, ts: Date.now() }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          text: d.answer || "(빈 응답)",
          ts: Date.now(),
        }]);
        const next = questionCount + 1;
        setQuestionCount(next);
        try { localStorage.setItem(STORAGE_QUESTION_COUNT + id, String(next)); } catch {}
        if (next >= MAX_QUESTIONS_PER_SESSION) setLimitReached(true);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `⚠️ 연결 오류: ${e?.message ?? "unknown"}`,
        ts: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <div className="text-5xl mb-4">📕</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{error}</h1>
          <Link href="/" className="inline-block mt-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition">
            🐯 Tigerbookmaker 홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">불러오는 중…</div>
      </div>
    );
  }

  const authorName = book.marketingMeta?.authorName;
  const suggestions = SUGGESTIONS_BY_TYPE[book.type] ?? DEFAULT_SUGGESTIONS;
  const showSuggestions = messages.length <= 1; // 첫 인사 후만

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/book/${id}`}
            className="text-sm text-gray-500 hover:text-gray-800 transition flex-shrink-0"
            aria-label="책 페이지로 돌아가기"
          >
            ←
          </Link>
          {book.cover?.base64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${book.cover.base64}`}
              alt={book.topic}
              className="w-10 h-12 object-cover rounded shadow-sm flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-12 bg-gray-200 rounded flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-900 truncate text-sm md:text-base">{book.topic}</div>
            {authorName && (
              <div className="text-xs text-gray-500 truncate">{authorName} 작가의 챗봇</div>
            )}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {sending && (
            <div className="flex">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] text-sm text-gray-400 animate-pulse">
                답변 생성 중…
              </div>
            </div>
          )}

          {showSuggestions && !sending && (
            <div className="pt-4">
              <div className="text-xs text-gray-500 mb-2 px-2">예시 질문</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    disabled={limitReached}
                    className="text-xs bg-white border border-gray-300 hover:border-orange-400 hover:bg-orange-50 rounded-full px-3 py-1.5 transition text-gray-700 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 bg-white sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {limitReached ? (
            <div className="text-center text-sm text-gray-500 py-3">
              한 세션당 {MAX_QUESTIONS_PER_SESSION}개 질문 한도에 도달했습니다.
              <Link href={`/book/${id}`} className="ml-2 text-orange-600 hover:underline font-semibold">책 페이지로 돌아가기</Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="이 책에 대해 질문해 보세요…"
                  rows={1}
                  maxLength={500}
                  disabled={sending}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-orange-400 resize-none text-sm min-h-[44px] max-h-32"
                />
                <button
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition text-sm whitespace-nowrap"
                >
                  전송
                </button>
              </div>
              <div className="text-[10px] text-gray-400 mt-1 text-right">
                {questionCount}/{MAX_QUESTIONS_PER_SESSION} · 답변은 책 내용에 기반합니다
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-orange-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] text-sm text-gray-800 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

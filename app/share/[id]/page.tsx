// /share/[id] — 공유 책 view (public, no login required)
// 작가가 책 자랑·홍보용으로 SNS·블로그에 링크 공유.

"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTheme } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

interface Chapter {
  title: string;
  subtitle?: string;
  content: string;
  images?: { placeholder: string; dataUrl?: string; caption?: string }[];
}

interface ShareData {
  id: string;
  topic: string;
  audience: string;
  type: string;
  chapters: Chapter[];
  cover?: { base64: string } | null;
  shareLinks?: {
    kmong?: string;
    ridi?: string;
    kyobo?: string;
    custom?: { label: string; url: string }[];
  };
  themeColor?: ThemeColorKey;
  createdAt: string;
}

const CHARS_PER_PAGE = 1300;

function splitToPages(content: string): string[] {
  const stripped = content.replace(/\[IMAGE:[^\]]+\]/g, "").trim();
  const paragraphs = stripped.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const pages: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > CHARS_PER_PAGE && buf) {
      pages.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) pages.push(buf);
  return pages.length > 0 ? pages : [""];
}

interface Page {
  type: "cover" | "toc" | "chapter-start" | "body" | "outro";
  chapterIdx?: number;
  text?: string;
}

function buildPages(book: ShareData): Page[] {
  const pages: Page[] = [{ type: "cover" }, { type: "toc" }];
  book.chapters.forEach((c, ci) => {
    if (!c.content) return;
    pages.push({ type: "chapter-start", chapterIdx: ci });
    splitToPages(c.content).forEach(text => pages.push({ type: "body", chapterIdx: ci, text }));
  });
  pages.push({ type: "outro" });
  return pages;
}

export default function SharePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [book, setBook] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(async r => {
        if (r.status === 404) throw new Error("책을 찾을 수 없습니다.");
        if (r.status === 403) throw new Error("작가가 비공개로 설정한 책입니다.");
        if (!r.ok) throw new Error(`로드 실패 (${r.status})`);
        return r.json();
      })
      .then(d => setBook(d))
      .catch(e => setError(e.message));
  }, [id]);

  const pages = useMemo(() => book ? buildPages(book) : [], [book]);
  const total = pages.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setIdx(i => Math.min(i + 1, total - 1));
      else if (e.key === "ArrowLeft") setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (error) {
    return (
      <main className="min-h-screen bg-ink-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">📕</div>
        <p className="text-ink-300 mb-4">{error}</p>
        <Link href="/" className="text-tiger-orange hover:underline font-bold">🐯 Tigerbookmaker 홈으로</Link>
      </main>
    );
  }
  if (!book) {
    return <main className="min-h-screen bg-ink-900 flex items-center justify-center text-ink-300">책 불러오는 중...</main>;
  }

  const current = pages[idx];
  const pct = total > 1 ? Math.round((idx / (total - 1)) * 100) : 100;
  const writtenChapters = book.chapters.filter(c => c.content);
  const theme = getTheme(book.themeColor as ThemeColorKey | undefined);

  return (
    <main className="min-h-screen bg-ink-900 flex flex-col">
      {/* 상단 — 작가 워터마크 + 홈 */}
      <header className="bg-ink-850 border-b border-ink-700/60 px-4 py-3 flex items-center justify-between text-white text-sm">
        <Link href="/" className="flex items-center gap-2 hover:text-tiger-orange transition">
          <span className="text-lg">🐯</span>
          <span className="font-black tracking-tight text-xs">Tigerbookmaker</span>
        </Link>
        <div className="font-bold tracking-tight truncate max-w-[50%] text-center">{book.topic}</div>
        <div className="text-xs font-mono text-ink-400">{idx + 1}/{total}</div>
      </header>

      <div className="h-0.5 bg-ink-800">
        <div className="h-full bg-tiger-orange transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* 책 페이지 */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
        <button
          onClick={() => setIdx(i => Math.max(i - 1, 0))}
          disabled={idx === 0}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition flex items-center justify-center text-2xl z-10"
        >←</button>
        <button
          onClick={() => setIdx(i => Math.min(i + 1, total - 1))}
          disabled={idx === total - 1}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition flex items-center justify-center text-2xl z-10"
        >→</button>

        <div
          className="w-full max-w-2xl bg-stone-50 rounded-sm shadow-2xl aspect-[3/4] overflow-hidden relative cursor-pointer"
          style={{ boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6)" }}
          onClick={() => setIdx(i => Math.min(i + 1, total - 1))}
        >
          <PageContent page={current} book={book} theme={theme} />
        </div>
      </div>

      {/* 챕터 nav */}
      <div className="bg-ink-850 border-t border-ink-700/60 px-4 py-3 flex items-center justify-center gap-2 overflow-x-auto">
        {writtenChapters.map((c, i) => {
          const startIdx = pages.findIndex(p => p.type === "chapter-start" && p.chapterIdx === book.chapters.indexOf(c));
          if (startIdx === -1) return null;
          const isActive = idx >= startIdx;
          return (
            <button
              key={i}
              onClick={() => setIdx(startIdx)}
              className={`text-[10px] px-2 py-1 rounded whitespace-nowrap ${isActive ? `${theme.bgBold} ${theme.textOnBold} font-bold` : "text-ink-400 hover:text-white hover:bg-ink-800"}`}
            >{i + 1}장</button>
          );
        })}
      </div>

      <div className="px-4 py-2 text-center text-[10px] font-mono text-ink-500 uppercase tracking-wider">
        ← → 키보드 / 페이지 클릭 → 다음
      </div>
    </main>
  );
}

function PageContent({ page, book, theme }: { page: Page; book: ShareData; theme: ReturnType<typeof getTheme> }) {
  if (page.type === "cover") {
    return (
      <div className="w-full h-full flex flex-col">
        {book.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`data:image/png;base64,${book.cover.base64}`} alt="표지" className="w-full flex-1 object-cover" />
        ) : (
          <div className="flex-1 bg-gradient-to-br from-ink-900 via-ink-800 to-tiger-orange flex items-center justify-center p-12">
            <div className="text-center text-white">
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-tiger-orange mb-4">TIGERBOOKMAKER</div>
              <div className="text-3xl md:text-4xl font-black leading-tight">{book.topic}</div>
              <div className="mt-4 text-sm text-white/70">대상: {book.audience}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (page.type === "toc") {
    return (
      <div className="w-full h-full p-8 md:p-12 overflow-y-auto bg-stone-50">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-tiger-orange mb-3">목차</div>
        <h2 className="text-3xl font-black tracking-tight text-ink-900 mb-8">CONTENTS</h2>
        <div className="space-y-3">
          {book.chapters.filter(c => c.content).map((c, i) => (
            <div key={i} className="flex items-baseline gap-3 pb-3 border-b border-stone-200">
              <span className="text-tiger-orange font-mono text-xs font-bold">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <div className="font-bold text-ink-900 text-sm">{c.title}</div>
                {c.subtitle && <div className="text-xs text-stone-500 mt-0.5">{c.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page.type === "chapter-start" && typeof page.chapterIdx === "number") {
    const c = book.chapters[page.chapterIdx];
    return (
      <div className={`w-full h-full bg-stone-50 flex flex-col p-8 md:p-12 relative border-l-4 ${theme.accentBorder}`}>
        <div className="absolute top-1/2 right-12 -translate-y-1/2 text-[120px] md:text-[160px] font-black text-tiger-orange/10 leading-none select-none tracking-tighter">
          {String(page.chapterIdx + 1).padStart(2, "0")}
        </div>
        <div className="flex-1 flex flex-col justify-center relative z-10">
          <div className={`text-[10px] font-mono uppercase tracking-[0.3em] ${theme.accent} mb-3`}>CHAPTER {String(page.chapterIdx + 1).padStart(2, "0")}</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-ink-900 leading-[1.1]">{c.title}</h2>
          {c.subtitle && <p className="mt-4 text-base md:text-lg text-stone-600 leading-relaxed">{c.subtitle}</p>}
          <div className={`mt-6 h-1 w-16 ${theme.bgBold}`} />
        </div>
      </div>
    );
  }

  if (page.type === "body" && typeof page.chapterIdx === "number") {
    const c = book.chapters[page.chapterIdx];
    return (
      <div className="w-full h-full bg-stone-50 flex flex-col">
        <div className="px-8 md:px-12 pt-6 md:pt-8 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 flex justify-between">
          <span>{page.chapterIdx + 1}장 — {c.title}</span>
          <span className="text-tiger-orange">TIGERBOOKMAKER</span>
        </div>
        <div className="flex-1 px-8 md:px-12 py-4 md:py-6 overflow-y-auto">
          <div className="text-[13px] leading-[1.75] text-ink-800 whitespace-pre-wrap break-keep" style={{ wordBreak: "keep-all" }}>
            {(page.text || "").split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold text-ink-900 mt-4 mb-2">{line.slice(3)}</h3>;
              if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold text-ink-900 mt-3 mb-1">{line.slice(4)}</h4>;
              if (!line.trim()) return <div key={i} className="h-2" />;
              return <p key={i} className="mb-2.5">{line}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  if (page.type === "outro") {
    const sl = book.shareLinks ?? {};
    const customLinks = sl.custom ?? [];
    const hasLinks = sl.kmong || sl.ridi || sl.kyobo || customLinks.length > 0;
    return (
      <div className="w-full h-full bg-gradient-to-br from-ink-900 via-ink-800 to-tiger-orange flex flex-col items-center justify-center text-white p-8 md:p-12 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">끝까지 읽어주셔서 감사해요</h2>
        <p className="text-white/70 text-sm mb-8">「{book.topic}」</p>

        {hasLinks && (
          <div className="w-full max-w-sm space-y-2 mb-8">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-tiger-orange mb-3">📚 책 구매·다운로드</div>
            {sl.kmong && <a href={sl.kmong} target="_blank" rel="noopener noreferrer" className="block py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition">크몽에서 보기 →</a>}
            {sl.ridi && <a href={sl.ridi} target="_blank" rel="noopener noreferrer" className="block py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition">리디북스에서 보기 →</a>}
            {sl.kyobo && <a href={sl.kyobo} target="_blank" rel="noopener noreferrer" className="block py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition">교보문고에서 보기 →</a>}
            {customLinks.map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="block py-3 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition">{c.label} →</a>
            ))}
          </div>
        )}

        <div className="border-t border-white/20 pt-6 mt-2 max-w-sm w-full">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-tiger-orange mb-2">이 책은</div>
          <div className="text-base font-bold mb-3">🐯 Tigerbookmaker로 30분만에 만들어졌어요</div>
          <Link href="/" className={`inline-block px-6 py-3 ${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold} rounded-lg font-bold transition`}>
            나도 책 만들기 →
          </Link>
        </div>
      </div>
    );
  }

  return <div className="p-8">알 수 없는 페이지</div>;
}

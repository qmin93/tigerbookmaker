// components/FlipbookPreview.tsx
// react-pageflip 기반 책장 넘김 미리보기. 데스크톱만 flip, 모바일은 stack 형태로 fallback.

"use client";
import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ThemeClasses } from "@/lib/theme-colors";

// react-pageflip은 client-only — dynamic import + ssr:false
const HTMLFlipBook = dynamic(() => import("react-pageflip").then(m => m.default), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center text-gray-400 animate-pulse">
      미리보기 준비 중...
    </div>
  ),
});

interface FlipbookPage {
  chapterIdx: number;
  title: string;
  subtitle?: string | null;
  excerpt: string;
}

interface Props {
  bookId: string;
  bookTopic: string;
  coverBase64?: string | null;
  pages: FlipbookPage[];
  theme: ThemeClasses;
}

export function FlipbookPreview({ bookId, bookTopic, coverBase64, pages, theme }: Props) {
  const flipRef = useRef<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (pages.length === 0) return null;

  // 모바일 fallback — flipbook 대신 단순 페이지 스크롤
  if (isMobile) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
        <h2 className={`text-2xl font-bold mb-4 border-l-4 pl-3 ${theme.accentBorder}`}>📖 미리보기</h2>
        <div className="space-y-6">
          {pages.map((p, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-5 border border-gray-200">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-2">
                {p.chapterIdx + 1}장
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{p.title}</h3>
              {p.subtitle && <p className="text-sm text-gray-500 mb-3">{p.subtitle}</p>}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.excerpt}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href={`/share/${bookId}`}
            className={`inline-block ${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold} font-bold text-sm px-6 py-3 rounded-lg shadow transition`}
          >
            📖 전체 본문 읽으러 가기 →
          </Link>
        </div>
      </section>
    );
  }

  // 데스크톱 flipbook
  const PAGE_W = 360;
  const PAGE_H = 500;

  return (
    <section className="max-w-5xl mx-auto px-4 py-12 border-t border-gray-100">
      <h2 className={`text-2xl font-bold mb-6 border-l-4 pl-3 ${theme.accentBorder} text-center md:text-left`}>
        📖 인터랙티브 미리보기
      </h2>
      <p className="text-sm text-gray-500 mb-6 text-center md:text-left">
        페이지를 클릭하거나 드래그해서 넘겨보세요.
      </p>

      <div className="flex justify-center mb-6">
        <HTMLFlipBook
          ref={flipRef as any}
          width={PAGE_W}
          height={PAGE_H}
          minWidth={300}
          maxWidth={500}
          minHeight={420}
          maxHeight={600}
          showCover
          mobileScrollSupport
          drawShadow
          flippingTime={700}
          usePortrait={false}
          startZIndex={0}
          autoSize
          maxShadowOpacity={0.5}
          showPageCorners
          disableFlipByClick={false}
          className="flipbook"
          style={{}}
          startPage={0}
          size="fixed"
          clickEventForward
          useMouseEvents
          swipeDistance={30}
        >
          {/* 표지 */}
          <div
            className={`flipbook-page ${theme.bg} flex flex-col items-center justify-center p-6 border ${theme.accentBorder} rounded-l-md`}
          >
            {coverBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${coverBase64}`}
                alt={bookTopic}
                className="w-full h-auto rounded shadow-lg"
              />
            ) : (
              <div
                className={`w-full aspect-[3/4] flex items-center justify-center rounded-lg ${theme.bg} border-2 ${theme.accentBorder} p-4`}
              >
                <span className={`text-xl font-bold text-center ${theme.accent.split(" ")[0]}`}>
                  {bookTopic}
                </span>
              </div>
            )}
          </div>

          {/* 페이지들 */}
          {pages.map((p, i) => (
            <div key={i} className="flipbook-page bg-white p-6 overflow-hidden">
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-2">
                {p.chapterIdx + 1}장
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1 leading-tight">{p.title}</h3>
              {p.subtitle && <p className="text-xs text-gray-500 mb-3">{p.subtitle}</p>}
              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line line-clamp-[20]">
                {p.excerpt}
              </div>
            </div>
          ))}

          {/* 마지막 페이지 — CTA */}
          <div
            className={`flipbook-page ${theme.bg} flex flex-col items-center justify-center p-6 text-center rounded-r-md`}
          >
            <div className="text-3xl mb-3">📖</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">전체 본문이 궁금하다면</h3>
            <p className="text-sm text-gray-600 mb-4">12장 본문 + 표지 + 마케팅 자료 모두 포함</p>
            <Link
              href={`/share/${bookId}`}
              className={`inline-block ${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold} font-bold text-sm px-5 py-2.5 rounded-lg`}
              onClick={e => e.stopPropagation()}
            >
              📖 읽으러 가기 →
            </Link>
          </div>
        </HTMLFlipBook>
      </div>

      {/* 컨트롤 */}
      <div className="flex justify-center gap-3">
        <button
          onClick={() => flipRef.current?.pageFlip()?.flipPrev()}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          ← 이전
        </button>
        <button
          onClick={() => flipRef.current?.pageFlip()?.flipNext()}
          className={`px-4 py-2 ${theme.bgBold} ${theme.textOnBold} rounded-lg text-sm font-bold ${theme.bgBoldHover}`}
        >
          다음 →
        </button>
      </div>
    </section>
  );
}

// /book/[id] — 마케팅 랜딩 페이지 (public, no login)
// 책 표지·광고 카피·목차·작가 소개로 구매·읽기 전환 유도.
// /share/[id]는 실제 읽기 페이지, /book/[id]는 홍보 페이지.

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTheme } from "@/lib/theme-colors";
import type { ThemeColorKey, MarketingMeta } from "@/lib/storage";

interface ChapterMeta {
  id?: string;
  title: string;
  subtitle?: string;
}

interface KmongCopy {
  kmongTitle?: string;
  kmongDescription?: string;
  [k: string]: unknown;
}

interface BookData {
  id: string;
  topic: string;
  audience: string;
  type: string;
  cover?: { base64: string } | null;
  chapters: ChapterMeta[];
  themeColor?: ThemeColorKey;
  marketingMeta?: MarketingMeta | null;
  kmongCopy?: KmongCopy | null;
  createdAt: string;
}

export default function BookPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/book/${id}`)
      .then(async r => {
        if (r.status === 404) throw new Error("책을 찾을 수 없습니다.");
        if (r.status === 403) throw new Error("작가가 비공개로 설정한 책입니다.");
        if (!r.ok) throw new Error("책 정보를 불러올 수 없습니다.");
        return r.json();
      })
      .then((d: BookData) => setData(d))
      .catch(e => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <div className="text-5xl mb-4">📕</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{error}</h1>
          <p className="text-sm text-gray-500 mb-6">링크가 올바른지 확인해주세요.</p>
          <Link href="/" className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition">
            🐯 Tigerbookmaker 홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">책 정보 불러오는 중…</div>
      </div>
    );
  }

  const theme = getTheme(data.themeColor);
  const tagline = data.marketingMeta?.tagline;
  const description = data.marketingMeta?.description || data.kmongCopy?.kmongDescription;
  const authorName = data.marketingMeta?.authorName;
  const authorBio = data.marketingMeta?.authorBio;
  const shareUrl = typeof window !== "undefined" ? window.location.href : `https://tigerbookmaker.vercel.app/book/${id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleKakao = () => {
    window.open(`https://story.kakao.com/share?url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`${data.topic}${tagline ? ` — ${tagline}` : ""}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: data.topic,
          text: tagline || `${data.audience} 대상 ${data.type}`,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* 1. Header bar — 작은 Tiger 로고만 (minimal chrome) */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-orange-500 hover:text-orange-600 transition">
            <span className="text-2xl">🐯</span>
            <span className="text-base">Tigerbookmaker</span>
          </Link>
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-800 transition">
            나도 책 만들기 →
          </Link>
        </div>
      </header>

      {/* 2. Hero section */}
      <section className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* 표지 */}
          <div className="flex justify-center md:justify-end">
            {data.cover?.base64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${data.cover.base64}`}
                alt={data.topic}
                className="rounded-xl shadow-2xl w-full max-w-[360px] aspect-[3/4] object-cover"
              />
            ) : (
              <div className={`rounded-xl shadow-2xl w-full max-w-[360px] aspect-[3/4] flex items-center justify-center ${theme.bg} border-2 ${theme.accentBorder} p-6`}>
                <span className={`text-2xl font-bold text-center ${theme.accent.split(" ")[0]}`}>{data.topic}</span>
              </div>
            )}
          </div>

          {/* 텍스트 */}
          <div className="text-center md:text-left">
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${theme.bg} ${theme.accent.split(" ")[0]}`}>
                {data.audience}
              </span>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                {data.type}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 text-gray-900">
              {data.topic}
            </h1>

            {tagline && (
              <p className="text-lg md:text-xl text-gray-600 mb-6 leading-relaxed">
                {tagline}
              </p>
            )}

            <Link
              href={`/share/${id}`}
              className={`inline-block ${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold} font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition transform hover:scale-105`}
            >
              📖 읽어보기
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Share buttons */}
      <section className="max-w-5xl mx-auto px-4 pb-10 border-b border-gray-100">
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition"
          >
            {copied ? "✅ 복사됨!" : "🔗 링크 복사"}
          </button>
          <button
            onClick={handleKakao}
            className="px-4 py-2 text-sm bg-yellow-300 hover:bg-yellow-400 rounded-lg font-medium text-gray-800 transition"
          >
            💬 카카오톡
          </button>
          <button
            onClick={handleTwitter}
            className="px-4 py-2 text-sm bg-gray-900 hover:bg-black rounded-lg font-medium text-white transition"
          >
            𝕏 트위터
          </button>
          <button
            onClick={handleNativeShare}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition"
          >
            📤 공유하기
          </button>
        </div>
      </section>

      {/* 4. 설명 section */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className={`text-2xl font-bold mb-4 border-l-4 pl-3 ${theme.accentBorder}`}>책 소개</h2>
        {description ? (
          <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base md:text-lg">
            {description}
          </p>
        ) : (
          <p className="text-gray-400 italic">곧 광고 카피가 추가됩니다.</p>
        )}
      </section>

      {/* 5. 목차 section */}
      {data.chapters.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
          <h2 className={`text-2xl font-bold mb-6 border-l-4 pl-3 ${theme.accentBorder}`}>목차</h2>
          <ol className="space-y-3">
            {data.chapters.map((c, i) => (
              <li key={c.id ?? i} className="flex gap-4 items-start py-2 border-b border-gray-50 last:border-0">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full ${theme.bg} ${theme.accent.split(" ")[0]} font-bold flex items-center justify-center text-sm`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{c.title}</div>
                  {c.subtitle && (
                    <div className="text-sm text-gray-500 mt-0.5">{c.subtitle}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 6. 작가 정보 — 있을 때만 */}
      {authorName && (
        <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
          <h2 className={`text-2xl font-bold mb-6 border-l-4 pl-3 ${theme.accentBorder}`}>작가 소개</h2>
          <div className={`rounded-xl ${theme.bg} p-6`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${theme.bgBold} ${theme.textOnBold} flex items-center justify-center font-bold text-lg`}>
                {authorName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg text-gray-900">{authorName}</div>
                {authorBio && (
                  <p className="text-sm text-gray-700 mt-2 leading-relaxed whitespace-pre-line">{authorBio}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. Footer CTA */}
      <section className="bg-gray-50 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
            나도 30분에 책 한 권 만들 수 있을까?
          </h2>
          <p className="text-gray-600 mb-8">
            🐯 Tigerbookmaker — AI가 한국어 책을 자동 집필합니다.
          </p>
          <Link
            href="/"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition transform hover:scale-105"
          >
            🐯 나도 30분에 책 만들기
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Powered by 🐯 Tigerbookmaker — {new Date(data.createdAt).getFullYear()}
      </footer>
    </div>
  );
}

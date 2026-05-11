// /book/[id] — 마케팅 랜딩 페이지 (public, no login)
// 책 표지·광고 카피·목차·작가 소개로 구매·읽기 전환 유도.
// /share/[id]는 실제 읽기 페이지, /book/[id]는 홍보 페이지.

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTheme } from "@/lib/theme-colors";
import { TEMPLATES, type TemplateKey } from "@/lib/templates";
import type { ThemeColorKey, MarketingMeta } from "@/lib/storage";
import { FlipbookPreview } from "@/components/FlipbookPreview";

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

interface ABTestPublic {
  enabled: boolean;
  taglineA?: string | null;
  taglineB?: string | null;
  descriptionA?: string | null;
  descriptionB?: string | null;
}

interface BookData {
  id: string;
  topic: string;
  audience: string;
  type: string;
  cover?: { base64: string } | null;
  chapters: ChapterMeta[];
  firstChapterPreview?: string | null;
  firstChapterTitle?: string | null;
  firstChapterSubtitle?: string | null;
  flipbookPages?: Array<{ chapterIdx: number; title: string; subtitle?: string | null; excerpt: string }>;
  themeColor?: ThemeColorKey;
  template?: TemplateKey;
  marketingMeta?: MarketingMeta | null;
  kmongCopy?: KmongCopy | null;
  abTest?: ABTestPublic | null;
  seriesMembership?: { seriesId: string; seriesTitle: string; orderInSeries: number } | null;
  seriesSiblings?: Array<{ id: string; topic: string; orderInSeries: number; coverBase64: string | null }>;
  createdAt: string;
}

// Wave B5: A/B 테스트 variant cookie helpers — 같은 visitor는 sticky.
function getOrAssignVariant(bookId: string): "A" | "B" {
  if (typeof document === "undefined") return "A";
  const cookieName = `tigerbookmaker:ab:${bookId}`;
  const match = document.cookie
    .split("; ")
    .find(row => row.startsWith(`${cookieName}=`));
  if (match) {
    const v = match.slice(cookieName.length + 1);
    if (v === "A" || v === "B") return v;
  }
  const assigned: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
  // 30일 sticky
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${cookieName}=${assigned}; path=/; max-age=${maxAge}; SameSite=Lax`;
  return assigned;
}

export default function BookPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Wave B5: A/B variant — data 도착 후 abTest.enabled 확인 후 cookie 할당.
  const [variantId, setVariantId] = useState<"A" | "B" | null>(null);

  useEffect(() => {
    fetch(`/api/book/${id}`)
      .then(async r => {
        if (r.status === 404) throw new Error("책을 찾을 수 없습니다.");
        if (r.status === 403) throw new Error("작가가 비공개로 설정한 책입니다.");
        if (!r.ok) throw new Error("책 정보를 불러올 수 없습니다.");
        return r.json();
      })
      .then((d: BookData) => {
        setData(d);

        // Wave B5: A/B 활성된 책 — cookie 기반 variant 할당, track에 같이 보냄.
        const ab = d.abTest;
        const abActive = !!(ab && ab.enabled && (ab.taglineA || ab.taglineB || ab.descriptionA || ab.descriptionB));
        const v = abActive ? getOrAssignVariant(id) : null;
        setVariantId(v);

        // 페이지 방문 추적 (silent, 실패 무시)
        fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageType: "book", pageId: id, variantId: v }),
        }).catch(() => {});
      })
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
  // Wave B5: A/B variant override — variantId 있으면 해당 variant의 tagline/description 우선.
  const ab = data.abTest;
  const abVariantTagline =
    variantId === "A" ? ab?.taglineA :
    variantId === "B" ? ab?.taglineB : null;
  const abVariantDescription =
    variantId === "A" ? ab?.descriptionA :
    variantId === "B" ? ab?.descriptionB : null;

  const tagline = (abVariantTagline && abVariantTagline.trim()) || data.marketingMeta?.tagline;
  const description = (abVariantDescription && abVariantDescription.trim()) || data.marketingMeta?.description || data.kmongCopy?.kmongDescription;
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

            {data.template && TEMPLATES[data.template] && (
              <div className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded ${theme.bg} ${theme.accent.split(" ")[0]} mt-2`}>
                📐 {TEMPLATES[data.template].label}
              </div>
            )}

            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 text-gray-900">
              {data.topic}
            </h1>

            {tagline && (
              <p className="text-lg md:text-xl text-gray-600 mb-6 leading-relaxed">
                {tagline}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                href={`/share/${id}`}
                className={`inline-block ${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold} font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition transform hover:scale-105`}
              >
                📖 읽어보기
              </Link>
              <Link
                href={`/book/${id}/chat`}
                className={`inline-block bg-white border-2 ${theme.accentBorder} ${theme.accent.split(" ")[0]} font-bold text-lg px-8 py-4 rounded-xl shadow-md hover:shadow-lg transition transform hover:scale-105`}
              >
                💬 이 책에 대해 질문 →
              </Link>
            </div>
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

      {/* 4. 설명 section — 설명이 있을 때만 노출. 없으면 본문으로 바로 안내. */}
      {description ? (
        <section className="max-w-3xl mx-auto px-4 py-12">
          <h2 className={`text-2xl font-bold mb-4 border-l-4 pl-3 ${theme.accentBorder}`}>책 소개</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base md:text-lg">
            {description}
          </p>
        </section>
      ) : (
        <section className="max-w-3xl mx-auto px-4 py-10">
          <div className={`rounded-2xl border ${theme.accentBorder} ${theme.bg} p-6 md:p-8 text-center`}>
            <div className="text-3xl mb-3">📖</div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
              {data.audience} 대상 {data.type}
            </h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              {data.chapters.length > 0
                ? `${data.chapters.length}장 본문이 준비되어 있습니다. 직접 읽어보시고 판단해주세요.`
                : "본문이 곧 추가됩니다. 잠시 후 다시 확인해주세요."}
            </p>
            {data.chapters.length > 0 && (
              <Link
                href={`/share/${id}`}
                className={`inline-block ${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold} font-bold text-sm px-5 py-2.5 rounded-lg shadow transition`}
              >
                📖 본문 바로 읽기 →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 4.5. 인터랙티브 flipbook 미리보기 (첫 2장의 첫 페이지) — 모바일 fallback 내장 */}
      {data.flipbookPages && data.flipbookPages.length > 0 && (
        <FlipbookPreview
          bookId={data.id}
          bookTopic={data.topic}
          coverBase64={data.cover?.base64}
          pages={data.flipbookPages}
          theme={theme}
        />
      )}

      {/* 5. 목차 section */}
      {data.chapters.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
          <h2 className={`text-2xl font-bold mb-6 border-l-4 pl-3 ${theme.accentBorder}`}>목차</h2>
          {(() => {
            const t = data.template ?? "minimal";
            if (t === "practical") {
              return (
                <ul className="space-y-2.5">
                  {data.chapters.map((c, i) => (
                    <li key={c.id ?? i} className="flex gap-3 items-start py-1.5">
                      <span className={`flex-shrink-0 mt-0.5 inline-block w-5 h-5 border-2 ${theme.accentBorder.replace("border-l-", "border-")} rounded-sm`}></span>
                      <span className="text-gray-900">{c.title}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (t === "classic") {
              return (
                <ol className="space-y-3" style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
                  {data.chapters.map((c, i) => (
                    <li key={c.id ?? i} className="flex justify-between py-2 border-b border-dotted border-gray-300">
                      <span>{c.title}</span>
                      <span className="text-gray-400 text-sm">CH {i + 1}</span>
                    </li>
                  ))}
                </ol>
              );
            }
            if (t === "editorial") {
              return (
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.chapters.map((c, i) => (
                    <div key={c.id ?? i} className={`p-4 rounded-lg ${theme.bg}`}>
                      <div className={`text-[10px] font-mono uppercase tracking-widest ${theme.accent.split(" ")[0]} font-bold mb-1`}>ISSUE {i + 1}</div>
                      <div className="font-bold text-gray-900">{c.title}</div>
                      {c.subtitle && <div className="text-xs text-gray-600 mt-1">{c.subtitle}</div>}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <ol className="space-y-3">
                {data.chapters.map((c, i) => (
                  <li key={c.id ?? i} className="flex gap-4 items-start py-2 border-b border-gray-50 last:border-0">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full ${theme.bg} ${theme.accent.split(" ")[0]} font-bold flex items-center justify-center text-sm`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{c.title}</div>
                      {c.subtitle && <div className="text-sm text-gray-500 mt-0.5">{c.subtitle}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            );
          })()}
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

      {/* 6.3 무료 1장 미리보기 구독 */}
      <SubscribeSection bookId={id} themeAccentBorder={theme.accentBorder} themeBgBold={theme.bgBold} themeBgBoldHover={theme.bgBoldHover} themeTextOnBold={theme.textOnBold} />

      {/* 6.4 독자 후기·평점 */}
      <ReviewsSection bookId={id} themeAccent={theme.accent.split(" ")[0]} themeAccentBorder={theme.accentBorder} />

      {/* 6.5 시리즈 형제 책 — 같은 시리즈 다른 책 */}
      {data.seriesSiblings && data.seriesSiblings.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12 border-t border-gray-100">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className={`text-2xl font-bold border-l-4 pl-3 ${theme.accentBorder}`}>
              📚 이 시리즈의 다른 책
            </h2>
            {data.seriesMembership?.seriesTitle && (
              <span className="text-sm text-gray-500">{data.seriesMembership.seriesTitle}</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {data.seriesSiblings.map(s => (
              <Link
                key={s.id}
                href={`/book/${s.id}`}
                className="group block"
              >
                <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition border border-gray-100 bg-gray-50">
                  {s.coverBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${s.coverBase64}`}
                      alt={s.topic}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className={`w-full h-full ${theme.bg} flex items-center justify-center p-4`}>
                      <span className={`text-sm font-bold text-center ${theme.accent.split(" ")[0]}`}>
                        {s.topic}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-2 px-1">
                  {s.orderInSeries > 0 && (
                    <div className={`text-[10px] font-mono font-bold ${theme.accent.split(" ")[0]} mb-0.5`}>
                      Vol. {s.orderInSeries}
                    </div>
                  )}
                  <div className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-tiger-orange transition">
                    {s.topic}
                  </div>
                </div>
              </Link>
            ))}
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

function SubscribeSection({ bookId, themeAccentBorder, themeBgBold, themeBgBoldHover, themeTextOnBold }: { bookId: string; themeAccentBorder: string; themeBgBold: string; themeBgBoldHover: string; themeTextOnBold: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg("⚠️ 올바른 이메일을 입력해주세요");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/book/${bookId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setMsg(`✓ ${data.message || "이메일로 발송됐어요. 받은편지함을 확인해주세요."}`);
      setDone(true);
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
      <div className={`rounded-2xl border-2 ${themeAccentBorder.replace("border-l-", "border-")} p-6 md:p-8`}>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">📧 1장 무료로 받기</h2>
        <p className="text-sm text-gray-600 mb-4">이메일 입력하면 1장 본문을 즉시 받아볼 수 있어요. 책이 본인에게 맞는지 확인 후 결정하세요.</p>
        {done ? (
          <p className="text-sm text-green-700">{msg}</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={busy}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-tiger-orange"
              />
              <button
                onClick={submit}
                disabled={busy}
                className={`px-6 py-3 ${themeBgBold} ${themeBgBoldHover} ${themeTextOnBold} font-bold rounded-lg transition disabled:opacity-50 whitespace-nowrap`}
              >
                {busy ? "발송 중..." : "📨 1장 받기"}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">스팸 X. 언제든 구독 취소 가능. 작가가 다음에 새 책을 내면 알림 받을 수 있어요.</p>
            {msg && <p className={`text-xs mt-2 ${msg.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>{msg}</p>}
          </>
        )}
      </div>
    </section>
  );
}

interface Review {
  id: string;
  readerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

function ReviewsSection({ bookId, themeAccent, themeAccentBorder }: { bookId: string; themeAccent: string; themeAccentBorder: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRating, setFormRating] = useState<number>(5);
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book/${bookId}/review`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setReviews(d.reviews ?? []);
          setAvg(d.averageRating ?? 0);
          setCount(d.totalCount ?? 0);
        }
      })
      .catch(() => {});
  }, [bookId]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch(`/api/book/${bookId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readerName: formName,
          readerEmail: formEmail || undefined,
          rating: formRating,
          comment: formComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "후기 등록 실패");
      setSubmitMsg("✓ 등록됐어요. 작가 승인 후 페이지에 표시됩니다.");
      setFormName("");
      setFormEmail("");
      setFormRating(5);
      setFormComment("");
      setTimeout(() => setShowForm(false), 2000);
    } catch (e: any) {
      setSubmitMsg(`⚠️ ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className={`text-2xl font-bold border-l-4 pl-3 ${themeAccentBorder}`}>독자 후기</h2>
        <div className="flex items-center gap-3">
          {count > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-yellow-500 text-lg">{"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))}</span>
              <span className="font-bold text-gray-900">{avg.toFixed(1)}</span>
              <span className="text-gray-500">({count})</span>
            </div>
          )}
          <button
            onClick={() => setShowForm(s => !s)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md border ${themeAccent} ${themeAccentBorder} hover:bg-orange-50 transition`}
          >
            {showForm ? "취소" : "✏️ 후기 쓰기"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="이름 (또는 닉네임)"
              maxLength={50}
              className="text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-tiger-orange"
            />
            <input
              type="email"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              placeholder="이메일 (선택, 작가 답글 받기)"
              className="text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-tiger-orange"
            />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-600">별점:</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setFormRating(n)}
                className={`text-2xl transition ${n <= formRating ? "text-yellow-500" : "text-gray-300 hover:text-yellow-300"}`}
                aria-label={`${n}점`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={formComment}
            onChange={e => setFormComment(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="이 책을 읽고 어떤 점이 좋았나요? (10자 이상)"
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-tiger-orange resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-gray-500">{formComment.length}/2000자 · 작가 승인 후 게시</span>
            <button
              onClick={submit}
              disabled={submitting || !formName || formComment.length < 10}
              className="px-4 py-2 text-xs bg-tiger-orange text-white font-bold rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? "전송 중..." : "후기 보내기"}
            </button>
          </div>
          {submitMsg && (
            <p className={`text-xs mt-2 ${submitMsg.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>{submitMsg}</p>
          )}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-400 italic">아직 후기가 없어요. 첫 번째 후기를 남겨주세요.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                <span className="font-bold text-sm text-gray-900">{r.readerName}</span>
                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// /u/[handle] — 작가 공개 프로필 (link-in-bio, Litt.ly 클론)
// 한 URL에 작가 avatar/bio + 외부 링크 + 모든 공개 책. 인스타 bio 한 줄용.
// NOT_FOUND 시 깔끔한 404 카드. Header 미사용 (minimal chrome).

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTheme } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

interface SocialLink {
  label: string;
  url: string;
}

interface BookCard {
  id: string;
  topic: string;
  type: string;
  themeColor: string;
  tagline: string | null;
  cover: { base64: string } | null;
  createdAt: string;
}

interface ProfileData {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: SocialLink[];
  books: BookCard[];
}

// URL → 이모지 매핑 (간단한 detection)
function socialIcon(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "📷";
  if (u.includes("twitter.com") || u.includes("x.com")) return "🐦";
  if (u.includes("kakao")) return "💬";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "▶️";
  if (u.includes("github.com")) return "🐙";
  if (u.includes("tiktok.com")) return "🎵";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "👍";
  if (u.includes("linkedin.com")) return "💼";
  if (u.startsWith("mailto:") || u.includes("@")) return "✉️";
  return "🌐";
}

export default function UserProfilePage({ params }: { params: { handle: string } }) {
  const { handle } = params;
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 이메일 구독
  const [subEmail, setSubEmail] = useState("");
  const [subState, setSubState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [subMessage, setSubMessage] = useState<string>("");

  const submitSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subState === "submitting") return;
    setSubState("submitting");
    setSubMessage("");
    try {
      const res = await fetch("/api/profile/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, email: subEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubState("error");
        setSubMessage(data?.message || "구독 실패");
        return;
      }
      setSubState("success");
      setSubMessage("구독 완료 — 새 책이 나오면 알려드릴게요.");
      setSubEmail("");
    } catch (e: any) {
      setSubState("error");
      setSubMessage(e?.message || "구독 실패");
    }
  };

  useEffect(() => {
    fetch(`/api/u/${handle}`)
      .then(async r => {
        if (r.status === 404) throw new Error("NOT_FOUND");
        if (!r.ok) throw new Error("프로필을 불러올 수 없습니다.");
        return r.json();
      })
      .then((d: ProfileData) => setData(d))
      .catch(e => setError(e.message));

    // 페이지 방문 추적 (silent, 실패 무시)
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageType: "profile", pageId: handle }),
    }).catch(() => {});
  }, [handle]);

  // NOT_FOUND 상태 — 깔끔한 404 카드
  if (error === "NOT_FOUND") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">프로필을 찾을 수 없어요</h1>
          <p className="text-sm text-gray-500 mb-6">
            <span className="font-mono">@{handle}</span> 작가가 존재하지 않거나 handle이 변경되었습니다.
          </p>
          <Link
            href="/"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            🐯 Tigerbookmaker 홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{error}</h1>
          <Link href="/" className="inline-block mt-4 text-orange-500 hover:text-orange-600 font-semibold">
            홈으로 →
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">프로필 불러오는 중…</div>
      </div>
    );
  }

  const initial = (data.displayName || data.handle).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-2xl mx-auto px-4 py-10 md:py-14">

        {/* 1. Hero — avatar + name + handle + bio */}
        <section className="text-center mb-10">
          <div className="flex justify-center mb-4">
            {data.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatarUrl}
                alt={data.displayName}
                className="w-[100px] h-[100px] rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {initial}
              </div>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            {data.displayName}
          </h1>
          <div className="text-sm text-gray-500 mt-1">@{data.handle}</div>
          {data.bio && (
            <p className="mt-4 text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line max-w-md mx-auto">
              {data.bio}
            </p>
          )}
        </section>

        {/* 2. Social links — pill buttons */}
        {data.socialLinks.length > 0 && (
          <section className="mb-10 space-y-3">
            {data.socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-800 font-semibold px-5 py-3.5 rounded-full transition shadow-sm hover:shadow-md"
              >
                <span className="text-xl">{socialIcon(link.url)}</span>
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </section>
        )}

        {/* 3. Books grid */}
        <section className="mb-10">
          {data.books.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
                내 책 {data.books.length}권
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.books.map(book => {
                  const theme = getTheme((book.themeColor as ThemeColorKey | undefined) ?? "orange");
                  // theme.accent → "text-{color}-600 border-{color}-500"
                  // theme.accentBorder → "border-l-{color}-500"
                  const accentText = theme.accent.split(" ")[0]; // "text-{color}-600"
                  return (
                    <Link
                      key={book.id}
                      href={`/book/${book.id}`}
                      className={`group block bg-white rounded-xl overflow-hidden border border-gray-100 border-l-4 ${theme.accentBorder} shadow-sm hover:shadow-lg transition-all hover:-translate-y-1`}
                    >
                      {/* 표지 — 3:4 aspect */}
                      <div className="aspect-[3/4] w-full overflow-hidden bg-gray-50">
                        {book.cover?.base64 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`data:image/png;base64,${book.cover.base64}`}
                            alt={book.topic}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${theme.bg} p-3`}>
                            <span className={`text-sm md:text-base font-bold text-center ${accentText} line-clamp-4`}>
                              {book.topic}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* 제목 + tagline */}
                      <div className={`p-3 ${theme.bg}`}>
                        <div className={`font-semibold text-sm ${accentText} line-clamp-2 leading-snug`}>
                          {book.topic}
                        </div>
                        {book.tagline && (
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2 leading-snug">
                            {book.tagline}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12 px-4 bg-gray-50 rounded-xl">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-sm text-gray-500">
                아직 공개된 책이 없습니다.
              </p>
            </div>
          )}
        </section>

        {/* 4. 이메일 구독 */}
        <section className="mb-10">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <div className="text-center mb-3">
              <div className="text-base font-bold text-gray-900">📧 새 책 나오면 알림</div>
              <div className="text-xs text-gray-600 mt-1">
                {data.displayName}님의 새 책이 나오면 이메일로 알려드릴게요.
              </div>
            </div>
            <form onSubmit={submitSubscribe} className="flex gap-2 flex-wrap">
              <input
                type="email"
                required
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={subState === "submitting"}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={subState === "submitting" || !subEmail.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
              >
                {subState === "submitting" ? "구독 중…" : "구독"}
              </button>
            </form>
            {subState === "success" && (
              <div className="mt-2 text-xs text-green-700">✓ {subMessage}</div>
            )}
            {subState === "error" && (
              <div className="mt-2 text-xs text-red-600">✗ {subMessage}</div>
            )}
          </div>
        </section>

        {/* 5. Footer */}
        <footer className="text-center pt-8 pb-4 border-t border-gray-100">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-orange-500 transition"
          >
            Powered by 🐯 Tigerbookmaker
          </Link>
        </footer>
      </main>
    </div>
  );
}

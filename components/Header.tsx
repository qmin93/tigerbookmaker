"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export function Header({ variant = "default" }: { variant?: "default" | "minimal" | "dark" }) {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(d.balance_krw))
      .catch(() => {});
  }, [status]);

  const loggedIn = status === "authenticated";
  const dark = variant === "dark";

  const headerCls = dark
    ? "border-b border-ink-700/60 bg-ink-900/70 backdrop-blur-xl sticky top-0 z-40"
    : "border-b border-gray-100 bg-white sticky top-0 z-40";
  const linkCls = dark ? "text-ink-300 hover:text-white" : "text-gray-600 hover:text-tiger-orange";
  const brandCls = dark ? "text-white" : "";
  const ctaCls = dark
    ? "px-4 py-2 bg-white text-ink-900 rounded-lg hover:bg-tiger-orange hover:text-white transition font-bold"
    : "px-4 py-2 bg-tiger-dark text-white rounded-lg hover:bg-tiger-orange transition";

  return (
    <header className={headerCls}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className={`flex items-center gap-2 ${brandCls}`}>
          <span className="text-2xl">🐯</span>
          <span className="font-black tracking-tight">Tigerbookmaker</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          {loggedIn ? (
            <>
              <Link href="/projects" className={`hidden sm:inline font-bold ${linkCls}`}>
                내 책
              </Link>
              <Link href="/billing" className={dark
                ? "bg-tiger-orange/10 text-tiger-orange font-bold px-3 py-2 rounded-lg hover:bg-tiger-orange/20 border border-tiger-orange/30"
                : "bg-orange-50 text-tiger-orange font-bold px-3 py-2 rounded-lg hover:bg-orange-100"}>
                ₩{balance?.toLocaleString() ?? "—"}
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className={dark
                    ? "w-9 h-9 rounded-full bg-white text-ink-900 flex items-center justify-center font-bold"
                    : "w-9 h-9 rounded-full bg-tiger-dark text-white flex items-center justify-center font-bold"}
                  title={session?.user?.email ?? ""}
                >
                  {session?.user?.email?.[0]?.toUpperCase() ?? "?"}
                </button>
                {menuOpen && (
                  <div className={dark
                    ? "absolute right-0 mt-2 w-48 bg-ink-850 border border-ink-700 rounded-xl shadow-2xl py-2 text-sm text-ink-100"
                    : "absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 text-sm"}>
                    <div className={dark
                      ? "px-4 py-2 text-xs text-ink-400 truncate border-b border-ink-700"
                      : "px-4 py-2 text-xs text-gray-500 truncate border-b border-gray-100"}>
                      {session?.user?.email}
                    </div>
                    <Link href="/projects" className={dark ? "block px-4 py-2 hover:bg-ink-800" : "block px-4 py-2 hover:bg-gray-50"}>내 책</Link>
                    <Link href="/billing" className={dark ? "block px-4 py-2 hover:bg-ink-800" : "block px-4 py-2 hover:bg-gray-50"}>잔액 / 베타 안내</Link>
                    <Link href="/usage" className={dark ? "block px-4 py-2 hover:bg-ink-800" : "block px-4 py-2 hover:bg-gray-50"}>사용 내역</Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className={dark
                        ? "block w-full text-left px-4 py-2 hover:bg-ink-800 text-red-400"
                        : "block w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600"}
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {(variant === "default" || dark) && (
                <>
                  <Link href="/#pricing" className={`hidden sm:inline ${linkCls}`}>가격</Link>
                  <Link href="/#samples" className={`hidden sm:inline ${linkCls}`}>샘플</Link>
                </>
              )}
              <Link href="/login" className={`font-bold ${linkCls}`}>로그인</Link>
              <Link href="/login" className={ctaCls}>
                시작하기
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

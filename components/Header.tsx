"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function Header({ variant = "default" }: { variant?: "default" | "minimal" | "dark" }) {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);          // 데스크탑 아바타 드롭다운
  const [mobileNavOpen, setMobileNavOpen] = useState(false);// 모바일 풀스크린 메뉴
  const [headerHidden, setHeaderHidden] = useState(false);  // 스크롤 다운 시 숨김
  const lastY = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBalance(d.balance_krw))
      .catch(() => {});
  }, [status]);

  // 추천 코드 자동 apply — 모든 페이지에서 발동 (sessionStorage 가드)
  useEffect(() => {
    if (status !== "authenticated") return;
    const code = (() => {
      try { return localStorage.getItem("tigerbookmaker_ref_code"); }
      catch { return null; }
    })();
    if (!code) return;

    const attempted = (() => {
      try { return sessionStorage.getItem("tigerbookmaker_ref_attempted"); }
      catch { return null; }
    })();
    if (attempted) return;
    try { sessionStorage.setItem("tigerbookmaker_ref_attempted", "1"); } catch {}

    fetch("/api/referral/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        try { localStorage.removeItem("tigerbookmaker_ref_code"); } catch {}
        try { document.cookie = "tigerbookmaker_ref_code=; path=/; max-age=0; SameSite=Lax"; } catch {}
        if (data?.awarded) {
          fetch("/api/me")
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setBalance(d.balance_krw))
            .catch(() => {});
        }
      })
      .catch(() => {
        try { localStorage.removeItem("tigerbookmaker_ref_code"); } catch {}
      });
  }, [status]);

  // 스크롤 다운 시 헤더 숨김 / 업 시 등장. 100px 이내는 항상 표시.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 100) {
        setHeaderHidden(false);
      } else if (delta > 8) {
        setHeaderHidden(true);
        setMenuOpen(false);
      } else if (delta < -8) {
        setHeaderHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 모바일 메뉴 열렸을 때 body 스크롤 잠금
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileNavOpen]);

  const loggedIn = status === "authenticated";
  const dark = variant === "dark";

  const headerCls = [
    dark
      ? "border-b border-ink-700/60 bg-ink-900/70 backdrop-blur-xl"
      : "border-b border-gray-100 bg-white",
    "sticky top-0 z-40 transition-transform duration-300",
    headerHidden ? "-translate-y-full" : "translate-y-0",
  ].join(" ");

  const desktopLinkCls = dark
    ? "hidden sm:inline text-ink-300 hover:text-white py-2"
    : "hidden sm:inline text-gray-600 hover:text-tiger-orange py-2";

  const balancePillCls = dark
    ? "bg-tiger-orange/10 text-tiger-orange font-bold px-3 py-2 rounded-lg hover:bg-tiger-orange/20 border border-tiger-orange/30"
    : "bg-orange-50 text-tiger-orange font-bold px-3 py-2 rounded-lg hover:bg-orange-100";

  const avatarCls = dark
    ? "w-9 h-9 rounded-full bg-white text-ink-900 flex items-center justify-center font-bold"
    : "w-9 h-9 rounded-full bg-tiger-dark text-white flex items-center justify-center font-bold";

  const dropdownCls = dark
    ? "absolute right-0 mt-2 w-48 bg-ink-850 border border-ink-700 rounded-xl shadow-2xl py-2 text-sm text-ink-100"
    : "absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 text-sm";

  const dropdownItemCls = dark ? "block px-4 py-2 hover:bg-ink-800" : "block px-4 py-2 hover:bg-gray-50";

  const ctaCls = dark
    ? "px-4 py-2 bg-white text-ink-900 rounded-lg hover:bg-tiger-orange hover:text-white transition font-bold"
    : "px-4 py-2 bg-tiger-dark text-white rounded-lg hover:bg-tiger-orange transition";

  return (
    <>
      <header className={headerCls}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className={`flex items-center gap-2 py-2 -my-2 ${dark ? "text-white" : ""}`}>
            <span className="text-2xl">🐯</span>
            <span className="font-black tracking-tight">Tigerbookmaker</span>
          </Link>

          {/* 데스크탑 nav — sm 이상 */}
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/pricing" className={desktopLinkCls}>가격</Link>
            {loggedIn ? (
              <>
                <Link href="/projects" className={`${desktopLinkCls} font-bold`}>내 책</Link>
                <Link href="/billing" className={balancePillCls}>
                  ₩{balance?.toLocaleString() ?? "—"}
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className={avatarCls}
                    title={session?.user?.email ?? ""}
                    aria-label="계정 메뉴"
                    aria-expanded={menuOpen}
                  >
                    {session?.user?.email?.[0]?.toUpperCase() ?? "?"}
                  </button>
                  {menuOpen && (
                    <div className={dropdownCls}>
                      <div className={dark
                        ? "px-4 py-2 text-xs text-ink-400 truncate border-b border-ink-700"
                        : "px-4 py-2 text-xs text-gray-500 truncate border-b border-gray-100"}>
                        {session?.user?.email}
                      </div>
                      <Link href="/projects" className={dropdownItemCls} onClick={() => setMenuOpen(false)}>내 책</Link>
                      <Link href="/profile" className={dropdownItemCls} onClick={() => setMenuOpen(false)}>내 프로필</Link>
                      <Link href="/billing" className={dropdownItemCls} onClick={() => setMenuOpen(false)}>잔액 / 충전</Link>
                      <Link href="/usage" className={dropdownItemCls} onClick={() => setMenuOpen(false)}>사용 내역</Link>
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
                  <Link href="/#samples" className={desktopLinkCls}>샘플</Link>
                )}
                <Link href="/login" className={dark
                  ? "text-ink-300 hover:text-white py-2 px-2 -mx-2 font-bold"
                  : "text-gray-600 hover:text-tiger-orange py-2 px-2 -mx-2 font-bold"}>로그인</Link>
                <Link href="/login" className={ctaCls}>시작하기</Link>
              </>
            )}
          </nav>

          {/* 모바일 햄버거 — sm 미만 */}
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="메뉴 열기"
            className={`sm:hidden flex items-center justify-center w-11 h-11 -mr-2 rounded-lg ${
              dark ? "text-white hover:bg-ink-800" : "text-ink-900 hover:bg-gray-100"
            }`}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* 모바일 풀스크린 메뉴 — sm 미만에서만 노출 */}
      {mobileNavOpen && (
        <div
          className={`fixed inset-0 z-50 sm:hidden flex flex-col ${dark ? "bg-ink-900 text-white" : "bg-white text-ink-900"}`}
          role="dialog"
          aria-modal="true"
          aria-label="메인 메뉴"
        >
          <div className={`flex items-center justify-between px-6 py-4 border-b ${dark ? "border-ink-700" : "border-gray-100"}`}>
            <Link
              href="/"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2"
            >
              <span className="text-2xl">🐯</span>
              <span className="font-black tracking-tight">Tigerbookmaker</span>
            </Link>
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="메뉴 닫기"
              className={`w-11 h-11 -mr-2 rounded-lg flex items-center justify-center ${dark ? "hover:bg-ink-800" : "hover:bg-gray-100"}`}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-6 py-4 text-lg font-bold">
            {loggedIn ? (
              <>
                <MobileLink href="/projects" onClick={() => setMobileNavOpen(false)} dark={dark}>내 책</MobileLink>
                <MobileLink href="/new" onClick={() => setMobileNavOpen(false)} dark={dark}>+ 새 책 만들기</MobileLink>
                <MobileLink href="/billing" onClick={() => setMobileNavOpen(false)} dark={dark}>
                  충전 <span className={`ml-2 text-sm font-mono ${dark ? "text-ink-300" : "text-gray-500"}`}>잔액 ₩{balance?.toLocaleString() ?? "—"}</span>
                </MobileLink>
                <MobileLink href="/usage" onClick={() => setMobileNavOpen(false)} dark={dark}>사용 내역</MobileLink>
                <MobileLink href="/profile" onClick={() => setMobileNavOpen(false)} dark={dark}>내 프로필</MobileLink>
                <MobileLink href="/pricing" onClick={() => setMobileNavOpen(false)} dark={dark}>가격</MobileLink>
                <button
                  onClick={() => { setMobileNavOpen(false); signOut({ callbackUrl: "/" }); }}
                  className={`block w-full text-left py-4 border-b ${dark ? "border-ink-700 text-red-400" : "border-gray-100 text-red-600"}`}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <MobileLink href="/pricing" onClick={() => setMobileNavOpen(false)} dark={dark}>가격</MobileLink>
                <MobileLink href="/#samples" onClick={() => setMobileNavOpen(false)} dark={dark}>샘플</MobileLink>
                <MobileLink href="/login" onClick={() => setMobileNavOpen(false)} dark={dark}>로그인</MobileLink>
                <div className="mt-8">
                  <Link
                    href="/login"
                    onClick={() => setMobileNavOpen(false)}
                    className="block text-center px-6 py-4 bg-tiger-orange text-white rounded-xl font-bold"
                  >
                    무료로 시작 — ₩5,000 크레딧 받기 →
                  </Link>
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

function MobileLink({ href, children, onClick, dark }: { href: string; children: React.ReactNode; onClick?: () => void; dark: boolean }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block py-4 border-b ${dark ? "border-ink-700" : "border-gray-100"}`}
    >
      {children}
    </Link>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Mode = "password" | "magiclink" | "register";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace("/projects");
  }, [status, router]);

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const needsAgreement = mode === "register" || mode === "magiclink";
  const agreed = !needsAgreement || (agreeTerms && agreePrivacy);
  const canSubmit = email.includes("@") && agreed
    && (mode === "magiclink" || password.length >= 8);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.message || `가입 실패 (${res.status})`);
        }
        // 가입 성공 → 자동 로그인
        const r = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/projects" });
        if (r?.error) throw new Error(r.error);
        if (r?.ok) window.location.href = "/projects";
        return;
      }
      if (mode === "password") {
        const r = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/projects" });
        if (r?.error) throw new Error("이메일 또는 비밀번호가 일치하지 않습니다.");
        if (r?.ok) window.location.href = "/projects";
        return;
      }
      // magiclink
      const r = await signIn("nodemailer", { email, redirect: false, callbackUrl: "/projects" });
      if (r?.error) throw new Error(r.error);
      setSent(true);
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-200">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-black tracking-tightest text-ink-900 mb-2">이메일을 확인해주세요</h1>
          <p className="text-gray-600 mb-6 font-mono text-sm">{email}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-6">로그인 링크 발송 완료</p>
          <button onClick={() => setSent(false)} className="text-sm text-tiger-orange hover:underline">
            다시 보내기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6 py-10">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-gray-200">
        <Link href="/" className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🐯</span>
          <span className="font-black tracking-tightest text-ink-900">Tigerbookmaker</span>
        </Link>

        {/* 모드 토글 */}
        <div className="flex border border-gray-200 rounded-lg p-1 mb-6 text-sm font-bold">
          <button
            type="button"
            onClick={() => { setMode("password"); setError(null); }}
            className={`flex-1 py-2 rounded-md transition ${mode === "password" ? "bg-ink-900 text-white" : "text-gray-500 hover:text-ink-900"}`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-2 rounded-md transition ${mode === "register" ? "bg-ink-900 text-white" : "text-gray-500 hover:text-ink-900"}`}
          >
            회원가입
          </button>
        </div>

        <h1 className="text-xl font-black mb-1">
          {mode === "register" ? "회원가입" : mode === "magiclink" ? "이메일 링크 로그인" : "로그인"}
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          {mode === "register"
            ? "이메일과 비밀번호로 가입합니다. 자동으로 1,000원 크레딧이 지급됩니다."
            : mode === "magiclink"
            ? "이메일로 로그인 링크를 보내드립니다."
            : "이메일과 비밀번호를 입력하세요."}
        </p>

        {/* Google 로그인 — 환경변수 있을 때만 보임 */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/projects" })}
          className="w-full flex items-center justify-center gap-3 py-3 border border-gray-200 rounded-lg font-bold hover:bg-[#fafafa] mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fillRule="evenodd">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </g>
          </svg>
          Google로 계속하기
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400">또는</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-bold block mb-1">이메일</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-tiger-orange focus:outline-none"
            />
          </div>

          {(mode === "password" || mode === "register") && (
            <div>
              <label className="text-xs font-bold block mb-1">
                비밀번호 {mode === "register" && <span className="text-gray-400 font-normal">(8자 이상)</span>}
              </label>
              <input
                type="password"
                required
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-tiger-orange focus:outline-none"
              />
            </div>
          )}

          {needsAgreement && (
            <div className="space-y-2 text-sm pt-1">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="mt-1" />
                <span><Link href="/legal/terms" className="text-tiger-orange hover:underline">이용약관</Link>에 동의합니다 (필수)</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)} className="mt-1" />
                <span><Link href="/legal/privacy" className="text-tiger-orange hover:underline">개인정보처리방침</Link>에 동의합니다 (필수)</span>
              </label>
            </div>
          )}

          {error && <div className="text-sm text-red-600 p-2 bg-red-50 rounded">{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "처리 중..." : mode === "register" ? "회원가입 + 1,000원 받기" : mode === "magiclink" ? "로그인 링크 받기" : "로그인"}
          </button>
        </form>

        <div className="text-center text-xs text-gray-500 mt-5">
          {mode === "magiclink" ? (
            <button onClick={() => setMode("password")} className="hover:text-tiger-orange">
              ← 비밀번호 로그인으로 돌아가기
            </button>
          ) : (
            <div className="space-y-1">
              <Link href="/reset-password" className="block hover:text-tiger-orange">
                비밀번호를 잊으셨나요?
              </Link>
              <button onClick={() => { setMode("magiclink"); setError(null); }} className="hover:text-tiger-orange">
                또는 이메일 링크로 로그인
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

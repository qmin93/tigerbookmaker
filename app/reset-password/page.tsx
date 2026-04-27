"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function Inner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [mode] = useState<"request" | "confirm">(token ? "confirm" : "request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "request" ? { mode, email } : { mode, token, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `요청 실패 (${res.status})`);
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done && mode === "request") {
    return (
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-200">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-2xl font-black mb-2">이메일 확인</h1>
        <p className="text-gray-600 mb-6">해당 이메일로 가입한 계정이 있다면 30분간 유효한 재설정 링크를 보냈습니다.</p>
        <Link href="/login" className="text-sm text-tiger-orange hover:underline">로그인으로 돌아가기</Link>
      </div>
    );
  }
  if (done && mode === "confirm") {
    return (
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-200">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-black mb-2">비밀번호 변경 완료</h1>
        <p className="text-gray-600 mb-6">새 비밀번호로 로그인할 수 있습니다.</p>
        <Link href="/login" className="inline-block px-6 py-3 bg-ink-900 text-white font-bold rounded-lg">로그인</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-8 max-w-md w-full border border-gray-200 space-y-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-2xl">🐯</span>
        <span className="font-black tracking-tight">Tigerbookmaker</span>
      </Link>
      <h1 className="text-2xl font-black">
        {mode === "request" ? "비밀번호 재설정" : "새 비밀번호 설정"}
      </h1>
      <p className="text-sm text-gray-600">
        {mode === "request"
          ? "가입한 이메일을 입력하세요. 재설정 링크를 보내드립니다."
          : "새 비밀번호를 입력하세요 (8자 이상)."}
      </p>
      {mode === "request" ? (
        <input
          type="email" required placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-tiger-orange focus:outline-none"
        />
      ) : (
        <input
          type="password" required minLength={8} placeholder="새 비밀번호 (8자 이상)"
          value={password} onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-tiger-orange focus:outline-none"
        />
      )}
      {error && <div className="text-sm text-red-600 p-2 bg-red-50 rounded">{error}</div>}
      <button
        type="submit"
        disabled={busy || (mode === "request" ? !email.includes("@") : password.length < 8)}
        className="w-full py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange disabled:opacity-40"
      >
        {busy ? "처리 중..." : mode === "request" ? "재설정 링크 받기" : "비밀번호 변경"}
      </button>
      <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-tiger-orange">
        ← 로그인으로
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6 py-10">
      <Suspense fallback={<div>로딩...</div>}>
        <Inner />
      </Suspense>
    </main>
  );
}

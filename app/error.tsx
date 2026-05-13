// 500 / runtime 에러 페이지 — 브랜드 톤 + 복구 액션
// Next.js 14 — 자동으로 ErrorBoundary 역할.

"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#fafafa] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-7xl mb-6">🐯</div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-red-600 mb-3">
          500 — 예상치 못한 오류
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-4">
          호랑이가<br />잠시 졸았어요.
        </h1>
        <p className="text-gray-600 mb-2 leading-relaxed">
          잠깐 문제가 생겼습니다. 다시 시도하면 풀릴 가능성이 높아요.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-gray-400 mb-6">
            ID: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-tiger-orange text-white font-bold hover:bg-orange-600 transition"
          >
            🔄 다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-ink-900 font-bold hover:border-ink-900 transition"
          >
            🏠 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}

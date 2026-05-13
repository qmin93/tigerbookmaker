// 404 페이지 — 브랜드 톤 유지

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#fafafa] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-7xl mb-6">🐯</div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-3">
          404 — 페이지를 찾을 수 없음
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-4">
          호랑이가<br />놓친 페이지예요.
        </h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          링크가 잘못되었거나, 옮겨졌거나, 아직 만들어지지 않은 페이지일 수 있어요.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-tiger-orange text-white font-bold hover:bg-orange-600 transition"
          >
            🏠 홈으로
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-ink-900 font-bold hover:border-ink-900 transition"
          >
            📚 내 책 목록
          </Link>
        </div>
      </div>
    </main>
  );
}

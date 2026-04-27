"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Inner() {
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message");

  return (
    <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center border border-gray-200">
      <div className="text-5xl mb-4">❌</div>
      <h1 className="text-2xl font-black mb-2">결제 실패</h1>
      <p className="text-gray-600 mb-2">결제가 정상적으로 처리되지 않았습니다.</p>
      {message && <p className="text-sm text-red-600 mb-2">{message}</p>}
      {code && <p className="text-xs text-gray-400 mb-6">에러 코드: {code}</p>}
      <div className="flex gap-3 mt-6">
        <Link href="/billing" className="flex-1 py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange transition">
          다시 시도
        </Link>
        <Link href="/" className="flex-1 py-3 border-2 border-gray-200 font-bold rounded-lg hover:border-tiger-orange transition">
          홈으로
        </Link>
      </div>
    </div>
  );
}

export default function BillingFailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
      <Suspense fallback={<div className="text-gray-500">로딩 중...</div>}>
        <Inner />
      </Suspense>
    </main>
  );
}

"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function Inner() {
  const params = useSearchParams();
  const [state, setState] = useState<"confirming" | "success" | "failed">("confirming");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount") || 0);
    if (!paymentKey || !orderId || !amount) {
      setState("failed");
      setError("필수 결제 정보 누락");
      return;
    }
    fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || `결제 확인 실패 (${r.status})`);
        setData(d);
        setState("success");
      })
      .catch(e => {
        setError(e.message);
        setState("failed");
      });
  }, [params]);

  return (
    <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center border border-gray-200">
      {state === "confirming" && (
        <>
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-black mb-2">결제 확인 중</h1>
          <p className="text-gray-600">잠시만 기다려주세요...</p>
        </>
      )}
      {state === "success" && (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-black mb-2">충전 완료</h1>
          <div className="my-6 p-5 bg-orange-50 rounded-xl border border-tiger-orange/20">
            <div className="text-xs font-mono uppercase tracking-wider text-gray-600">충전 금액</div>
            <div className="font-mono text-3xl font-black text-tiger-orange tracking-tight mt-1">
              ₩{data?.charged?.toLocaleString()}
            </div>
            {data?.bonus > 0 && (
              <div className="text-xs font-mono text-tiger-orange mt-1">
                +₩{data.bonus.toLocaleString()} 보너스
              </div>
            )}
            <div className="text-xs font-mono text-gray-500 mt-3 uppercase tracking-wider">
              현재 잔액 ₩{data?.newBalance?.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/projects" className="flex-1 py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange transition">
              내 책 시작
            </Link>
            <Link href="/billing" className="flex-1 py-3 border-2 border-gray-200 font-bold rounded-lg hover:border-tiger-orange transition">
              추가 충전
            </Link>
          </div>
        </>
      )}
      {state === "failed" && (
        <>
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-black mb-2">결제 처리 실패</h1>
          <p className="text-sm text-red-600 mb-6">{error}</p>
          <Link href="/billing" className="inline-block px-6 py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange transition">
            다시 시도
          </Link>
        </>
      )}
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
      <Suspense fallback={<div className="text-gray-500">로딩 중...</div>}>
        <Inner />
      </Suspense>
    </main>
  );
}

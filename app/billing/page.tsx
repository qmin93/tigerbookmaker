"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";

const PRICING = [
  { amount: 1_000, bonus: 0, label: "최소" },
  { amount: 5_000, bonus: 0, label: "책 1.5권" },
  { amount: 10_000, bonus: 0, label: "책 3권" },
  { amount: 30_000, bonus: 1_500, label: "책 10권", featured: true },
  { amount: 50_000, bonus: 5_000, label: "책 18권" },
];

export default function BillingPage() {
  const [user, setUser] = useState<{ id?: string; balance_krw?: number; total_spent?: number; email?: string } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetsRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/me").then(r => r.ok ? r.json() : null).then(d => d && setUser(d));
  }, []);

  // 금액 선택 시 위젯 마운트 (또는 금액만 변경)
  useEffect(() => {
    if (!selected || !user?.id) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        // 1) 우리 서버에서 orderId 발급
        const prepRes = await fetch("/api/payment/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: selected }),
        });
        if (!prepRes.ok) {
          const e = await prepRes.json().catch(() => ({}));
          throw new Error(e.message || `결제 준비 실패 (${prepRes.status})`);
        }
        const prep = await prepRes.json();
        if (cancelled) return;
        setOrderId(prep.orderId);

        // 2) Toss v2 위젯 로드
        const mod = await import("@tosspayments/tosspayments-sdk").catch(() => null);
        if (!mod) throw new Error("Toss SDK 로드 실패");
        const tossPayments = await mod.loadTossPayments(prep.clientKey);
        const widgets = tossPayments.widgets({ customerKey: user.id! });
        widgetsRef.current = { widgets, prep };

        await widgets.setAmount({ currency: "KRW", value: selected });
        // 컨테이너 비우기 (재선택 시 중복 방지)
        const pm = document.getElementById("payment-methods");
        const ag = document.getElementById("agreement");
        if (pm) pm.innerHTML = "";
        if (ag) ag.innerHTML = "";

        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-methods", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, user?.id]);

  const requestPayment = async () => {
    if (!widgetsRef.current || !orderId || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const { widgets, prep } = widgetsRef.current;
      await widgets.requestPayment({
        orderId,
        orderName: `Tigerbookmaker 충전 ${selected.toLocaleString()}원${prep.totalCredit > selected ? ` (+${(prep.totalCredit - selected).toLocaleString()}원 보너스)` : ""}`,
        customerEmail: user?.email,
        successUrl: prep.successUrl,
        failUrl: prep.failUrl,
      });
    } catch (e: any) {
      setError(e?.message || "결제 요청 실패");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link href="/projects" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 책</Link>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">잔액 충전</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">충전한 만큼만.</h1>
        <p className="text-gray-600 mb-10">사용 안 한 잔액은 7일 내 100% 환불.</p>

        {/* 현재 잔액 */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 mb-10">
          <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">현재 잔액</div>
          <div className="font-mono text-5xl md:text-6xl font-black text-ink-900 tracking-tightest">
            ₩{user?.balance_krw?.toLocaleString() ?? "—"}
          </div>
          {user?.total_spent != null && (
            <div className="text-xs font-mono text-gray-400 mt-3 uppercase tracking-wider">
              누적 사용 ₩{user.total_spent.toLocaleString()}
            </div>
          )}
        </div>

        {/* 충전 단위 */}
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-3">01 / 충전 금액</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {PRICING.map((p) => (
            <button
              key={p.amount}
              onClick={() => setSelected(p.amount)}
              disabled={busy}
              className={`p-4 rounded-xl border-2 transition text-center bg-white ${
                selected === p.amount
                  ? "border-tiger-orange shadow-glow-orange-sm"
                  : p.featured
                  ? "border-tiger-orange/60"
                  : "border-gray-200 hover:border-gray-400"
              } disabled:opacity-50`}
            >
              {p.featured && (
                <div className="text-[10px] font-mono text-tiger-orange uppercase tracking-[0.2em] mb-1">★ 인기</div>
              )}
              <div className="font-mono text-lg font-bold text-ink-900">₩{p.amount.toLocaleString()}</div>
              {p.bonus > 0 ? (
                <div className="text-xs font-mono text-tiger-orange mt-1">+₩{p.bonus.toLocaleString()}</div>
              ) : <div className="text-xs font-mono text-gray-400 mt-1">—</div>}
              <div className="text-[10px] text-gray-500 mt-1">{p.label}</div>
            </button>
          ))}
        </div>

        {/* 티어별 환산 */}
        {selected && (
          <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-tiger-orange/30 text-sm">
            <div className="font-bold text-ink-900 mb-2">충전 ₩{selected.toLocaleString()} → 책 환산:</div>
            <ul className="space-y-1 text-gray-700 font-mono text-xs">
              <li>🌱 베이직 ₩500/권 → 약 <strong className="text-tiger-orange">{Math.floor(selected / 500)}권</strong></li>
              <li>⭐ 프로 ₩1,500/권 → 약 <strong className="text-tiger-orange">{Math.floor(selected / 1500)}권</strong></li>
              <li>🌟 프리미엄 ₩7,000/권 → 약 <strong className="text-tiger-orange">{Math.floor(selected / 7000)}권</strong></li>
            </ul>
          </div>
        )}

        {/* 결제 위젯 */}
        {selected && (
          <>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-3">02 / 결제 수단</p>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
              <div id="payment-methods" />
              <div id="agreement" className="mt-4" />
            </div>
          </>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>
        )}

        <button
          onClick={requestPayment}
          disabled={!selected || busy || !widgetsRef.current}
          className="w-full py-4 bg-tiger-orange text-white text-lg font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? "처리 중..." : selected ? `₩${selected.toLocaleString()} 결제하기` : "충전 단위 선택"}
        </button>

        <details className="mt-8 text-sm text-gray-600 bg-white rounded-xl border border-gray-200 p-4">
          <summary className="cursor-pointer font-bold text-ink-900">환불 정책</summary>
          <p className="mt-3 leading-relaxed">
            충전 후 7일 내 미사용 잔액은 100% 환불 가능합니다 (보너스 제외).
            사용한 분과 7일 경과 후에는 환불되지 않습니다.
            환불 요청: cs@tigerbookmaker.com
          </p>
        </details>
      </div>
    </main>
  );
}

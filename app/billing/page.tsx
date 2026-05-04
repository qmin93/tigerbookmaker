"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { PRICING } from "@/lib/landing-data";

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
        <p className="text-gray-600 mb-6">사용 안 한 잔액은 7일 내 100% 환불.</p>

        {/* 베타 — 테스트 결제 안내 */}
        <div className="mb-10 p-4 rounded-xl bg-yellow-50 border border-yellow-300 text-sm">
          <div className="font-bold text-yellow-900 mb-1">🧪 베타 — 테스트 결제 모드</div>
          <p className="text-yellow-800 leading-relaxed">
            지금은 토스 sandbox 결제예요. <strong>실제 카드 청구 안 됨</strong>, 어떤 카드번호든 통과합니다.
            결제 흐름·잔액 반영·영수증을 미리 체험할 수 있습니다.
            정식 결제는 사업자등록 + 토스 가맹점 심사 완료 후 활성화 예정.
          </p>
        </div>

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

        {/* 충전 패키지 */}
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-3">01 / 충전 패키지</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {PRICING.map((p) => {
            const isSelected = selected === p.amount;
            return (
              <button
                key={p.amount}
                onClick={() => setSelected(p.amount)}
                disabled={busy}
                className={`text-left p-5 rounded-2xl border-2 transition disabled:opacity-50 ${
                  isSelected
                    ? "border-tiger-orange bg-orange-50 shadow-glow-orange-sm"
                    : p.featured
                    ? "border-tiger-orange/60 bg-orange-50/30 hover:border-tiger-orange"
                    : "border-gray-200 hover:border-tiger-orange bg-white"
                }`}
              >
                {p.featured && (
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">
                    ★ 추천
                  </div>
                )}
                <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">{p.label}</div>
                <div className="font-mono text-2xl font-black text-ink-900">₩{p.amount.toLocaleString()}</div>
                {p.bonus > 0 && (
                  <div className="text-xs text-tiger-orange font-bold mt-1">
                    + ₩{p.bonus.toLocaleString()} 보너스
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-2 leading-relaxed">{p.desc}</div>
              </button>
            );
          })}
        </div>

        {/* 환산 — 새 가격 정책: 라이트 ₩4K/권, 풀 ₩12K/권 */}
        {selected && (() => {
          const lightBooks = Math.floor(selected / 4000);
          const standardBooks = Math.floor(selected / 7400);
          const fullBooks = Math.floor(selected / 12200);
          return (
            <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-tiger-orange/30 text-sm space-y-1">
              <div className="font-bold text-ink-900">
                충전 ₩{selected.toLocaleString()} →
              </div>
              <div className="text-gray-700">
                라이트 약 <strong className="text-tiger-orange">{lightBooks}권</strong> (₩4,000/권) ·
                표준 약 <strong className="text-tiger-orange">{standardBooks}권</strong> (₩7,400/권) ·
                풀 약 <strong className="text-tiger-orange">{fullBooks}권</strong> (₩12,200/권)
              </div>
            </div>
          );
        })()}

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

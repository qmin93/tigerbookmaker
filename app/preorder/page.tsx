"use client";

import { useState } from "react";

// /preorder — Week 1 진단 리드 스퀴즈 랜딩.
// PLACEHOLDER로 표시된 영역은 Day 5 후크-스토리-제안 v1 + Day 6 캐릭터 결과로 교체.
// 빌드는 통과하지만 운영 전 반드시 카피 채워넣을 것.

const ICP_OPTIONS = [
  { value: "kmong_seller", label: "크몽/PDF 셀러" },
  { value: "side_writer", label: "블로그·뉴스레터 운영" },
  { value: "coach", label: "1인 코치/강사" },
  { value: "other", label: "기타" },
];

export default function PreorderPage() {
  const [email, setEmail] = useState("");
  const [icpSignal, setIcpSignal] = useState("");
  const [intent, setIntent] = useState<"preorder" | "paid_intent">("preorder");
  const [amount, setAmount] = useState<number | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const res = await fetch("/api/preorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        icp_signal: icpSignal || undefined,
        intent,
        amount_won: intent === "paid_intent" ? Number(amount) : undefined,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
      }),
    });

    if (res.ok) {
      setStatus("done");
      return;
    }
    const body = await res.json().catch(() => null);
    setErrorMsg(body?.error ?? "PREORDER_FAILED");
    setStatus("error");
  }

  if (status === "done") {
    return (
      <main className="min-h-screen bg-[#fafafa] text-ink-900 flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter2 text-ink-900">
            사전예약 완료
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            베타 오픈 시 가장 먼저 이메일로 안내드릴게요.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            오픈까지 한 통씩, 무료 미니 이북 자료를 보내드립니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-ink-900">
      {/* Hero — light with orange radial glow */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(ellipse_at_50%_-20%,rgba(249,115,22,0.10),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-mono text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-tiger-orange animate-pulse" />
            사전예약 — 오픈 시 우선 안내
          </span>

          {/* HOOK — Day 5 v1 차가운 헤드라인 */}
          <h1 className="mt-8 font-black tracking-tighter2 leading-[0.98] text-[40px] sm:text-5xl md:text-6xl text-ink-900">
            퇴근 후 30분,<br />
            <span className="text-tiger-orange">첫 PDF 자료</span>가<br />나옵니다.
          </h1>

          <p className="mt-6 max-w-2xl text-lg md:text-xl text-gray-600 leading-relaxed">
            <span className="text-ink-900 font-bold">
              주제 한 줄 + 자료 1개 → AI가 12챕터 + 표지 자동.
            </span>
            <br />
            사전예약자에게 <span className="font-bold">미니 이북 1편 + 크몽 키워드 체크리스트</span> 무료.
          </p>
        </div>
      </section>

      {/* STORY — Day 5 v1 박지수 페르소나 압축 */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-5 text-gray-700 leading-relaxed">
          <p className="text-sm font-mono uppercase tracking-[0.2em] text-tiger-orange font-bold">
            크몽 셀러 박지수, 32세 — 마케터 4년차
          </p>
          <p>
            <span className="italic">"퇴근하고 노트북 켜는 게 매일 약속이지만, 실제로는 일주일에 2–3번도 어려웠어요.
            챕터 구조 잡으려고 ChatGPT 켜면 30분이 1시간이 되고, 표지 만들려고 Canva 켜면 또 2시간."</span>
          </p>
          <p>
            프롬프트 묶음을 ₩9,900에 사봤어도 결국 본인이 복붙·정리해야 하니 시간은 안 줄었어요.
            외주 견적 ₩300,000은 한 달 매출보다 비쌌고요.
          </p>
          <p>
            <span className="text-ink-900 font-bold">잘못된 믿음은 "AI는 잡 글이고, 사람이 다듬어야 한다"</span>
            는 거였어요. 실제로는 — <span className="italic">AI가 부족한 게 아니라 다듬을 시간이 부족했던 것</span>.
            AI가 90% 만들고 본인이 10%만 손보면 일주일에 2권이 가능합니다.
          </p>
          <p className="font-bold text-ink-900">
            tigerbookmaker는 이 흐름을 30분 워크플로우로 묶은 한국어 AI 이북 도구예요.
          </p>
        </div>
      </section>

      {/* OFFER + CTA */}
      <section className="relative">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="rounded-2xl border-2 border-tiger-orange bg-white p-6 md:p-8 shadow-glow-orange">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange font-bold mb-3">
              🎁 사전예약 혜택
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-ink-900">
              지금 신청하면 — 총 ₩49,600 가치를 무료로
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              베타 한정. 사전예약자만 평생 베타 가격 유지.
            </p>

            <ul className="mt-5 space-y-2.5 text-gray-700">
              <li className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                <span className="flex items-start gap-2">
                  <span className="text-tiger-orange font-bold">✓</span>
                  <span>미니 이북 1편 (10페이지 PDF, 본인 주제) — 사전예약자 한정</span>
                </span>
                <span className="font-mono text-sm text-gray-400 line-through shrink-0">₩9,900</span>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                <span className="flex items-start gap-2">
                  <span className="text-tiger-orange font-bold">✓</span>
                  <span>크몽 베스트셀러 키워드 체크리스트 PDF — 즉시</span>
                </span>
                <span className="font-mono text-sm text-gray-400 line-through shrink-0">₩4,900</span>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                <span className="flex items-start gap-2">
                  <span className="text-tiger-orange font-bold">✓</span>
                  <span>5일 "30분 이북 만들기" 시퀀스 이메일 강좌</span>
                </span>
                <span className="font-mono text-sm text-gray-400 line-through shrink-0">₩19,900</span>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                <span className="flex items-start gap-2">
                  <span className="text-tiger-orange font-bold">✓</span>
                  <span>베타 ₩5,000 크레딧 자동 = 라이트 1권 무료</span>
                </span>
                <span className="font-mono text-sm text-gray-400 line-through shrink-0">₩5,000</span>
              </li>
              <li className="flex items-start justify-between gap-3 pb-2">
                <span className="flex items-start gap-2">
                  <span className="text-tiger-orange font-bold">✓</span>
                  <span>표지 30종 갤러리 평생 접근</span>
                </span>
                <span className="font-mono text-sm text-gray-400 line-through shrink-0">₩9,900</span>
              </li>
              <li className="flex items-start justify-between gap-3 pt-2 border-t-2 border-tiger-orange/40">
                <span className="font-bold text-ink-900">총 가치</span>
                <span className="font-mono font-bold text-ink-900">₩49,600 → ₩0</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              카드 정보 받지 않음. 이메일은 베타 안내·자료 발송에만 사용. 언제든 수신거부 가능.
            </p>

            {/* Form */}
            <form onSubmit={submit} className="mt-8 space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                autoComplete="email"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-tiger-orange focus:outline-none focus:ring-2 focus:ring-orange-200"
              />

              <select
                value={icpSignal}
                onChange={(e) => setIcpSignal(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-tiger-orange focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">현재 어떤 일 하세요? (선택 — 맞춤 안내용)</option>
                {ICP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <div className="space-y-3 rounded-xl bg-gray-50 p-4 border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={intent === "preorder"}
                    onChange={() => setIntent("preorder")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-ink-900">사전예약 (베타 오픈 시 알림)</div>
                    <div className="text-sm text-gray-600">무료 미니 이북 + 시퀀스 이메일 받기</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={intent === "paid_intent"}
                    onChange={() => setIntent("paid_intent")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-ink-900">즉시 결제 의향 (얼리버드)</div>
                    <div className="text-sm text-gray-600 mb-2">이 가격이면 지금 결제하겠다는 의향가:</div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">₩</span>
                      <input
                        type="number"
                        min={0}
                        max={10_000_000}
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value ? Number(e.target.value) : "")
                        }
                        placeholder="예: 9900"
                        disabled={intent !== "paid_intent"}
                        className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 disabled:bg-gray-100 disabled:text-gray-400 focus:border-tiger-orange focus:outline-none"
                      />
                      <span className="text-gray-500">원</span>
                    </div>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-tiger-orange text-white font-bold text-lg shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "신청 중..." : "사전예약 신청 →"}
              </button>

              {status === "error" && (
                <p className="text-sm text-red-600 text-center">
                  오류가 발생했어요{errorMsg ? ` (${errorMsg})` : ""}. 다시 시도해 주세요.
                </p>
              )}

              <p className="text-xs text-gray-500 text-center">
                이메일은 베타 안내·자료 발송에만 사용해요. 언제든 수신거부 가능.
              </p>
            </form>
          </div>

          <div className="mt-10 text-center text-sm text-gray-500 space-y-2">
            <p>
              만든 사람 — <span className="font-bold text-ink-900">김과장</span> (
              <a
                href="https://managerkim.com"
                target="_blank"
                rel="noopener"
                className="text-tiger-orange hover:underline font-medium"
              >
                managerkim.com
              </a>
              )
            </p>
            <p className="max-w-md mx-auto">
              11년차 대기업 사무직 → 매주 100시간 야근에서 살아남으려고 AI 자동화 도구를 매일 만듭니다.
              tigerbookmaker는 그 중 잘 통한 걸 한국어 콘텐츠 자동 집필 도구로 다듬은 결과예요.
            </p>
          </div>

          {/* AI 라벨링 — 한국 AI 기본법 + 공정위 표시광고 심사지침 (2026-06-01 발효) */}
          <div className="mt-8 mx-auto max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 space-y-1.5">
            <p className="font-mono uppercase tracking-wider text-gray-400">고지</p>
            <p>
              tigerbookmaker는 <strong className="text-gray-700">AI(생성형 인공지능) 기반 자동 콘텐츠 집필 도구</strong>입니다.
              생성된 책의 본문·표지·메타데이터는 AI에 의해 생성되며, 사용자가 검토·편집할 수 있습니다.
            </p>
            <p>
              본 페이지 인터뷰 인용은 베타 사용 예시이며 모든 사용자의 결과를 보장하지 않습니다.
              실제 결과는 주제·자료 품질·시장 환경에 따라 다를 수 있습니다.
            </p>
            <p>
              사전예약 시 입력하신 이메일은 베타 안내·자료 발송 외 용도로 사용하지 않으며, 언제든 수신거부할 수 있습니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

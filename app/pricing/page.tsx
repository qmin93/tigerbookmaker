import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "가격 — Tigerbookmaker",
  description:
    "지금은 베타 — 모든 기능 무료. ₩3,000 무료 크레딧 자동 지급. 카드 등록 · 정기결제 없음.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] text-ink-900">
      <Header variant="default" />

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(ellipse_at_50%_-20%,rgba(249,115,22,0.10),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-12 md:pt-28 md:pb-16">
          <Eyebrow>가격 안내</Eyebrow>
          <h1 className="mt-6 font-black tracking-tighter2 leading-[0.98] text-[40px] sm:text-5xl md:text-6xl text-ink-900">
            지금은 베타 —{" "}
            <span className="text-tiger-orange">모든 기능 무료</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
            ₩3,000 무료 크레딧 자동 지급.{" "}
            <span className="text-ink-900 font-bold">카드 등록 · 정기결제 없음.</span>
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="pb-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {/* Card 1 — 베타 (현재) */}
            <div className="relative rounded-2xl border-2 border-tiger-orange bg-white p-6 shadow-glow-orange flex flex-col">
              <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-tiger-orange/10 text-tiger-orange text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-tiger-orange animate-pulse" />
                진행 중
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-ink-900">베타 (현재)</h3>
              <div className="mt-3">
                <div className="text-3xl font-black text-ink-900 tracking-tight">₩0</div>
                <div className="mt-1 text-sm text-tiger-orange font-bold">+ ₩3,000 무료 크레딧</div>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-700 flex-1">
                <Feature>모든 신기능 (RAG · 톤 매칭 · 마케팅)</Feature>
                <Feature>link-in-bio · Meta 광고 자동 생성</Feature>
                <Feature>콘텐츠 재가공 (블로그·SNS·뉴스레터)</Feature>
                <Feature>잔액 7일 내 100% 환불</Feature>
              </ul>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-tiger-orange text-white font-bold shadow-glow-orange-sm hover:bg-orange-600 transition"
              >
                지금 시작하기 <span>→</span>
              </Link>
            </div>

            {/* Card 2 — 개인 (예정) */}
            <div className="relative rounded-2xl border border-gray-200 bg-white p-6 flex flex-col">
              <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                출시 예정
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-ink-900">개인</h3>
              <div className="mt-3">
                <div className="text-3xl font-black text-ink-900 tracking-tight">
                  ₩5,000<span className="text-base font-bold text-gray-500">/월</span>
                </div>
                <div className="mt-1 text-sm text-gray-500">또는 ₩50,000/년 (2개월 무료)</div>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-700 flex-1">
                <Feature>무제한 책</Feature>
                <Feature>모든 신기능 포함</Feature>
                <Feature>우선 지원</Feature>
                <Feature>사용량 분석 대시보드</Feature>
              </ul>
              <button
                disabled
                className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold cursor-not-allowed"
              >
                베타 사용자는 영구 할인
              </button>
            </div>

            {/* Card 3 — 팀 (예정) */}
            <div className="relative rounded-2xl border border-gray-200 bg-white p-6 flex flex-col">
              <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                출시 예정
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-ink-900">팀</h3>
              <div className="mt-3">
                <div className="text-3xl font-black text-ink-900 tracking-tight">
                  ₩30,000<span className="text-base font-bold text-gray-500">/월</span>
                </div>
                <div className="mt-1 text-sm text-gray-500">또는 맞춤형</div>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-700 flex-1">
                <Feature>5명까지</Feature>
                <Feature>팀 워크스페이스</Feature>
                <Feature>공유 자료 (RAG)</Feature>
                <Feature>API 접근</Feature>
                <Feature>가격 협의 가능</Feature>
              </ul>
              <a
                href="mailto:qmin93@gmail.com?subject=Tigerbookmaker%20%ED%8C%80%20%ED%94%8C%EB%9E%9C%20%EB%AC%B8%EC%9D%98"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-300 text-ink-900 font-bold hover:border-ink-900 hover:bg-gray-50 transition"
              >
                관심 표시하기
              </a>
            </div>
          </div>

          {/* 베타 사용자 혜택 박스 */}
          <div className="mt-8 rounded-2xl border border-tiger-orange/30 bg-orange-50/60 p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🎁</div>
              <div>
                <h3 className="text-lg md:text-xl font-black tracking-tight text-ink-900">
                  베타 사용자 영구 혜택
                </h3>
                <p className="mt-2 text-gray-700 leading-relaxed">
                  베타 기간 동안 사용해주신 모든 분께 정식 출시 시{" "}
                  <span className="text-tiger-orange font-bold">영구 할인</span>을 드립니다.
                  <span className="block mt-1 text-sm text-gray-600">
                    (정확한 % 미정 — 베타 데이터를 본 후 결정합니다.)
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* FAQ */}
      <section className="py-20 md:py-24">
        <div className="max-w-4xl mx-auto px-6">
          <Eyebrow>자주 묻는 질문</Eyebrow>
          <h2 className="mt-4 text-3xl md:text-4xl font-black tracking-tightest text-ink-900">
            가격 · 환불 · 취소
          </h2>
          <div className="mt-10 divide-y divide-gray-200 border-t border-b border-gray-200">
            <Faq q="정식 가격은 언제 결정되나요?">
              베타 데이터(사용자 패턴 · 평균 사용량)를 보고 결정합니다. 베타 사용자는 정식 출시 시
              영구 할인 혜택을 받습니다.
            </Faq>
            <Faq q="환불 가능한가요?">
              사용 안 한 잔액은 7일 내 100% 환불 가능합니다. 카드 등록 · 정기결제 없음.
            </Faq>
            <Faq q="구독 취소가 어렵나요?">
              정식 출시 후 구독 모델이 도입되어도 언제든 마이페이지에서 즉시 취소 가능합니다.
              다음 결제일부터 청구가 중단됩니다.
            </Faq>
            <Faq q="신용카드 정보를 저장하나요?">
              토스 PG가 처리합니다. 우리 서버에는 카드 정보를 저장하지 않습니다.
            </Faq>
            <Faq q="베타 사용 중 결제(차감)가 실패하면 어떻게 되나요?">
              AI 호출이 실패하면 자동으로 차감하지 않습니다. 본문 일부만 받은 경우에는 자동으로
              정정 환불됩니다.
            </Faq>
            <Faq q="팀 플랜이 우리 회사에 맞을지 모르겠어요.">
              <a className="text-tiger-orange font-bold hover:underline" href="mailto:qmin93@gmail.com">
                qmin93@gmail.com
              </a>
              으로 회사 규모와 사용 시나리오를 알려주시면 맞춤 안내해드립니다.
            </Faq>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-24 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tightest text-ink-900">
            지금은 무료. <span className="text-tiger-orange">한 권 만들어보세요.</span>
          </h2>
          <p className="mt-5 text-gray-600 text-lg">
            ₩3,000 크레딧 자동 지급 · 카드 등록 없음 · 7일 내 100% 환불
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-tiger-orange text-white font-black text-lg shadow-glow-orange hover:bg-orange-600 transition"
            >
              🐯 지금 무료로 시작 <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-sm bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-gray-500">
          <span className="font-mono text-xs uppercase tracking-wider">
            🐯 Tigerbookmaker · 본문 12pt · 줄간격 1.5
          </span>
          <nav className="flex items-center gap-5 text-xs">
            <Link href="/legal/terms" className="hover:text-ink-900">
              이용약관
            </Link>
            <Link href="/legal/privacy" className="hover:text-ink-900">
              개인정보처리방침
            </Link>
            <Link href="/legal/refund" className="hover:text-ink-900">
              환불 정책
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange">
      <span className="w-6 h-px bg-tiger-orange" />
      {children}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 text-tiger-orange font-bold">✓</span>
      <span>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-5">
      <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
        <span className="font-bold text-ink-900 text-base md:text-lg">{q}</span>
        <span className="text-tiger-orange text-xl font-mono transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-gray-600 leading-relaxed">{children}</div>
    </details>
  );
}

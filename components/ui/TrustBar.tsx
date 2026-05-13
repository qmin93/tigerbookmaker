// 신뢰 배지 띠 — 사용 중인 인프라 서비스 로고 노출
// 위치: 홈페이지 다크 CTA 직전, 푸터 영역. 결제 직전 "이 사이트 진짜인가" 의심 해소.

const SERVICES = [
  { name: "토스 결제", url: "https://tosspayments.com", note: "PG 보안 결제" },
  { name: "Vercel", url: "https://vercel.com", note: "글로벌 호스팅" },
  { name: "Neon", url: "https://neon.tech", note: "Postgres DB" },
  { name: "Resend", url: "https://resend.com", note: "이메일 발송" },
  { name: "Sentry", url: "https://sentry.io", note: "에러 모니터링" },
];

export function TrustBar() {
  return (
    <section className="border-t border-gray-200 bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-6">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
            🛡 Powered by — 검증된 인프라
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {SERVICES.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1"
              title={s.note}
            >
              <span className="text-sm font-bold text-gray-400 group-hover:text-tiger-orange transition tracking-tight">
                {s.name}
              </span>
              <span className="text-[10px] font-mono text-gray-300 group-hover:text-gray-500 transition uppercase tracking-wider">
                {s.note}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

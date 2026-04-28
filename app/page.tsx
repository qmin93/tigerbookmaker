import Link from "next/link";
import { Header } from "@/components/Header";
import { SAMPLE_BOOKS, HERO_STATS, TRUST_ITEMS, PERFORMANCE_METRICS } from "@/lib/landing-data";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafafa] text-ink-900 overflow-x-hidden">
      <Header variant="default" />

      {/* Hero — light with subtle orange radial glow at top */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(ellipse_at_50%_-20%,rgba(249,115,22,0.10),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="opacity-0 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-mono text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-tiger-orange animate-pulse" />
              AI 한국어 전자책 자동 집필 — Beta
            </span>
          </div>
          <h1 className="opacity-0 animate-fade-up mt-8 font-black tracking-tighter2 leading-[0.95] text-[44px] sm:text-6xl md:text-7xl lg:text-[88px] text-ink-900" style={{ animationDelay: "180ms" }}>
            30분이면 한 권.<br />
            <span className="text-tiger-orange">주제만</span> 던지세요.
          </h1>
          <p className="opacity-0 animate-fade-up mt-8 max-w-2xl text-lg md:text-xl text-gray-600 leading-relaxed" style={{ animationDelay: "300ms" }}>
            목차부터 12챕터 본문까지 자동 집필. PDF·DOCX 즉시 다운로드.
            크몽·리디북스·교보문고 그대로 등록 가능합니다.
          </p>
          <div className="opacity-0 animate-fade-up mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "420ms" }}>
            <Link href="/login" className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-tiger-orange text-white font-bold shadow-glow-orange-sm hover:bg-orange-600 transition">
              베타 무료 — 책 3권 받기
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link href="#samples" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-gray-300 hover:border-ink-900 hover:bg-white text-ink-900 font-bold transition">
              샘플 책 보기
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-3 md:grid-cols-6 divide-x divide-gray-200">
            {HERO_STATS.map((s, i) => (
              <div key={i} className="px-3 md:px-6 py-6 first:pl-0 last:pr-0">
                <div className="font-mono text-2xl md:text-3xl font-bold text-ink-900 tracking-tight">{s.value}</div>
                <div className="mt-1 text-[10px] md:text-xs font-mono uppercase tracking-wider text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* Sample showcase — 8권, 7장르 다양화, 가로 carousel */}
      <section id="samples" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <Eyebrow>이미 만들어진 책</Eyebrow>
              <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">결과물부터 보세요.</h2>
              <p className="mt-3 text-gray-600 max-w-xl">7개 장르 — 자기계발 · 재테크 · 에세이 · 웹소설 · 전문서 · 매뉴얼 · 실용서. 각 장르마다 톤·구조가 다름.</p>
            </div>
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">← 옆으로 스와이프 →</span>
          </div>
        </div>
        <div className="mt-12 max-w-6xl mx-auto px-6 relative">
          {/* 양쪽 fade mask로 끝부분 자연스럽게 */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#fafafa] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#fafafa] to-transparent z-10" />
          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 scroll-smooth -mx-6 px-6">
            {SAMPLE_BOOKS.map((b, i) => (
              <div key={i} className="flex-shrink-0 w-[320px] md:w-[380px] snap-center">
                <GenreBookCard {...b} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* Capabilities — minimal list */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Eyebrow>기능</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
            한국어 책 한 권을<br />처음부터 끝까지.
          </h2>
        </div>
        <div className="mt-16 max-w-6xl mx-auto px-6 divide-y divide-gray-200 border-t border-b border-gray-200">
          {[
            { n: "01", title: "목차도 본문도 AI", body: "주제 한 줄 → 목차 자동, 12챕터 본문 자동. 30분이면 권당 평균 ₩263." },
            { n: "02", title: "한국어 문체 특화", body: "해요체 통일, 번역투 차단, AI 특유 표현 금지. 책방에서 통하는 문장만." },
            { n: "03", title: "챕터 일관성 보장", body: "앞 챕터 요약을 자동 주입 — 인물·용어·예시가 책 끝까지 일관." },
            { n: "04", title: "선결제 · 환불 보장", body: "사용 안 한 잔액 7일 내 100% 환불. 카드 등록·정기결제 없음." },
          ].map(c => (
            <div key={c.n} className="grid md:grid-cols-12 gap-6 py-8 md:py-12 group">
              <div className="md:col-span-2 font-mono text-xs text-tiger-orange uppercase tracking-wider">{c.n}</div>
              <h3 className="md:col-span-3 text-2xl md:text-3xl font-black tracking-tight text-ink-900 group-hover:text-tiger-orange transition">{c.title}</h3>
              <p className="md:col-span-7 text-gray-600 md:text-lg leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* Performance metrics */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Eyebrow>실측 데이터</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
            숫자로 증명되는<br />책 한 권의 경제학.
          </h2>
        </div>
        <div className="mt-16 max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 border-t border-b border-gray-200 divide-x divide-gray-200">
          {PERFORMANCE_METRICS.map((m, i) => (
            <div key={i} className="px-6 py-10 first:pl-0">
              <div className={`font-mono text-4xl md:text-6xl font-black tracking-tightest ${i === 0 ? "text-tiger-orange" : "text-ink-900"}`}>{m.value}</div>
              <div className="mt-3 text-sm text-ink-900 font-bold">{m.label}</div>
              <div className="mt-1 text-xs font-mono text-gray-500 uppercase tracking-wider">{m.note}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* Trust */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="md:col-span-1">
            <Eyebrow>신뢰</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
              돈이 오가는 일.<br />타협 없이.
            </h2>
          </div>
          <div className="md:col-span-2 divide-y divide-gray-200 border-t border-b border-gray-200">
            {TRUST_ITEMS.map((t, i) => (
              <div key={i} className="py-6 flex gap-6">
                <div className="font-mono text-xs text-tiger-orange pt-1.5 w-8">0{i + 1}</div>
                <div>
                  <h3 className="font-bold text-ink-900 text-lg">{t.title}</h3>
                  <p className="mt-1 text-gray-600 text-sm leading-relaxed">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* Pricing — 베타 기간 무료 안내 */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Eyebrow>베타 기간</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
            지금 가입하면<br /><span className="text-tiger-orange">책 3권 무료.</span>
          </h2>
          <p className="mt-4 text-gray-600 max-w-xl">베타 기간 — 회원가입 + 이메일 인증 시 ₩3,000 크레딧 자동 지급. 카드 등록 불필요.</p>
        </div>
        <div className="mt-12 max-w-3xl mx-auto px-6">
          <div className="rounded-2xl p-8 md:p-10 border-2 border-tiger-orange shadow-glow-orange-sm bg-white">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-3">베타 환영 크레딧</div>
            <div className="font-mono text-5xl md:text-6xl font-black text-ink-900 tracking-tight">
              ₩3,000<span className="text-base text-gray-500 font-normal"> 무료</span>
            </div>
            <div className="mt-4 text-base text-gray-700">한국어 12챕터, 30분 자동 집필. PDF·DOCX·EPUB 즉시 다운로드. 크몽 패키지 포함.</div>
            <div className="mt-2 text-sm text-gray-500">정식 결제는 사업자등록 완료 후 시작 — 그동안 부담 없이 써보세요.</div>
          </div>
        </div>
        <div className="mt-10 max-w-3xl mx-auto px-6">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="rounded-2xl p-5 md:p-6 border border-gray-200 bg-white">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-2">기본 혜택</div>
              <div className="font-bold text-ink-900 mb-1">책 3권 자동 충전</div>
              <div className="text-xs text-gray-500">이메일 인증 시 ₩3,000 크레딧</div>
            </div>
            <div className="rounded-2xl p-5 md:p-6 border border-tiger-orange/40 bg-orange-50">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">★ 추가 혜택</div>
              <div className="font-bold text-ink-900 mb-1">피드백 = 크레딧</div>
              <div className="text-xs text-gray-700">개선 의견 보내면 추가 충전</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA — DARK INVERSION + tiger orange explosion */}
      <section className="relative bg-ink-900 text-white py-32 md:py-40 overflow-hidden">
        <div className="absolute inset-0 bg-radial-orange pointer-events-none" />
        <div className="absolute inset-0 bg-grid-faint bg-grid-32 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] opacity-60 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-6">시작하기</p>
          <h2 className="text-5xl md:text-7xl font-black tracking-tightest text-white">
            오늘부터<br /><span className="text-tiger-orange">책을 쓰세요.</span>
          </h2>
          <p className="mt-6 text-ink-300 text-lg max-w-xl mx-auto">
            베타 기간 — 가입 + 이메일 인증 시 ₩3,000 자동 충전. 책 3권 무료. 카드 등록 불필요.
          </p>
          <div className="mt-10">
            <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-tiger-orange text-white text-lg font-bold shadow-glow-orange hover:bg-orange-600 transition">
              베타 무료 — 책 3권 받기 →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 text-sm bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-gray-500">
          <span className="font-mono text-xs uppercase tracking-wider">🐯 Tigerbookmaker · 본문 12pt · 줄간격 1.5</span>
          <nav className="flex items-center gap-5 text-xs">
            <Link href="/legal/terms" className="hover:text-ink-900">이용약관</Link>
            <Link href="/legal/privacy" className="hover:text-ink-900">개인정보처리방침</Link>
            <Link href="/legal/refund" className="hover:text-ink-900">환불 정책</Link>
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

// 장르별 시그니처 디자인. 실제 cover 있으면 우선 표시, 없으면 장르 분기.
function GenreBookCard({ cover, title, subtitle, audience, category, chapters, pages }: any) {
  return (
    <article className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-tiger-orange hover:shadow-xl transition-all h-full">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-4 ring-1 ring-gray-200 shadow-sm">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
            <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-white/95 border border-gray-200 text-[10px] font-mono text-tiger-orange uppercase tracking-wider">실제 결과물</div>
          </>
        ) : (
          <CoverDesign category={category} title={title} subtitle={subtitle} />
        )}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange">{category}</div>
      <h3 className="mt-2 text-lg font-bold text-ink-900 leading-snug line-clamp-2 min-h-[3.2rem]">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-600 line-clamp-2 min-h-[2.6rem]">{subtitle}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-gray-500">
        <span>{chapters}챕터</span><span>·</span><span>{pages}쪽</span>
      </div>
      <div className="mt-1 text-[11px] text-gray-400 line-clamp-1">{audience}</div>
    </article>
  );
}

// 장르별 표지 디자인 — 풍부한 SVG 모티프 + 그라데이션 + 디테일
function CoverDesign({ category, title, subtitle }: { category: string; title: string; subtitle: string }) {
  switch (category) {
    case "자기계발서":
      return (
        <div className="w-full h-full bg-gradient-to-br from-orange-100 via-orange-200 to-amber-300 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 햇살 그라데이션 글로우 */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-radial from-yellow-200/80 to-transparent blur-2xl" />
          {/* 큰 화살표 */}
          <svg className="absolute -bottom-8 -right-8 w-48 h-48 text-tiger-orange" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="arr" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ea580c" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.9"/>
              </linearGradient>
            </defs>
            <path d="M50 95 L50 15 M28 38 L50 15 L72 38" stroke="url(#arr)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {/* 작은 별/스파클 */}
          <svg className="absolute top-4 right-6 w-6 h-6 text-tiger-orange opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z"/>
          </svg>
          <svg className="absolute top-16 right-20 w-3 h-3 text-amber-600 opacity-60" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z"/>
          </svg>
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-orange-900 font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-ink-900 text-2xl font-black leading-[1.1] tracking-tight drop-shadow-sm">{title}</div>
            <div className="mt-2 text-orange-950/70 text-xs font-medium leading-snug line-clamp-2">{subtitle}</div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-0.5 w-12 bg-tiger-orange" />
              <span className="text-[9px] font-mono text-orange-900/60 uppercase tracking-[0.2em]">Growth</span>
            </div>
          </div>
        </div>
      );

    case "재테크":
      return (
        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 골드 글로우 */}
          <div className="absolute top-1/3 left-1/3 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl" />
          {/* 메인 차트 */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 280" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* 채워진 area */}
            <path d="M0,200 L30,180 L60,150 L90,170 L120,120 L150,90 L180,60 L200,40 L200,280 L0,280 Z" fill="url(#chartFill)"/>
            {/* 라인 */}
            <polyline points="0,200 30,180 60,150 90,170 120,120 150,90 180,60 200,40" stroke="#fbbf24" strokeWidth="2.5" fill="none"/>
            {/* 데이터 포인트 */}
            <circle cx="60" cy="150" r="3" fill="#fbbf24"/>
            <circle cx="120" cy="120" r="3" fill="#fbbf24"/>
            <circle cx="180" cy="60" r="4" fill="#fbbf24"/>
            <circle cx="180" cy="60" r="8" fill="#fbbf24" opacity="0.3"/>
            {/* 캔들스틱 */}
            <rect x="40" y="220" width="6" height="20" fill="#10b981"/>
            <rect x="55" y="225" width="6" height="15" fill="#10b981"/>
            <rect x="70" y="218" width="6" height="22" fill="#ef4444"/>
            <rect x="85" y="222" width="6" height="18" fill="#10b981"/>
          </svg>
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400 font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-white text-2xl font-black leading-[1.1] tracking-tight">{title}</div>
            <div className="mt-2 text-blue-200/80 text-xs font-medium leading-snug line-clamp-2">{subtitle}</div>
            <div className="mt-4 flex items-center gap-3 text-[10px] font-mono">
              <span className="text-emerald-400">▲ +12.4%</span>
              <span className="text-amber-400/60">|</span>
              <span className="text-amber-300">YIELD</span>
            </div>
          </div>
        </div>
      );

    case "에세이":
      return (
        <div className="w-full h-full bg-gradient-to-br from-rose-100 via-stone-100 to-emerald-100 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 부드러운 wash */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-radial from-amber-100/50 to-transparent" />
          {/* 잎사귀 여러개 */}
          <svg className="absolute right-2 top-4 w-32 h-40 text-emerald-700/40" viewBox="0 0 60 80" fill="currentColor">
            <ellipse cx="30" cy="25" rx="14" ry="22" fill="currentColor" opacity="0.5"/>
            <path d="M30 5 L30 50" stroke="#065f46" strokeWidth="1" opacity="0.6"/>
            <path d="M30 18 L20 22 M30 28 L18 32 M30 38 L20 42" stroke="#065f46" strokeWidth="0.5" opacity="0.4"/>
          </svg>
          <svg className="absolute left-4 bottom-16 w-16 h-20 text-rose-400/40" viewBox="0 0 40 50" fill="currentColor">
            <ellipse cx="20" cy="20" rx="10" ry="15" fill="currentColor" opacity="0.6"/>
            <path d="M20 5 L20 35" stroke="#9f1239" strokeWidth="0.5" opacity="0.4"/>
          </svg>
          {/* 떨어지는 점들 */}
          <div className="absolute top-8 left-12 w-1.5 h-1.5 rounded-full bg-rose-300/60" />
          <div className="absolute top-20 left-24 w-1 h-1 rounded-full bg-amber-400/50" />
          <div className="absolute top-32 right-32 w-1 h-1 rounded-full bg-emerald-500/40" />
          <div className="absolute bottom-32 right-12 w-2 h-2 rounded-full bg-rose-300/40" />
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-900/80 font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-stone-900 text-2xl font-bold leading-[1.15] tracking-tight">{title}</div>
            <div className="mt-2 text-stone-600 text-xs italic leading-snug line-clamp-2">{subtitle}</div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-stone-500 font-serif italic text-[10px]">— a memoir</span>
            </div>
          </div>
        </div>
      );

    case "웹소설":
      return (
        <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-950 to-rose-950 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 달 + 글로우 */}
          <div className="absolute top-6 right-6">
            <div className="absolute inset-0 w-24 h-24 -m-4 rounded-full bg-yellow-100/30 blur-2xl" />
            <svg className="relative w-20 h-20" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="35" fill="#fef3c7" opacity="0.85"/>
              <circle cx="60" cy="42" r="35" fill="#1e1b4b"/>
              {/* 달 표면 디테일 */}
              <circle cx="42" cy="55" r="3" fill="#fde68a" opacity="0.4"/>
              <circle cx="38" cy="68" r="2" fill="#fde68a" opacity="0.3"/>
            </svg>
          </div>
          {/* 별들 */}
          {[
            [15, 75, 1.2], [25, 55, 0.8], [40, 85, 1], [55, 50, 0.7], [70, 80, 0.9],
            [85, 30, 1.1], [12, 30, 0.6], [60, 25, 1], [30, 15, 0.8],
          ].map(([x, y, r], i) => (
            <div
              key={i}
              className="absolute rounded-full bg-yellow-100"
              style={{ left: `${x}%`, top: `${y}%`, width: `${r}px`, height: `${r}px`, opacity: 0.6 + (i % 3) * 0.1 }}
            />
          ))}
          {/* 인물 silhouette */}
          <svg className="absolute bottom-0 left-0 w-full h-32 text-black opacity-50" viewBox="0 0 200 80" preserveAspectRatio="none">
            <path d="M0,80 L0,55 L20,55 L25,40 L40,40 L45,55 L80,55 L85,35 L110,35 L115,55 L160,55 L165,45 L185,45 L190,55 L200,55 L200,80 Z" fill="currentColor"/>
          </svg>
          {/* 안개 */}
          <div className="absolute bottom-12 inset-x-0 h-12 bg-gradient-to-t from-purple-900/60 to-transparent" />
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-rose-300 font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-white text-2xl font-black leading-[1.1] tracking-tight drop-shadow-lg">{title}</div>
            <div className="mt-2 text-rose-100/70 text-xs leading-snug line-clamp-2 italic">{subtitle}</div>
          </div>
        </div>
      );

    case "전문서":
      return (
        <div className="w-full h-full bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-900 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 격자 패턴 */}
          <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="grid2" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#60a5fa" strokeWidth="0.3"/>
              </pattern>
            </defs>
            <rect width="100" height="140" fill="url(#grid2)"/>
          </svg>
          {/* 데이터 노드 네트워크 */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 280" preserveAspectRatio="none">
            <line x1="40" y1="80" x2="100" y2="120" stroke="#60a5fa" strokeWidth="1" opacity="0.4"/>
            <line x1="100" y1="120" x2="160" y2="80" stroke="#60a5fa" strokeWidth="1" opacity="0.4"/>
            <line x1="100" y1="120" x2="80" y2="180" stroke="#60a5fa" strokeWidth="1" opacity="0.4"/>
            <line x1="100" y1="120" x2="140" y2="180" stroke="#60a5fa" strokeWidth="1" opacity="0.4"/>
            <line x1="80" y1="180" x2="140" y2="180" stroke="#60a5fa" strokeWidth="1" opacity="0.3"/>
            {/* 노드들 */}
            <circle cx="40" cy="80" r="4" fill="#60a5fa" opacity="0.9"/>
            <circle cx="160" cy="80" r="4" fill="#60a5fa" opacity="0.9"/>
            <circle cx="100" cy="120" r="6" fill="#3b82f6"/>
            <circle cx="100" cy="120" r="11" fill="#60a5fa" opacity="0.3"/>
            <circle cx="80" cy="180" r="4" fill="#60a5fa" opacity="0.8"/>
            <circle cx="140" cy="180" r="4" fill="#60a5fa" opacity="0.8"/>
          </svg>
          {/* 글로우 */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl" />
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-blue-300 font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-white text-xl font-bold leading-[1.15] tracking-tight">{title}</div>
            <div className="mt-2 text-blue-200/70 text-xs font-medium leading-snug line-clamp-2">{subtitle}</div>
            <div className="mt-3 flex items-center gap-1.5">
              <div className="w-3 h-3 border border-blue-400/60 rounded-sm" />
              <div className="w-3 h-3 border border-blue-400/60 rounded-sm bg-blue-400/30" />
              <div className="w-3 h-3 border border-blue-400/60 rounded-sm" />
              <div className="w-3 h-3 border border-blue-400/60 rounded-sm bg-blue-400/30" />
              <span className="ml-2 text-[9px] font-mono text-blue-300/70">RESEARCH</span>
            </div>
          </div>
        </div>
      );

    case "매뉴얼":
      return (
        <div className="w-full h-full bg-gradient-to-br from-cyan-50 to-blue-50 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 블루프린트 격자 */}
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="bp2" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#0e7490" strokeWidth="0.3"/>
              </pattern>
            </defs>
            <rect width="100" height="140" fill="url(#bp2)"/>
          </svg>
          {/* 도면 */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 280" preserveAspectRatio="none">
            {/* 중심 도형 */}
            <circle cx="100" cy="120" r="40" fill="none" stroke="#0e7490" strokeWidth="1.5" strokeDasharray="4 2"/>
            <circle cx="100" cy="120" r="20" fill="none" stroke="#f97316" strokeWidth="1.5"/>
            <circle cx="100" cy="120" r="3" fill="#f97316"/>
            {/* 십자선 */}
            <line x1="40" y1="120" x2="160" y2="120" stroke="#0e7490" strokeWidth="0.5" strokeDasharray="2 2"/>
            <line x1="100" y1="60" x2="100" y2="180" stroke="#0e7490" strokeWidth="0.5" strokeDasharray="2 2"/>
            {/* 측정 마크 */}
            <line x1="20" y1="120" x2="35" y2="120" stroke="#0e7490" strokeWidth="1"/>
            <line x1="20" y1="115" x2="20" y2="125" stroke="#0e7490" strokeWidth="1"/>
            <line x1="35" y1="115" x2="35" y2="125" stroke="#0e7490" strokeWidth="1"/>
            <text x="22" y="113" fill="#0e7490" fontSize="6" fontFamily="monospace">15mm</text>
            {/* 화살표 라벨 */}
            <line x1="170" y1="80" x2="140" y2="100" stroke="#f97316" strokeWidth="0.8"/>
            <circle cx="140" cy="100" r="2" fill="#f97316"/>
            <text x="172" y="80" fill="#f97316" fontSize="6" fontFamily="monospace">A1</text>
          </svg>
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-cyan-800 font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-cyan-950 text-xl font-bold leading-[1.15] tracking-tight">{title}</div>
            <div className="mt-2 text-cyan-900/70 text-xs leading-snug line-clamp-2 font-mono">{subtitle}</div>
            <div className="mt-3 flex items-center gap-2 text-[9px] font-mono text-cyan-800">
              <span className="px-1.5 py-0.5 border border-cyan-700 rounded">v1.0</span>
              <span>·</span>
              <span>2026-04-28</span>
              <span className="ml-auto w-2 h-2 bg-tiger-orange rounded-full"/>
            </div>
          </div>
        </div>
      );

    case "실용서":
    default:
      return (
        <div className="w-full h-full bg-gradient-to-br from-white via-orange-50 to-amber-50 flex flex-col justify-between p-6 relative overflow-hidden">
          {/* 큰 도형 */}
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-tiger-orange/10" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-tiger-orange/15" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-tiger-orange/25" />
          {/* 작은 도형 */}
          <div className="absolute top-12 right-8 w-3 h-3 bg-tiger-orange rounded-sm rotate-45" />
          <div className="absolute top-20 right-16 w-2 h-2 bg-amber-400 rounded-full" />
          <svg className="absolute right-6 bottom-32 w-12 h-12 text-tiger-orange/30" viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="20" height="20" rx="3"/>
            <rect x="6" y="8" width="12" height="1.5" fill="white"/>
            <rect x="6" y="12" width="12" height="1.5" fill="white"/>
            <rect x="6" y="16" width="8" height="1.5" fill="white"/>
          </svg>
          {/* 좌측 컬러 바 */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-tiger-orange to-amber-500" />
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-tiger-orange font-bold relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-ink-900 text-2xl font-black leading-[1.1] tracking-tight">{title}</div>
            <div className="mt-2 text-gray-700 text-xs font-medium leading-snug line-clamp-2">{subtitle}</div>
            <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-gray-500 uppercase tracking-[0.15em]">
              <span>🐯 Tigerbookmaker</span>
              <span className="ml-auto px-1.5 py-0.5 border border-tiger-orange/40 text-tiger-orange rounded">실전</span>
            </div>
          </div>
        </div>
      );
  }
}


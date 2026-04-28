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
        <div className="mt-12 max-w-6xl mx-auto pl-6 md:pl-[calc((100vw-72rem)/2+1.5rem)]">
          <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-6 pr-6 scroll-smooth scrollbar-thin">
            {SAMPLE_BOOKS.map((b, i) => (
              <div key={i} className="flex-shrink-0 w-[260px] md:w-[280px] snap-start">
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
    <article className="group rounded-2xl border border-gray-200 bg-white p-4 hover:border-tiger-orange hover:shadow-md transition h-full">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 ring-1 ring-gray-200">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 border border-gray-200 text-[10px] font-mono text-tiger-orange uppercase tracking-wider">실제 결과물</div>
          </>
        ) : (
          <CoverDesign category={category} title={title} subtitle={subtitle} />
        )}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange">{category}</div>
      <h3 className="mt-1.5 text-base font-bold text-ink-900 leading-snug line-clamp-2 min-h-[2.6rem]">{title}</h3>
      <p className="mt-1 text-xs text-gray-600 line-clamp-2 min-h-[2rem]">{subtitle}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-gray-500">
        <span>{chapters}챕터</span><span>·</span><span>{pages}쪽</span>
      </div>
      <div className="mt-1 text-[10px] text-gray-400 line-clamp-1">{audience}</div>
    </article>
  );
}

// 장르별 표지 디자인 — 인라인 SVG로 시그니처 모티프
function CoverDesign({ category, title, subtitle }: { category: string; title: string; subtitle: string }) {
  switch (category) {
    case "자기계발서":
      return (
        <div className="w-full h-full bg-gradient-to-br from-orange-50 to-orange-100 flex flex-col justify-between p-5 relative overflow-hidden">
          <svg className="absolute -right-4 -top-4 w-32 h-32 text-tiger-orange/30" viewBox="0 0 100 100" fill="none">
            <path d="M50 90 L50 20 M30 40 L50 20 L70 40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-ink-900 text-lg font-black leading-tight tracking-tight">{title}</div>
            <div className="mt-1.5 text-ink-900/60 text-[11px] line-clamp-2">{subtitle}</div>
            <div className="mt-3 h-0.5 w-10 bg-tiger-orange" />
          </div>
        </div>
      );

    case "재테크":
      return (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col justify-between p-5 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 280" preserveAspectRatio="none">
            <polyline points="0,200 30,180 60,150 90,170 120,120 150,90 180,60 200,40" stroke="#fbbf24" strokeWidth="2" fill="none"/>
            <polyline points="0,240 30,230 60,220 90,235 120,215 150,200 180,190 200,180" stroke="#fbbf24" strokeWidth="1" fill="none" opacity="0.5"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-white text-lg font-black leading-tight tracking-tight">{title}</div>
            <div className="mt-1.5 text-white/60 text-[11px] line-clamp-2">{subtitle}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-amber-400 font-mono text-[10px]">▲</span>
              <div className="h-0.5 flex-1 bg-amber-400/40" />
            </div>
          </div>
        </div>
      );

    case "에세이":
      return (
        <div className="w-full h-full bg-gradient-to-br from-stone-100 via-emerald-50 to-stone-200 flex flex-col justify-between p-5 relative overflow-hidden">
          <svg className="absolute right-3 top-6 w-20 h-20 text-emerald-700/40" viewBox="0 0 60 60" fill="currentColor">
            <path d="M30 5 Q15 25 30 55 Q45 25 30 5 Z M30 5 L30 55" stroke="currentColor" strokeWidth="1" fill="none"/>
            <ellipse cx="30" cy="30" rx="12" ry="22" fill="currentColor" opacity="0.3"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-800/70 relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-stone-900 text-lg font-bold leading-snug">{title}</div>
            <div className="mt-1.5 text-stone-600 text-[11px] line-clamp-2 italic">{subtitle}</div>
          </div>
        </div>
      );

    case "웹소설":
      return (
        <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-900 to-rose-900 flex flex-col justify-between p-5 relative overflow-hidden">
          <svg className="absolute right-2 top-2 w-24 h-24 text-yellow-200/60" viewBox="0 0 100 100" fill="currentColor">
            <circle cx="75" cy="25" r="14" fill="currentColor" opacity="0.6"/>
            <circle cx="78" cy="25" r="11" fill="#1e1b4b"/>
            <circle cx="20" cy="60" r="1" fill="currentColor"/>
            <circle cx="40" cy="80" r="1" fill="currentColor"/>
            <circle cx="60" cy="50" r="0.8" fill="currentColor"/>
            <circle cx="35" cy="35" r="0.6" fill="currentColor"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-300 relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-white text-lg font-black leading-tight tracking-tight">{title}</div>
            <div className="mt-1.5 text-white/60 text-[11px] line-clamp-2">{subtitle}</div>
          </div>
        </div>
      );

    case "전문서":
      return (
        <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-950 flex flex-col justify-between p-5 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.3"/>
              </pattern>
            </defs>
            <rect width="100" height="140" fill="url(#grid)"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-300 relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-white text-base font-bold leading-tight tracking-tight">{title}</div>
            <div className="mt-1.5 text-blue-200/60 text-[11px] line-clamp-2">{subtitle}</div>
            <div className="mt-2 flex gap-1">
              <div className="w-3 h-3 border border-blue-300/50" />
              <div className="w-3 h-3 border border-blue-300/50 bg-blue-300/20" />
              <div className="w-3 h-3 border border-blue-300/50" />
            </div>
          </div>
        </div>
      );

    case "매뉴얼":
      return (
        <div className="w-full h-full bg-cyan-50 flex flex-col justify-between p-5 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="bp" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#0e7490" strokeWidth="0.3"/>
              </pattern>
            </defs>
            <rect width="100" height="140" fill="url(#bp)"/>
            <circle cx="50" cy="50" r="20" fill="none" stroke="#f97316" strokeWidth="1" strokeDasharray="3 2"/>
            <line x1="30" y1="50" x2="70" y2="50" stroke="#f97316" strokeWidth="0.5"/>
            <line x1="50" y1="30" x2="50" y2="70" stroke="#f97316" strokeWidth="0.5"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-800 relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-cyan-950 text-base font-bold leading-tight tracking-tight">{title}</div>
            <div className="mt-1.5 text-cyan-900/60 text-[11px] line-clamp-2 font-mono">{subtitle}</div>
            <div className="mt-2 flex items-center gap-2 text-[9px] font-mono text-cyan-800">
              <span>v1.0</span>
              <span>·</span>
              <span className="w-1.5 h-1.5 bg-tiger-orange rounded-full"/>
            </div>
          </div>
        </div>
      );

    case "실용서":
    default:
      return (
        <div className="w-full h-full bg-white flex flex-col justify-between p-5 relative overflow-hidden border-l-4 border-tiger-orange">
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-24 h-24 text-tiger-orange/15" viewBox="0 0 60 60" fill="currentColor">
            <rect x="5" y="5" width="50" height="50" rx="8"/>
            <rect x="14" y="20" width="32" height="3" fill="white" opacity="0.8"/>
            <rect x="14" y="28" width="32" height="3" fill="white" opacity="0.6"/>
            <rect x="14" y="36" width="20" height="3" fill="white" opacity="0.4"/>
          </svg>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange relative z-10">{category}</span>
          <div className="relative z-10">
            <div className="text-ink-900 text-lg font-black leading-tight tracking-tight">{title}</div>
            <div className="mt-1.5 text-gray-600 text-[11px] line-clamp-2">{subtitle}</div>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-gray-400">
              <span>TIGERBOOKMAKER</span>
            </div>
          </div>
        </div>
      );
  }
}


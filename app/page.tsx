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

      {/* Sample showcase */}
      <section id="samples" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Eyebrow>이미 만들어진 책</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">결과물부터 보세요.</h2>
          <p className="mt-3 text-gray-600 max-w-xl">베타 사용자가 실제로 발간 가능한 수준으로 뽑아낸 책들.</p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SAMPLE_BOOKS.map((b, i) => <BookCard key={i} {...b} />)}
            <PlaceholderBook hue="rose" category="자기계발서" title="아침 루틴, 30일이면 인생이 바뀝니다" subtitle="새벽 5시에 일어나는 사람의 진짜 비밀" audience="번아웃 직전의 30대" />
            <PlaceholderBook hue="emerald" category="에세이" title="나는 그래서 회사를 그만뒀습니다" subtitle="13년 직장인이 쓴 첫 1년 기록" audience="퇴사를 고민하는 직장인" />
            <PlaceholderBook hue="indigo" category="실용서" title="혼자서도 만드는 SaaS" subtitle="개발자 아닌 PM이 0원으로 1,200만원 만든 법" audience="비개발자 1인 창업자" />
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

function BookCard({ cover, title, subtitle, audience, category, chapters, pages }: any) {
  return (
    <article className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-tiger-orange hover:shadow-md transition">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 mb-4 ring-1 ring-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 border border-gray-200 text-[10px] font-mono text-tiger-orange uppercase tracking-wider">실제 결과물</div>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange">{category}</div>
      <h3 className="mt-2 text-base font-bold text-ink-900 leading-snug">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{subtitle}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-gray-500">
        <span>{chapters}챕터</span><span>·</span><span>{pages}쪽</span><span>·</span><span>{audience}</span>
      </div>
    </article>
  );
}

function PlaceholderBook({ hue, category, title, subtitle, audience }: any) {
  const hueMap = {
    rose: { from: "from-rose-100", to: "to-rose-200", accent: "bg-rose-500" },
    emerald: { from: "from-emerald-100", to: "to-emerald-200", accent: "bg-emerald-500" },
    indigo: { from: "from-indigo-100", to: "to-indigo-200", accent: "bg-indigo-500" },
  } as const;
  const c = hueMap[hue as keyof typeof hueMap];
  return (
    <article className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-tiger-orange hover:shadow-md transition">
      <div className={`relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br ${c.from} ${c.to} mb-4 ring-1 ring-gray-200 flex flex-col justify-between p-5`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-900/70">{category}</span>
          <span className={`w-2 h-2 rounded-full ${c.accent}`} />
        </div>
        <div>
          <div className="text-ink-900 text-xl font-black leading-tight tracking-tight">{title}</div>
          <div className="mt-2 text-ink-900/60 text-xs">{subtitle}</div>
          <div className="mt-6 flex items-center justify-between text-[10px] font-mono text-ink-900/50 uppercase tracking-wider border-t border-ink-900/10 pt-3">
            <span>Tigerbookmaker</span><span>v1.0</span>
          </div>
        </div>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">샘플 시안</div>
      <h3 className="mt-2 text-base font-bold text-ink-900 leading-snug">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{subtitle}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-gray-500">
        <span>12챕터</span><span>·</span><span>약 60쪽</span><span>·</span><span>{audience}</span>
      </div>
    </article>
  );
}


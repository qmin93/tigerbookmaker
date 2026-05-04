import Link from "next/link";
import { Header } from "@/components/Header";
import { RoiSimulator } from "@/components/RoiSimulator";
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
            <span className="text-ink-900 font-bold">내 자료(PDF·URL·텍스트)를 정확히 이해</span>하고 목차부터 12챕터 본문까지 자동 집필.
            톤 매칭 · 마케팅 페이지 · 작가 프로필 · Meta 광고까지 한 번에.
          </p>
          <div className="opacity-0 animate-fade-up mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "420ms" }}>
            <Link href="/login" className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-tiger-orange text-white font-bold shadow-glow-orange-sm hover:bg-orange-600 transition">
              무료로 시작 — ₩3,000 크레딧 받기
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
            { n: "04", title: "내 자료 학습 (RAG)", body: "PDF · URL · 텍스트 업로드 → AI가 모두 읽고 인터뷰·목차·본문에 자동 인용. 내 지식이 그대로 책이 됩니다." },
            { n: "05", title: "자료 자동 분석", body: "업로드한 자료에서 5 핵심 + 빠진 부분을 자동 정리. 인터뷰는 빈 부분만 5~7개 — 시간 낭비 없음." },
            { n: "06", title: "톤 · 말투 매칭", body: "6 preset(따뜻 · 전문 · 캐주얼 · 시적 · 직설 · 유머) 또는 좋아하는 책 한 단락만 붙여넣으면 그 톤으로 집필." },
            { n: "07", title: "책별 색상 + 마케팅 페이지", body: "책마다 6가지 테마 색상 자동 매칭. /book/[id] SNS 공유용 랜딩 + AI 카피 + OG 미리보기 자동 생성." },
            { n: "08", title: "작가 프로필 + Meta 광고", body: "/u/[handle] 인스타 bio용 link-in-bio 한 URL · Meta Ads 헤드라인·본문·타겟팅 한 번에 받기." },
            { n: "09", title: "선결제 · 환불 보장", body: "사용 안 한 잔액 7일 내 100% 환불. 카드 등록·정기결제 없음." },
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

      {/* 출판 후가 진짜 시작 — 마케팅·프로필·광고 */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <Eyebrow>출판 후가 진짜 시작</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
            책을 만든 다음<br />어떻게 <span className="text-tiger-orange">팔까?</span>
          </h2>
          <p className="mt-4 text-gray-600 max-w-xl">집필만으로는 부족합니다. 책 한 권마다 마케팅 페이지, 작가 프로필, Meta 광고 카피까지 자동 생성.</p>
        </div>

        <div className="mt-16 max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
          {/* 1. 책 마케팅 페이지 */}
          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-6 hover:border-tiger-orange hover:shadow-lg transition group">
            <div className="text-3xl mb-4">📖</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">/book/[id]</div>
            <h3 className="text-xl font-black tracking-tight text-ink-900 mb-2">책 마케팅 페이지</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">한 URL로 카톡·인스타·DM 공유. AI가 책 카피·후킹 자동 생성, OG 미리보기까지.</p>
            {/* 미니 mock */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 font-mono text-[10px]">
              <div className="text-gray-400 mb-1.5">tigerbookmaker.com</div>
              <div className="h-16 rounded bg-gradient-to-br from-orange-100 via-amber-50 to-orange-200 mb-2 relative overflow-hidden">
                <div className="absolute bottom-1.5 left-2 text-ink-900 text-[9px] font-black leading-tight">아침 루틴<br/>30일</div>
              </div>
              <div className="text-tiger-orange font-bold">→ 지금 읽기</div>
            </div>
          </div>

          {/* 2. 작가 link-in-bio */}
          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-6 hover:border-tiger-orange hover:shadow-lg transition group">
            <div className="text-3xl mb-4">🔗</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">/u/[handle]</div>
            <h3 className="text-xl font-black tracking-tight text-ink-900 mb-2">작가 link-in-bio</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">인스타 bio에 1줄, 모든 책 자동 정리. Litt.ly 안 써도 됨 — 프로필 편집까지 내장.</p>
            {/* 미니 mock */}
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-tiger-orange to-amber-400" />
                <div>
                  <div className="text-[10px] font-bold text-ink-900 leading-tight">@author</div>
                  <div className="text-[9px] text-gray-500 leading-tight">3 books</div>
                </div>
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="h-5 rounded bg-gray-100 mb-1 flex items-center px-2 text-[9px] font-mono text-gray-600">📘 Book {i}</div>
              ))}
            </div>
          </div>

          {/* 3. Meta 광고 패키지 */}
          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-6 hover:border-tiger-orange hover:shadow-lg transition group">
            <div className="text-3xl mb-4">🎯</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">Meta Ads</div>
            <h3 className="text-xl font-black tracking-tight text-ink-900 mb-2">광고 패키지 자동 생성</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">헤드라인 · 본문 · CTA · 타겟팅(연령·관심사)까지 책 한 권당 한 번에 받기.</p>
            {/* 미니 mock */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 font-mono text-[10px] space-y-1.5">
              <div><span className="text-gray-400">headline</span> <span className="text-ink-900 font-bold">"30일이면 인생이 바뀝니다"</span></div>
              <div><span className="text-gray-400">cta</span> <span className="text-tiger-orange font-bold">지금 읽기</span></div>
              <div><span className="text-gray-400">target</span> <span className="text-ink-900">30대 직장인 · 자기계발</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200" />

      {/* ROI 시뮬레이터 — A 부수익러 페르소나 */}
      <RoiSimulator />

      <div className="border-t border-gray-200" />

      {/* Pricing — 베타 기간 무료 안내 */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Eyebrow>베타 기간</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
            지금 가입하면<br /><span className="text-tiger-orange">₩3,000 무료 크레딧.</span>
          </h2>
          <p className="mt-4 text-gray-600 max-w-xl">회원가입 + 이메일 인증 시 자동 지급. 모든 신기능 포함 (RAG · 톤 매칭 · 마케팅 페이지 · 작가 프로필 · Meta 광고). 카드 등록 · 정기결제 없음.</p>
        </div>
        <div className="mt-12 max-w-3xl mx-auto px-6">
          <div className="rounded-2xl p-8 md:p-10 border-2 border-tiger-orange shadow-glow-orange-sm bg-white">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-3">베타 환영 크레딧</div>
            <div className="font-mono text-5xl md:text-6xl font-black text-ink-900 tracking-tight">
              ₩3,000<span className="text-base text-gray-500 font-normal"> 무료</span>
            </div>
            <div className="mt-4 text-base text-gray-700">집필 + RAG 자료 학습 + 톤 매칭 + 마케팅 페이지 + 작가 프로필 + Meta 광고 카피 — 전부 포함.</div>
            <div className="mt-2 text-sm text-gray-500">정식 결제는 사업자등록 완료 후 시작 — 그동안 부담 없이 써보세요.</div>
          </div>
        </div>
        <div className="mt-10 max-w-3xl mx-auto px-6">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="rounded-2xl p-5 md:p-6 border border-gray-200 bg-white">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-2">기본 혜택</div>
              <div className="font-bold text-ink-900 mb-1">₩3,000 무료 크레딧</div>
              <div className="text-xs text-gray-500">이메일 인증 시 자동 지급 · 신기능 전부 사용 가능</div>
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
            가입 + 이메일 인증 시 ₩3,000 무료 크레딧 자동 지급. RAG · 톤 매칭 · 마케팅 페이지 · 작가 프로필 · Meta 광고까지 전부 포함. 카드 등록 불필요.
          </p>
          <div className="mt-10">
            <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-tiger-orange text-white text-lg font-bold shadow-glow-orange hover:bg-orange-600 transition">
              무료로 시작 — ₩3,000 크레딧 받기 →
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

// 장르별 표지 — Penguin Classics / Monocle 매거진 영감
// 큰 typography + negative space + 정제된 footer + 3색 이내 팔레트
function CoverDesign({ category, title, subtitle }: { category: string; title: string; subtitle: string }) {
  // 공통 footer — 모든 표지에 통일된 발행 정보
  const Footer = ({ color, accent }: { color: string; accent?: string }) => (
    <div className={`flex items-center justify-between text-[8px] font-mono tracking-[0.25em] uppercase ${color}`}>
      <span className="font-bold">Tigerbookmaker</span>
      <span className={accent}>2026 · Vol.01</span>
    </div>
  );

  switch (category) {
    case "자기계발서":
      return (
        <div className="w-full h-full bg-gradient-to-b from-amber-50 via-orange-100 to-orange-200 flex flex-col p-6 relative overflow-hidden">
          {/* 햇살 글로우 */}
          <div className="absolute -top-32 -right-20 w-72 h-72 rounded-full bg-yellow-300/40 blur-3xl" />
          <div className="absolute -top-10 right-10 w-40 h-40 rounded-full bg-orange-200/60 blur-2xl" />
          {/* 큰 숫자 30 — focal point */}
          <div className="absolute top-12 right-6 text-[120px] font-black leading-none text-tiger-orange/15 select-none tracking-tighter">30</div>
          {/* 미니멀 화살표 */}
          <svg className="absolute bottom-32 right-8 w-16 h-32 text-tiger-orange/80" viewBox="0 0 40 100" fill="none">
            <line x1="20" y1="95" x2="20" y2="15" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <path d="M8 28 L20 15 L32 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-orange-900/80 font-bold">{category}</div>
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-orange-900/50 mt-0.5">Self-Development</div>
            </div>
            <div className="w-1 h-10 bg-tiger-orange" />
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8">
            <div>
              <div className="text-ink-900 text-[26px] font-black leading-[1.05] tracking-tight">{title}</div>
              <div className="mt-3 text-orange-950/70 text-[11px] font-medium leading-snug line-clamp-2">{subtitle}</div>
              <div className="mt-4 h-px w-12 bg-orange-900/40" />
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-4">
            <Footer color="text-orange-900/60" accent="text-tiger-orange" />
          </div>
        </div>
      );

    case "재테크":
      return (
        <div className="w-full h-full bg-slate-950 flex flex-col p-6 relative overflow-hidden">
          {/* 골드 글로우 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />
          {/* 미니멀 차트 — 하단 */}
          <svg className="absolute inset-x-0 bottom-0 h-32 w-full" viewBox="0 0 200 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cf" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0,60 L40,55 L80,40 L120,45 L160,25 L200,15 L200,80 L0,80 Z" fill="url(#cf)"/>
            <polyline points="0,60 40,55 80,40 120,45 160,25 200,15" stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
            <circle cx="160" cy="25" r="2" fill="#fbbf24"/>
            <circle cx="200" cy="15" r="3" fill="#fbbf24"/>
          </svg>
          {/* 큰 ₩ 심볼 */}
          <div className="absolute top-8 right-4 text-[140px] font-black leading-none text-amber-400/15 select-none">₩</div>
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-amber-400 font-bold">{category}</div>
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-amber-300/40 mt-0.5">Wealth Building</div>
            </div>
            <div className="text-[9px] font-mono text-emerald-400 tracking-wider">▲+12.4%</div>
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8">
            <div>
              <div className="text-white text-[24px] font-black leading-[1.1] tracking-tight">{title}</div>
              <div className="mt-3 text-blue-200/60 text-[11px] font-medium leading-snug line-clamp-2">{subtitle}</div>
              <div className="mt-4 h-px w-12 bg-amber-400/50" />
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-4">
            <Footer color="text-amber-400/60" accent="text-amber-400" />
          </div>
        </div>
      );

    case "에세이":
      return (
        <div className="w-full h-full bg-stone-50 flex flex-col p-6 relative overflow-hidden">
          {/* 워터컬러 wash — 부드럽게 */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-radial from-rose-200/60 via-amber-100/40 to-transparent blur-2xl" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-gradient-radial from-emerald-100/50 to-transparent blur-2xl" />
          {/* 큰 따옴표 — focal point */}
          <div className="absolute top-4 right-4 text-[200px] leading-none text-stone-300/40 font-serif italic select-none">"</div>
          {/* 떨어지는 점 */}
          <div className="absolute top-16 left-12 w-1 h-1 rounded-full bg-rose-400/60" />
          <div className="absolute top-32 left-24 w-1 h-1 rounded-full bg-amber-500/40" />
          <div className="absolute top-48 left-8 w-0.5 h-0.5 rounded-full bg-emerald-700/40" />
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-stone-700 font-bold">{category}</div>
              <div className="text-[8px] font-serif italic tracking-wide text-stone-500 mt-1">— a personal memoir</div>
            </div>
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8">
            <div>
              <div className="text-stone-900 text-[24px] font-bold leading-[1.15] tracking-tight font-serif">{title}</div>
              <div className="mt-3 text-stone-600 text-[11px] italic leading-snug line-clamp-2 font-serif">{subtitle}</div>
              <div className="mt-4 h-px w-12 bg-stone-400" />
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-4">
            <Footer color="text-stone-500" accent="text-stone-700 font-serif italic" />
          </div>
        </div>
      );

    case "웹소설":
      return (
        <div className="w-full h-full bg-gradient-to-b from-indigo-950 via-purple-950 to-rose-950 flex flex-col p-6 relative overflow-hidden">
          {/* 달 + 글로우 */}
          <div className="absolute top-8 right-8">
            <div className="absolute inset-0 w-28 h-28 -m-4 rounded-full bg-yellow-100/40 blur-3xl" />
            <svg className="relative w-20 h-20" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="#fef3c7" opacity="0.9"/>
              <circle cx="62" cy="42" r="38" fill="#1e1b4b"/>
              <circle cx="42" cy="55" r="3" fill="#fde68a" opacity="0.4"/>
              <circle cx="38" cy="68" r="2" fill="#fde68a" opacity="0.3"/>
              <circle cx="48" cy="40" r="1.5" fill="#fde68a" opacity="0.5"/>
            </svg>
          </div>
          {/* 별 */}
          {[
            [12, 70, 1.4], [22, 50, 1], [38, 80, 1.2], [55, 48, 0.8], [68, 78, 1.1],
            [82, 28, 1.3], [10, 28, 0.7], [62, 22, 1.1], [28, 12, 0.9], [78, 60, 0.8],
          ].map(([x, y, r], i) => (
            <div key={i} className="absolute rounded-full bg-yellow-100"
              style={{ left: `${x}%`, top: `${y}%`, width: `${r}px`, height: `${r}px`, opacity: 0.5 + (i % 3) * 0.15 }}
            />
          ))}
          {/* 도시 silhouette + 안개 */}
          <svg className="absolute bottom-0 left-0 w-full h-28 text-indigo-950 opacity-90" viewBox="0 0 200 80" preserveAspectRatio="none">
            <path d="M0,80 L0,55 L20,55 L25,40 L40,40 L45,55 L80,55 L85,32 L110,32 L115,55 L160,55 L165,42 L185,42 L190,55 L200,55 L200,80 Z" fill="currentColor"/>
          </svg>
          <div className="absolute bottom-12 inset-x-0 h-16 bg-gradient-to-t from-purple-950/80 to-transparent" />
          {/* 큰 EP 숫자 */}
          <div className="absolute bottom-32 left-6 text-[80px] leading-none text-rose-200/15 font-black select-none">01</div>
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-rose-300 font-bold">{category}</div>
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-rose-200/40 mt-0.5">Episode 01</div>
            </div>
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8 pb-4">
            <div>
              <div className="text-white text-[24px] font-black leading-[1.1] tracking-tight drop-shadow-lg">{title}</div>
              <div className="mt-3 text-rose-100/70 text-[11px] italic leading-snug line-clamp-2">{subtitle}</div>
              <div className="mt-4 h-px w-12 bg-rose-400/60" />
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-2">
            <Footer color="text-rose-200/50" accent="text-rose-300" />
          </div>
        </div>
      );

    case "전문서":
      return (
        <div className="w-full h-full bg-white flex flex-col p-6 relative overflow-hidden">
          {/* 미니멀 격자 — 거의 안 보이게 */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="g3" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e3a8a" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100" height="140" fill="url(#g3)"/>
          </svg>
          {/* 큰 숫자 30 — Swiss style */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[180px] leading-none font-black text-blue-950 select-none tracking-tighter pointer-events-none">30</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-12 text-[10px] font-mono uppercase tracking-[0.4em] text-blue-950/70">Principles</div>
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-blue-900 font-bold">{category}</div>
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-blue-900/50 mt-0.5">Behavioral Economics</div>
            </div>
            <div className="text-[8px] font-mono text-blue-900/40 text-right tracking-wider">
              <div>FIRST EDITION</div>
              <div>2026</div>
            </div>
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8">
            <div>
              <div className="text-blue-950 text-[22px] font-bold leading-[1.15] tracking-tight">{title}</div>
              <div className="mt-3 text-blue-900/60 text-[11px] font-medium leading-snug line-clamp-2">{subtitle}</div>
              <div className="mt-4 h-px w-12 bg-blue-900/30" />
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-4">
            <Footer color="text-blue-900/40" accent="text-blue-900" />
          </div>
        </div>
      );

    case "매뉴얼":
      return (
        <div className="w-full h-full bg-cyan-50 flex flex-col p-6 relative overflow-hidden">
          {/* 블루프린트 격자 */}
          <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 140" preserveAspectRatio="none">
            <defs>
              <pattern id="bp3" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#0e7490" strokeWidth="0.3"/>
              </pattern>
            </defs>
            <rect width="100" height="140" fill="url(#bp3)"/>
          </svg>
          {/* 정밀 도면 */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 280" preserveAspectRatio="none">
            {/* 외곽 도형 */}
            <rect x="40" y="80" width="120" height="120" fill="none" stroke="#0e7490" strokeWidth="0.8"/>
            <circle cx="100" cy="140" r="50" fill="none" stroke="#0e7490" strokeWidth="1.2" strokeDasharray="3 2"/>
            <circle cx="100" cy="140" r="25" fill="none" stroke="#f97316" strokeWidth="1.5"/>
            <circle cx="100" cy="140" r="3" fill="#f97316"/>
            {/* 십자선 */}
            <line x1="20" y1="140" x2="180" y2="140" stroke="#0e7490" strokeWidth="0.5" strokeDasharray="2 2"/>
            <line x1="100" y1="60" x2="100" y2="220" stroke="#0e7490" strokeWidth="0.5" strokeDasharray="2 2"/>
            {/* 측정 */}
            <line x1="40" y1="80" x2="40" y2="65" stroke="#0e7490" strokeWidth="0.6"/>
            <line x1="160" y1="80" x2="160" y2="65" stroke="#0e7490" strokeWidth="0.6"/>
            <line x1="35" y1="68" x2="165" y2="68" stroke="#0e7490" strokeWidth="0.6"/>
            <text x="92" y="63" fill="#0e7490" fontSize="6" fontFamily="monospace">120mm</text>
            {/* 레이블 라인 */}
            <line x1="170" y1="110" x2="135" y2="125" stroke="#f97316" strokeWidth="0.6"/>
            <circle cx="135" cy="125" r="2" fill="#f97316"/>
            <text x="172" y="110" fill="#f97316" fontSize="6" fontFamily="monospace">A1</text>
            <line x1="170" y1="170" x2="135" y2="155" stroke="#f97316" strokeWidth="0.6"/>
            <circle cx="135" cy="155" r="2" fill="#f97316"/>
            <text x="172" y="170" fill="#f97316" fontSize="6" fontFamily="monospace">A2</text>
          </svg>
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-cyan-800 font-bold">{category}</div>
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-cyan-700 mt-0.5">Technical Reference</div>
            </div>
            <div className="text-[8px] font-mono text-cyan-800 text-right tracking-wider">
              <div>REV 1.0</div>
              <div className="text-cyan-700/60">2026-04</div>
            </div>
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8">
            <div>
              <div className="text-cyan-950 text-[22px] font-bold leading-[1.15] tracking-tight">{title}</div>
              <div className="mt-3 text-cyan-900/70 text-[11px] font-mono leading-snug line-clamp-2">{subtitle}</div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-px w-10 bg-cyan-700" />
                <div className="w-1.5 h-1.5 bg-tiger-orange rounded-full" />
              </div>
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-4">
            <Footer color="text-cyan-800/60" accent="text-tiger-orange" />
          </div>
        </div>
      );

    case "실용서":
    default:
      return (
        <div className="w-full h-full bg-gradient-to-br from-orange-100 via-white to-amber-50 flex flex-col p-6 relative overflow-hidden">
          {/* 큰 도형 — focal */}
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-tiger-orange/15" />
          <div className="absolute -bottom-8 -left-8 w-44 h-44 rounded-full bg-tiger-orange/25" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-tiger-orange/40" />
          {/* 큰 숫자 — focal */}
          <div className="absolute top-12 right-6 text-[100px] leading-none font-black text-tiger-orange/20 select-none tracking-tighter">30<span className="text-[40px]">분</span></div>
          {/* 좌측 컬러 바 */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-tiger-orange via-tiger-orange to-amber-400" />
          {/* 헤더 */}
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-tiger-orange font-bold">{category}</div>
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-orange-900/60 mt-0.5">Practical Guide</div>
            </div>
            <span className="text-[8px] font-mono px-1.5 py-0.5 border border-tiger-orange text-tiger-orange rounded tracking-wider">실전</span>
          </div>
          {/* 타이틀 */}
          <div className="flex-1 flex items-end relative z-10 mt-8">
            <div>
              <div className="text-ink-900 text-[24px] font-black leading-[1.1] tracking-tight">{title}</div>
              <div className="mt-3 text-gray-700 text-[11px] font-medium leading-snug line-clamp-2">{subtitle}</div>
              <div className="mt-4 h-px w-12 bg-tiger-orange" />
            </div>
          </div>
          {/* 푸터 */}
          <div className="relative z-10 mt-4">
            <Footer color="text-orange-900/50" accent="text-tiger-orange" />
          </div>
        </div>
      );
  }
}


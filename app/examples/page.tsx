// /examples — 예제 책 갤러리 (v3 Phase 3.1)
// spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.7
//
// 비로그인 접근 가능 (public). "이렇게 책을 만들었어요" — 5권 예시.
// 각 카드: 표지 · 타이틀 · 대상 · 장르 · 첫 챕터 미리보기 · 목차
// "이 책으로 시작 →" 클릭 → /new?fork=<id> (미로그인 시 login → /new?fork)
//
// fork = 카피 아님. 사용자 본인 책 만들기 form의 prefill일 뿐.
//
// 데이터: lib/landing-data.ts SAMPLE_BOOKS 중 first 5 + EXAMPLE_CONTENT 보충.

import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { SAMPLE_BOOKS } from "@/lib/landing-data";

export const metadata: Metadata = {
  title: "예제 책 5권 — 이렇게 만들었어요 | Tigerbookmaker",
  description:
    "Tigerbookmaker로 만든 5권의 예제 책. 자기계발 · 재테크 · 에세이 · 웹소설 · 전문서. 첫 챕터 미리보기 + 전체 목차. 본인 주제로 시작 가능.",
  openGraph: {
    title: "예제 책 5권 — 이렇게 만들었어요",
    description: "Tigerbookmaker 예제 책 갤러리. 첫 챕터 미리보기 + fork.",
  },
};

// ────────────────────────────────────────────
// 데이터 — 5권의 목차 + 첫 챕터 (SAMPLE_BOOKS 처음 5권 순서 일치)
// 자기계발 / 재테크 / 에세이 / 웹소설 / 전문서
// ────────────────────────────────────────────

const EXAMPLE_TOC: string[][] = [
  // 1. 아침 루틴, 30일이면 인생이 바뀝니다 (자기계발서)
  [
    "왜 새벽 5시인가",
    "첫 7일 — 몸의 저항을 부수는 법",
    "8~14일 — 루틴이 본능이 되는 시점",
    "15~21일 — 일·운동·독서 한 시간씩",
    "22~30일 — 자기 신뢰의 누적",
    "실패한 날의 회복 프로토콜",
    "에너지 관리 — 카페인·수면·식사",
    "주말은 어떻게 보내야 하는가",
    "한 달 후 다시 흔들릴 때",
    "1년차 새벽인의 하루",
    "동료를 만드는 법 — 같이 일어나기",
    "30일 다음 — 지속 가능한 시스템",
  ],
  // 2. 월급만으로 부족함을 느끼나요 (재테크)
  [
    "자산 흐름이란 무엇인가",
    "통장 쪼개기 — 6개 통장 시스템",
    "고정비 다이어트 30% 룰",
    "비상금 — 얼마, 어디에",
    "신용카드 vs 체크카드 — 진짜 차이",
    "ETF 입문 — 3개 종목으로 시작",
    "연금저축 · IRP 세제 혜택 한 번에",
    "부동산 — 30대 직장인 첫 집",
    "보험 점검 — 정말 필요한 4개만",
    "사이드 인컴 — 월 30만원 만들기",
    "FIRE까지 걸리는 시간 계산",
    "재테크 멘탈 — 시장과 거리두기",
  ],
  // 3. 나는 그래서 회사를 그만뒀습니다 (에세이)
  [
    "12월 23일, 사표를 낸 그 아침",
    "13년 동안 쌓아온 것을 두고",
    "첫 달 — 알람 없는 일상의 어색함",
    "통장 잔고와 마주한 두 번째 달",
    "엄마에게 말한 날",
    "프리랜서 첫 의뢰 — 시간당 단가의 충격",
    "직장인 친구들과 멀어지는 거리감",
    "다시 입사 제안이 왔을 때",
    "6개월차 — 매출 vs 안정감",
    "운동, 독서, 글쓰기로 채운 오후",
    "회사 다닐 때 못한 일들",
    "1년 후 — 후회와 안도 사이",
    "다시 결정한다면 — 같은 선택",
    "퇴사를 고민하는 당신에게",
  ],
  // 4. 그날 밤, 도시에 비가 내렸다 (웹소설)
  [
    "사라진 그 — 마지막 메시지",
    "비 오는 골목, 익숙한 향수",
    "낡은 카페에서 들은 이름",
    "13년 전 사진 한 장",
    "이상한 형사의 방문",
    "도시의 지하 ─ 잊혀진 길",
    "그녀가 남긴 일기장",
    "거짓을 말한 친구",
    "옛 주소로 향하는 새벽",
    "비밀의 방, 열쇠 없는 문",
    "마침내 마주한 그의 흔적",
    "도시는 아무 일 없었던 듯",
    "에필로그 — 사라진 자의 편지",
    "추신 — 7일 후",
    "마지막 페이지 — 비는 아직 내린다",
  ],
  // 5. 행동경제학 실무 입문 (전문서)
  [
    "행동경제학이란 — 합리성의 한계",
    "프레이밍 효과 — 같은 정보, 다른 결정",
    "앵커링 — 가격 책정의 기준점",
    "손실 회피 — 1.5~2.5배 강한 통증",
    "사회적 증거 — 줄 선 가게의 비밀",
    "디폴트 설정 — 선택 안 한 사람이 다수",
    "넛지 설계 — 6가지 패턴",
    "기획 사례 — 구독 해지율 30% 감소",
    "마케팅 사례 — A/B 테스트 12개",
    "정책 사례 — 장기기증 동의율 90%",
    "다크 패턴 — 윤리적 경계",
    "측정 — 정성·정량 데이터 조합",
    "실험 설계 — 6주 사이클",
  ],
];

const EXAMPLE_FIRST_CHAPTERS: string[] = [
  // 1. 자기계발서
  `왜 새벽 5시인가. 새벽 5시는 아무도 당신에게 연락하지 않는 시간이에요. 카톡도, 슬랙도, 회의 알림도 없어요. 오직 당신과 시간만 있습니다.

이 시간의 진짜 가치는 길이가 아니라 밀도예요. 출근 후의 1시간은 회의·메일·잡일에 잘게 쪼개지지만, 새벽의 1시간은 통째로 당신 것입니다. 운동을 끝내고, 책 30쪽을 읽고, 글 한 편을 쓸 수 있어요.

번아웃 직전이라고 느낀다면 문제는 시간 부족이 아니라 통제 부족일 가능성이 큽니다. 새벽 5시 루틴은 시간을 늘리는 게 아니라, 당신 손에 통제권을 돌려주는 일이에요.

처음엔 무조건 힘들어요. 7일이 가장 어렵습니다. 몸이 저항해요. 알람이 울려도 일어나기 싫고, 일어나도 멍합니다. 하지만 8일째부터 분명한 변화가 옵니다. 다음 챕터에서 첫 7일을 어떻게 견디는지 구체적으로 다룹니다.`,

  // 2. 재테크
  `재테크의 시작은 종목 추천이 아닙니다. 흐름을 보는 일이에요. 매월 어떤 돈이 들어오고, 어디로 빠져나가고, 얼마가 남는지. 이 흐름이 안 보이면 어떤 투자도 의미가 없습니다.

직장인의 흐름은 단순해 보이지만 실은 복잡해요. 월급 300만원이 들어오면, 카드 자동결제 80, 통신비 8, 보험 15, 구독 12, 생활비 50, 외식 30, 가끔의 쇼핑 25 — 이렇게만 빠져나가도 220이에요. 남은 80은 어디로 갔을까요? 대부분 모릅니다.

자산 흐름을 보는 첫 단계는 통장을 쪼개는 일이에요. 한 통장에 모든 돈이 섞이면 보이지 않습니다. 6개 통장 시스템 — 다음 챕터에서 자세히 — 으로 분리하면, 어디서 새는지 1주일 안에 발견할 수 있어요.

이 책의 목표는 부자가 되는 법이 아니라 흐름의 통제권을 잡는 법입니다. 통제권 없이 부자가 된 사람은 없어요.`,

  // 3. 에세이
  `12월 23일 아침 8시 47분. 사무실 1층 로비, 회전문 앞에서 한참 망설였습니다. 출근 카드를 찍을지, 그냥 돌아갈지. 결국 찍었어요. 그날 점심까지는 평소처럼 일했습니다.

오후 1시, 팀장에게 메시지를 보냈어요. "잠깐 시간 되세요?" 회의실에서 사표를 내밀던 그 순간보다, 사무실로 돌아와 노트북을 닫던 5시 35분이 더 기억에 남아요. 13년 동안 매일 켜고 끄던 노트북이에요. 마지막으로 끄는데 손이 떨렸습니다.

회사를 그만둔다는 건, 13년 동안 쌓아온 모든 것 — 일하는 방식, 관계, 정체성 — 을 두고 나오는 일이었어요. 잘 모르는 사람에게 "회사 다녀요"라고 말하던 한 줄짜리 자기소개도 사라집니다.

이 책은 퇴사가 옳다는 책이 아니에요. 13년 직장 생활 후 첫 1년을 어떻게 보냈는지, 그 안에서 무엇을 발견했는지 기록한 일기입니다. 결정은 당신 몫이에요.`,

  // 4. 웹소설
  `7월 12일 23시 47분. 그가 마지막으로 보낸 메시지였다. "비 오네. 너 우산 챙겼어?" 그게 전부였다. 그날 이후 7일째 그는 보이지 않았다.

처음엔 화가 났다. 어른이 일주일씩 사라지면서 한 마디 연락도 없는 건, 친구 사이에 할 짓이 아니었으니까. 둘째 날엔 걱정이 됐다. 사흘째부터는 무서워졌다. 회사는 휴가 처리되어 있고, 집은 비어 있었다. 가구는 그대로였지만 그가 매일 들고 다니던 책가방은 사라져 있었다.

오늘은 비가 내린다. 7년 전 같은 골목에 같은 시간, 같은 향수 냄새가 났다. 카페 창가에 익숙한 옆모습이 보였다. 빗방울이 유리를 두드리는 소리가 그날과 똑같았다.

"아직 살아 있어." 누군가 뒤에서 속삭였다. 돌아봤을 때 거기엔 아무도 없었다. 비는 더 거세졌고, 도시는 평소처럼 무관심했다.`,

  // 5. 전문서
  `행동경제학은 인간이 항상 합리적이라는 고전 경제학의 가정에 의문을 제기하는 학문입니다. 1979년 Kahneman과 Tversky의 'Prospect Theory' 발표가 출발점이었어요. 이들은 사람이 손실에 1.5~2.5배 민감하게 반응한다는 사실을 실험으로 증명했습니다.

실무 관점에서 행동경제학이 중요한 이유는 단순합니다. 사용자는 합리적으로 행동하지 않는다는 것이 데이터로 증명됐는데, 이걸 모르고 기획·마케팅·정책을 설계하면 실제 행동과 의도가 어긋납니다.

이 책에서 다룰 30가지 원칙은 모두 학술 논문 + 실무 사례 한 쌍으로 구성됐어요. 원칙 → 메커니즘 → 실험 결과 → 한국 시장 적용 사례 순서입니다.

다음 챕터부터 핵심 효과를 하나씩 풀어갑니다. 첫 번째는 프레이밍 효과 — 같은 정보를 어떻게 제시하느냐가 결정을 어떻게 바꾸는지, 12가지 A/B 테스트 결과를 통해 살펴봐요.`,
];

// 5권만 노출 (spec 요구). SAMPLE_BOOKS는 7권이지만 첫 5권만.
const EXAMPLES = SAMPLE_BOOKS.slice(0, 5).map((book, idx) => ({
  ...book,
  id: `example-${idx + 1}`, // /new?fork=example-1
  toc: EXAMPLE_TOC[idx] ?? [],
  firstChapter: EXAMPLE_FIRST_CHAPTERS[idx] ?? "",
}));

interface Example {
  id: string;
  title: string;
  subtitle: string;
  audience: string;
  category: string;
  chapters: number;
  pages: number;
  kmongPrice: number;
  toc: string[];
  firstChapter: string;
}

// 장르별 컬러 팔레트 — landing CoverDesign 간소화
const COVER_PALETTES: Record<string, {
  bg: string; glow: string; accent: string;
  label: string; title: string; subtitle: string; divider: string; footer: string;
}> = {
  "자기계발서": {
    bg: "linear-gradient(to bottom, #fef3c7, #fed7aa, #fdba74)",
    glow: "#fcd34d",
    accent: "#f97316",
    label: "#7c2d12",
    title: "#0a0a0a",
    subtitle: "#7c2d12",
    divider: "#7c2d12",
    footer: "#7c2d12",
  },
  "재테크": {
    bg: "linear-gradient(to bottom, #020617, #0f172a, #1e293b)",
    glow: "#22d3ee",
    accent: "#22d3ee",
    label: "#22d3ee",
    title: "#f1f5f9",
    subtitle: "#94a3b8",
    divider: "#22d3ee",
    footer: "#64748b",
  },
  "에세이": {
    bg: "linear-gradient(to bottom, #fafaf9, #f5f5f4, #e7e5e4)",
    glow: "#a8a29e",
    accent: "#0a0a0a",
    label: "#44403c",
    title: "#0a0a0a",
    subtitle: "#57534e",
    divider: "#0a0a0a",
    footer: "#78716c",
  },
  "웹소설": {
    bg: "linear-gradient(to bottom, #1e1b4b, #312e81, #4338ca)",
    glow: "#a78bfa",
    accent: "#fbbf24",
    label: "#fbbf24",
    title: "#fef3c7",
    subtitle: "#c7d2fe",
    divider: "#fbbf24",
    footer: "#a5b4fc",
  },
  "전문서": {
    bg: "linear-gradient(to bottom, #f8fafc, #e2e8f0, #cbd5e1)",
    glow: "#475569",
    accent: "#1e293b",
    label: "#334155",
    title: "#0f172a",
    subtitle: "#475569",
    divider: "#0f172a",
    footer: "#64748b",
  },
  "매뉴얼": {
    bg: "linear-gradient(to bottom, #fff7ed, #fed7aa, #fdba74)",
    glow: "#fb923c",
    accent: "#9a3412",
    label: "#9a3412",
    title: "#0a0a0a",
    subtitle: "#9a3412",
    divider: "#9a3412",
    footer: "#9a3412",
  },
  "실용서": {
    bg: "linear-gradient(to bottom, #ecfdf5, #d1fae5, #a7f3d0)",
    glow: "#34d399",
    accent: "#065f46",
    label: "#065f46",
    title: "#0a0a0a",
    subtitle: "#065f46",
    divider: "#065f46",
    footer: "#065f46",
  },
};

// ────────────────────────────────────────────
// Page
// ────────────────────────────────────────────

export default function ExamplesPage() {
  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header variant="default" />

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(ellipse_at_50%_-20%,rgba(249,115,22,0.10),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-12 md:pt-28 md:pb-16">
          <Eyebrow>예제 책 갤러리</Eyebrow>
          <h1 className="mt-6 font-black tracking-tightest leading-[0.98] text-[40px] sm:text-5xl md:text-6xl text-ink-900">
            이렇게 책을<br />
            만들었어요 <span className="text-tiger-orange">— 예제 5권.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
            장르별 본보기. 톤·구조·표지·목차가 어떻게 짜이는지 직접 살펴보세요.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-gray-500">
            <b>&quot;이 책으로 시작&quot; 버튼</b> = 같은 장르·톤으로 본인 주제 입력 — 카피본이 아닌 새 프로젝트.
          </p>
        </div>
      </section>

      {/* 책 5권 */}
      <section className="pb-24 md:pb-32">
        <div className="max-w-5xl mx-auto px-6 space-y-12 md:space-y-16">
          {EXAMPLES.map((book, idx) => (
            <ExampleCard key={book.id} book={book} reverse={idx % 2 === 1} />
          ))}
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="border-t border-gray-200 bg-white py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Eyebrow>준비됐어요?</Eyebrow>
          <h2 className="mt-6 text-3xl md:text-4xl font-black tracking-tight text-ink-900">
            본인 주제로 시작.
          </h2>
          <p className="mt-4 text-gray-600">
            한 줄만 적으면 됩니다. 자료 없어도 OK — AI 인터뷰가 채워줘요.
          </p>
          <Link
            href="/new"
            className="inline-block mt-8 px-8 py-3.5 bg-tiger-orange text-white font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition"
          >
            새 프로젝트 시작 →
          </Link>
        </div>
      </section>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3 text-[11px] font-mono text-tiger-orange uppercase tracking-[0.2em]">
      <span className="w-6 h-px bg-tiger-orange" />
      {children}
    </div>
  );
}

function ExampleCard({ book, reverse }: { book: Example; reverse: boolean }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className={`grid md:grid-cols-12 gap-0 ${reverse ? "md:[direction:rtl]" : ""}`}>
        {/* 표지 */}
        <div className="md:col-span-5 p-6 md:p-8 bg-gradient-to-br from-orange-50 via-amber-50/50 to-orange-100/50 [direction:ltr]">
          <div className="aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-gray-200 shadow-md">
            <SimpleCover
              category={book.category}
              title={book.title}
              subtitle={book.subtitle}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 text-[11px] font-mono">
            <span className="px-2 py-1 rounded bg-white border border-tiger-orange/40 text-tiger-orange uppercase tracking-wider">
              {book.category}
            </span>
            <span className="text-gray-500">
              {book.chapters}챕터 · {book.pages}쪽
            </span>
          </div>
        </div>

        {/* 본문 */}
        <div className="md:col-span-7 p-6 md:p-8 [direction:ltr]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-ink-900 leading-tight">
            {book.title}
          </h2>
          <p className="mt-2 text-gray-600 leading-relaxed">{book.subtitle}</p>

          <div className="mt-3 text-xs text-gray-500">
            <span className="font-bold">대상</span> · {book.audience}
          </div>

          {/* 목차 */}
          <div className="mt-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange font-bold mb-2">
              목차 ({book.toc.length}챕터)
            </div>
            <ol className="text-sm text-gray-700 space-y-1.5">
              {book.toc.map((ch, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-tiger-orange shrink-0 w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{ch}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 첫 챕터 미리보기 */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange font-bold mb-2">
              1장. {book.toc[0] ?? "첫 챕터"} — 미리보기
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {book.firstChapter}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/new?fork=${book.id}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-tiger-orange text-white font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition"
            >
              이 책으로 시작 →
            </Link>
            <span className="text-xs text-gray-500">
              본인 주제로 바꿔 새 프로젝트 생성. 카피 아님.
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

// 간소화된 cover 디자인 — landing 페이지 GenreBookCard의 lite 버전
function SimpleCover({ category, title, subtitle }: { category: string; title: string; subtitle: string }) {
  const palette = COVER_PALETTES[category] ?? COVER_PALETTES["실용서"];
  return (
    <div
      className="w-full h-full flex flex-col p-5 relative overflow-hidden"
      style={{ background: palette.bg }}
    >
      <div className="absolute -top-20 -right-10 w-48 h-48 rounded-full opacity-30 blur-3xl" style={{ background: palette.glow }} />
      <div className="relative z-10 flex items-start justify-between">
        <div className="text-[9px] font-mono uppercase tracking-[0.3em] font-bold" style={{ color: palette.label }}>
          {category}
        </div>
        <div className="w-1 h-8" style={{ background: palette.accent }} />
      </div>
      <div className="flex-1 flex items-end relative z-10 mt-6">
        <div>
          <div className="text-[20px] md:text-[22px] font-black leading-[1.05] tracking-tight" style={{ color: palette.title }}>
            {title}
          </div>
          <div className="mt-2 text-[10px] font-medium leading-snug line-clamp-2" style={{ color: palette.subtitle }}>
            {subtitle}
          </div>
          <div className="mt-3 h-px w-10" style={{ background: palette.divider }} />
        </div>
      </div>
      <div className="relative z-10 mt-3 flex items-center justify-between text-[8px] font-mono tracking-[0.25em] uppercase" style={{ color: palette.footer }}>
        <span className="font-bold">Tigerbookmaker</span>
        <span style={{ color: palette.accent }}>2026 · Vol.01</span>
      </div>
    </div>
  );
}

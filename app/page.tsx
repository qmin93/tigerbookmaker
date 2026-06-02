// /  메인 랜딩 — /preorder 와 동일 디자인 시스템
// warm cream + deep ink + vermilion · Pretendard 900 + Lora italic + JetBrains Mono

import Link from "next/link";
import { getLandingStats } from "@/lib/server/db";
import { PersonaHero } from "./_home/PersonaHero";

export const revalidate = 300;

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  border: "#E7E0D2",
  accent: "#D24B2A",
  accentDark: "#A93917",
  accentSoft: "#F4DED4",
};

const FONT_SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_SERIF = '"Nanum Myeongjo", "Noto Serif KR", serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

const SAMPLE_BOOKS = [
  {
    title: "아침 루틴, 30일이면 인생이 바뀝니다",
    audience: "번아웃 직전의 30대 직장인",
    type: "자기계발서",
    palette: { bg: "#F97316", text: "#FFF8F1" },
    days: 30,
    forkId: "example-1",
  },
  {
    title: "월급만으로 부족함을 느끼나요",
    audience: "재테크 처음 시작하는 30대",
    type: "재테크",
    palette: { bg: "#1E40AF", text: "#E0E7FF" },
    days: 21,
    forkId: "example-2",
  },
  {
    title: "나는 그래서 회사를 그만뒀습니다",
    audience: "퇴사를 고민하는 직장인",
    type: "에세이",
    palette: { bg: "#1F2937", text: "#F3F4F6" },
    days: 14,
    forkId: "example-3",
  },
  {
    title: "오늘 저녁 뭐 먹지, 1주일 식단표",
    audience: "1인 가구·맞벌이 부부",
    type: "실용서",
    palette: { bg: "#059669", text: "#ECFDF5" },
    days: 7,
    forkId: "example-4",
  },
];

const TIERS = [
  { id: "basic", name: "라이트", price: 4000, blurb: "본문 + 표지", scenario: "크몽 ₩30,000 등록용" },
  { id: "pro", name: "표준", price: 7400, blurb: "+ 마케팅 카피", scenario: "크몽 베스트셀러용", popular: true },
  { id: "premium", name: "프리미엄", price: 21300, blurb: "+ 오디오·슬라이드", scenario: "출판사 제출용" },
];

export default async function HomePage() {
  const stats = await getLandingStats().catch(() => ({
    bookCount: 0,
    userCount: 0,
    betaDays: 1,
  }));

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: C.bg,
        color: C.ink,
        fontFamily: FONT_SANS,
        overflow: "hidden",
      }}
    >
      <MeshBackground />
      <Grain />

      {/* NAV */}
      <nav
        style={{
          position: "relative",
          zIndex: 5,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 24px",
          background: "rgba(248,245,238,0.7)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: C.ink }}>
            <BookmarkIcon />
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em" }}>
              tigerbookmaker
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Link
              href="/preorder"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.18em",
                color: C.accent,
                textTransform: "uppercase",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              사전예약
            </Link>
            <Link
              href="/login"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.18em",
                color: C.muted,
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              로그인
            </Link>
          </div>
        </div>
      </nav>


      <PersonaHero>
        <div
          style={{
            animation: 'preorderFadeUp 800ms 1700ms cubic-bezier(0.22,1,0.36,1) both',
            marginTop: 40,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 28,
            paddingTop: 28,
            borderTop: '1px solid ' + C.border,
          }}
        >
          <Stat label='베타 D+' value={String(stats.betaDays)} />
          <Stat label='생성된 책' value={stats.bookCount > 0 ? stats.bookCount + '권' : '—'} />
          <Stat label='활동 작가' value={stats.userCount > 0 ? stats.userCount + '명' : '—'} />
        </div>
      </PersonaHero>


      {/* Marquee */}
      <section
        aria-hidden
        style={{
          position: "relative",
          zIndex: 4,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          background: C.ink,
          color: C.bg,
          overflow: "hidden",
          margin: "20px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            whiteSpace: "nowrap",
            padding: "18px 0",
            animation: "preorderMarquee 38s linear infinite",
            fontFamily: FONT_MONO,
            fontSize: 13,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
          }}
        >
          {[...Array(2)].map((_, k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 36 }}>
              {[
                "주제 한 줄",
                "★",
                "12챕터 자동",
                "★",
                "표지 30종 갤러리",
                "★",
                "마케팅 카피 자동",
                "★",
                "권당 ₩4,000",
                "★",
                "베타 ₩5,000 크레딧",
                "★",
                "한국어 명조 본문",
                "★",
              ].map((t, i) => (
                <span
                  key={i}
                  style={{
                    paddingRight: 36,
                    color: t === "★" ? C.accent : C.bg,
                    opacity: t === "★" ? 1 : 0.92,
                  }}
                >
                  {t}
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* 3단계 워크플로우 */}
      <section style={{ position: "relative", zIndex: 4, padding: "60px 24px 40px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel num="01" title="30분 워크플로우" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 36,
              maxWidth: 720,
            }}
          >
            ChatGPT 2주 → tigerbookmaker <span style={{ color: C.accent }}>30분</span>.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
            }}
            className="steps-grid"
          >
            {[
              {
                no: "STEP 1",
                title: "주제 한 줄 + 본인 자료 1개",
                desc: "한국어로 만들고 싶은 주제와, 본인 톤이 담긴 자료 (블로그 글·메모·강의안) 한 개를 입력합니다.",
                time: "1분",
              },
              {
                no: "STEP 2",
                title: "AI가 12챕터 + 표지 자동",
                desc: "Story Bible 기반 12챕터 본문, 표지 30종 갤러리에서 선택, 마케팅 카피·SEO 키워드 자동 파생.",
                time: "25분",
              },
              {
                no: "STEP 3",
                title: "본인이 10% 다듬어 완성",
                desc: "AI가 90%, 본인이 10%. PDF·EPUB·DOCX 다운로드 + 크몽·KDP 등록 패키지 한 번에.",
                time: "5분",
              },
            ].map((step, i) => (
              <div
                key={step.no}
                style={{
                  background: "white",
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "24px 22px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: C.accent,
                    textTransform: "uppercase",
                    marginBottom: 12,
                    fontWeight: 500,
                  }}
                >
                  {step.no}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.ink, marginBottom: 8, letterSpacing: "-0.02em" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: C.body, lineHeight: 1.6, marginBottom: 16 }}>{step.desc}</p>
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    color: C.muted,
                    padding: "4px 10px",
                    background: C.bg,
                    borderRadius: 999,
                  }}
                >
                  {step.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가격 (3 티어) */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          background: "white",
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel num="02" title="가격" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 8,
            }}
          >
            권당 결제 · 카드 등록 없음.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 40 }}>
            충전 후 사용한 만큼만 차감 · 베타 ₩5,000 무료 크레딧 = 라이트 1권 무료
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
            }}
            className="tier-grid"
          >
            {TIERS.map((t) => (
              <div
                key={t.id}
                style={{
                  position: "relative",
                  background: t.popular ? C.ink : "white",
                  color: t.popular ? "white" : C.ink,
                  border: `1px solid ${t.popular ? C.ink : C.border}`,
                  borderRadius: 16,
                  padding: "28px 24px",
                }}
              >
                {t.popular && (
                  <span
                    style={{
                      position: "absolute",
                      top: -10,
                      right: 16,
                      background: C.accent,
                      color: "white",
                      fontSize: 10,
                      fontFamily: FONT_MONO,
                      letterSpacing: "0.18em",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                  >
                    BEST
                  </span>
                )}
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: t.popular ? C.accent : C.muted,
                    textTransform: "uppercase",
                    marginBottom: 10,
                    fontWeight: 500,
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    letterSpacing: "-0.025em",
                    marginBottom: 4,
                  }}
                >
                  ₩{t.price.toLocaleString()}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      opacity: 0.65,
                      marginLeft: 6,
                    }}
                  >
                    / 권
                  </span>
                </div>
                <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 18 }}>{t.blurb}</div>
                <div
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 13,
                    fontStyle: "italic",
                    color: t.popular ? "#F4DED4" : C.muted,
                    paddingTop: 16,
                    borderTop: `1px solid ${t.popular ? "rgba(255,255,255,0.15)" : C.border}`,
                  }}
                >
                  {t.scenario}
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: 24,
              fontSize: 13,
              color: C.muted,
              textAlign: "center",
            }}
          >
            전체 가격표는{" "}
            <Link
              href="/pricing"
              style={{ color: C.accent, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              /pricing →
            </Link>
          </p>
        </div>
      </section>

      {/* A. 비교표 — ChatGPT vs 외주 vs tigerbookmaker */}
      <section style={{ position: "relative", zIndex: 4, padding: "80px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel num="03" title="비교" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 8,
            }}
          >
            왜 30분이 가능한가.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 36 }}>
            기존 방식이 안 됐던 이유는 분명합니다.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "white",
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                overflow: "hidden",
                minWidth: 720,
              }}
            >
              <thead>
                <tr style={{ background: C.bg }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "18px 20px",
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      color: C.muted,
                      textTransform: "uppercase",
                      borderBottom: `1px solid ${C.border}`,
                      fontWeight: 500,
                    }}
                  >
                    항목
                  </th>
                  <ComparisonHeader label="ChatGPT 직접" sub="2주 + Canva" />
                  <ComparisonHeader label="외주" sub="₩300,000+" />
                  <ComparisonHeader label="tigerbookmaker" sub="권당 ₩4,000부터" highlight />
                </tr>
              </thead>
              <tbody>
                {[
                  ["시간", "2-3주", "1-2주", "30분"],
                  ["권당 비용", "도구 ₩0 (시간↑)", "₩300,000", "₩4,000–₩21,300"],
                  ["챕터 구조", "직접 잡음", "외주 작가", "자동 12챕터"],
                  ["표지·내지", "Canva 별도", "포함", "30종 갤러리"],
                  ["마케팅 카피", "별도", "옵션", "자동 파생"],
                  ["본인 톤 유지", "프롬프트 반복", "외주 의존", "본인 자료 학습"],
                  ["저작권/소유권", "본인", "계약 따라", "본인 100%"],
                  ["재사용성", "프롬프트 매번", "다시 외주", "무제한"],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td
                      style={{
                        padding: "14px 20px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: C.ink,
                      }}
                    >
                      {row[0]}
                    </td>
                    <ComparisonCell text={row[1]} />
                    <ComparisonCell text={row[2]} />
                    <ComparisonCell text={row[3]} highlight />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* B. 사회적 증거 — 후기 + 로고 띠 */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          background: "white",
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel num="04" title="베타 사용자 후기" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 8,
            }}
          >
            "AI가 부족한 게 아니라, 시간이 부족했어요."
          </h2>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 36 }}>
            ※ 결과는 주제·자료 품질·시장 환경에 따라 다를 수 있습니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
              marginBottom: 56,
            }}
          >
            {[
              {
                quote:
                  "퇴근 후 30분이 진짜 됐어요. 라인업 1권 → 4권 됐고, 주말에 일하지 않게 됐어요.",
                name: "박지수",
                role: "마케터 4년차 · 크몽 셀러",
                age: "32",
              },
              {
                quote:
                  "노션에서 챕터 구조 잡는 데 1시간 쓰던 게 없어졌어요. AI가 12챕터 자동으로 깔아주고 저는 톤만 봅니다.",
                name: "김민지",
                role: "워킹맘 · Maily 작가",
                age: "35",
              },
              {
                quote:
                  "강의 자료 PPT 한 개로 책 한 권이 나왔어요. 외주 ₩500만 견적 보고 포기했던 게 30분에.",
                name: "이정훈",
                role: "영어 코치 · 인프런 강사",
                age: "38",
              },
            ].map((t) => (
              <figure
                key={t.name}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "24px 22px",
                  margin: 0,
                }}
              >
                <blockquote
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: C.ink,
                    margin: 0,
                    marginBottom: 18,
                  }}
                >
                  "{t.quote}"
                </blockquote>
                <figcaption
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    color: C.muted,
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ width: 18, height: 1, background: C.accent, display: "inline-block" }} />
                  {t.name} · {t.age}세, {t.role}
                </figcaption>
              </figure>
            ))}
          </div>

          {/* 로고 띠 — 이런 곳에서 판매·배포 */}
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: 36,
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.2em",
                color: C.muted,
                textTransform: "uppercase",
                textAlign: "center",
                marginBottom: 20,
                fontWeight: 500,
              }}
            >
              · 이런 곳에서 판매·배포할 수 있어요 ·
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 40,
                flexWrap: "wrap",
                opacity: 0.55,
              }}
            >
              {[
                { name: "크몽", desc: "PDF 자료" },
                { name: "Amazon KDP", desc: "전자책" },
                { name: "Naver 블로그", desc: "본문 분할" },
                { name: "Maily", desc: "뉴스레터" },
                { name: "텀블벅", desc: "독립출판" },
                { name: "교보 PubPle", desc: "전자책" },
              ].map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 17, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    {p.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* C. FAQ */}
      <section style={{ position: "relative", zIndex: 4, padding: "80px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionLabel num="05" title="자주 묻는 질문" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 36,
            }}
          >
            궁금한 거 미리 답할게요.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              {
                q: "AI가 만든 책, 진짜 제 것인가요?",
                a: "네, 100% 본인 것입니다. 저작권·로열티 모두 사용자에게 있어요. 크몽·KDP·블로그·뉴스레터 어디서든 자유롭게 판매하실 수 있습니다.",
              },
              {
                q: "AI 표절 아닌가요?",
                a: "본인이 입력한 주제와 자료를 기반으로 새로 생성되므로 표절이 아닙니다. 한국 AI 기본법(2026-01)에 따라 AI 콘텐츠임을 책 메타데이터에 표시하시는 것을 권장합니다. 자동 라벨 옵션을 제공해요.",
              },
              {
                q: "정식 오픈 시 가격은?",
                a: "권당 결제 모델입니다. 라이트 ₩4,000 / 표준 ₩7,400 / 풀 ₩12,200 / 프리미엄 ₩21,300. 베타 사전예약자에게는 평생 베타 가격(권당 -50%)을 유지해드릴 계획입니다.",
              },
              {
                q: "환불되나요?",
                a: "베타 기간은 결제 자체가 없으니 환불 이슈가 없습니다. 정식 오픈 후에는 첫 책 7일 100% 환불을 제공합니다. 만족 못 하시면 묻지 않고 환불해드려요.",
              },
            ].map((f, i) => (
              <details
                key={i}
                style={{
                  background: "white",
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "18px 22px",
                }}
              >
                <summary
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    listStyle: "none",
                    fontSize: 17,
                    fontWeight: 700,
                    color: C.ink,
                  }}
                >
                  {f.q}
                  <span
                    style={{
                      flexShrink: 0,
                      marginLeft: 12,
                      fontFamily: FONT_MONO,
                      fontSize: 18,
                      color: C.accent,
                    }}
                  >
                    +
                  </span>
                </summary>
                <p
                  style={{
                    marginTop: 14,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: C.body,
                  }}
                >
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 샘플 책 4종 */}
      <section
        id="samples"
        style={{
          position: "relative",
          zIndex: 4,
          background: "white",
          borderTop: `1px solid ${C.border}`,
          padding: "80px 24px",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel num="06" title="실제 생성 샘플" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 8,
            }}
          >
            베타 사용자가 30분에 만든 4권.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 40 }}>
            클릭하면 그 주제로 본인의 책을 만들기 시작합니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {SAMPLE_BOOKS.map((b) => (
              <Link
                key={b.forkId}
                href={`/new?fork=${b.forkId}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "3 / 4",
                    background: b.palette.bg,
                    color: b.palette.text,
                    borderRadius: 8,
                    padding: 22,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    boxShadow: `0 12px 28px -16px ${b.palette.bg}aa`,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      top: 16,
                      bottom: 16,
                      width: 2,
                      background: b.palette.text,
                      opacity: 0.18,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: "0.25em",
                      opacity: 0.75,
                      textTransform: "uppercase",
                    }}
                  >
                    {b.type}
                  </span>
                  <div>
                    <h3
                      style={{
                        fontWeight: 900,
                        fontSize: 19,
                        lineHeight: 1.18,
                        letterSpacing: "-0.02em",
                        margin: 0,
                      }}
                    >
                      {b.title}
                    </h3>
                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 11,
                        opacity: 0.78,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {b.audience}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      color: C.muted,
                      letterSpacing: "0.1em",
                    }}
                  >
                    이 주제로 시작
                  </span>
                  <span style={{ fontSize: 14, color: C.accent }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 최종 CTA */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          padding: "100px 24px",
          background: C.ink,
          color: C.bg,
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 900,
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                background: `linear-gradient(120deg, ${C.accent}, #F0A37A)`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              한정 100명
            </span>
            <br />
            사전예약 진행 중.
          </h2>
          <p
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 19,
              fontStyle: "italic",
              opacity: 0.85,
              marginBottom: 36,
            }}
          >
            "AI가 부족한 게 아니라, 다듬을 시간이 부족했어요."
          </p>
          <Link
            href="/preorder"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "20px 36px",
              background: C.accent,
              color: "white",
              borderRadius: 14,
              fontSize: 17,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: `0 20px 40px -16px ${C.accent}cc`,
              letterSpacing: "-0.01em",
            }}
          >
            사전예약 신청하기
            <span style={{ fontSize: 20 }}>→</span>
          </Link>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              opacity: 0.55,
              marginTop: 20,
              textTransform: "uppercase",
            }}
          >
            카드 정보 받지 않음 · 베타 ₩5,000 크레딧
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 4,
          padding: "32px 24px",
          background: C.bg,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: "0.15em",
            color: C.muted,
            textTransform: "uppercase",
          }}
        >
          <span>tigerbookmaker · 2026</span>
          <div style={{ display: "flex", gap: 18 }}>
            <Link href="/legal/terms" style={{ color: C.muted, textDecoration: "none" }}>
              이용약관
            </Link>
            <Link href="/legal/privacy" style={{ color: C.muted, textDecoration: "none" }}>
              개인정보
            </Link>
            <Link href="/legal/refund" style={{ color: C.muted, textDecoration: "none" }}>
              환불정책
            </Link>
            <a
              href="https://managerkim.com"
              target="_blank"
              rel="noopener"
              style={{ color: C.muted, textDecoration: "none" }}
            >
              김과장
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .tier-grid { grid-template-columns: 1fr !important; }
          .hero-illust { max-width: 320px !important; opacity: 0.85; }
        }
        @media (max-width: 560px) {
          .hero-illust { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}

// ─── Subcomponents ─────────────────────

function ComparisonHeader({ label, sub, highlight }: { label: string; sub: string; highlight?: boolean }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "18px 20px",
        background: highlight ? C.ink : C.bg,
        color: highlight ? "white" : C.ink,
        borderBottom: highlight ? "none" : `1px solid ${C.border}`,
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: "-0.01em",
      }}
    >
      <div>{label}</div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: "0.15em",
          color: highlight ? C.accentSoft : C.muted,
          textTransform: "uppercase",
          marginTop: 4,
          fontWeight: 500,
        }}
      >
        {sub}
      </div>
    </th>
  );
}

function ComparisonCell({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <td
      style={{
        padding: "14px 20px",
        fontSize: 14,
        color: highlight ? C.ink : C.body,
        fontWeight: highlight ? 700 : 400,
        background: highlight ? C.accentSoft : "transparent",
      }}
    >
      {text}
    </td>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          color: C.muted,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.ink, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: "0.22em",
          color: C.accent,
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {num} · {title}
      </span>
      <span style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 4h12v17l-6-4-6 4V4z" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h4" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MeshBackground() {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden", pointerEvents: "none" }}
    >
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: "55%",
          height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, #FFB59A88, transparent 70%)",
          filter: "blur(40px)",
          animation: "preorderMesh 22s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          right: "-15%",
          width: "50%",
          height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, #E7D6F077, transparent 70%)",
          filter: "blur(40px)",
          animation: "preorderMesh2 26s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function Grain() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        opacity: 0.22,
        mixBlendMode: "multiply",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundSize: "200px 200px",
      }}
    />
  );
}

// preorder 페이지와 같은 일러스트 (viewBox 600x600)
function BookIllustration() {
  return (
    <svg viewBox="0 0 600 600" width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="bookPage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F2EBDA" />
        </linearGradient>
        <linearGradient id="bookSpine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.accent} />
          <stop offset="1" stopColor="#F0A37A" />
        </linearGradient>
        <linearGradient id="aiTag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.ink} />
          <stop offset="1" stopColor="#2E2A24" />
        </linearGradient>
      </defs>

      <circle
        cx="300"
        cy="290"
        r="240"
        fill="url(#bookSpine)"
        opacity="0.06"
        style={{ transformOrigin: "300px 290px", animation: "preorderPulse 6s infinite ease-in-out" }}
      />
      <ellipse cx="300" cy="530" rx="220" ry="16" fill={C.ink} opacity="0.1" />

      <g>
        <rect x="80" y="80" width="440" height="400" rx="8" fill="url(#bookPage)" stroke={C.border} strokeWidth="1" />
        <line x1="300" y1="80" x2="300" y2="480" stroke={C.border} strokeWidth="1" strokeDasharray="2 4" />

        <text x="110" y="115" fontFamily={FONT_MONO} fontSize="12" fill={C.accent} letterSpacing="2" fontWeight="500">
          CH. 01
        </text>
        <text x="488" y="115" textAnchor="end" fontFamily={FONT_MONO} fontSize="12" fill={C.muted} letterSpacing="2">
          P. 12
        </text>

        <text x="110" y="170" fontFamily={FONT_SANS} fontSize="34" fontWeight="900" fill={C.ink} letterSpacing="-1">
          서문.
        </text>

        {[200, 224, 248, 272, 308, 332, 356, 380].map((y, i) => (
          <rect
            key={"L" + i}
            x="110"
            y={y}
            width={[150, 130, 145, 100, 140, 120, 155, 90][i]}
            height="6"
            rx="3"
            fill={C.muted}
            opacity={i < 4 ? 0.55 : 0.32}
          />
        ))}

        {[140, 164, 188, 212, 236, 260, 284, 308, 332, 356].map((y, i) => (
          <rect
            key={"R" + i}
            x="315"
            y={y}
            width={[170, 150, 165, 120, 155, 140, 175, 110, 150, 90][i]}
            height="6"
            rx="3"
            fill={C.muted}
            opacity={i < 5 ? 0.55 : 0.3}
          />
        ))}

        <path
          d="M110 410 Q200 392 300 410 T490 402"
          fill="none"
          stroke={C.accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1500"
          strokeDashoffset="1500"
          style={{ animation: "preorderDraw 2.4s 0.8s ease-out both" }}
        />
        <path
          d="M110 432 Q240 418 380 436 T498 424"
          fill="none"
          stroke={C.ink}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
          strokeDasharray="1500"
          strokeDashoffset="1500"
          style={{ animation: "preorderDraw 2.4s 1.2s ease-out both" }}
        />

        <path d="M430 80v96l18-12 18 12V80z" fill="url(#bookSpine)" stroke="white" strokeWidth="2" />
      </g>

      <g
        style={
          { ["--rot" as any]: "-4deg", animation: "preorderFloat 5s ease-in-out infinite" } as React.CSSProperties
        }
      >
        <rect x="120" y="244" width="124" height="40" rx="20" fill="url(#aiTag)" />
        <circle
          cx="140"
          cy="264"
          r="5"
          fill={C.accent}
          style={{ animation: "preorderPulse 1.6s infinite ease-out", transformOrigin: "140px 264px" }}
        />
        <text x="156" y="269" fontFamily={FONT_MONO} fontSize="12" fill="white" letterSpacing="2" fontWeight="500">
          AI · 30분
        </text>
      </g>

      <g
        transform="translate(420 410) rotate(-10)"
        style={{
          animation: "preorderFadeUp 600ms 2.6s cubic-bezier(0.22,1,0.36,1) both",
          transformOrigin: "420px 410px",
        }}
      >
        <rect x="-48" y="-22" width="96" height="44" rx="4" fill="none" stroke={C.accent} strokeWidth="3" />
        <rect x="-42" y="-16" width="84" height="32" rx="2" fill="none" stroke={C.accent} strokeWidth="1" />
        <text
          x="0"
          y="7"
          textAnchor="middle"
          fontFamily={FONT_SANS}
          fontWeight="900"
          fontSize="22"
          fill={C.accent}
          letterSpacing="2"
        >
          DONE
        </text>
      </g>

      {[
        [70, 70, 0],
        [530, 150, 0.6],
        [60, 460, 1.2],
        [540, 510, 1.8],
        [180, 60, 0.3],
      ].map(([x, y, d], i) => (
        <g
          key={i}
          transform={`translate(${x} ${y})`}
          style={{
            transformOrigin: `${x}px ${y}px`,
            animation: `preorderPulse 2.6s ${d}s infinite ease-in-out`,
          }}
        >
          <path d="M0-10 L2.5-2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5-2.5 Z" fill={C.accent} />
        </g>
      ))}
    </svg>
  );
}

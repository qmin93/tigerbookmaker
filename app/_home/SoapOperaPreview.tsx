"use client";

import { useState } from "react";

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  border: "#E7E0D2",
  accent: "#D24B2A",
};

const FONT_SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_SERIF = '"Hahmlet", "Nanum Myeongjo", "Noto Serif KR", serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

// Secret 7 — 후속 퍼널을 사용자에게 명시.
// "신청하면 매일 어떤 게 오는지" 보여줘서 사전예약 자체의 가치 ↑.
const DAYS = [
  {
    day: 0,
    when: "신청 즉시",
    title: "미니 이북 PDF + 키워드 30개",
    desc: "이메일 입력 1분 내. tigerbookmaker로 직접 만든 30페이지 PDF + 크몽 베스트셀러 키워드 분석.",
  },
  {
    day: 1,
    when: "다음 날",
    title: "진짜 30분에 되나요?",
    desc: "베타 예시 사례 박지수씨의 첫 책 만들기 과정. 시도 실패 → 깨달음 → 결과.",
  },
  {
    day: 2,
    when: "3일째",
    title: "ChatGPT로 2주 걸리는 3가지 이유",
    desc: "프롬프트 묶음·외주·노션 — 안 되는 이유 + 잘못된 믿음 깨기.",
  },
  {
    day: 3,
    when: "4일째",
    title: "AI에 90% 떠넘기는 게 합리적인 이유",
    desc: "AI는 인턴. 잘 가르치는 워크플로우 + tigerbookmaker가 하는 역할.",
  },
  {
    day: 4,
    when: "5일째",
    title: "한 달 후 박지수씨의 라인업",
    desc: "베타 사용 한 달 결과 + 일상 변화 + 본인 톤 유지하는 방법.",
  },
  {
    day: 5,
    when: "6일째",
    title: "베타 오픈 D-Day",
    desc: "혜택 5종 활성 + ₩5,000 크레딧 자동 적용 + 첫 책 만들기 가이드.",
  },
];

export function SoapOperaPreview() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      style={{
        position: "relative",
        zIndex: 4,
        padding: "80px 24px",
        background: C.bg,
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
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
            06 · 신청하면 매일 받는 것
          </span>
          <span style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <h2
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 800,
            fontSize: 40,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: C.ink,
            marginBottom: 12,
          }}
        >
          5일 뒤, 첫 책이
          <br />
          <span style={{ color: C.accent }}>준비 완료</span>.
        </h2>
        <p
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 16,
            fontStyle: "italic",
            color: C.muted,
            marginBottom: 36,
            lineHeight: 1.6,
          }}
        >
          신청 즉시 PDF가 도착하고, 매일 한 통씩 베타 오픈 D-Day까지 가이드를 보냅니다.
        </p>

        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {DAYS.map((d, i) => {
            const open = openIdx === i;
            const isToday = i === 0;
            return (
              <li
                key={d.day}
                style={{
                  position: "relative",
                  paddingLeft: 36,
                  paddingBottom: i < DAYS.length - 1 ? 4 : 0,
                }}
              >
                {/* 좌측 타임라인 도트 + 라인 */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 14,
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: isToday ? C.accent : "white",
                    border: `2px solid ${isToday ? C.accent : C.border}`,
                    zIndex: 1,
                  }}
                />
                {i < DAYS.length - 1 && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 13,
                      top: 26,
                      bottom: -8,
                      width: 2,
                      background: C.border,
                    }}
                  />
                )}

                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "white",
                    border: `1px solid ${open ? C.ink : C.border}`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    marginBottom: 8,
                    cursor: "pointer",
                    transition: "border-color 180ms ease",
                    fontFamily: FONT_SANS,
                    color: C.ink,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 16,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          color: isToday ? C.accent : C.muted,
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Day {d.day} · {d.when}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 2 }}>
                        {d.title}
                      </span>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        border: `1px solid ${C.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: open ? C.ink : "transparent",
                        color: open ? "white" : C.ink,
                        fontSize: 14,
                        lineHeight: 1,
                        transition: "all 180ms ease",
                      }}
                    >
                      {open ? "−" : "+"}
                    </span>
                  </div>
                  <div
                    style={{
                      maxHeight: open ? 300 : 0,
                      overflow: "hidden",
                      transition: "max-height 320ms cubic-bezier(0.22,1,0.36,1)",
                    }}
                  >
                    <p
                      style={{
                        marginTop: 12,
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: C.body,
                      }}
                    >
                      {d.desc}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        <div
          style={{
            marginTop: 28,
            padding: "16px 18px",
            background: "white",
            border: `1px dashed ${C.accent}55`,
            borderRadius: 12,
            fontSize: 13,
            color: C.body,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: C.ink }}>· 언제든 수신거부 가능.</strong> 이메일은 베타 안내·자료 발송에만 사용합니다. 6일째에는 베타가 열려있을 거예요.
        </div>
      </div>
    </section>
  );
}

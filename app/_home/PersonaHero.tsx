"use client";

import { useState } from "react";
import Link from "next/link";
import { DemoAnimation } from "./DemoAnimation";

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

type PersonaKey = "general" | "kmong_seller" | "side_writer" | "coach" | "other";

interface PersonaContent {
  label: string;
  badge: string;
  headline: { line1: string; emphasis: string; line2: string };
  subhead: string;
  cta: string;
  highlight: string;
  destination: string;
}

const PERSONAS: Record<PersonaKey, PersonaContent> = {
  general: {
    label: "처음 오셨어요?",
    badge: "한국어 AI 이북 자동 집필 · 베타",
    headline: { line1: "주제 한 줄,", emphasis: "책 한 권", line2: "30분." },
    subhead: "주제 한 줄과 본인 자료 한 개만 주세요. AI가 12챕터 + 표지 + 마케팅 카피까지 자동.",
    cta: "사전예약 · 무료",
    highlight: "권당 ₩4,000부터 · 베타 ₩5,000 무료 크레딧",
    destination: "/preorder",
  },
  kmong_seller: {
    label: "크몽 셀러",
    badge: "한국어 AI 이북 · 크몽 PDF 자료",
    headline: { line1: "퇴근 후 30분,", emphasis: "크몽 PDF 자료", line2: "한 권 완성." },
    subhead: "ChatGPT로 2주씩 걸리던 PDF 한 권을 30분에. 표지 30종 갤러리 + 크몽 등록 패키지 자동.",
    cta: "크몽 셀러용 사전예약",
    highlight: "베타 예시: 라인업 확장 + 평일 1-2시간 작업",
    destination: "/preorder?utm_source=hero&utm_campaign=kmong",
  },
  side_writer: {
    label: "블로그·뉴스레터",
    badge: "한국 작가 · 본인 톤 학습",
    headline: { line1: "블로그 글이", emphasis: "한 권의 책으로,", line2: "30분에." },
    subhead: "본인 자료 1개 (블로그·뉴스레터·메모)를 입력하면 AI가 본인 톤을 학습해 책을 완성합니다.",
    cta: "작가용 사전예약",
    highlight: "베타 예시: 뉴스레터 분량 → 자기 이름의 책 한 권",
    destination: "/preorder?utm_source=hero&utm_campaign=writer",
  },
  coach: {
    label: "1인 코치·강사",
    badge: "강의 자료 → 책 변환",
    headline: { line1: "강의 PPT 한 개로", emphasis: "전문가 책,", line2: "30분에." },
    subhead: "강의 자료·인터뷰 노트·코칭 메모를 입력하면 책으로. 외주 견적이 권당 ₩4,000부터.",
    cta: "코치용 사전예약",
    highlight: "베타 예시: 회화 강의 PPT → 학습서 한 권",
    destination: "/preorder?utm_source=hero&utm_campaign=coach",
  },
  other: {
    label: "그 외",
    badge: "한국어 AI 이북 자동 집필",
    headline: { line1: "주제 한 줄,", emphasis: "책 한 권", line2: "30분." },
    subhead: "자기계발·재테크·실용서·에세이·매뉴얼·웹소설 6가지 유형. 본인 주제로 자유롭게.",
    cta: "사전예약 · 무료",
    highlight: "권당 ₩4,000부터 · 본인 권리 100%",
    destination: "/preorder?utm_source=hero&utm_campaign=other",
  },
};

const PERSONA_ORDER: PersonaKey[] = ["kmong_seller", "side_writer", "coach", "other"];

export function PersonaHero({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<PersonaKey>("general");
  const p = PERSONAS[persona];

  return (
    <section style={{ position: "relative", zIndex: 4, padding: "60px 24px 40px" }}>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
          gap: 48,
          alignItems: "center",
        }}
        className="hero-grid"
      >
        <div>
          <div
            style={{
              animation: "preorderFadeUp 700ms 100ms cubic-bezier(0.22,1,0.36,1) both",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              border: `1px solid ${C.border}`,
              background: "white",
              borderRadius: 999,
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.15em",
              color: C.body,
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            <span style={{ color: C.accent }}>●</span>
            {p.badge}
          </div>

          {/* 페르소나 선택 칩 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: "0.2em",
                color: C.muted,
                textTransform: "uppercase",
                alignSelf: "center",
                marginRight: 4,
              }}
            >
              당신은 →
            </span>
            {PERSONA_ORDER.map((key) => {
              const active = persona === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPersona(key)}
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    padding: "6px 12px",
                    background: active ? C.ink : "white",
                    color: active ? "white" : C.ink,
                    border: `1px solid ${active ? C.ink : C.border}`,
                    borderRadius: 999,
                    cursor: "pointer",
                    transition: "all 160ms ease",
                  }}
                >
                  {PERSONAS[key].label}
                </button>
              );
            })}
          </div>

          {/* 헤드라인 — persona 따라 갈아끼움 */}
          <h1
            key={persona}
            style={{
              animation: "preorderFadeUp 600ms cubic-bezier(0.22,1,0.36,1) both",
              fontFamily: FONT_SANS,
              fontWeight: 900,
              fontSize: "clamp(44px, 5.6vw, 84px)",
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              color: C.ink,
              marginBottom: 28,
            }}
          >
            <span style={{ display: "block" }}>{p.headline.line1}</span>
            <span style={{ display: "block", position: "relative" }}>
              <span style={{ position: "relative", display: "inline-block" }}>
                {p.headline.emphasis}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: "0.04em",
                    height: "0.14em",
                    background: `linear-gradient(120deg, ${C.accent}, #F0A37A)`,
                    borderRadius: 99,
                    transformOrigin: "left",
                    animation: "preorderUnderline 700ms 600ms cubic-bezier(0.22,1,0.36,1) both",
                    opacity: 0.9,
                  }}
                />
              </span>
            </span>
            <span style={{ display: "block" }}>{p.headline.line2}</span>
          </h1>

          <p
            key={`sub-${persona}`}
            style={{
              animation: "preorderFadeUp 600ms 200ms cubic-bezier(0.22,1,0.36,1) both",
              fontSize: 18,
              lineHeight: 1.6,
              color: C.body,
              marginBottom: 12,
              maxWidth: 540,
            }}
          >
            {p.subhead}
          </p>

          <p
            key={`hl-${persona}`}
            style={{
              animation: "preorderFadeUp 600ms 280ms cubic-bezier(0.22,1,0.36,1) both",
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontSize: 14,
              color: C.muted,
              marginBottom: 36,
              maxWidth: 540,
              borderLeft: `2px solid ${C.accent}`,
              paddingLeft: 12,
            }}
          >
            {p.highlight}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={p.destination}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "16px 24px",
                background: C.ink,
                color: "white",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: `0 12px 28px -12px ${C.ink}88`,
                transition: "transform 200ms ease, background 200ms ease",
              }}
            >
              {p.cta}
              <span style={{ fontSize: 18 }}>→</span>
            </Link>
          </div>

          {/* Hero CTA 아래 즉시 받는 것 약속 (사전예약 클릭 → /preorder 에서 발송) */}
          <p
            style={{
              marginTop: 18,
              fontSize: 13,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            신청 즉시 <strong style={{ color: C.ink }}>미니 이북 PDF + 크몽 키워드 30개</strong>가 메일함에 도착해요. 카드 정보 받지 않음.
          </p>

          {/* 라이브 스탯 (server에서 받은 children) */}
          {children}
        </div>

        {/* 책 일러스트 (server에서 전달) */}
        <div
          className="hero-illust"
          style={{
            animation: "preorderFadeUp 1000ms 400ms cubic-bezier(0.22,1,0.36,1) both",
            position: "relative",
            aspectRatio: "1 / 1.05",
            maxWidth: 480,
            justifySelf: "center",
            width: "100%",
          }}
        >
          <DemoAnimation />
        </div>
      </div>
    </section>
  );
}

function HeroBookIllustration() {
  // page.tsx의 BookIllustration과 동일. 클라이언트 컴포넌트에서 분리됐으니 재정의.
  return (
    <svg viewBox="0 0 600 600" width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="hbookPage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F2EBDA" />
        </linearGradient>
        <linearGradient id="hbookSpine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.accent} />
          <stop offset="1" stopColor="#F0A37A" />
        </linearGradient>
        <linearGradient id="haiTag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.ink} />
          <stop offset="1" stopColor="#2E2A24" />
        </linearGradient>
      </defs>

      <circle
        cx="300"
        cy="290"
        r="240"
        fill="url(#hbookSpine)"
        opacity="0.06"
        style={{ transformOrigin: "300px 290px", animation: "preorderPulse 6s infinite ease-in-out" }}
      />
      <ellipse cx="300" cy="530" rx="220" ry="16" fill={C.ink} opacity="0.1" />

      <g>
        <rect x="80" y="80" width="440" height="400" rx="8" fill="url(#hbookPage)" stroke={C.border} strokeWidth="1" />
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

        <path d="M430 80v96l18-12 18 12V80z" fill="url(#hbookSpine)" stroke="white" strokeWidth="2" />
      </g>

      <g
        style={
          { ["--rot" as any]: "-4deg", animation: "preorderFloat 5s ease-in-out infinite" } as React.CSSProperties
        }
      >
        <rect x="120" y="244" width="124" height="40" rx="20" fill="url(#haiTag)" />
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

      <g transform="translate(420 410) rotate(-10)">
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

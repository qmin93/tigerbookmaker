"use client";

import { useEffect, useRef, useState } from "react";

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  border: "#E7E0D2",
  accent: "#D24B2A",
  accentSoft: "#F4DED4",
};

const FONT_SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

const COVERS = [
  { bg: "#F97316", t: "F" },
  { bg: "#1E40AF", t: "B" },
  { bg: "#1F2937", t: "E" },
  { bg: "#059669", t: "C" },
  { bg: "#7C3AED", t: "P" },
  { bg: "#DC2626", t: "R" },
];

// 30초 4컷 데모 — HERO 우측 책 일러스트 자리 교체.
// 모바일·prefers-reduced-motion 정적 폴백 포함.
export function DemoAnimation() {
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0); // 0..30 (sec)
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const [reduce, setReduce] = useState(false);

  // 디바이스 감지 (mount)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mob = window.matchMedia("(max-width: 768px)").matches;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIsMobile(mob);
    setReduce(rm);
    // 모바일이면 자동 재생 정지 (탭으로 재생)
    if (mob) setPlaying(false);
  }, []);

  // 30초 loop 시간 진행
  useEffect(() => {
    if (!playing || reduce) return;
    let stopped = false;
    function loop(t: number) {
      if (stopped) return;
      if (startRef.current == null) startRef.current = t;
      const elapsed = ((t - startRef.current) / 1000) % 30;
      setTick(elapsed);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = undefined;
    };
  }, [playing, reduce]);

  // 현재 컷 (0..3)
  const cutIndex = reduce ? 0 : Math.min(3, Math.floor(tick / 7.5));
  const cutProgress = reduce ? 0 : (tick % 7.5) / 7.5; // 0..1 within current cut

  // reduced-motion: 2x2 grid 정적
  if (reduce) {
    return (
      <div
        aria-label="tigerbookmaker 데모 (정적 4컷)"
        style={{
          width: "100%",
          aspectRatio: "1 / 1.05",
          background: "white",
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 12,
        }}
      >
        <CutStatic label="01" title="주제 입력" desc="주제 한 줄" />
        <CutStatic label="02" title="AI 챕터 12개" desc="자동 구조" />
        <CutStatic label="03" title="표지 선택" desc="30종 갤러리" />
        <CutStatic label="04" title="PDF 다운로드" desc="완성" />
      </div>
    );
  }

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={() => isMobile && setPlaying((p) => !p)}
    >
      <svg
        viewBox="0 0 600 600"
        width="100%"
        height="100%"
        aria-label={`tigerbookmaker 30초 데모 · 현재 컷 ${cutIndex + 1}/4`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="demoBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" />
            <stop offset="1" stopColor="#F2EBDA" />
          </linearGradient>
          <linearGradient id="demoVerm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.accent} />
            <stop offset="1" stopColor="#F0A37A" />
          </linearGradient>
        </defs>

        {/* 외곽 카드 */}
        <rect
          x="40"
          y="40"
          width="520"
          height="520"
          rx="16"
          fill="url(#demoBg)"
          stroke={C.border}
          strokeWidth="1"
        />

        {/* 상단 mono 라벨 (현재 컷) */}
        <text
          x="60"
          y="80"
          fontFamily={FONT_MONO}
          fontSize="11"
          fill={C.accent}
          letterSpacing="2.5"
          fontWeight="600"
        >
          {String(cutIndex + 1).padStart(2, "0")} / 04 ·{" "}
          {["INPUT", "CHAPTERS", "COVER", "DOWNLOAD"][cutIndex]}
        </text>

        {/* === Cut 1: 주제 입력 (0-7.5s) === */}
        <g style={{ opacity: cutIndex === 0 ? 1 : 0, transition: "opacity 400ms" }}>
          {/* 입력 박스 */}
          <rect
            x="80"
            y="180"
            width="440"
            height="80"
            rx="10"
            fill="white"
            stroke={cutIndex === 0 ? C.accent : C.border}
            strokeWidth="2"
          />
          <text
            x="100"
            y="208"
            fontFamily={FONT_MONO}
            fontSize="11"
            fill={C.muted}
            letterSpacing="2"
          >
            TOPIC ·  주제
          </text>
          <CutOneTypewriter t={cutProgress} />
          {/* 라벨 */}
          <text
            x="80"
            y="320"
            fontFamily={FONT_MONO}
            fontSize="11"
            fill={C.muted}
            letterSpacing="2"
          >
            STEP 1 · 1분
          </text>
          <text
            x="80"
            y="362"
            fontFamily={FONT_SANS}
            fontSize="36"
            fontWeight="900"
            fill={C.ink}
            letterSpacing="-1"
          >
            주제 한 줄.
          </text>
        </g>

        {/* === Cut 2: 12 챕터 펼침 (7.5-15s) === */}
        <g style={{ opacity: cutIndex === 1 ? 1 : 0, transition: "opacity 400ms" }}>
          <text
            x="80"
            y="180"
            fontFamily={FONT_SANS}
            fontSize="32"
            fontWeight="900"
            fill={C.ink}
            letterSpacing="-1"
          >
            12 챕터 자동 생성.
          </text>
          <text
            x="80"
            y="208"
            fontFamily={FONT_MONO}
            fontSize="11"
            fill={C.muted}
            letterSpacing="2"
          >
            STEP 2 · 25분
          </text>
          {/* 12 챕터 stagger */}
          {Array.from({ length: 12 }).map((_, i) => {
            const stagger = i * 0.06;
            const visible = cutIndex === 1 && cutProgress > stagger;
            return (
              <g
                key={i}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 280ms, transform 280ms",
                }}
              >
                <text
                  x="80"
                  y={250 + i * 22}
                  fontFamily={FONT_MONO}
                  fontSize="10"
                  fill={C.muted}
                  letterSpacing="2"
                >
                  CH.{String(i + 1).padStart(2, "0")}
                </text>
                <rect
                  x="130"
                  y={240 + i * 22}
                  width={180 + Math.sin(i * 1.7) * 50 + 50}
                  height="6"
                  rx="3"
                  fill={i < 4 ? C.accent : C.border}
                  opacity={i < 4 ? 0.85 : 1}
                />
              </g>
            );
          })}
          {/* 진행률 바 */}
          <rect x="380" y="500" width="140" height="6" rx="3" fill={C.border} />
          <rect
            x="380"
            y="500"
            width={140 * (cutIndex === 1 ? cutProgress : 0)}
            height="6"
            rx="3"
            fill={C.accent}
          />
          <text
            x="380"
            y="486"
            fontFamily={FONT_MONO}
            fontSize="10"
            fill={C.muted}
            letterSpacing="2"
          >
            AI 진행 {Math.round((cutIndex === 1 ? cutProgress : 0) * 100)}%
          </text>
        </g>

        {/* === Cut 3: 표지 갤러리 (15-22.5s) === */}
        <g style={{ opacity: cutIndex === 2 ? 1 : 0, transition: "opacity 400ms" }}>
          <text
            x="80"
            y="180"
            fontFamily={FONT_SANS}
            fontSize="32"
            fontWeight="900"
            fill={C.ink}
            letterSpacing="-1"
          >
            표지 30종 — 선택.
          </text>
          <text
            x="80"
            y="208"
            fontFamily={FONT_MONO}
            fontSize="11"
            fill={C.muted}
            letterSpacing="2"
          >
            STEP 3 · 갤러리
          </text>
          {/* 6 표지 그리드 (3x2 큰 사이즈) */}
          {COVERS.map((cov, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const selected = cutIndex === 2 && i === 1 && cutProgress > 0.4;
            return (
              <g key={i}>
                <rect
                  x={80 + col * 152}
                  y={240 + row * 200}
                  width="130"
                  height="170"
                  rx="6"
                  fill={cov.bg}
                  opacity={cutIndex === 2 ? (cutProgress > 0.05 + i * 0.05 ? 1 : 0) : 0}
                  style={{ transition: "opacity 380ms" }}
                />
                {selected && (
                  <rect
                    x={75 + col * 152}
                    y={235 + row * 200}
                    width="140"
                    height="180"
                    rx="8"
                    fill="none"
                    stroke={C.accent}
                    strokeWidth="3"
                    style={{
                      filter: `drop-shadow(0 0 10px ${C.accent}88)`,
                    }}
                  />
                )}
                <text
                  x={80 + col * 152 + 14}
                  y={240 + row * 200 + 30}
                  fontFamily={FONT_MONO}
                  fontSize="9"
                  fill="white"
                  opacity={0.75}
                  letterSpacing="2"
                >
                  TYPE {String(i + 1).padStart(2, "0")}
                </text>
              </g>
            );
          })}
        </g>

        {/* === Cut 4: PDF 완성 (22.5-30s) === */}
        <g style={{ opacity: cutIndex === 3 ? 1 : 0, transition: "opacity 400ms" }}>
          <text
            x="80"
            y="180"
            fontFamily={FONT_SANS}
            fontSize="32"
            fontWeight="900"
            fill={C.ink}
            letterSpacing="-1"
          >
            PDF 다운로드.
          </text>
          <text
            x="80"
            y="208"
            fontFamily={FONT_MONO}
            fontSize="11"
            fill={C.muted}
            letterSpacing="2"
          >
            STEP 4 · 5분
          </text>
          {/* 책 표지 큰 사이즈 */}
          <rect
            x="180"
            y="240"
            width="180"
            height="240"
            rx="8"
            fill="url(#demoVerm)"
            opacity={cutIndex === 3 ? Math.min(1, cutProgress * 2) : 0}
            style={{ transition: "opacity 400ms" }}
          />
          <text
            x="270"
            y="370"
            textAnchor="middle"
            fontFamily={FONT_SANS}
            fontSize="22"
            fontWeight="900"
            fill="white"
            letterSpacing="-0.5"
            opacity={cutIndex === 3 ? Math.min(1, cutProgress * 2) : 0}
          >
            30 분
          </text>
          <text
            x="270"
            y="395"
            textAnchor="middle"
            fontFamily={FONT_SANS}
            fontSize="14"
            fontWeight="500"
            fill="white"
            opacity={cutIndex === 3 ? Math.min(1, cutProgress * 1.8) : 0}
          >
            가이드
          </text>
          {/* DOWNLOAD 도장 — 회전 등장 */}
          <g
            transform="translate(420 460) rotate(-12)"
            style={{
              opacity: cutIndex === 3 && cutProgress > 0.45 ? 1 : 0,
              transform: `translate(420px, 460px) rotate(${
                cutIndex === 3 && cutProgress > 0.45
                  ? -12
                  : 30
              }deg)`,
              transformOrigin: "420px 460px",
              transition: "opacity 380ms ease, transform 480ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <rect x="-60" y="-26" width="120" height="52" rx="4" fill="none" stroke={C.accent} strokeWidth="3.5" />
            <rect x="-54" y="-20" width="108" height="40" rx="2" fill="none" stroke={C.accent} strokeWidth="1" />
            <text
              x="0"
              y="8"
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
        </g>

        {/* 캡션 — 시간 + 4 dot 진행도 */}
        <g>
          <text
            x="60"
            y="540"
            fontFamily={FONT_MONO}
            fontSize="10"
            fill={C.muted}
            letterSpacing="2"
          >
            {formatTime(tick)} / 00:30
          </text>
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              cx={200 + i * 16}
              cy={536}
              r="4"
              fill={i === cutIndex ? C.accent : C.border}
              style={{ transition: "fill 380ms" }}
            />
          ))}
        </g>
      </svg>

      {/* 모바일 재생 오버레이 */}
      {isMobile && !playing && (
        <button
          onClick={() => setPlaying(true)}
          aria-label="데모 재생"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(11,11,11,0.35)",
            border: "none",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              padding: "14px 22px",
              background: C.accent,
              color: "white",
              borderRadius: 999,
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
              boxShadow: `0 12px 28px -8px ${C.accent}cc`,
            }}
          >
            ▶ 30초 데모 재생
          </div>
        </button>
      )}
    </div>
  );
}

// 컷 1 타이핑 — 글자별 progress 따라 타이프라이팅
function CutOneTypewriter({ t }: { t: number }) {
  const text = "퇴근 후 30분 PDF 만들기";
  const visible = Math.floor(t * text.length * 1.6);
  const shown = text.slice(0, Math.min(text.length, visible));
  const showCursor = Math.floor(t * 4) % 2 === 0;
  return (
    <text
      x="100"
      y="240"
      fontFamily={FONT_SANS}
      fontSize="22"
      fontWeight="800"
      fill={C.ink}
      letterSpacing="-0.5"
    >
      {shown}
      <tspan fill={showCursor ? C.accent : "transparent"}>▍</tspan>
    </text>
  );
}

function CutStatic({
  label,
  title,
  desc,
}: {
  label: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px dashed ${C.border}`,
        borderRadius: 8,
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 0,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          color: C.accent,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: C.ink,
            letterSpacing: "-0.01em",
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `00:${String(s).padStart(2, "0")}`;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

interface Stats {
  count: number;
  capacity: number;
  remaining: number;
}

// 스크롤 > 700px 후 슬라이드업. 실시간 사전예약 잔여석 노출.
// 사용자가 페이지 어디에 있어도 "다음 한 행동"이 명확.
export function StickyCta() {
  const [show, setShow] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/preorder/stats");
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setStats({ count: d.count, capacity: d.capacity, remaining: d.remaining });
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      aria-hidden={!show}
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: show ? 12 : -160,
        zIndex: 60,
        maxWidth: 760,
        margin: "0 auto",
        background: C.ink,
        color: "white",
        borderRadius: 14,
        padding: "12px 14px 12px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: `0 20px 50px -10px ${C.ink}aa`,
        transition: "bottom 380ms cubic-bezier(0.22,1,0.36,1)",
        fontFamily: FONT_SANS,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: C.accent,
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: C.accent,
              animation: "preorderPulse 1.4s infinite ease-out",
            }}
          />
          {stats ? `${stats.remaining}석 남음 · 총 ${stats.capacity}명` : "한정 100명"}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            opacity: 0.95,
          }}
        >
          미니 이북 PDF + 키워드 30개 무료
        </span>
      </div>
      <Link
        href="/preorder?utm_source=sticky"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: C.accent,
          color: "white",
          padding: "12px 18px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          letterSpacing: "-0.01em",
        }}
      >
        지금 신청 →
      </Link>
    </div>
  );
}

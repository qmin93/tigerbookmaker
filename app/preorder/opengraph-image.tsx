// /preorder 전용 OG 이미지 — 1200×630
// 카톡·Threads·트위터·페이스북 공유 시 미리보기 이미지.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "퇴근하고 30분, 첫 이북이 완성됩니다 — tigerbookmaker 베타 사전예약";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  accent: "#D24B2A",
  accentSoft: "#F4DED4",
};

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.bg,
          position: "relative",
          fontFamily: "system-ui, sans-serif",
          color: C.ink,
        }}
      >
        {/* Mesh gradient blobs */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 600,
            height: 600,
            borderRadius: 999,
            background: "radial-gradient(closest-side, #FFB59A88, transparent 70%)",
            filter: "blur(20px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -120,
            right: -120,
            width: 600,
            height: 600,
            borderRadius: 999,
            background: "radial-gradient(closest-side, #E7D6F088, transparent 70%)",
            filter: "blur(20px)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
            width: "100%",
            position: "relative",
          }}
        >
          {/* TOP: brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* book icon */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "white",
                  borderRadius: 8,
                  border: `1px solid #E7E0D2`,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path
                    d="M6 4h12v17l-6-4-6 4V4z"
                    fill="none"
                    stroke={C.accent}
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: 0.5,
                  color: C.ink,
                }}
              >
                tigerbookmaker
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                background: C.accent,
                color: "white",
                borderRadius: 999,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 1.2,
              }}
            >
              <span>●</span>
              <span>베타 사전예약</span>
            </div>
          </div>

          {/* MIDDLE: 헤드라인 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 920 }}>
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                lineHeight: 1.0,
                letterSpacing: -3,
                color: C.ink,
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              <span>퇴근하고&nbsp;</span>
              <span style={{ color: C.accent }}>30분</span>
              <span>,</span>
            </div>
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                lineHeight: 1.0,
                letterSpacing: -3,
                color: C.ink,
              }}
            >
              첫 이북이 완성됩니다.
            </div>
            <div
              style={{
                marginTop: 24,
                fontSize: 30,
                lineHeight: 1.5,
                color: C.body,
                maxWidth: 880,
              }}
            >
              주제 한 줄 + 자료 한 개 → AI가 12챕터 + 표지 + 마케팅 카피까지 자동
            </div>
          </div>

          {/* BOTTOM: 혜택 + URL */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {["미니 이북 무료", "₩5,000 크레딧", "한정 100명"].map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    padding: "12px 22px",
                    background: "white",
                    border: `1px solid #E7E0D2`,
                    borderRadius: 999,
                    fontSize: 22,
                    color: C.body,
                    fontWeight: 500,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 18,
                color: C.muted,
                letterSpacing: 1.5,
              }}
            >
              TIGERBOOKMAKER.VERCEL.APP/PREORDER
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}

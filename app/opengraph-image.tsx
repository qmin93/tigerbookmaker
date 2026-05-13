// 동적 OG 이미지 — 1200×630
// 카톡·트위터·페이스북·구글 공유 시 사용되는 미리보기 이미지.
// Next.js 14 ImageResponse — 빌드 시 자동 생성 + Vercel edge에서 캐시.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tigerbookmaker — 크몽에서 부수익, 30분에 한 권";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1f1f1f 50%, #7c2d12 100%)",
          padding: "72px",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top — 브랜드 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            color: "#fafafa",
            fontSize: "22px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          <span style={{ fontSize: "40px" }}>🐯</span>
          <span>Tigerbookmaker</span>
        </div>

        {/* 주황 액센트 선 */}
        <div
          style={{
            display: "flex",
            width: "72px",
            height: "4px",
            background: "#f97316",
            marginTop: "24px",
          }}
        />

        {/* 헤드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            color: "#fafafa",
            fontSize: "92px",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
          }}
        >
          <span>크몽에서 부수익,</span>
          <span>
            <span style={{ color: "#f97316" }}>30분</span>에 한 권.
          </span>
        </div>

        {/* 서브 */}
        <div
          style={{
            display: "flex",
            marginTop: "32px",
            color: "#d4d4d8",
            fontSize: "30px",
            fontWeight: 500,
          }}
        >
          ₩5,000 무료 크레딧으로 시작 · 카드 등록 X
        </div>

        {/* Bottom right — URL */}
        <div
          style={{
            position: "absolute",
            bottom: "72px",
            right: "72px",
            color: "#a1a1aa",
            fontSize: "20px",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
          }}
        >
          tigerbookmaker.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}

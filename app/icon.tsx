// 동적 favicon — 32x32. Next.js 14 자동 인식.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f97316",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
          borderRadius: "6px",
        }}
      >
        🐯
      </div>
    ),
    { ...size }
  );
}

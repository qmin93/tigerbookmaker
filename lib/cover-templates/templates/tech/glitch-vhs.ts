import type { CoverTemplate } from "../../types";

/** Glitch VHS — 스캔라인 + RGB 채널 시프트 + 테이프 노이즈. */
export const glitchVhs: CoverTemplate = {
  key: "glitch-vhs",
  label: "글리치 VHS",
  category: "TECH",
  description: "스캔라인 + RGB 시프트 + VHS 노이즈. 레트로 디지털 톤. 사이버·매뉴얼.",
  promptHint:
    "Glitch VHS aesthetic composition: scanlines, RGB channel-shift, chromatic aberration, VHS tracking artifacts and tape noise, retro CRT vignette, leave a darker band along the bottom for a title overlay.",
  overlay: {
    background: { area: "bottom-half", gradient: "linear-gradient(180deg, rgba(10,10,20,0) 0%, rgba(10,10,20,0.7) 50%, rgba(10,10,20,0.96) 100%)" },
    decorations: [
      { type: "divider-line", position: "top-bleed", size: { width: 1, height: 0.005 }, color: "#EF4444" },
      { type: "divider-line", position: "top-bleed", size: { width: 1, height: 0.005 }, color: "#22D3EE", offsetPx: [-12, 8] },
    ],
    textBlocks: [
      { field: "series", position: "top-left", offsetPx: [40, 36], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#22D3EE", letterSpacing: 0.3, textTransform: "uppercase" },
      { field: "title", position: "bottom-left", offsetPx: [40, -150], font: { weight: 900, sizeRatio: 0.078 }, color: "#FFFFFF", maxWidth: 0.84, lineHeight: 0.95, letterSpacing: -0.03, shadow: "2px 0 0 rgba(239,68,68,0.85)", textTransform: "uppercase" },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -94], font: { weight: 500, sizeRatio: 0.016, family: "ui-monospace, monospace" }, color: "#FBBF24", maxWidth: 0.84, letterSpacing: 0.15 },
      { field: "author", position: "bottom-left", offsetPx: [40, -42], font: { weight: 700, sizeRatio: 0.012, family: "ui-monospace, monospace" }, color: "#22D3EE", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["novel", "manual"],
};

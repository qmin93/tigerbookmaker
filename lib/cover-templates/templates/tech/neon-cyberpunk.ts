import type { CoverTemplate } from "../../types";

/** Neon Cyberpunk — 어두운 배경 + 네온 글로우 + 모노스페이스. */
export const neonCyberpunk: CoverTemplate = {
  key: "neon-cyberpunk",
  label: "네온 사이버펑크",
  category: "TECH",
  description: "어두운 배경 + 네온 글로우 + 모노스페이스. 미래·테크 톤. AI·개발·매뉴얼.",
  promptHint:
    "Neon cyberpunk cityscape or interface composition with deep blacks and electric accent colors; leave the bottom band darker for a title overlay.",
  overlay: {
    background: { area: "bottom-half", gradient: "linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.85) 60%, rgba(10,10,10,0.98) 100%)" },
    decorations: [
      { type: "divider-line", position: "top-bleed", size: { width: 1, height: 0.004 }, color: "#8B5CF6" },
      { type: "divider-line", position: "bottom-bleed", size: { width: 1, height: 0.004 }, color: "#EC4899", offsetPx: [0, -1] },
    ],
    textBlocks: [
      { field: "series", position: "top-left", offsetPx: [40, 36], font: { weight: 700, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#06B6D4", letterSpacing: 0.3, textTransform: "uppercase", shadow: "0 0 12px rgba(6,182,212,0.6)" },
      { field: "title", position: "bottom-left", offsetPx: [40, -150], font: { weight: 900, sizeRatio: 0.075 }, color: "#FFFFFF", maxWidth: 0.84, lineHeight: 0.95, letterSpacing: -0.025, shadow: "0 0 24px rgba(139,92,246,0.85)" },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -90], font: { weight: 500, sizeRatio: 0.018, family: "ui-monospace, monospace" }, color: "#EC4899", maxWidth: 0.84, letterSpacing: 0.1 },
      { field: "author", position: "bottom-left", offsetPx: [40, -40], font: { weight: 700, sizeRatio: 0.012, family: "ui-monospace, monospace" }, color: "#06B6D4", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["manual", "academic"],
};

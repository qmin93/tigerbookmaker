import type { CoverTemplate } from "../../types";

/** Penguin Modern Classics — 한 가지 색 블록 + 작은 중앙 모티브 + 큰 여백. */
export const penguinMinimal: CoverTemplate = {
  key: "penguin-minimal",
  label: "퍼펭귄 미니멀",
  category: "EDITORIAL",
  description: "한 색 컬러블록 + 작은 모티브 + 큰 여백. 퍼펭귄 클래식 톤.",
  promptHint:
    "Penguin Modern Classics style minimalist layout: a single bold color block with one small centered visual motif and generous negative space.",
  overlay: {
    decorations: [
      { type: "badge-pill", position: "top-bleed", size: { width: 1, height: 0.12 }, color: "#F97316" },
      { type: "badge-pill", position: "bottom-bleed", size: { width: 1, height: 0.1 }, color: "#F97316" },
    ],
    textBlocks: [
      { field: "series", position: "top-center", offsetPx: [0, 60], font: { weight: 700, sizeRatio: 0.016 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.2 },
      { field: "title", position: "center", offsetPx: [0, -40], font: { weight: 900, sizeRatio: 0.072, family: "Georgia, serif" }, color: "#FFFFFF", align: "middle", maxWidth: 0.78, lineHeight: 1.0, letterSpacing: -0.02 },
      { field: "subtitle", position: "center", offsetPx: [0, 30], font: { weight: 500, sizeRatio: 0.018, family: "Georgia, serif", italic: true }, color: "rgba(255,255,255,0.92)", align: "middle", maxWidth: 0.78 },
      { field: "author", position: "bottom-center", offsetPx: [0, -32], font: { weight: 700, sizeRatio: 0.016 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.18 },
    ],
  },
  recommendedFor: ["self-dev", "essay", "academic"],
};

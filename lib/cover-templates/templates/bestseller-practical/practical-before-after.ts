import type { CoverTemplate } from "../../types";

/** Practical Before / After — 변화 시각화 사진 2장 + BEFORE → AFTER 배지. */
export const practicalBeforeAfter: CoverTemplate = {
  key: "practical-before-after",
  label: "실용서 비포 / 애프터",
  category: "BESTSELLER",
  description: "변화 시각화 사진 2장 + BEFORE → AFTER 배지. 증거 기반 실용서.",
  promptHint:
    "Before / after comparison composition: vertical split with the left side a desaturated 'before' scene and the right side a bright clean 'after' scene, a small circular badge centered on the split, lower band reserved for a bold title.",
  overlay: {
    background: { area: "bottom-third", color: "rgba(255,255,255,0.96)" },
    decorations: [
      { type: "badge-pill", position: "center", size: { width: 0.4, height: 0.045 }, color: "#F97316", offsetPx: [0, -40] },
      { type: "badge-pill", position: "top-left", size: { width: 0.18, height: 0.04 }, color: "rgba(0,0,0,0.5)", offsetPx: [30, 30] },
    ],
    textBlocks: [
      { field: "badge", position: "top-left", offsetPx: [114, 55], font: { weight: 700, sizeRatio: 0.012 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.3 },
      { field: "tagline", position: "center", offsetPx: [0, -30], font: { weight: 900, sizeRatio: 0.014 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.18 },
      { field: "title", position: "bottom-left", offsetPx: [40, -90], font: { weight: 900, sizeRatio: 0.062 }, color: "#0F172A", maxWidth: 0.84, lineHeight: 0.96, letterSpacing: -0.025 },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -46], font: { weight: 700, sizeRatio: 0.013 }, color: "#F97316", maxWidth: 0.84, letterSpacing: 0.1 },
      { field: "author", position: "bottom-right", offsetPx: [-40, -24], font: { weight: 700, sizeRatio: 0.012 }, color: "#0F172A", align: "end", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["practical", "self-dev", "finance"],
};

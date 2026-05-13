import type { CoverTemplate } from "../../types";

/** Practical Hands — 작업 사진 + 결과 라벨 + 깨끗한 흰색 바닥. Marie Kondo / Notion 가이드북. */
export const practicalHands: CoverTemplate = {
  key: "practical-hands",
  label: "실용서 핸즈",
  category: "BESTSELLER",
  description: "실제 작업 사진 + 결과 라벨 + 깨끗한 흰색 바닥. Marie Kondo / Notion 가이드북 톤.",
  promptHint:
    "Marie Kondo-style practical how-to composition: top half showing real hands at work on a clean desk or notebook with natural light, bottom half a clean white frosted-glass band reserved for a confident title and a small result badge.",
  overlay: {
    background: { area: "bottom-third", color: "rgba(255,255,255,0.96)" },
    decorations: [
      { type: "badge-pill", position: "top-right", size: { width: 0.26, height: 0.045 }, color: "#059669", offsetPx: [-30, 30] },
    ],
    textBlocks: [
      { field: "badge", position: "top-right", offsetPx: [-128, 56], font: { weight: 900, sizeRatio: 0.013 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.2 },
      { field: "series", position: "bottom-left", offsetPx: [40, -130], font: { weight: 700, sizeRatio: 0.013 }, color: "#059669", letterSpacing: 0.4, textTransform: "uppercase" },
      { field: "title", position: "bottom-left", offsetPx: [40, -86], font: { weight: 900, sizeRatio: 0.062 }, color: "#0F172A", maxWidth: 0.84, lineHeight: 0.96, letterSpacing: -0.025 },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -46], font: { weight: 500, sizeRatio: 0.014, italic: true }, color: "#6B7280", maxWidth: 0.84 },
      { field: "author", position: "bottom-right", offsetPx: [-40, -28], font: { weight: 700, sizeRatio: 0.012 }, color: "#059669", align: "end", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["practical", "self-dev"],
};

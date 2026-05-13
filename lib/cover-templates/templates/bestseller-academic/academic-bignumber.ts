import type { CoverTemplate } from "../../types";

/** Academic Big Number — 거대한 숫자 + 상하 컬러블록 분할. */
export const academicBignumber: CoverTemplate = {
  key: "academic-bignumber",
  label: "학술 빅넘버",
  category: "BESTSELLER",
  description: "거대한 숫자 + 상하 컬러블록 분할. 30 Principles 식. 강렬 · 권위.",
  promptHint:
    "Big-number editorial cover composition (Atomic Habits style): an oversized abstract numeric or geometric form as the focal element, with clean space around it for text.",
  overlay: {
    background: { area: "bottom-third", color: "rgba(255,255,255,0.96)" },
    decorations: [
      { type: "divider-line", position: "top-bleed", size: { width: 1, height: 0.01 }, color: "#7F1D1D", offsetPx: [0, 240] },
    ],
    textBlocks: [
      { field: "badge", position: "top-center", offsetPx: [0, 36], font: { weight: 700, sizeRatio: 0.012 }, color: "rgba(255,255,255,0.85)", align: "middle", textTransform: "uppercase", letterSpacing: 0.4 },
      { field: "series", position: "top-center", offsetPx: [0, 195], font: { weight: 700, sizeRatio: 0.014 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.3 },
      { field: "title", position: "bottom-center", offsetPx: [0, -100], font: { weight: 900, sizeRatio: 0.06 }, color: "#0F172A", align: "middle", maxWidth: 0.84, lineHeight: 0.96, letterSpacing: -0.02 },
      { field: "subtitle", position: "bottom-center", offsetPx: [0, -52], font: { weight: 500, sizeRatio: 0.014, italic: true }, color: "#6B7280", align: "middle", maxWidth: 0.82 },
      { field: "author", position: "bottom-center", offsetPx: [0, -22], font: { weight: 700, sizeRatio: 0.012 }, color: "#DC2626", align: "middle", textTransform: "uppercase", letterSpacing: 0.2 },
    ],
  },
  recommendedFor: ["academic", "finance"],
};

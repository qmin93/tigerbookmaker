import type { CoverTemplate } from "../../types";

/** Academic Metaphor — 큰 일러스트(뇌·톱니·핵심 상징) + 베스트셀러 라벨. Atomic Habits 스타일. */
export const academicMetaphor: CoverTemplate = {
  key: "academic-metaphor",
  label: "학술 메타포",
  category: "BESTSELLER",
  description: "큰 일러스트(뇌·톱니·핵심 상징) + 베스트셀러 라벨. Atomic Habits 스타일.",
  promptHint:
    "Conceptual visual metaphor for an academic non-fiction cover: one strong symbolic object on a minimal background, leaving the upper half empty for a title.",
  overlay: {
    textBlocks: [
      { field: "badge", position: "top-center", offsetPx: [0, 36], font: { weight: 700, sizeRatio: 0.013 }, color: "#92400E", align: "middle", textTransform: "uppercase", letterSpacing: 0.4 },
      { field: "title", position: "bottom-center", offsetPx: [0, -130], font: { weight: 900, sizeRatio: 0.07 }, color: "#0F172A", align: "middle", maxWidth: 0.84, lineHeight: 0.96, letterSpacing: -0.025 },
      { field: "subtitle", position: "bottom-center", offsetPx: [0, -76], font: { weight: 500, sizeRatio: 0.015, italic: true }, color: "#92400E", align: "middle", maxWidth: 0.82, letterSpacing: 0.05 },
      { field: "author", position: "bottom-center", offsetPx: [0, -32], font: { weight: 900, sizeRatio: 0.013 }, color: "#0F172A", align: "middle", textTransform: "uppercase", letterSpacing: 0.25 },
    ],
  },
  recommendedFor: ["academic", "self-dev"],
};

import type { CoverTemplate } from "../../types";

/** Manual O'Reilly — 흰 배경 + 동물 일러스트 + serif. 기술서 클래식. */
export const manualOreilly: CoverTemplate = {
  key: "manual-oreilly",
  label: "오라일리 매뉴얼",
  category: "BESTSELLER",
  description: "흰 배경 + 동물 일러스트 + serif. 기술서 클래식. 권위 + 가독성.",
  promptHint:
    "O'Reilly-inspired manual cover: a single detailed animal or object illustration centered on a clean cream background with a colored header band reserved for the title.",
  overlay: {
    decorations: [
      { type: "divider-line", position: "top-bleed", size: { width: 1, height: 0.04 }, color: "#1E3A8A" },
      { type: "frame-border", position: "center", size: { width: 0.94, height: 0.94 }, color: "#0F172A" },
    ],
    textBlocks: [
      { field: "publisher", position: "top-center", offsetPx: [0, 28], font: { weight: 700, sizeRatio: 0.013 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.3 },
      { field: "series", position: "top-center", offsetPx: [0, 90], font: { weight: 700, sizeRatio: 0.014 }, color: "#1E3A8A", align: "middle", letterSpacing: 0.3, textTransform: "uppercase" },
      { field: "title", position: "bottom-center", offsetPx: [0, -140], font: { weight: 900, sizeRatio: 0.062, family: "Georgia, serif" }, color: "#0F172A", align: "middle", maxWidth: 0.84, lineHeight: 0.96, letterSpacing: -0.02 },
      { field: "subtitle", position: "bottom-center", offsetPx: [0, -86], font: { weight: 500, sizeRatio: 0.016, italic: true, family: "Georgia, serif" }, color: "#475569", align: "middle", maxWidth: 0.82 },
      { field: "author", position: "bottom-center", offsetPx: [0, -48], font: { weight: 700, sizeRatio: 0.013 }, color: "#1E3A8A", align: "middle", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["manual", "academic"],
};

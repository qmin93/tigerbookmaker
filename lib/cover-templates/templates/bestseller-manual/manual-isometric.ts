import type { CoverTemplate } from "../../types";

/** Manual Isometric — 3D 블록 일러스트 + 다크 + 모노스페이스. */
export const manualIsometric: CoverTemplate = {
  key: "manual-isometric",
  label: "이소메트릭 매뉴얼",
  category: "BESTSELLER",
  description: "3D 블록 일러스트 + 다크 + 모노스페이스. Designing Data-Intensive Apps 톤.",
  promptHint:
    "Isometric 3D illustration of tools or architecture on a flat background; the upper band stays clean for the manual title.",
  overlay: {
    background: { area: "bottom-third", gradient: "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.8) 60%, rgba(15,23,42,0.98) 100%)" },
    textBlocks: [
      { field: "series", position: "top-left", offsetPx: [40, 36], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#22D3EE", letterSpacing: 0.2, textTransform: "uppercase" },
      { field: "badge", position: "top-right", offsetPx: [-40, 36], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#FBBF24", align: "end" },
      { field: "title", position: "bottom-left", offsetPx: [40, -130], font: { weight: 900, sizeRatio: 0.07 }, color: "#FFFFFF", maxWidth: 0.84, lineHeight: 0.96, letterSpacing: -0.025 },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -76], font: { weight: 500, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#22D3EE", maxWidth: 0.84, letterSpacing: 0.05 },
      { field: "author", position: "bottom-left", offsetPx: [40, -36], font: { weight: 700, sizeRatio: 0.012, family: "ui-monospace, monospace" }, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.2 },
    ],
  },
  recommendedFor: ["manual", "academic"],
};

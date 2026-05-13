import type { CoverTemplate } from "../../types";

/** Brutalist — 거대 타이포 + 비대칭 + 강한 색 대비. */
export const brutalist: CoverTemplate = {
  key: "brutalist",
  label: "브루탈리스트",
  category: "BOLD",
  description: "거대 텍스트 덩어리 · 비대칭 · 강한 색 대비. 보자마자 멈춤. 기획·전문서 적합.",
  promptHint:
    "Brutalist graphic composition: blocky color planes, hard edges, off-grid composition, lots of empty negative space for text overlay.",
  overlay: {
    decorations: [
      { type: "divider-line", position: "center-left", size: { width: 0.025, height: 1 }, color: "#000000" },
      { type: "divider-line", position: "bottom-left", size: { width: 0.6, height: 0.004 }, color: "#000000", offsetPx: [40, -180] },
    ],
    textBlocks: [
      { field: "series", position: "top-left", offsetPx: [40, 32], font: { weight: 700, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#000000", letterSpacing: 0.1, textTransform: "uppercase" },
      { field: "title", position: "bottom-left", offsetPx: [40, -80], font: { weight: 900, sizeRatio: 0.105 }, color: "#000000", maxWidth: 0.7, lineHeight: 0.9, letterSpacing: -0.04, textTransform: "uppercase" },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -36], font: { weight: 700, sizeRatio: 0.018 }, color: "#000000", maxWidth: 0.7 },
      { field: "author", position: "bottom-left", offsetPx: [40, -8], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#000000" },
    ],
  },
  recommendedFor: ["academic", "self-dev", "practical"],
};

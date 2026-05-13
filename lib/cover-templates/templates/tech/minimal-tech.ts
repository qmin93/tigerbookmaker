import type { CoverTemplate } from "../../types";

/** Minimal Tech — 모노스페이스 그리드 + 작은 터미널 모티브 + 큰 여백. */
export const minimalTech: CoverTemplate = {
  key: "minimal-tech",
  label: "미니멀 테크",
  category: "TECH",
  description: "모노스페이스 그리드 + 터미널 모티브 + 큰 여백. 깨끗한 SaaS 표지.",
  promptHint:
    "Minimal tech composition: monospace grid feel, one small terminal-cursor or code-bracket motif, vast negative space for the title.",
  overlay: {
    decorations: [
      { type: "divider-line", position: "center-left", size: { width: 0.015, height: 1 }, color: "#06B6D4" },
      { type: "divider-line", position: "center-left", size: { width: 0.3, height: 0.002 }, color: "#06B6D4", offsetPx: [60, 0] },
    ],
    textBlocks: [
      { field: "series", position: "top-left", offsetPx: [60, 50], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#06B6D4", letterSpacing: 0.25, textTransform: "uppercase" },
      { field: "title", position: "center-left", offsetPx: [60, -40], font: { weight: 900, sizeRatio: 0.062 }, color: "#0F172A", maxWidth: 0.76, lineHeight: 0.98, letterSpacing: -0.025 },
      { field: "subtitle", position: "center-left", offsetPx: [60, 36], font: { weight: 500, sizeRatio: 0.016, family: "ui-monospace, monospace" }, color: "#475569", maxWidth: 0.76, letterSpacing: 0.05 },
      { field: "author", position: "bottom-left", offsetPx: [60, -50], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#0F172A", letterSpacing: 0.2, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["manual", "academic"],
};

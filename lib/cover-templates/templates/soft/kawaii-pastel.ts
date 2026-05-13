import type { CoverTemplate } from "../../types";

/** Kawaii Pastel — 파스텔 핑크/민트/버터 + 둥근 구름·토끼·하트. */
export const kawaiiPastel: CoverTemplate = {
  key: "kawaii-pastel",
  label: "카와이 파스텔",
  category: "SOFT",
  description: "파스텔 핑크/민트 + 둥근 구름/토끼/하트. 친근 · 부담 ↓. 초심자 친화.",
  promptHint:
    "Kawaii pastel composition: soft pastel pinks, mint and butter yellow, rounded cloud and bunny / heart shapes, hand-illustrated charm, leave the lower band clean for a friendly rounded title.",
  overlay: {
    background: { area: "bottom-third", color: "rgba(255, 255, 255, 0.92)", cornerRadiusPx: 24 },
    decorations: [
      { type: "circle", position: "top-right", size: { width: 0.1 }, color: "#FBCFE8", offsetPx: [-40, 40] },
    ],
    textBlocks: [
      { field: "badge", position: "top-right", offsetPx: [-72, 56], font: { weight: 700, sizeRatio: 0.014 }, color: "#831843", align: "middle" },
      { field: "title", position: "bottom-center", offsetPx: [0, -130], font: { weight: 900, sizeRatio: 0.066 }, color: "#831843", align: "middle", maxWidth: 0.84, lineHeight: 1.05, letterSpacing: -0.02 },
      { field: "subtitle", position: "bottom-center", offsetPx: [0, -70], font: { weight: 500, sizeRatio: 0.016 }, color: "#9D174D", align: "middle", maxWidth: 0.82 },
      { field: "author", position: "bottom-center", offsetPx: [0, -32], font: { weight: 700, sizeRatio: 0.012 }, color: "#831843", align: "middle", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["practical", "self-dev", "essay"],
};

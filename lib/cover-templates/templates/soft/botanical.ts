import type { CoverTemplate } from "../../types";

/** Botanical — 부드러운 수채화 잎 + 세이지/크림 팔레트. */
export const botanical: CoverTemplate = {
  key: "botanical",
  label: "보태니컬",
  category: "SOFT",
  description: "수채화 잎 + 세이지·크림 + 손그림 우아함. 차분 · 라이프스타일.",
  promptHint:
    "Botanical editorial composition: soft watercolor leaves, eucalyptus and pampas, muted sage and cream palette, hand-drawn elegance, leave the center quiet for a delicate serif title.",
  overlay: {
    decorations: [
      { type: "frame-border", position: "center", size: { width: 0.94, height: 0.94 }, color: "#84A98C" },
      { type: "divider-line", position: "center", size: { width: 0.12, height: 0.002 }, color: "#84A98C", offsetPx: [0, -20] },
    ],
    textBlocks: [
      { field: "series", position: "top-center", offsetPx: [0, 70], font: { weight: 500, sizeRatio: 0.013, family: "Georgia, serif", italic: true }, color: "#52796F", align: "middle", letterSpacing: 0.3 },
      { field: "title", position: "center", offsetPx: [0, 30], font: { weight: 700, sizeRatio: 0.06, family: "Georgia, serif" }, color: "#1F2937", align: "middle", maxWidth: 0.78, lineHeight: 1.1, letterSpacing: -0.005 },
      { field: "subtitle", position: "center", offsetPx: [0, 100], font: { weight: 400, sizeRatio: 0.016, family: "Georgia, serif", italic: true }, color: "#52796F", align: "middle", maxWidth: 0.78 },
      { field: "author", position: "bottom-center", offsetPx: [0, -70], font: { weight: 700, sizeRatio: 0.013 }, color: "#52796F", align: "middle", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["essay", "self-dev", "practical"],
};

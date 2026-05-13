import type { CoverTemplate } from "../../types";

/** Korean Traditional Modern — 한지/단청 색감 + 모던 타이포. */
export const koreanModern: CoverTemplate = {
  key: "korean-modern",
  label: "한국 모던",
  category: "CULTURAL",
  description: "한지/단청 색감 + 모던 타이포 + 태극/한자. 권위감 + 한국적 정체성.",
  promptHint:
    "Modern Korean editorial layout: clean sans-serif aesthetic, vertical balance, restrained palette, leave a vertical strip empty for the title.",
  overlay: {
    decorations: [
      { type: "frame-border", position: "center", size: { width: 0.96, height: 0.96 }, color: "#92400E" },
      { type: "divider-line", position: "top-left", size: { width: 1, height: 0.005 }, color: "#DC2626", offsetPx: [0, 80] },
    ],
    textBlocks: [
      { field: "series", position: "top-center", offsetPx: [0, 50], font: { weight: 700, sizeRatio: 0.014, family: "Georgia, serif" }, color: "#92400E", align: "middle", letterSpacing: 0.3, textTransform: "uppercase" },
      { field: "title", position: "center", offsetPx: [0, -20], font: { weight: 900, sizeRatio: 0.066 }, color: "#0F172A", align: "middle", maxWidth: 0.78, lineHeight: 1.05, letterSpacing: -0.02 },
      { field: "subtitle", position: "center", offsetPx: [0, 50], font: { weight: 500, sizeRatio: 0.015, family: "Georgia, serif", italic: true }, color: "#475569", align: "middle", maxWidth: 0.78 },
      { field: "author", position: "bottom-center", offsetPx: [0, -64], font: { weight: 700, sizeRatio: 0.013 }, color: "#92400E", align: "middle", letterSpacing: 0.25, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["self-dev", "essay", "finance"],
};

import type { CoverTemplate } from "../../types";

/** Wuxia / 홍콩 누아르 — 붓 글씨 + 잉크 드라마틱 조명 + 세로 두루마리. */
export const wuxiaAsian: CoverTemplate = {
  key: "wuxia-asian",
  label: "무협 · 아시아 누아르",
  category: "CULTURAL",
  description: "붓글씨 텍스처 + 잉크 조명 + 세로 두루마리 프레임. 웹소설·역사물.",
  promptHint:
    "Asian wuxia / cinematic Hong Kong noir composition: brushwork textures, dramatic ink-style lighting, vertical scroll-like framing with empty top area for a title.",
  overlay: {
    background: { area: "top-third", gradient: "linear-gradient(180deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.6) 70%, rgba(10,10,10,0) 100%)" },
    decorations: [
      { type: "divider-line", position: "center-right", size: { width: 0.005, height: 0.7 }, color: "#DC2626", offsetPx: [-50, 0] },
    ],
    textBlocks: [
      { field: "series", position: "top-center", offsetPx: [0, 50], font: { weight: 700, sizeRatio: 0.014, family: "Georgia, serif" }, color: "#DC2626", align: "middle", letterSpacing: 0.4, textTransform: "uppercase" },
      { field: "title", position: "top-center", offsetPx: [0, 130], font: { weight: 900, sizeRatio: 0.082, family: "Georgia, serif" }, color: "#FEF3C7", align: "middle", maxWidth: 0.86, lineHeight: 0.95, letterSpacing: -0.02, shadow: "2px 2px 8px rgba(0,0,0,0.8)" },
      { field: "subtitle", position: "top-center", offsetPx: [0, 230], font: { weight: 500, sizeRatio: 0.016, italic: true, family: "Georgia, serif" }, color: "#FBBF24", align: "middle", maxWidth: 0.78 },
      { field: "author", position: "bottom-center", offsetPx: [0, -50], font: { weight: 700, sizeRatio: 0.014 }, color: "#FBBF24", align: "middle", letterSpacing: 0.25, textTransform: "uppercase", shadow: "1px 1px 4px rgba(0,0,0,0.7)" },
    ],
  },
  recommendedFor: ["novel", "essay"],
};

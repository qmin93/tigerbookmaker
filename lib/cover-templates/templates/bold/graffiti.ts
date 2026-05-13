import type { CoverTemplate } from "../../types";

/** Graffiti — 스프레이 텍스처 + 거친 드립 + 태그. */
export const graffiti: CoverTemplate = {
  key: "graffiti",
  label: "그래피티",
  category: "BOLD",
  description: "스프레이 텍스처 + 거친 드립 + 태그. 거리 톤. 자유 · 반항 메시지.",
  promptHint:
    "Urban graffiti / street art composition: spray-paint textures on a brick or concrete wall, drip effects, layered tags and stencils, leave one large blank panel reserved for a clean title overlay.",
  overlay: {
    background: { area: "bottom-half", gradient: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.92) 100%)" },
    decorations: [
      { type: "badge-pill", position: "bottom-left", size: { width: 0.84, height: 0.16 }, color: "rgba(255,255,255,0.94)", offsetPx: [40, -200] },
    ],
    textBlocks: [
      { field: "title", position: "bottom-left", offsetPx: [60, -100], font: { weight: 900, sizeRatio: 0.075 }, color: "#000000", maxWidth: 0.78, lineHeight: 0.95, letterSpacing: -0.025, textTransform: "uppercase" },
      { field: "subtitle", position: "bottom-left", offsetPx: [60, -56], font: { weight: 700, sizeRatio: 0.016 }, color: "#525252", maxWidth: 0.78 },
      { field: "author", position: "bottom-right", offsetPx: [-60, -24], font: { weight: 700, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#FFFFFF", letterSpacing: 0.15, textTransform: "uppercase", shadow: "1px 1px 0 rgba(0,0,0,0.6)" },
    ],
  },
  recommendedFor: ["novel", "essay"],
};

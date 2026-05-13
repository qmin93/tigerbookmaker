import type { CoverTemplate } from "../../types";

/** K-pop Y2K — 핫핑크·네온·사이버. 별/하트/스파클. */
export const kpopY2k: CoverTemplate = {
  key: "kpop-y2k",
  label: "K-pop Y2K",
  category: "RETRO",
  description: "핫핑크·네온·사이버 + 별/하트/스파클. MZ 직장인 + 인스타 바이럴 타겟.",
  promptHint:
    "K-pop Y2K composition: holographic chrome gradients of hot pink, lavender and cyan, sparkle and star motifs, glossy bubble surfaces, leave a clean center block for a stylized title with metallic sheen aesthetic.",
  overlay: {
    decorations: [
      { type: "badge-pill", position: "top-right", size: { width: 0.22, height: 0.05 }, color: "rgba(0,0,0,0.4)", offsetPx: [-30, 30] },
    ],
    textBlocks: [
      { field: "badge", position: "top-right", offsetPx: [-80, 55], font: { weight: 700, sizeRatio: 0.013, family: "ui-monospace, monospace" }, color: "#FFFFFF", align: "middle", letterSpacing: 0.1 },
      { field: "series", position: "center", offsetPx: [0, -110], font: { weight: 700, sizeRatio: 0.015 }, color: "#FFFFFF", align: "middle", letterSpacing: 0.3, textTransform: "uppercase", shadow: "2px 2px 0 #000" },
      { field: "title", position: "center", offsetPx: [0, -20], font: { weight: 900, sizeRatio: 0.085 }, color: "#FFFFFF", align: "middle", maxWidth: 0.82, lineHeight: 1.0, letterSpacing: -0.02, shadow: "3px 3px 0 #000" },
      { field: "subtitle", position: "center", offsetPx: [0, 64], font: { weight: 700, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#FFFFFF", align: "middle", letterSpacing: 0.2, textTransform: "uppercase", shadow: "1px 1px 0 #000" },
      { field: "author", position: "bottom-center", offsetPx: [0, -40], font: { weight: 700, sizeRatio: 0.013 }, color: "#FFFFFF", align: "middle", letterSpacing: 0.25, textTransform: "uppercase", shadow: "1px 1px 0 #000" },
    ],
  },
  recommendedFor: ["essay", "self-dev", "practical"],
};

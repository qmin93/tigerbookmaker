import type { CoverTemplate } from "../../types";

/** Retro 80s Synthwave — 네온 그라데이션 + 격자 원근 + 픽셀 폰트. */
export const retro80s: CoverTemplate = {
  key: "retro-80s",
  label: "레트로 80s",
  category: "RETRO",
  description: "네온 핑크/노랑/보라 + 격자 원근 + 픽셀 폰트. 노스탤지어 + 트렌디.",
  promptHint:
    "Retro 80s synthwave composition: sunset gradient from magenta to orange to deep purple, perspective neon grid horizon, chrome accents and palm silhouettes, leave the upper-center band clean for a chunky retro title.",
  overlay: {
    decorations: [
      { type: "divider-line", position: "top-bleed", size: { width: 1, height: 0.003 }, color: "#FEF3C7", offsetPx: [0, 32] },
    ],
    textBlocks: [
      { field: "series", position: "top-center", offsetPx: [0, 56], font: { weight: 700, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#FEF3C7", align: "middle", letterSpacing: 0.4, textTransform: "uppercase", shadow: "2px 2px 0 #000" },
      { field: "title", position: "top-center", offsetPx: [0, 180], font: { weight: 900, sizeRatio: 0.092, family: "ui-monospace, monospace" }, color: "#FEF3C7", align: "middle", maxWidth: 0.84, lineHeight: 0.92, letterSpacing: -0.02, textTransform: "uppercase", shadow: "4px 4px 0 #EC4899" },
      { field: "subtitle", position: "center", offsetPx: [0, 80], font: { weight: 500, sizeRatio: 0.016, family: "ui-monospace, monospace" }, color: "#FEF3C7", align: "middle", letterSpacing: 0.25, textTransform: "uppercase", shadow: "2px 2px 0 #000" },
      { field: "author", position: "bottom-center", offsetPx: [0, -50], font: { weight: 700, sizeRatio: 0.014, family: "ui-monospace, monospace" }, color: "#FEF3C7", align: "middle", letterSpacing: 0.3, textTransform: "uppercase", shadow: "2px 2px 0 #000" },
    ],
  },
  recommendedFor: ["essay", "practical", "self-dev"],
};

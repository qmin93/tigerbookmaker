import type { CoverTemplate } from "../../types";

/** Manga / Comic — 만화 효과음 + 말풍선 + 두꺼운 검정 보더. */
export const mangaComic: CoverTemplate = {
  key: "manga-comic",
  label: "만화 / 코믹",
  category: "BOLD",
  description: "만화 효과음·말풍선·기울임 + 두꺼운 검정 보더. 강렬·재미. 자기계발·실용서 적합.",
  promptHint:
    "Japanese manga / comic page composition: speed lines, halftone screentone shading, dynamic angled paneling, dramatic black-and-white ink work with a single accent color and a clean dialog-box area for the title.",
  overlay: {
    decorations: [
      { type: "badge-pill", position: "bottom-left", size: { width: 0.78, height: 0.22 }, color: "#FFFFFF", offsetPx: [40, -240] },
      { type: "badge-pill", position: "top-right", size: { width: 0.22, height: 0.07 }, color: "#FBBF24", offsetPx: [-50, 50] },
    ],
    textBlocks: [
      { field: "badge", position: "top-right", offsetPx: [-160, 100], font: { weight: 900, sizeRatio: 0.022 }, color: "#000000", align: "middle", textTransform: "uppercase" },
      { field: "title", position: "bottom-left", offsetPx: [70, -150], font: { weight: 900, sizeRatio: 0.075 }, color: "#000000", maxWidth: 0.66, lineHeight: 0.92, letterSpacing: -0.03 },
      { field: "subtitle", position: "bottom-left", offsetPx: [70, -96], font: { weight: 700, sizeRatio: 0.018 }, color: "#6B7280", maxWidth: 0.66 },
      { field: "author", position: "bottom-right", offsetPx: [-50, -32], font: { weight: 700, sizeRatio: 0.013 }, color: "#FFFFFF", shadow: "1px 1px 0 rgba(0,0,0,0.7)" },
    ],
  },
  recommendedFor: ["self-dev", "practical"],
};

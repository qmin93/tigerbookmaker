import type { CoverTemplate } from "../../types";

/** Pop Art — Roy Lichtenstein 스타일. 하프톤 도트 + 원색 + 만화 보더. */
export const popArt: CoverTemplate = {
  key: "pop-art",
  label: "팝아트",
  category: "BOLD",
  description: "하프톤 도트 + 원색 + 만화 보더. 1960s 광고 톤. 강한 시선 끌기.",
  promptHint:
    "Roy Lichtenstein-inspired pop art composition: halftone Ben-Day dot pattern, saturated primary colors, comic-style bold outlines, leave the lower third clean for a speech-bubble title slot.",
  overlay: {
    background: { area: "bottom-third", color: "#FEF08A", opacity: 0.95 },
    decorations: [
      { type: "divider-line", position: "center-left", size: { width: 1, height: 0.008 }, color: "#000000", offsetPx: [0, 240] },
      { type: "circle", position: "top-right", size: { width: 0.12 }, color: "#DC2626", offsetPx: [-50, 50] },
    ],
    textBlocks: [
      { field: "badge", position: "top-right", offsetPx: [-50, 55], font: { weight: 900, sizeRatio: 0.018 }, color: "#FFFFFF", align: "middle", textTransform: "uppercase", letterSpacing: 0.05 },
      { field: "title", position: "bottom-center", offsetPx: [0, -120], font: { weight: 900, sizeRatio: 0.085 }, color: "#000000", maxWidth: 0.86, lineHeight: 0.95, letterSpacing: -0.03, textTransform: "uppercase" },
      { field: "subtitle", position: "bottom-center", offsetPx: [0, -56], font: { weight: 700, sizeRatio: 0.022 }, color: "#000000", maxWidth: 0.84 },
      { field: "author", position: "bottom-center", offsetPx: [0, -24], font: { weight: 700, sizeRatio: 0.014 }, color: "#000000", letterSpacing: 0.15, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["practical", "self-dev"],
};

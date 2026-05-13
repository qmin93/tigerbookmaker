import type { CoverTemplate } from "../../types";

/** Monocle 잡지 — sans 마스트헤드 + 단일 히어로 사진 + 크림/네이비 팔레트. */
export const monocleMagazine: CoverTemplate = {
  key: "monocle-magazine",
  label: "모노클 매거진",
  category: "EDITORIAL",
  description: "마스트헤드 + 단일 히어로 사진 + 차분한 팔레트. 출판물 권위 톤.",
  promptHint:
    "Monocle magazine editorial composition: confident sans-serif masthead area at the top, a single hero photograph below, refined color palette of cream, navy and burgundy, generous gutters and column structure.",
  overlay: {
    background: { area: "top-third", color: "rgba(250, 248, 240, 0.96)" },
    decorations: [
      { type: "divider-line", position: "top-left", size: { width: 0.86, height: 0.002 }, color: "#1E3A8A", offsetPx: [80, 200] },
      { type: "badge-pill", position: "bottom-bleed", size: { width: 1, height: 0.06 }, color: "#1E3A8A" },
    ],
    textBlocks: [
      { field: "publisher", position: "top-center", offsetPx: [0, 90], font: { weight: 900, sizeRatio: 0.05, family: "Georgia, serif" }, color: "#1E3A8A", align: "middle", textTransform: "uppercase", letterSpacing: 0.18 },
      { field: "series", position: "top-center", offsetPx: [0, 150], font: { weight: 500, sizeRatio: 0.013 }, color: "#525252", align: "middle", letterSpacing: 0.3, textTransform: "uppercase" },
      { field: "title", position: "bottom-center", offsetPx: [0, -110], font: { weight: 900, sizeRatio: 0.055, family: "Georgia, serif" }, color: "#1E3A8A", align: "middle", maxWidth: 0.84, lineHeight: 1.0, letterSpacing: -0.01 },
      { field: "subtitle", position: "bottom-center", offsetPx: [0, -64], font: { weight: 500, sizeRatio: 0.016, family: "Georgia, serif", italic: true }, color: "#475569", align: "middle", maxWidth: 0.78 },
      { field: "author", position: "bottom-center", offsetPx: [0, -20], font: { weight: 700, sizeRatio: 0.013 }, color: "#FFFFFF", align: "middle", letterSpacing: 0.2, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["essay", "academic", "self-dev"],
};

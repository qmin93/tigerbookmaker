import type { CoverTemplate } from "../../types";

/** Collage Zine — 찢어진 종이 + 회전된 사진 클립 + 마스킹테이프. */
export const collageZine: CoverTemplate = {
  key: "collage-zine",
  label: "콜라주 진",
  category: "EXPERIMENTAL",
  description: "찢어진 종이 + 비뚤어진 사진 + 손그림 보더. 인디·재미. 에세이·인터뷰·취미.",
  promptHint:
    "Indie magazine collage / zine composition: torn paper edges, mixed photographic clippings on slightly rotated planes, masking-tape pieces, handwritten margin notes, leave one rectangular white sticker area reserved for the title.",
  overlay: {
    decorations: [
      { type: "badge-pill", position: "bottom-left", size: { width: 0.78, height: 0.16 }, color: "#FFFFFF", offsetPx: [50, -220] },
      { type: "badge-pill", position: "top-right", size: { width: 0.18, height: 0.05 }, color: "#FBBF24", offsetPx: [-30, 30] },
    ],
    textBlocks: [
      { field: "badge", position: "top-right", offsetPx: [-90, 56], font: { weight: 900, sizeRatio: 0.014 }, color: "#000000", align: "middle", textTransform: "uppercase", letterSpacing: 0.15 },
      { field: "title", position: "bottom-left", offsetPx: [80, -150], font: { weight: 900, sizeRatio: 0.07 }, color: "#000000", maxWidth: 0.68, lineHeight: 0.95, letterSpacing: -0.025 },
      { field: "subtitle", position: "bottom-left", offsetPx: [80, -100], font: { weight: 500, sizeRatio: 0.015, italic: true }, color: "#6B7280", maxWidth: 0.68 },
      { field: "author", position: "bottom-right", offsetPx: [-40, -50], font: { weight: 700, sizeRatio: 0.013, family: "Georgia, serif", italic: true }, color: "#FFFFFF", shadow: "1px 1px 2px rgba(0,0,0,0.6)" },
    ],
  },
  recommendedFor: ["essay", "novel"],
};

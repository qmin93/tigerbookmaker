import type { CoverTemplate } from "../../types";

/** Movie Poster — 시네마틱 라이팅 + 드라마틱 타이포 + 영화 포스터 레이아웃. */
export const moviePoster: CoverTemplate = {
  key: "movie-poster",
  label: "무비 포스터",
  category: "EXPERIMENTAL",
  description: "시네마틱 라이팅 + 드라마틱 타이포. 영화 포스터 톤. 에세이·웹소설.",
  promptHint:
    "Cinematic movie-poster composition: dramatic silhouette or subject against a moody backdrop, vertical key-art framing, bottom third reserved for text.",
  overlay: {
    background: { area: "bottom-half", gradient: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.98) 100%)" },
    textBlocks: [
      { field: "series", position: "top-left", offsetPx: [40, 36], font: { weight: 500, sizeRatio: 0.012 }, color: "rgba(255,255,255,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },
      { field: "title", position: "bottom-left", offsetPx: [40, -130], font: { weight: 900, sizeRatio: 0.092 }, color: "#FFFFFF", maxWidth: 0.84, lineHeight: 0.92, letterSpacing: -0.03, shadow: "0 2px 12px rgba(0,0,0,0.6)" },
      { field: "subtitle", position: "bottom-left", offsetPx: [40, -64], font: { weight: 500, sizeRatio: 0.014 }, color: "rgba(255,255,255,0.7)", maxWidth: 0.84, letterSpacing: 0.15, textTransform: "uppercase" },
      { field: "author", position: "bottom-left", offsetPx: [40, -28], font: { weight: 700, sizeRatio: 0.012 }, color: "rgba(255,255,255,0.55)", letterSpacing: 0.2, textTransform: "uppercase" },
    ],
  },
  recommendedFor: ["novel", "essay"],
};

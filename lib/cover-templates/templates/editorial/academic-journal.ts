import type { CoverTemplate } from "../../types";

/** Academic Journal — 학술지 표지 톤. 추상 기하 + 큰 헤더 밴드. */
export const academicJournal: CoverTemplate = {
  key: "academic-journal",
  label: "학술 저널",
  category: "EDITORIAL",
  description: "학술지 표지 톤. 추상 기하 + 큰 헤더 밴드. 권위 + 가독성.",
  promptHint:
    "Academic journal cover layout: restrained typography-friendly grid, single abstract geometric motif centered, large quiet header band for the title.",
  overlay: {
    background: { area: "top-third", color: "rgba(250, 250, 248, 0.96)" },
    decorations: [
      { type: "divider-line", position: "top-left", size: { width: 1, height: 0.002 }, color: "#1E3A8A", offsetPx: [0, 36] },
      { type: "divider-line", position: "top-left", size: { width: 1, height: 0.002 }, color: "#1E3A8A", offsetPx: [0, 280] },
      { type: "divider-line", position: "bottom-left", size: { width: 1, height: 0.002 }, color: "#1E3A8A", offsetPx: [0, -36] },
    ],
    textBlocks: [
      { field: "publisher", position: "top-center", offsetPx: [0, 70], font: { weight: 700, sizeRatio: 0.014 }, color: "#1E3A8A", align: "middle", textTransform: "uppercase", letterSpacing: 0.3 },
      { field: "series", position: "top-center", offsetPx: [0, 100], font: { weight: 500, sizeRatio: 0.012 }, color: "#475569", align: "middle", letterSpacing: 0.2 },
      { field: "title", position: "top-center", offsetPx: [0, 180], font: { weight: 900, sizeRatio: 0.052, family: "Georgia, serif" }, color: "#0F172A", align: "middle", maxWidth: 0.86, lineHeight: 1.05, letterSpacing: -0.01 },
      { field: "subtitle", position: "top-center", offsetPx: [0, 245], font: { weight: 500, sizeRatio: 0.015, italic: true, family: "Georgia, serif" }, color: "#475569", align: "middle", maxWidth: 0.82 },
      { field: "author", position: "bottom-center", offsetPx: [0, -56], font: { weight: 700, sizeRatio: 0.015 }, color: "#1E3A8A", align: "middle", textTransform: "uppercase", letterSpacing: 0.2 },
    ],
  },
  recommendedFor: ["academic"],
};

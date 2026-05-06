import type { BookTemplate } from "./index";

export const minimal: BookTemplate = {
  key: "minimal",
  label: "모던 미니멀",
  description: "정돈된 sans-serif, 1단, 큰 여백",
  thumbnailSvg: "",
  suggestedFor: ["자기계발서", "실용서", "재테크"],
  Render: () => null as any,
  epubCss: "",
  pdfHtmlWrapper: (inner) => inner,
  coverStyleHint: "",
};

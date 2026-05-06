import type { BookTemplate } from "./index";

export const practical: BookTemplate = {
  key: "practical",
  label: "실용 가이드",
  description: "체크리스트·인용 박스 강조",
  thumbnailSvg: "",
  suggestedFor: ["매뉴얼"],
  Render: () => null as any,
  epubCss: "",
  pdfHtmlWrapper: (inner) => inner,
  coverStyleHint: "",
};

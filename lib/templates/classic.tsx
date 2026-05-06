import type { BookTemplate } from "./index";

export const classic: BookTemplate = {
  key: "classic",
  label: "클래식 도서",
  description: "serif, 챕터 시작 큰 첫글자",
  thumbnailSvg: "",
  suggestedFor: ["에세이", "웹소설"],
  Render: () => null as any,
  epubCss: "",
  pdfHtmlWrapper: (inner) => inner,
  coverStyleHint: "",
};

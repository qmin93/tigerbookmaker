import type { BookTemplate } from "./index";

export const editorial: BookTemplate = {
  key: "editorial",
  label: "에디토리얼 매거진",
  description: "1단형, 큰 이미지, 인용 박스 강조",
  thumbnailSvg: "",
  suggestedFor: ["전문서"],
  Render: () => <></>,
  epubCss: "",
  pdfHtmlWrapper: (inner, _theme) => inner,
  coverStyleHint: "",
};

// lib/templates/index.ts
// 4가지 레이아웃 템플릿 — registry, types, getTemplate, suggestTemplate
// 각 template은 별도 파일에 정의되고 여기서 모음

import type { ReactElement } from "react";
import type { ThemeClasses } from "../theme-colors";
import { minimal } from "./minimal";
import { editorial } from "./editorial";
import { classic } from "./classic";
import { practical } from "./practical";

export type TemplateKey = "minimal" | "editorial" | "classic" | "practical";

// project.type 가능한 값 (lib/storage.ts BookProject.type과 일치)
export type BookType =
  | "자기계발서" | "실용서" | "에세이" | "매뉴얼"
  | "재테크" | "웹소설" | "전문서";

export interface ChapterImage {
  placeholder: string;     // "[IMAGE: 캡션]"
  dataUrl?: string;
  alt?: string;
  caption?: string;
}

export interface TemplateProps {
  chapter: {
    title: string;
    subtitle?: string;
    content: string;
    images?: ChapterImage[];
  };
  theme: ThemeClasses;
  chapterIdx?: number;
  totalChapters?: number;
}

export interface BookTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  thumbnailSvg: string;     // SVG inline string for sidebar preview
  suggestedFor: BookType[];
  Render: (props: TemplateProps) => ReactElement;
  epubCss: string;
  pdfHtmlWrapper: (innerHtml: string, theme: ThemeClasses) => string;
  coverStyleHint: string;
}

export const TEMPLATES: Record<TemplateKey, BookTemplate> = {
  minimal,
  editorial,
  classic,
  practical,
};

const TEMPLATE_KEYS: ReadonlyArray<TemplateKey> = ["minimal", "editorial", "classic", "practical"];

export function isValidTemplateKey(key: unknown): key is TemplateKey {
  return typeof key === "string" && (TEMPLATE_KEYS as readonly string[]).includes(key);
}

export function getTemplate(key: TemplateKey | null | undefined): BookTemplate {
  if (key && isValidTemplateKey(key)) return TEMPLATES[key];
  return TEMPLATES.minimal;  // default fallback
}

// project.type → 자동 추천 template
export function suggestTemplate(bookType: BookType | string | null | undefined): TemplateKey {
  if (!bookType) return "minimal";
  switch (bookType) {
    case "전문서":
      return "editorial";
    case "에세이":
    case "웹소설":
      return "classic";
    case "매뉴얼":
      return "practical";
    case "자기계발서":
    case "실용서":
    case "재테크":
    default:
      return "minimal";
  }
}

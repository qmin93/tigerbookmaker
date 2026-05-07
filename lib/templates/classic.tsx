// lib/templates/classic.tsx
// Classic Book — serif (Noto Serif KR), 1단, 챕터 시작 큰 첫글자
// 어울리는 책: 에세이·웹소설·인문·자서전

import type { BookTemplate, TemplateProps } from "./index";
import { parseMultimedia, renderMultimediaToken } from "./_multimedia";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fefefe" rx="4"/>
  <text x="40" y="14" text-anchor="middle" font-size="5" font-family="serif" fill="#9ca3af" font-style="italic">CHAPTER ONE</text>
  <rect x="22" y="20" width="36" height="4" fill="#1f2937" rx="1"/>
  <text x="14" y="48" font-size="22" font-weight="900" fill="#1f2937" font-family="Georgia,serif">A</text>
  <line x1="26" y1="36" x2="70" y2="36" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="26" y1="44" x2="65" y2="44" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="26" y1="52" x2="68" y2="52" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="68" x2="70" y2="68" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="76" x2="65" y2="76" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="84" x2="60" y2="84" stroke="#d4d4d8" stroke-width="1.5"/>
</svg>`;

function ClassicRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-classic max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16" style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
      <div className="text-center mb-12">
        {chapterIdx != null && (
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3 font-sans">
            CHAPTER {chapterIdx + 1}{totalChapters ? ` / ${totalChapters}` : ""}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{chapter.title}</h1>
        {chapter.subtitle && (
          <p className="mt-3 text-base text-gray-600 italic">{chapter.subtitle}</p>
        )}
      </div>
      <div className="text-base md:text-lg text-gray-800 leading-loose" style={{ wordBreak: "keep-all" }}>
        {renderContentWithImages(chapter.content, chapter.images, theme)}
      </div>
    </article>
  );
}

function renderContentWithImages(
  content: string,
  images: TemplateProps["chapter"]["images"],
  theme: TemplateProps["theme"],
) {
  const segments = parseMultimedia(content);
  const accentText = theme.accent.split(" ")[0];
  let firstParagraphRendered = false;

  return segments.map((seg, segIdx) => {
    if (typeof seg !== "string") {
      return renderMultimediaToken(
        seg,
        `mm-${segIdx}`,
        "classic",
        accentText,
        theme.accentBorder,
        theme.bg,
      );
    }
    const parts = seg.split(/(\[IMAGE:[^\]]+\])/);
    return parts.map((part, i) => {
      if (part.startsWith("[IMAGE:")) {
        const matched = images?.find(img => img.placeholder === part);
        if (!matched?.dataUrl) return null;
        return (
          <figure key={`${segIdx}-${i}`} className="my-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={matched.dataUrl} alt={matched.alt ?? ""} className="mx-auto max-w-[50%] rounded" />
            {matched.caption && <figcaption className="mt-2 text-sm text-gray-500 italic font-sans">{matched.caption}</figcaption>}
          </figure>
        );
      }
      const paragraphs = part.split("\n\n").filter(p => p.trim());
      return paragraphs.map((para, j) => {
        if (!firstParagraphRendered && para.trim().length > 0) {
          firstParagraphRendered = true;
          return (
            <p key={`${segIdx}-${i}-${j}`} className="mb-6 first-letter:text-6xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:leading-none first-letter:mt-1">
              {para}
            </p>
          );
        }
        return <p key={`${segIdx}-${i}-${j}`} className="mb-5">{para}</p>;
      });
    });
  });
}

const EPUB_CSS = `
.tpl-classic { font-family: 'Noto Serif KR', Georgia, serif; line-height: 2.0; max-width: 100%; padding: 1.5em; color: #1a1a1a; }
.tpl-classic h1 { font-size: 1.8em; font-weight: 700; text-align: center; margin-bottom: 1em; }
.tpl-classic .chapter-label { text-align: center; font-size: 0.7em; letter-spacing: 0.3em; color: #9ca3af; text-transform: uppercase; margin-bottom: 0.5em; font-family: sans-serif; }
.tpl-classic p { margin-bottom: 1em; text-align: justify; word-break: keep-all; text-indent: 1em; }
.tpl-classic p:first-of-type { text-indent: 0; }
.tpl-classic p:first-of-type::first-letter { font-size: 3em; font-weight: 700; float: left; line-height: 1; margin-right: 0.1em; margin-top: 0.05em; }
.tpl-classic figure { margin: 1.5em auto; text-align: center; }
.tpl-classic figure img { max-width: 50%; height: auto; }
.tpl-classic figcaption { margin-top: 0.3em; font-size: 0.85em; color: #6b7280; font-style: italic; font-family: sans-serif; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-classic" style="font-family:'Noto Serif KR',Georgia,serif;line-height:2.0;color:#1a1a1a;max-width:620px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const classic: BookTemplate = {
  key: "classic",
  label: "클래식 도서",
  description: "serif (Noto Serif KR), 1단, 큰 첫글자, 종이책 느낌",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["에세이", "웹소설", "여행기", "동화"],
  Render: ClassicRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Classic literary book cover, elegant serif typography, generous spacing, traditional paper texture or subtle grain, sophisticated muted color palette, single classical reference image.",
};

// lib/templates/minimal.tsx
// Modern Minimal — sans-serif, 1단, 큰 여백, 정돈된 비즈니스 스타일
// 어울리는 책: 자기계발서·실용서·재테크

import type { BookTemplate, TemplateProps } from "./index";
import { parseMultimedia, renderMultimediaToken } from "./_multimedia";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fafafa" rx="4"/>
  <rect x="10" y="14" width="40" height="6" fill="#0a0a0a" rx="1"/>
  <rect x="10" y="24" width="20" height="3" fill="#9ca3af" rx="1"/>
  <line x1="10" y1="38" x2="70" y2="38" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="46" x2="65" y2="46" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="54" x2="62" y2="54" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="62" x2="68" y2="62" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="74" x2="55" y2="74" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="82" x2="60" y2="82" stroke="#d4d4d8" stroke-width="1.5"/>
</svg>`;

function MinimalRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-minimal max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14 font-sans">
      {chapterIdx != null && totalChapters != null && (
        <div className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">
          {chapterIdx + 1} / {totalChapters}
        </div>
      )}
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-3 leading-tight">
        {chapter.title}
      </h1>
      {chapter.subtitle && (
        <p className="text-lg text-gray-500 mb-10 leading-relaxed">{chapter.subtitle}</p>
      )}
      <div className={`prose prose-lg prose-gray max-w-none ${theme.accent.split(" ")[0]}`}>
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
  return segments.map((seg, segIdx) => {
    if (typeof seg !== "string") {
      return renderMultimediaToken(
        seg,
        `mm-${segIdx}`,
        "minimal",
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
          <figure key={`${segIdx}-${i}`} className="my-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={matched.dataUrl} alt={matched.alt ?? ""} className="mx-auto max-w-[70%] rounded-md" />
            {matched.caption && <figcaption className="mt-3 text-sm text-gray-500">{matched.caption}</figcaption>}
          </figure>
        );
      }
      return part.split("\n\n").map((para, j) => (
        para.trim() ? <p key={`${segIdx}-${i}-${j}`} className="leading-loose text-gray-800 mb-5">{para}</p> : null
      ));
    });
  });
}

const EPUB_CSS = `
.tpl-minimal { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.85; max-width: 100%; padding: 1.5em; color: #1a1a1a; }
.tpl-minimal h1 { font-size: 1.8em; font-weight: 900; margin-bottom: 0.5em; letter-spacing: -0.02em; }
.tpl-minimal h2 { font-size: 1.3em; font-weight: 800; margin-top: 2em; margin-bottom: 0.4em; }
.tpl-minimal p { margin-bottom: 1em; text-align: justify; word-break: keep-all; }
.tpl-minimal figure { margin: 2em auto; text-align: center; }
.tpl-minimal figure img { max-width: 70%; height: auto; border-radius: 4px; }
.tpl-minimal figcaption { margin-top: 0.5em; font-size: 0.9em; color: #6b7280; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-minimal" style="font-family:'Pretendard',sans-serif;line-height:1.85;color:#1a1a1a;max-width:680px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const minimal: BookTemplate = {
  key: "minimal",
  label: "모던 미니멀",
  description: "sans-serif, 1단, 큰 여백, 정돈된 비즈니스",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["자기계발서", "실용서", "재테크"],
  Render: MinimalRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Modern minimalist design, clean sans-serif typography, generous negative space, single bold focal element, restrained editorial style.",
};

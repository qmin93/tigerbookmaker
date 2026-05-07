// lib/templates/practical.tsx
// Practical Guide — 1단 + 박스, sans-serif, 체크리스트·인용 박스 강조
// 어울리는 책: 매뉴얼·요리·여행·튜토리얼

import type { BookTemplate, TemplateProps } from "./index";
import { parseMultimedia, renderMultimediaToken } from "./_multimedia";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fff7ed" rx="4"/>
  <rect x="10" y="14" width="35" height="5" fill="#0a0a0a" rx="1"/>
  <rect x="10" y="26" width="60" height="14" fill="#fff" stroke="#fb923c" stroke-width="1.5" rx="3"/>
  <rect x="14" y="30" width="22" height="2.5" fill="#9a3412" rx="1"/>
  <rect x="14" y="35" width="48" height="2" fill="#fdba74" rx="1"/>
  <g transform="translate(10,46)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="60" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
  <g transform="translate(10,56)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="55" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
  <g transform="translate(10,66)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="58" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
  <g transform="translate(10,76)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="50" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
</svg>`;

function PracticalRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-practical max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 font-sans">
      <div className="mb-6">
        {chapterIdx != null && totalChapters != null && (
          <div className={`inline-block px-2 py-1 text-xs font-mono uppercase tracking-widest rounded ${theme.bg} ${theme.accent.split(" ")[0]} mb-3`}>
            STEP {chapterIdx + 1} / {totalChapters}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 mb-2">{chapter.title}</h1>
        {chapter.subtitle && (
          <p className="text-base text-gray-600">{chapter.subtitle}</p>
        )}
      </div>
      <div className="text-base text-gray-800 leading-relaxed">
        {renderContentWithImages(chapter.content, chapter.images, theme)}
      </div>
    </article>
  );
}

function renderContentWithImages(
  content: string,
  images: TemplateProps["chapter"]["images"],
  theme: TemplateProps["theme"]
) {
  let figureCount = 0;
  const segments = parseMultimedia(content);
  const accentText = theme.accent.split(" ")[0];
  return segments.map((seg, segIdx) => {
    if (typeof seg !== "string") {
      return renderMultimediaToken(
        seg,
        `mm-${segIdx}`,
        "practical",
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
        figureCount += 1;
        const num = figureCount;
        return (
          <figure key={`${segIdx}-${i}`} className={`my-6 border-2 ${theme.accentBorder.replace("border-l-", "border-")} rounded-lg overflow-hidden`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={matched.dataUrl} alt={matched.alt ?? ""} className="block w-full" />
            <figcaption className={`px-3 py-2 text-sm ${theme.bg} text-gray-700`}>
              <b>그림 {num}.</b> {matched.caption ?? matched.alt ?? ""}
            </figcaption>
          </figure>
        );
      }
      return part.split("\n\n").map((para, j) => {
        if (!para.trim()) return null;
        const trimmed = para.trim();
        if (trimmed.startsWith("💡") || /^TIP[:.]/i.test(trimmed)) {
          return (
            <div key={`${segIdx}-${i}-${j}`} className={`my-4 px-4 py-3 ${theme.bg} border-l-4 ${theme.accentBorder} rounded`}>
              <p className="font-semibold">{trimmed}</p>
            </div>
          );
        }
        const lines = trimmed.split("\n").filter(l => l.trim());
        const isChecklist = lines.length > 0 && lines.every(line => /^[-*]\s\[\s?\]/.test(line) || /^✓\s/.test(line));
        if (isChecklist) {
          return (
            <ul key={`${segIdx}-${i}-${j}`} className="my-4 space-y-2">
              {lines.map((line, k) => (
                <li key={k} className="flex items-start gap-2">
                  <span className={`flex-shrink-0 mt-1 inline-block w-4 h-4 border-2 ${theme.accentBorder.replace("border-l-", "border-")} rounded-sm`}></span>
                  <span>{line.replace(/^[-*]\s\[\s?\]\s*|^✓\s*/, "")}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={`${segIdx}-${i}-${j}`} className="mb-4">{para}</p>;
      });
    });
  });
}

const EPUB_CSS = `
.tpl-practical { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.7; max-width: 100%; padding: 1.5em; color: #1a1a1a; background: #fff7ed; }
.tpl-practical h1 { font-size: 1.6em; font-weight: 900; margin-bottom: 0.4em; }
.tpl-practical p { margin-bottom: 0.8em; word-break: keep-all; }
.tpl-practical .tip-box { padding: 0.8em 1em; background: #fff; border-left: 4px solid #f97316; border-radius: 4px; margin: 1em 0; font-weight: 600; }
.tpl-practical figure { margin: 1.2em 0; border: 2px solid #fb923c; border-radius: 6px; overflow: hidden; }
.tpl-practical figure img { display: block; max-width: 100%; }
.tpl-practical figcaption { padding: 0.5em 0.8em; background: #ffedd5; font-size: 0.9em; color: #7c2d12; }
.tpl-practical figcaption b { color: #9a3412; }
.tpl-practical ul.checklist li { display: flex; align-items: flex-start; gap: 0.5em; margin-bottom: 0.4em; }
.tpl-practical ul.checklist li::before { content: ""; flex-shrink: 0; display: inline-block; width: 1em; height: 1em; border: 2px solid #f97316; border-radius: 2px; margin-top: 0.25em; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-practical" style="font-family:'Pretendard',sans-serif;line-height:1.7;color:#1a1a1a;background:#fff7ed;max-width:680px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const practical: BookTemplate = {
  key: "practical",
  label: "실용 가이드",
  description: "체크리스트·인용 박스·표 강조, 행동 지향",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["매뉴얼", "요리책", "강의노트"],
  Render: PracticalRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Practical guide cover, clean and useful-looking, white or light background with one bold geometric color block, heavy sans-serif typography, numbered or bulleted feel, professional.",
};

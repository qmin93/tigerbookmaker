// lib/templates/editorial.tsx
// Editorial Magazine — 1단, 큰 이미지 풀폭, 인라인 인용 박스 (강조 컬러 좌측 라인)
// 어울리는 책: 비즈니스·전문서·트렌드·인터뷰

import type { BookTemplate, TemplateProps } from "./index";
import { parseMultimedia, renderMultimediaToken } from "./_multimedia";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fff" rx="4" stroke="#e5e7eb"/>
  <rect x="6" y="10" width="40" height="6" fill="#0a0a0a" rx="1"/>
  <rect x="6" y="22" width="68" height="22" fill="#fbbf24" rx="2"/>
  <line x1="6" y1="50" x2="74" y2="50" stroke="#d4d4d8" stroke-width="1.2"/>
  <line x1="6" y1="56" x2="68" y2="56" stroke="#d4d4d8" stroke-width="1.2"/>
  <rect x="6" y="62" width="68" height="14" fill="#fef3c7" stroke="#f59e0b" stroke-width="0" rx="2"/>
  <line x1="9" y1="62" x2="9" y2="76" stroke="#f59e0b" stroke-width="2"/>
  <line x1="14" y1="66" x2="60" y2="66" stroke="#92400e" stroke-width="1"/>
  <line x1="14" y1="71" x2="55" y2="71" stroke="#92400e" stroke-width="1"/>
  <line x1="6" y1="82" x2="74" y2="82" stroke="#d4d4d8" stroke-width="1.2"/>
  <line x1="6" y1="88" x2="65" y2="88" stroke="#d4d4d8" stroke-width="1.2"/>
</svg>`;

function EditorialRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-editorial max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <div className="mb-8">
        {chapterIdx != null && totalChapters != null && (
          <div className={`text-xs font-mono uppercase tracking-[0.25em] mb-4 ${theme.accent.split(" ")[0]} font-bold`}>
            ISSUE {chapterIdx + 1} · {totalChapters}장 시리즈
          </div>
        )}
        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05] text-gray-900 mb-4" style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
          {chapter.title}
        </h1>
        {chapter.subtitle && (
          <p className="text-lg md:text-xl text-gray-600 leading-snug max-w-2xl font-sans">{chapter.subtitle}</p>
        )}
      </div>
      <div className="text-base md:text-lg text-gray-800 leading-loose font-sans" style={{ wordBreak: "keep-all" }}>
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
  const segments = parseMultimedia(content);
  const accentText = theme.accent.split(" ")[0];
  return segments.map((seg, segIdx) => {
    if (typeof seg !== "string") {
      return renderMultimediaToken(
        seg,
        `mm-${segIdx}`,
        "editorial",
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
          <figure key={`${segIdx}-${i}`} className="my-10 -mx-4 md:-mx-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={matched.dataUrl} alt={matched.alt ?? ""} className="block w-full aspect-[16/9] object-cover" />
            {matched.caption && (
              <figcaption className={`mt-3 mx-4 md:mx-6 pl-3 border-l-4 ${theme.accentBorder} text-sm font-bold ${theme.accent.split(" ")[0]}`}>
                {matched.caption}
              </figcaption>
            )}
          </figure>
        );
      }
      return part.split("\n\n").map((para, j) => {
        if (!para.trim()) return null;
        const trimmed = para.trim();
        if (trimmed.startsWith(">") || trimmed.startsWith("❝") || trimmed.startsWith('"')) {
          const text = trimmed.replace(/^>\s?|^❝\s?|^"|"$/g, "");
          return (
            <blockquote key={`${segIdx}-${i}-${j}`} className={`my-6 pl-5 border-l-4 ${theme.accentBorder} ${theme.accent.split(" ")[0]} text-xl md:text-2xl font-bold leading-snug`} style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
              "{text}"
            </blockquote>
          );
        }
        return <p key={`${segIdx}-${i}-${j}`} className="mb-5">{para}</p>;
      });
    });
  });
}

const EPUB_CSS = `
.tpl-editorial { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.85; max-width: 100%; padding: 1.5em; color: #1a1a1a; }
.tpl-editorial h1 { font-family: 'Noto Serif KR', Georgia, serif; font-size: 2em; font-weight: 900; line-height: 1.1; margin-bottom: 0.5em; letter-spacing: -0.02em; }
.tpl-editorial .issue-label { font-size: 0.7em; letter-spacing: 0.25em; color: #f97316; text-transform: uppercase; font-weight: 700; margin-bottom: 0.5em; }
.tpl-editorial p { margin-bottom: 1em; word-break: keep-all; }
.tpl-editorial blockquote { margin: 1.5em 0; padding-left: 1em; border-left: 4px solid currentColor; font-family: 'Noto Serif KR', Georgia, serif; font-size: 1.3em; font-weight: 700; line-height: 1.4; }
.tpl-editorial figure { margin: 2em -1.5em; }
.tpl-editorial figure img { display: block; width: 100%; height: auto; }
.tpl-editorial figcaption { margin: 0.6em 1.5em 0; padding-left: 0.8em; border-left: 4px solid currentColor; font-size: 0.95em; font-weight: 700; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-editorial" style="font-family:'Pretendard',sans-serif;line-height:1.85;color:#1a1a1a;max-width:720px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const editorial: BookTemplate = {
  key: "editorial",
  label: "에디토리얼 매거진",
  description: "1단 + 큰 이미지 풀폭 + 인라인 인용 박스, 매거진 분위기",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["전문서", "매거진", "인터뷰집", "포트폴리오"],
  Render: EditorialRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Editorial magazine cover style, bold serif title, asymmetric composition, large abstract or photographic background, accent color stripe or geometric element, sophisticated publication aesthetic.",
};

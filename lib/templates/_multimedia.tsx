// lib/templates/_multimedia.tsx
// 본문 안 [VIDEO: ...] [AUDIO: ...] [LINK: url|텍스트] placeholder 처리.
// 4 template (minimal/classic/practical/editorial) 공통 helper.
// EPUB/PDF는 video/audio iframe 안 됨 → link fallback.

import type { ReactNode } from "react";

export type MultimediaToken =
  | { kind: "video"; url: string; original: string }
  | { kind: "audio"; url: string; original: string }
  | { kind: "link"; url: string; label: string; original: string };

const PLACEHOLDER_RE = /\[(VIDEO|AUDIO|LINK):\s*([^\]]+)\]/g;

/** content 문자열 → 텍스트 segment + multimedia token 배열 */
export function parseMultimedia(content: string): Array<string | MultimediaToken> {
  const out: Array<string | MultimediaToken> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      out.push(content.slice(lastIndex, match.index));
    }
    const kind = match[1].toLowerCase() as "video" | "audio" | "link";
    const raw = match[2].trim();
    const original = match[0];
    if (kind === "link") {
      const [url, ...labelParts] = raw.split("|").map(s => s.trim());
      const label = labelParts.length > 0 ? labelParts.join("|") : url;
      out.push({ kind: "link", url, label, original });
    } else if (kind === "video" || kind === "audio") {
      out.push({ kind, url: raw, original });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) out.push(content.slice(lastIndex));
  return out;
}

/** YouTube URL → embed URL. Vimeo / 일반 URL → 그대로 반환 (or null) */
export function videoEmbedUrl(url: string): string | null {
  // YouTube
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  // Other — 그대로
  if (/^https?:\/\//.test(url)) return url;
  return null;
}

export type MultimediaStyle = "minimal" | "classic" | "practical" | "editorial";

/** 웹용 React 렌더 (4 templates 공통, style별 약간 다름) */
export function renderMultimediaToken(
  token: MultimediaToken,
  key: string | number,
  style: MultimediaStyle,
  themeAccentText: string,
  themeAccentBorder: string,
  themeBg: string,
): ReactNode {
  if (token.kind === "video") {
    const embed = videoEmbedUrl(token.url);
    if (!embed) return null;
    // editorial: 풀폭 dramatic / 그 외: 본문폭
    const wrapClass =
      style === "editorial"
        ? "my-10 -mx-4 md:-mx-6 aspect-video bg-black overflow-hidden shadow-lg"
        : style === "minimal"
          ? "my-8 mx-auto max-w-[80%] aspect-video rounded-lg overflow-hidden bg-black shadow-md"
          : style === "practical"
            ? `my-6 aspect-video rounded-lg overflow-hidden bg-black border-2 ${themeAccentBorder.replace("border-l-", "border-")}`
            : "my-6 aspect-video rounded overflow-hidden bg-black";
    return (
      <div key={key} className={wrapClass}>
        <iframe
          src={embed}
          title="video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }
  if (token.kind === "audio") {
    const wrapClass =
      style === "practical"
        ? `my-4 p-3 ${themeBg} border-l-4 ${themeAccentBorder} rounded-r`
        : style === "editorial"
          ? `my-6 p-4 ${themeBg} border-l-4 ${themeAccentBorder}`
          : "my-4 p-3 bg-gray-50 rounded-lg border border-gray-200";
    return (
      <div key={key} className={wrapClass}>
        <audio controls preload="metadata" className="w-full">
          <source src={token.url} />
          오디오를 재생할 수 없습니다.
        </audio>
      </div>
    );
  }
  if (token.kind === "link") {
    const wrapClass =
      style === "editorial"
        ? `my-6 flex items-center gap-3 px-4 py-3 border-l-4 ${themeAccentBorder} ${themeBg} hover:opacity-80 transition no-underline`
        : style === "practical"
          ? `my-4 flex items-center gap-3 px-4 py-3 border-2 ${themeAccentBorder.replace("border-l-", "border-")} ${themeBg} rounded-lg hover:opacity-80 transition no-underline`
          : style === "classic"
            ? `my-5 flex items-center gap-3 px-4 py-2 border-l-2 ${themeAccentBorder.replace("border-l-", "border-")} bg-gray-50 hover:bg-gray-100 transition no-underline font-sans`
            : `my-4 flex items-center gap-3 px-4 py-3 border-l-4 ${themeAccentBorder} bg-gray-50 rounded-r-lg hover:bg-gray-100 transition no-underline`;
    return (
      <a
        key={key}
        href={token.url}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapClass}
      >
        <span className="text-2xl flex-shrink-0">🔗</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold ${themeAccentText} truncate`}>{token.label}</div>
          <div className="text-xs text-gray-500 truncate">{token.url}</div>
        </div>
      </a>
    );
  }
  return null;
}

/** EPUB/PDF용 HTML 문자열 (audio/video는 link로 fallback) */
export function multimediaTokenToEpubHtml(token: MultimediaToken): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  if (token.kind === "video") {
    return `<p class="multimedia-fallback" style="margin:1em 0;padding:0.6em 0.9em;background:#f3f4f6;border-left:3px solid #6b7280;border-radius:3px;"><a href="${escape(token.url)}">🎬 영상 보기: ${escape(token.url)}</a></p>`;
  }
  if (token.kind === "audio") {
    return `<p class="multimedia-fallback" style="margin:1em 0;padding:0.6em 0.9em;background:#f3f4f6;border-left:3px solid #6b7280;border-radius:3px;"><a href="${escape(token.url)}">🔊 오디오 듣기: ${escape(token.url)}</a></p>`;
  }
  if (token.kind === "link") {
    return `<p class="multimedia-link" style="margin:1em 0;padding:0.5em 0.8em;background:#f9fafb;border-left:3px solid #6b7280;">🔗 <a href="${escape(token.url)}">${escape(token.label)}</a></p>`;
  }
  return "";
}

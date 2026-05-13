// Sharp-based SVG text overlay for AI-generated meta ad images.
// Replaces unreliable Korean text rendering by Imagen with precise SVG composition.
//
// PR #2 확장: `templateKey` (LayoutKey) 인자로 `lib/cover-templates` 의 풍부한 layout 정의를
// 그대로 그려준다. 기존 5개 string 템플릿("minimal"|"bold"|"story"|"quote"|"cta") 은 backward-compat 유지.

import sharp from "sharp";
import { PRETENDARD_BOLD_BASE64 } from "@/lib/fonts/pretendard-base64";
import { getTemplate } from "@/lib/cover-templates";
import type { LayoutKey } from "@/lib/cover-style-map";
import type {
  CoverTemplate,
  OverlayBackground,
  OverlayDecoration,
  OverlayPosition,
  OverlayTextBlock,
} from "@/lib/cover-templates/types";

export type OverlayTemplate = "minimal" | "bold" | "story" | "quote" | "cta";

/** 표지의 풍부한 텍스트 슬롯. PR #2 `templateKey` 경로에서 사용. */
export interface CoverFields {
  title: string;
  subtitle?: string;
  author?: string;
  badge?: string;
  series?: string;
  publisher?: string;
  tagline?: string;
}

export interface OverlayOptions {
  imageBase64: string;
  width: number;
  height: number;
  headline: string;        // 큰 글자 (헤드라인)
  subhead?: string;        // 작은 글자
  /** 레거시 5개 템플릿. templateKey 와 동시 지정 시 templateKey 가 우선. */
  template?: OverlayTemplate;
  /**
   * PR #2 신규: `lib/cover-templates` 의 LayoutKey.
   * 지정되면 해당 템플릿의 overlay 정의(background + decorations + textBlocks)를 그대로 그린다.
   *
   * 추가 텍스트 필드(author/badge/series/...)는 `fields` 인자로 전달한다. 미전달 시:
   *   - title  ← headline
   *   - subtitle ← subhead
   *   - 나머지는 ""(빈 문자열) 처리.
   */
  templateKey?: LayoutKey;
  /** templateKey 사용 시 추가 텍스트 슬롯들. */
  fields?: Partial<CoverFields>;
  brandText?: string;      // 하단 워터마크 (default "🐯 Tigerbookmaker")
}

export async function overlayTextOnImage(opts: OverlayOptions): Promise<string> {
  const { imageBase64, width, height, headline, subhead, template, templateKey, fields, brandText } = opts;

  // PR #2 경로: templateKey 우선 적용.
  let svg: string;
  if (templateKey) {
    const tpl = getTemplate(templateKey);
    if (tpl) {
      const resolvedFields: CoverFields = {
        title: fields?.title ?? headline,
        subtitle: fields?.subtitle ?? subhead,
        author: fields?.author,
        badge: fields?.badge,
        series: fields?.series,
        publisher: fields?.publisher,
        tagline: fields?.tagline,
      };
      svg = generateCoverTemplateSvg({ template: tpl, width, height, fields: resolvedFields, brandText });
    } else {
      // 정의되지 않은 LayoutKey — 레거시 "bold" 폴백.
      svg = generateOverlaySvg({ width, height, headline, subhead, template: "bold", brandText });
    }
  } else {
    // 기존 경로: 5개 string 템플릿.
    const legacyTemplate: OverlayTemplate = template ?? "bold";
    svg = generateOverlaySvg({ width, height, headline, subhead, template: legacyTemplate, brandText });
  }

  const inputBuffer = Buffer.from(imageBase64, "base64");
  const overlayBuffer = Buffer.from(svg);

  const result = await sharp(inputBuffer)
    .resize(width, height, { fit: "cover" })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result.toString("base64");
}

// ─────────────────────────────────────────────────────────
// PR #2: CoverTemplate.overlay 정의를 그대로 SVG 로 렌더.
// 합성 순서: background → decorations → textBlocks (가장 위).
// ─────────────────────────────────────────────────────────
function generateCoverTemplateSvg(opts: {
  template: CoverTemplate;
  width: number;
  height: number;
  fields: CoverFields;
  brandText?: string;
}): string {
  const { template, width, height, fields, brandText = "🐯 Tigerbookmaker" } = opts;
  const overlay = template.overlay;

  const fontFace = PRETENDARD_BOLD_BASE64
    ? `@font-face { font-family: 'Pretendard'; src: url(data:font/woff2;base64,${PRETENDARD_BOLD_BASE64}) format('woff2'); font-weight: 700; }`
    : "";

  const parts: string[] = [];

  if (overlay.background) parts.push(renderBackground(overlay.background, width, height));
  for (const deco of overlay.decorations ?? []) parts.push(renderDecoration(deco, width, height));
  for (const block of overlay.textBlocks) {
    const value = fields[block.field];
    if (value && typeof value === "string" && value.trim()) {
      parts.push(renderTextBlock(block, value, width, height));
    }
  }

  if (brandText && brandText.trim()) {
    parts.push(
      `<text x="${width * 0.5}" y="${height - 16}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(width / 60)}" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="middle">${escapeXml(brandText)}</text>`,
    );
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>${fontFace}</style>${parts.join("\n")}</svg>`;
}

function renderBackground(bg: OverlayBackground, w: number, h: number): string {
  const { x, y, width: areaW, height: areaH } = areaToRect(bg.area, w, h);
  const opacity = bg.opacity ?? 1;
  const rx = bg.cornerRadiusPx ?? 0;

  if (bg.gradient) {
    const gradId = `bg-${Math.floor(Math.random() * 1e9)}`;
    const stops = parseGradientStops(bg.gradient);
    const angleDeg = parseGradientAngle(bg.gradient);
    const { x1, y1, x2, y2 } = angleToSvgGradient(angleDeg);
    const stopsXml = stops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
    return `<defs><linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsXml}</linearGradient></defs><rect x="${x}" y="${y}" width="${areaW}" height="${areaH}" fill="url(#${gradId})" opacity="${opacity}" rx="${rx}"/>`;
  }

  const color = bg.color ?? "rgba(0,0,0,0)";
  return `<rect x="${x}" y="${y}" width="${areaW}" height="${areaH}" fill="${color}" opacity="${opacity}" rx="${rx}"/>`;
}

function renderDecoration(deco: OverlayDecoration, w: number, h: number): string {
  const sz = deco.size ?? {};
  const dw = (sz.width ?? 0) * w;
  const dh = (sz.height ?? 0) * h;
  const anchor = positionToAnchor(deco.position, w, h);
  const offX = deco.offsetPx?.[0] ?? 0;
  const offY = deco.offsetPx?.[1] ?? 0;

  switch (deco.type) {
    case "divider-line": {
      const x = anchor.x + offX;
      const y = anchor.y + offY;
      return `<rect x="${x}" y="${y}" width="${Math.max(dw, 1)}" height="${Math.max(dh, 1)}" fill="${deco.color}"/>`;
    }
    case "badge-pill": {
      const x = anchor.x + offX;
      const y = anchor.y + offY;
      const r = Math.min(dw, dh) * 0.5;
      return `<rect x="${x}" y="${y}" width="${dw}" height="${dh}" fill="${deco.color}" rx="${r}" ry="${r}"/>`;
    }
    case "circle": {
      const radius = (sz.width ?? 0.1) * w * 0.5;
      const cx = anchor.x + offX;
      const cy = anchor.y + offY;
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${deco.color}"/>`;
    }
    case "frame-border": {
      const fw = (sz.width ?? 0.94) * w;
      const fh = (sz.height ?? 0.94) * h;
      const fx = (w - fw) * 0.5 + offX;
      const fy = (h - fh) * 0.5 + offY;
      return `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="${deco.color}" stroke-width="1.5"/>`;
    }
  }
}

function renderTextBlock(block: OverlayTextBlock, value: string, w: number, h: number): string {
  const anchor = positionToAnchor(block.position, w, h);
  const offX = block.offsetPx?.[0] ?? 0;
  const offY = block.offsetPx?.[1] ?? 0;
  const x = anchor.x + offX;
  const y = anchor.y + offY;

  const fontSize = Math.max(8, Math.round(block.font.sizeRatio * w));
  const family = block.font.family ?? "Pretendard, sans-serif";
  const weight = block.font.weight;
  const italic = block.font.italic ? `font-style="italic"` : "";
  const align = block.align ?? defaultAlignForPosition(block.position);
  const letterSpacing = block.letterSpacing ? `letter-spacing="${block.letterSpacing}em"` : "";
  const shadow = block.shadow ? `style="filter: drop-shadow(${cssShadowToSvg(block.shadow)});"` : "";

  const maxW = (block.maxWidth ?? 0.84) * w;
  const charPx = fontSize * 0.55;
  const maxChars = Math.max(6, Math.floor(maxW / charPx));
  const lineHeight = block.lineHeight ?? 1.1;
  const lineHeightPx = fontSize * lineHeight;
  const transformed = applyTextTransform(value, block.textTransform);
  const lines = wrapText(transformed, maxChars);

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeightPx;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" font-family="${family}" font-weight="${weight}" font-size="${fontSize}" ${italic} fill="${block.color}" text-anchor="${align}" ${letterSpacing} ${shadow}>${tspans}</text>`;
}

function areaToRect(area: OverlayBackground["area"], w: number, h: number) {
  switch (area) {
    case "full":         return { x: 0, y: 0, width: w, height: h };
    case "top-half":     return { x: 0, y: 0, width: w, height: h * 0.5 };
    case "bottom-half":  return { x: 0, y: h * 0.5, width: w, height: h * 0.5 };
    case "top-third":    return { x: 0, y: 0, width: w, height: h * 0.34 };
    case "bottom-third": return { x: 0, y: h * 0.66, width: w, height: h * 0.34 };
  }
}

function positionToAnchor(pos: OverlayPosition, w: number, h: number): { x: number; y: number } {
  switch (pos) {
    case "top-left":      return { x: 0,         y: 0 };
    case "top-center":    return { x: w * 0.5,   y: 0 };
    case "top-right":     return { x: w,         y: 0 };
    case "center-left":   return { x: 0,         y: h * 0.5 };
    case "center":        return { x: w * 0.5,   y: h * 0.5 };
    case "center-right":  return { x: w,         y: h * 0.5 };
    case "bottom-left":   return { x: 0,         y: h };
    case "bottom-center": return { x: w * 0.5,   y: h };
    case "bottom-right":  return { x: w,         y: h };
    case "top-bleed":     return { x: 0,         y: 0 };
    case "bottom-bleed":  return { x: 0,         y: h };
  }
}

function defaultAlignForPosition(pos: OverlayPosition): "start" | "middle" | "end" {
  if (pos.endsWith("right")) return "end";
  if (pos.endsWith("center") || pos === "center" || pos === "top-bleed" || pos === "bottom-bleed") return "middle";
  return "start";
}

function applyTextTransform(s: string, t: OverlayTextBlock["textTransform"]): string {
  if (t === "uppercase") return s.toUpperCase();
  if (t === "lowercase") return s.toLowerCase();
  return s;
}

function cssShadowToSvg(shadow: string): string {
  return shadow.split(",")[0]?.trim() ?? "";
}

/** 매우 단순한 CSS linear-gradient 파서. */
function parseGradientStops(g: string): Array<{ offset: string; color: string }> {
  const inner = g.replace(/^linear-gradient\(/, "").replace(/\)$/, "");
  const parts = splitCssArgs(inner);
  const stops = parts.slice(1);
  return stops.map((s, i) => {
    const trimmed = s.trim();
    const m = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)%$/);
    if (m) return { color: m[1], offset: `${m[2]}%` };
    const evenly = (i / Math.max(1, stops.length - 1)) * 100;
    return { color: trimmed, offset: `${evenly}%` };
  });
}

function parseGradientAngle(g: string): number {
  const m = g.match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg/);
  return m ? Number(m[1]) : 180;
}

/** CSS gradient angle(deg) → SVG x1/y1/x2/y2 (0~1). */
function angleToSvgGradient(angleDeg: number): { x1: string; y1: string; x2: string; y2: string } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const x1 = (0.5 - dx * 0.5).toFixed(3);
  const y1 = (0.5 - dy * 0.5).toFixed(3);
  const x2 = (0.5 + dx * 0.5).toFixed(3);
  const y2 = (0.5 + dy * 0.5).toFixed(3);
  return { x1, y1, x2, y2 };
}

/** ", " 로 분할하되 괄호 안의 콤마는 보존. */
function splitCssArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out.map(s => s.trim());
}

function generateOverlaySvg(opts: {
  width: number;
  height: number;
  headline: string;
  subhead?: string;
  template: OverlayTemplate;
  brandText?: string;
}): string {
  const { width, height, headline, subhead, template, brandText = "🐯 Tigerbookmaker" } = opts;

  // Korean 폰트 — Pretendard Bold base64 임베드 (librsvg가 외부 URL 못 가져옴 → 한글 깨짐 방지)
  const fontFace = PRETENDARD_BOLD_BASE64
    ? `
    @font-face {
      font-family: 'Pretendard';
      src: url(data:font/woff2;base64,${PRETENDARD_BOLD_BASE64}) format('woff2');
      font-weight: 700;
    }
  `
    : "";

  // template별 layout 분기
  switch (template) {
    case "minimal":
      return svgMinimal(width, height, headline, subhead, brandText, fontFace);
    case "bold":
      return svgBold(width, height, headline, subhead, brandText, fontFace);
    case "story":
      return svgStory(width, height, headline, subhead, brandText, fontFace);
    case "quote":
      return svgQuote(width, height, headline, subhead, brandText, fontFace);
    case "cta":
      return svgCta(width, height, headline, subhead, brandText, fontFace);
  }
}

// 5개 SVG 템플릿 함수 — 각각 다른 layout
function svgMinimal(w: number, h: number, headline: string, subhead: string | undefined, brand: string, fontFace: string): string {
  // 흰색 박스 배경 + 작은 글자 — 깔끔한 미니멀
  const fontSize = Math.floor(w / 16);
  const subFontSize = Math.floor(w / 32);
  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <rect x="${w*0.08}" y="${h*0.65}" width="${w*0.84}" height="${h*0.27}" fill="white" opacity="0.95" rx="12"/>
  <text x="${w*0.5}" y="${h*0.78}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${fontSize}" fill="#0a0a0a" text-anchor="middle" dominant-baseline="middle">${escapeXml(truncate(headline, 30))}</text>
  ${subhead ? `<text x="${w*0.5}" y="${h*0.86}" font-family="Pretendard, sans-serif" font-weight="500" font-size="${subFontSize}" fill="#525252" text-anchor="middle" dominant-baseline="middle">${escapeXml(truncate(subhead, 50))}</text>` : ""}
  <text x="${w*0.5}" y="${h*0.96}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/40)}" fill="#f97316" text-anchor="middle">${escapeXml(brand)}</text>
</svg>`;
}

function svgBold(w: number, h: number, headline: string, subhead: string | undefined, brand: string, fontFace: string): string {
  // 큰 헤드라인 + 검정 그라데이션 오버레이 — 강한 인상
  const fontSize = Math.floor(w / 12);
  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="60%" stop-color="black" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <text x="${w*0.06}" y="${h*0.72}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${fontSize}" fill="white">${escapeXml(truncate(headline, 25))}</text>
  ${subhead ? `<text x="${w*0.06}" y="${h*0.84}" font-family="Pretendard, sans-serif" font-weight="500" font-size="${Math.floor(w/24)}" fill="#fed7aa">${escapeXml(truncate(subhead, 40))}</text>` : ""}
  <text x="${w*0.06}" y="${h*0.94}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/40)}" fill="#f97316">${escapeXml(brand)}</text>
</svg>`;
}

function svgStory(w: number, h: number, headline: string, subhead: string | undefined, brand: string, fontFace: string): string {
  // 9:16 비율 친화 — 상단 큰 글자 + 하단 CTA 영역 (Story/Reels용)
  const fontSize = Math.floor(w / 14);
  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <rect x="0" y="0" width="${w}" height="${h*0.3}" fill="black" opacity="0.6"/>
  <rect x="0" y="${h*0.7}" width="${w}" height="${h*0.3}" fill="white" opacity="0.92"/>
  <text x="${w*0.5}" y="${h*0.16}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${fontSize}" fill="white" text-anchor="middle">${escapeXml(truncate(headline, 25))}</text>
  ${subhead ? `<text x="${w*0.5}" y="${h*0.78}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/18)}" fill="#0a0a0a" text-anchor="middle">${escapeXml(truncate(subhead, 30))}</text>` : ""}
  <rect x="${w*0.2}" y="${h*0.85}" width="${w*0.6}" height="${h*0.08}" fill="#f97316" rx="${h*0.04}"/>
  <text x="${w*0.5}" y="${h*0.89}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/22)}" fill="white" text-anchor="middle" dominant-baseline="middle">지금 보기 →</text>
  <text x="${w*0.5}" y="${h*0.97}" font-family="Pretendard, sans-serif" font-weight="500" font-size="${Math.floor(w/36)}" fill="#525252" text-anchor="middle">${escapeXml(brand)}</text>
</svg>`;
}

function svgQuote(w: number, h: number, headline: string, subhead: string | undefined, brand: string, fontFace: string): string {
  // 큰 따옴표 + 인용 스타일
  const fontSize = Math.floor(w / 18);
  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <rect width="${w}" height="${h}" fill="black" opacity="0.4"/>
  <text x="${w*0.1}" y="${h*0.4}" font-family="serif" font-weight="700" font-size="${Math.floor(w/4)}" fill="#f97316" opacity="0.6">"</text>
  <text x="${w*0.5}" y="${h*0.55}" font-family="Pretendard, sans-serif" font-weight="500" font-style="italic" font-size="${fontSize}" fill="white" text-anchor="middle">${escapeXml(truncate(headline, 50))}</text>
  ${subhead ? `<text x="${w*0.5}" y="${h*0.72}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/22)}" fill="#fed7aa" text-anchor="middle">— ${escapeXml(truncate(subhead, 30))}</text>` : ""}
  <text x="${w*0.5}" y="${h*0.94}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/40)}" fill="#f97316" text-anchor="middle">${escapeXml(brand)}</text>
</svg>`;
}

function svgCta(w: number, h: number, headline: string, subhead: string | undefined, brand: string, fontFace: string): string {
  // 강한 CTA — 큰 버튼 강조
  const fontSize = Math.floor(w / 16);
  return `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <rect width="${w}" height="${h}" fill="white" opacity="0.55"/>
  <text x="${w*0.5}" y="${h*0.45}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${fontSize}" fill="#0a0a0a" text-anchor="middle">${escapeXml(truncate(headline, 30))}</text>
  ${subhead ? `<text x="${w*0.5}" y="${h*0.55}" font-family="Pretendard, sans-serif" font-weight="500" font-size="${Math.floor(w/26)}" fill="#525252" text-anchor="middle">${escapeXml(truncate(subhead, 40))}</text>` : ""}
  <rect x="${w*0.3}" y="${h*0.7}" width="${w*0.4}" height="${h*0.1}" fill="#f97316" rx="${h*0.05}"/>
  <text x="${w*0.5}" y="${h*0.755}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/20)}" fill="white" text-anchor="middle" dominant-baseline="middle">지금 시작 →</text>
  <text x="${w*0.5}" y="${h*0.93}" font-family="Pretendard, sans-serif" font-weight="700" font-size="${Math.floor(w/40)}" fill="#f97316" text-anchor="middle">${escapeXml(brand)}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─────────────────────────────────────────────────────────
// Wave B3: 카드뉴스 인포그래픽 5장 자동 (Sharp + SVG, AI 호출 X)
// 1080x1080 PNG. 큰 슬라이드 번호 (01/5) + 메인 메시지 + 책 제목 + 브랜드 워터마크.
// ─────────────────────────────────────────────────────────

export type InfographicTemplate = "minimal" | "bold" | "dark";

export interface InfographicCardOptions {
  slideNum: number;          // 1~5
  totalSlides: number;       // 5
  message: string;           // 핵심 메시지 (한 줄/문장)
  bookTitle: string;         // 책 제목 (footer)
  template: InfographicTemplate;
  brandText?: string;        // default "🐯 Tigerbookmaker"
}

export async function generateInfographicCard(opts: InfographicCardOptions): Promise<string> {
  const W = 1080;
  const H = 1080;
  const svg = generateInfographicSvg({ ...opts, width: W, height: H });
  const result = await sharp({
    create: {
      width: W, height: H, channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },  // SVG가 전체 덮기 때문에 무관
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return result.toString("base64");
}

function generateInfographicSvg(opts: InfographicCardOptions & { width: number; height: number }): string {
  const { width: W, height: H, slideNum, totalSlides, message, bookTitle, template, brandText = "🐯 Tigerbookmaker" } = opts;

  const fontFace = PRETENDARD_BOLD_BASE64
    ? `
    @font-face {
      font-family: 'Pretendard';
      src: url(data:font/woff2;base64,${PRETENDARD_BOLD_BASE64}) format('woff2');
      font-weight: 700;
    }
  ` : "";

  // 템플릿별 색상 팔레트
  const palette = template === "minimal"
    ? { bgFrom: "#fafafa", bgTo: "#ffffff", text: "#0a0a0a", sub: "#525252", accent: "#f97316", chip: "#fed7aa" }
    : template === "bold"
    ? { bgFrom: "#f97316", bgTo: "#ea580c", text: "#ffffff", sub: "#fef3c7", accent: "#ffffff", chip: "#fdba74" }
    : { bgFrom: "#0a0a0a", bgTo: "#1f1f1f", text: "#ffffff", sub: "#a3a3a3", accent: "#f97316", chip: "#525252" };

  // 메시지 word-wrap (한국어 word-break: keep-all 흉내 — SVG는 자동 줄바꿈 X)
  const wrappedMessage = wrapText(message, 14); // 14자 라인 (1080px 기준 큰 글자)
  const messageLineHeight = 70;
  const messageStartY = H * 0.45 - ((wrappedMessage.length - 1) * messageLineHeight) / 2;

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bgFrom}"/>
      <stop offset="100%" stop-color="${palette.bgTo}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- 큰 슬라이드 번호 (좌상단, 살짝 투명) -->
  <text
    x="${W * 0.08}" y="${H * 0.22}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="180"
    fill="${palette.accent}" opacity="0.85"
  >${String(slideNum).padStart(2, "0")}</text>

  <!-- "/ totalSlides" 작게 옆 -->
  <text
    x="${W * 0.08 + 220}" y="${H * 0.22}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="56"
    fill="${palette.sub}" opacity="0.8"
  >/ ${totalSlides}</text>

  <!-- 구분 라인 -->
  <line x1="${W * 0.08}" y1="${H * 0.27}" x2="${W * 0.4}" y2="${H * 0.27}" stroke="${palette.accent}" stroke-width="6"/>

  <!-- 메인 메시지 (가운데, word-wrap) -->
  ${wrappedMessage.map((line, i) => `
  <text
    x="${W * 0.08}" y="${messageStartY + i * messageLineHeight}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="60"
    fill="${palette.text}"
  >${escapeXml(line)}</text>`).join("\n")}

  <!-- 책 제목 (footer 위, chip 형태) -->
  <rect
    x="${W * 0.08}" y="${H * 0.86}"
    width="${Math.min(W * 0.84, bookTitle.length * 22 + 40)}" height="56"
    fill="${palette.chip}" rx="28"
  />
  <text
    x="${W * 0.08 + 20}" y="${H * 0.86 + 38}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="28"
    fill="${template === "minimal" ? "#0a0a0a" : palette.text}"
  >📖 ${escapeXml(truncate(bookTitle, 28))}</text>

  <!-- 브랜드 워터마크 (footer) -->
  <text
    x="${W * 0.08}" y="${H * 0.96}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="24"
    fill="${palette.accent}"
  >${escapeXml(brandText)}</text>
</svg>`;
}

// ─────────────────────────────────────────────────────────
// 강의 슬라이드 — 1920x1080 Full HD PNG (강사·코치용 zoom/오프라인 강의 즉시 사용)
// 3 templates: minimal (밝음), bold (어두운 강조), academic (출판물 톤)
// ─────────────────────────────────────────────────────────

export type CourseSlideTemplate = "minimal" | "bold" | "academic";

export interface CourseSlideOptions {
  slideNum: number;
  totalSlides: number;
  title: string;
  bullets: string[];
  bookTitle: string;
  template?: CourseSlideTemplate;
}

export async function generateCourseSlide(opts: CourseSlideOptions): Promise<string> {
  const W = 1920;
  const H = 1080;
  const template = opts.template ?? "minimal";
  const svg = generateCourseSlideSvg({ ...opts, width: W, height: H, template });
  const result = await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: getCourseSlideBg(template),
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return result.toString("base64");
}

function getCourseSlideBg(template: CourseSlideTemplate): { r: number; g: number; b: number } {
  if (template === "bold") return { r: 10, g: 10, b: 10 };
  if (template === "academic") return { r: 250, g: 250, b: 248 };
  return { r: 255, g: 255, b: 255 }; // minimal
}

function generateCourseSlideSvg(opts: CourseSlideOptions & { width: number; height: number; template: CourseSlideTemplate }): string {
  const { width, height, slideNum, totalSlides, title, bullets, bookTitle, template } = opts;

  const fontFace = PRETENDARD_BOLD_BASE64
    ? `
    @font-face {
      font-family: 'Pretendard';
      src: url(data:font/woff2;base64,${PRETENDARD_BOLD_BASE64}) format('woff2');
      font-weight: 700;
    }
  ` : "";

  const colors = template === "bold"
    ? { titleColor: "#ffffff", bulletColor: "#fed7aa", footerColor: "#71717a", bg: "#0a0a0a", bullet: "#f97316" }
    : template === "academic"
    ? { titleColor: "#0a0a0a", bulletColor: "#374151", footerColor: "#9ca3af", bg: "#fafaf8", bullet: "#1e40af" }
    : { titleColor: "#0a0a0a", bulletColor: "#374151", footerColor: "#9ca3af", bg: "#ffffff", bullet: "#f97316" };

  const titleFontSize = Math.min(72, Math.max(48, Math.floor(width * 0.04)));
  const bulletFontSize = Math.floor(width * 0.022);

  const safeBullets = (bullets ?? []).slice(0, 5);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <rect width="${width}" height="${height}" fill="${colors.bg}"/>
  <!-- 좌측 accent bar -->
  <rect x="0" y="0" width="20" height="${height}" fill="${colors.bullet}"/>

  <!-- 슬라이드 번호 (우상단) -->
  <text
    x="${width - 80}" y="80"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="24" fill="${colors.footerColor}"
    text-anchor="end"
  >${slideNum} / ${totalSlides}</text>

  <!-- 제목 -->
  <text
    x="120" y="${Math.floor(height * 0.25)}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="${titleFontSize}" fill="${colors.titleColor}"
  >${escapeXml(truncate(title, 40))}</text>

  <!-- 제목 아래 구분선 -->
  <line
    x1="120" y1="${Math.floor(height * 0.25) + 24}"
    x2="${Math.floor(width * 0.4)}" y2="${Math.floor(height * 0.25) + 24}"
    stroke="${colors.bullet}" stroke-width="6"
  />

  <!-- bullets -->
  ${safeBullets.map((b, i) => {
    const cy = Math.floor(height * 0.4) + i * 80;
    return `  <circle cx="140" cy="${cy}" r="8" fill="${colors.bullet}"/>
  <text
    x="170" y="${cy + 10}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="${bulletFontSize}" fill="${colors.bulletColor}"
  >${escapeXml(truncate(b ?? "", 50))}</text>`;
  }).join("\n")}

  <!-- footer: 책 제목 + 브랜드 -->
  <text
    x="120" y="${height - 50}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="20" fill="${colors.footerColor}"
  >${escapeXml(truncate(bookTitle, 50))} · 🐯 Tigerbookmaker</text>
</svg>`;
}

// ─────────────────────────────────────────────────────────
// Wave B6: 미리보기 영상 frame — 1080x1920 (9:16) PNG.
// 인스타 릴스/유튜브 쇼츠 비율. 5장이 한 세트 (cover/excerpt/excerpt/excerpt/cta).
// FFmpeg 없이 PNG 5장만 생성 — 사용자가 본인 영상 편집기에서 1분 영상 조립.
// ─────────────────────────────────────────────────────────

export interface VideoFrameOptions {
  frameIdx: number;            // 0..N-1
  totalFrames: number;         // 5
  text: string;                // 표시할 텍스트
  template: "cover" | "excerpt" | "cta";
  bookTitle: string;
  brandText?: string;
}

export async function generateVideoFrame(opts: VideoFrameOptions): Promise<string> {
  const W = 1080;
  const H = 1920;
  const svg = generateVideoFrameSvg({ ...opts, width: W, height: H });
  const result = await sharp({
    create: {
      width: W, height: H, channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return result.toString("base64");
}

function generateVideoFrameSvg(opts: VideoFrameOptions & { width: number; height: number }): string {
  const { width: W, height: H, frameIdx, totalFrames, text, template, bookTitle, brandText = "🐯 Tigerbookmaker" } = opts;

  const fontFace = PRETENDARD_BOLD_BASE64
    ? `
    @font-face {
      font-family: 'Pretendard';
      src: url(data:font/woff2;base64,${PRETENDARD_BOLD_BASE64}) format('woff2');
      font-weight: 700;
    }
  ` : "";

  // 템플릿별 색상 — cover=다크, excerpt=라이트(읽기 친화), cta=강한 오렌지
  const palette = template === "cover"
    ? { bgFrom: "#0a0a0a", bgTo: "#1f1f1f", text: "#ffffff", sub: "#fed7aa", accent: "#f97316" }
    : template === "cta"
    ? { bgFrom: "#f97316", bgTo: "#ea580c", text: "#ffffff", sub: "#fef3c7", accent: "#ffffff" }
    : { bgFrom: "#fafafa", bgTo: "#ffffff", text: "#0a0a0a", sub: "#525252", accent: "#f97316" };

  // 9:16 좁은 폭 → 한 줄에 ~12자
  const wrapped = wrapText(text, template === "cover" ? 10 : 12);
  const lineHeight = template === "cover" ? 110 : 90;
  const fontSize = template === "cover" ? 96 : 80;
  const startY = H * 0.5 - ((wrapped.length - 1) * lineHeight) / 2;

  // 진행 바 — 5장 중 어느 frame인지 시각화 (상단)
  const progressW = W * 0.84;
  const progressX = W * 0.08;
  const segGap = 8;
  const segW = (progressW - segGap * (totalFrames - 1)) / totalFrames;

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>${fontFace}</style>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.bgFrom}"/>
      <stop offset="100%" stop-color="${palette.bgTo}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- 상단 진행 바 (frame 위치 표시) -->
  ${Array.from({ length: totalFrames }).map((_, i) => `
  <rect x="${progressX + i * (segW + segGap)}" y="${H * 0.05}"
        width="${segW}" height="6"
        fill="${i <= frameIdx ? palette.accent : "#525252"}"
        opacity="${i <= frameIdx ? 0.95 : 0.3}"
        rx="3"/>`).join("")}

  <!-- 메인 텍스트 (가운데, word-wrap) -->
  ${wrapped.map((line, i) => `
  <text
    x="${W * 0.5}" y="${startY + i * lineHeight}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="${fontSize}"
    fill="${palette.text}" text-anchor="middle" dominant-baseline="middle"
  >${escapeXml(line)}</text>`).join("\n")}

  <!-- 책 제목 (footer 위) -->
  <text
    x="${W * 0.5}" y="${H * 0.88}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="36" fill="${palette.sub}" text-anchor="middle"
  >📖 ${escapeXml(truncate(bookTitle, 22))}</text>

  <!-- 브랜드 워터마크 (footer) -->
  <text
    x="${W * 0.5}" y="${H * 0.95}"
    font-family="Pretendard, sans-serif" font-weight="700"
    font-size="32" fill="${palette.accent}" text-anchor="middle"
  >${escapeXml(brandText)}</text>
</svg>`;
}

// 한국어 친화 word-wrap — 공백·구두점 기준 + maxChars 강제
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [""];
  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    // 한 단어가 maxChars 초과 → 강제 자르기
    if (word.length > maxCharsPerLine) {
      if (current) { lines.push(current); current = ""; }
      for (let i = 0; i < word.length; i += maxCharsPerLine) {
        lines.push(word.slice(i, i + maxCharsPerLine));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  // 너무 많은 줄 방지 (max 6 lines, 마지막에 …)
  if (lines.length > 6) {
    const truncated = lines.slice(0, 5);
    truncated.push((lines[5] ?? "").slice(0, maxCharsPerLine - 1) + "…");
    return truncated;
  }
  return lines;
}

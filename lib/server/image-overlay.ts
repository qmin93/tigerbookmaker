// Sharp-based SVG text overlay for AI-generated meta ad images.
// Replaces unreliable Korean text rendering by Imagen with precise SVG composition.

import sharp from "sharp";
import { PRETENDARD_BOLD_BASE64 } from "@/lib/fonts/pretendard-base64";

export type OverlayTemplate = "minimal" | "bold" | "story" | "quote" | "cta";

export interface OverlayOptions {
  imageBase64: string;
  width: number;
  height: number;
  headline: string;        // 큰 글자 (헤드라인)
  subhead?: string;        // 작은 글자
  template: OverlayTemplate;
  brandText?: string;      // 하단 워터마크 (default "🐯 Tigerbookmaker")
}

export async function overlayTextOnImage(opts: OverlayOptions): Promise<string> {
  const { imageBase64, width, height, headline, subhead, template, brandText } = opts;

  const svg = generateOverlaySvg({ width, height, headline, subhead, template, brandText });

  const inputBuffer = Buffer.from(imageBase64, "base64");
  const overlayBuffer = Buffer.from(svg);

  const result = await sharp(inputBuffer)
    .resize(width, height, { fit: "cover" })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result.toString("base64");
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

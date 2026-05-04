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

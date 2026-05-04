# Wave 3 — 광고 이미지 품질 개선

**Goal**: 
1. AI 생성 이미지 위에 Sharp으로 한국어 헤드라인 정확히 overlay (Imagen이 한글 30% 정확 → 100%)
2. 5가지 디자인 템플릿 (minimal / bold / story / quote / cta) — A/B 테스트용

---

## Approach

**현재 (Wave 0)**: prompt에 한국어 텍스트 포함 → Imagen이 그려줌 → 글자 깨짐 자주
**개선 (Wave 3)**: Imagen은 배경만 → Sharp으로 SVG text overlay → 정확한 한국어

**SVG text overlay**: SVG 안에 한국어 텍스트를 명시 → Sharp이 librsvg로 렌더링 → PNG composite. Pretendard 폰트는 CDN URL or base64 embed.

---

## Tasks

### W3-1. Sharp 설치 + lib/server/image-overlay.ts

`package.json`에 `sharp` 추가 (production dependency).

`lib/server/image-overlay.ts`:

```typescript
import sharp from "sharp";

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

  // Korean 폰트 — Pretendard (Google Fonts에 없으니 CDN 사용)
  const fontFace = `
    @font-face {
      font-family: 'Pretendard';
      src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2') format('woff2');
      font-weight: 700;
    }
  `;

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
```

Commit: `feat(image): Sharp 기반 SVG text overlay (5 템플릿)`

### W3-2. Meta-images route 수정

기존 `app/api/generate/meta-images/route.ts`를 수정:
- prompt에서 텍스트 합성 요청 제거 → 배경/컨셉만 요청
- 생성 후 `overlayTextOnImage`로 헤드라인 합성
- body에 `template` 파라미터 받음 (default "bold")

또 prompt도 단순화 — Imagen이 글자 안 그리고 분위기만 그리도록.

```typescript
function metaImagePrompt(project, type): string {
  // 글자 합성 요청 제거 — 배경 분위기만
  return `한국어 책 광고 배경 이미지. ${aspect} 비율.

[책 정보]
- 주제: ${project.topic}
- 대상: ${project.audience}
- 유형: ${project.type}

[디자인]
- 책 표지 컨셉의 시각적 분위기
- 텍스트 영역(하단 30%)은 비워둘 것 — 별도로 텍스트 합성됨
- 색상: 따뜻하고 깔끔한 톤
- 글자 합성하지 마세요 — 분위기만`;
}
```

각 이미지 생성 후:
```typescript
const overlaid = await overlayTextOnImage({
  imageBase64: img.base64,
  width: targetWidth,
  height: targetHeight,
  headline: marketingMeta?.tagline || project.topic,
  subhead: project.audience,
  template,
});
// save overlaid as base64 instead of raw img.base64
```

`MetaAdImage` 타입에 `template?: OverlayTemplate` 필드 추가.

Commit: `feat(api): meta-images에 Sharp text overlay + 템플릿 옵션`

### W3-3. UI — Template picker

`/write` 페이지의 Meta 광고 이미지 섹션에 템플릿 picker 추가:

이미지 생성 버튼 위에 5개 템플릿 토글 (chip):
- Minimal / Bold / Story / Quote / CTA

선택된 템플릿을 API 호출 시 body에 포함.

Commit: `feat(ui): Meta 이미지 템플릿 5종 picker`

---

## 통합

- `npm install sharp` (production dep)
- `npm run build` 통과 확인
- main merge + push
- Vercel 배포 검증

---

*— end of Wave 3 plan*

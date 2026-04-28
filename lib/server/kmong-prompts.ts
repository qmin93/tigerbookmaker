import type { BookProject } from "../storage";

export type KmongImageType = "cover" | "thumb" | "toc" | "spec" | "audience" | "preview";

export const KMONG_IMAGE_TYPES: KmongImageType[] = ["cover", "thumb", "toc", "spec", "audience", "preview"];

export interface KmongCopy {
  kmongDescription: string;
  kmongHighlights: string[];
  instagram: string;
  kakao: string;
  twitter: string;
}

// 영어 prompt — Cloudflare Workers AI (Flux 1 Schnell) 가 한국어 약함.
// 책 정보를 영어로 짧게 인라인.

// 장르별 표지 시각 컨셉 — 책 유형에 따라 분위기를 분기.
function coverPromptByGenre(p: BookProject, topic: string): string {
  const base = `Korean ebook cover, square 1:1, premium publishing aesthetic, NO Korean text, NO Hangul characters in image. Topic: "${topic}".`;

  switch (p.type) {
    case "자기계발서":
      return `${base} Bold typography-driven design. Strong abstract shape (arrow, rising curve, mountain peak) suggesting growth and momentum. Two-color palette: warm orange (#f97316) accent on cream/white background. Editorial book cover style. Confident, motivational mood. NO photo realism.`;

    case "재테크":
      return `${base} Financial book cover. Subtle line chart or upward graph as background motif. Dark navy + gold accent palette, OR clean white with deep green accent. Trustworthy professional banking aesthetic. Geometric and serious. NO cartoon style, NO cash piles.`;

    case "에세이":
      return `${base} Emotional abstract cover. Soft watercolor wash, single botanical element (leaf, branch, single flower), or atmospheric landscape silhouette. Muted earthy palette (sage, terracotta, cream). Quiet contemplative mood. Hand-drawn illustration style. NO bold typography focus.`;

    case "웹소설":
      return `${base} Webnovel cover style. Single dramatic character silhouette or evocative scene, cinematic mood lighting, vivid contrast. Webtoon-influenced illustration aesthetic but painterly. Genre-appropriate atmosphere (romantic / fantasy / mystery based on topic). High visual drama.`;

    case "전문서":
      return `${base} Academic/professional book cover. Geometric grid layout, restrained typography hierarchy, single conceptual diagram or symbolic icon. Cool palette (deep blue, charcoal, white). Serious authoritative mood, like a university press publication. Minimalist and structured.`;

    case "매뉴얼":
      return `${base} Technical manual cover. Schematic diagram or exploded-view illustration of relevant tool/process. Blueprint aesthetic — fine line work, monochrome with single safety-orange (#f97316) accent. Functional and clear. NO decorative flourishes.`;

    case "실용서":
    default:
      return `${base} Modern minimalist cover. Big bold typography-led layout, clean white background, single accent color (orange #f97316), one simple geometric or symbolic icon. Editorial design. NO complex illustration.`;
  }
}

export function imagePrompt(type: KmongImageType, p: BookProject): string {
  const topic = p.topic.slice(0, 80);
  const audience = p.audience.slice(0, 50);

  switch (type) {
    case "cover":
      return coverPromptByGenre(p, topic);

    case "thumb":
      return `Eye-catching ebook marketplace thumbnail. Topic: "${topic}". Bold visual metaphor in center, bright color contrast (orange #f97316 accent), professional publishing look. Square 1:1. NO text in image (will overlay separately).`;

    case "toc":
      return `Clean modern infographic showing 12-chapter table of contents structure. Vertical numbered list with subtle dividers. White background, monochrome with orange accents. Professional publishing aesthetic. Square 1:1. NO actual text content (just structural visual).`;

    case "spec":
      return `Minimalist book specification card. Show file format icons (PDF, DOCX), page icons, layout grid. Modern flat design, hairline borders, monochrome with single orange accent. Premium professional. Square 1:1. NO Korean text.`;

    case "audience":
      return `Friendly persona illustration for "${audience}". Single character or icon representing the target reader. Warm minimal style, single subject focus, white background with subtle warm accent. Modern editorial illustration. Square 1:1. NO text.`;

    case "preview":
      return `Mockup of an open ebook on a clean desk. Minimal photo style, paper texture visible, soft natural lighting. White background. Editorial product shot. Square 1:1.`;
  }
}

export function copyPrompt(p: BookProject): string {
  const topic = p.topic;
  const audience = p.audience;
  const type = p.type;
  const chapterTitles = (p.chapters ?? [])
    .map((c, i) => `${i + 1}. ${c.title}`)
    .join("\n");

  return `다음 책의 크몽 등록·SNS 홍보용 카피를 생성합니다.

[책 정보]
- 주제: ${topic}
- 대상 독자: ${audience}
- 책 유형: ${type}
- 목차:
${chapterTitles}

[요구사항]
다음 5개 필드를 가진 JSON만 출력:

{
  "kmongDescription": "크몽 상세 페이지 메인 카피 — 300~500자, 책의 가치 제안 + 누구에게 좋은가 + 어떤 변화를 주는가. '~합니다' 존댓말. 광고 톤이지만 과장 X",
  "kmongHighlights": ["강조 포인트 5개, 각 30~50자, ~합니다 존댓말, 구체적 결과·이익 명시"],
  "instagram": "인스타 캡션 — 200~400자, 줄바꿈 적극 활용, 첫 줄 후크, 마지막에 #해시태그 5~8개",
  "kakao": "카톡 1:1 메시지 — 50~80자, 친근한 반말, 상대 호기심 유발",
  "twitter": "트위터/X 게시 — 280자 이내 한 게시물, 짧고 강한 후크"
}

[금지]
- "혁신적인" "획기적인" "AI 시대에" 같은 AI 특유 표현
- 마크다운 코드블록 (그냥 순수 JSON만)
- 과장 (예: "10배 빨라진다", "100% 성공")

순수 JSON만 출력하세요.`;
}

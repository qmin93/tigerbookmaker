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

// Cloudflare Flux 1 Schnell — 한국어/한자 텍스트 못 만듦. prompt에 한국어 들어가면
// 깨진 글자 그리려 시도. 그래서:
// 1) "Korean" 키워드 완전 제거 (Flux가 한국어 텍스트 만들려는 신호)
// 2) 한국어 topic/audience를 prompt에 직접 인라인 X
// 3) 부정문 "NO text" 약함 → "wordless" "no letters of any language" 같은 강한 표현 반복
// 4) "book cover" → "magazine cover art" (책 mockup 그리는 거 회피)

const NO_TEXT = `WORDLESS, no letters, no numbers, no characters, no glyphs, no symbols, no readable text of any language anywhere in the image. Pure visual artwork only.`;
const NO_BOOK_OBJECT = `flat 2D artwork only, NO 3D book mockup, NO physical book, NO bound pages.`;

// 장르별 표지 시각 컨셉 — 책 유형에 따라 분위기 분기. topic은 prompt에 직접 사용 X.
function coverPromptByGenre(p: BookProject): string {
  const base = `Square 1:1 magazine cover art, premium editorial design. ${NO_TEXT} ${NO_BOOK_OBJECT}`;

  switch (p.type) {
    case "자기계발서":
      return `${base} Powerful upward arrow, mountain peak, or rising line graph as central abstract element. Warm orange (#f97316) on cream/white background. Bold geometric shapes. Confident motivational mood.`;

    case "재테크":
      return `${base} Abstract financial chart pattern — upward trending line graph, geometric coin silhouette, or vault icon. Deep navy + gold OR white + emerald palette. Banking professional aesthetic. Geometric and serious.`;

    case "에세이":
      return `${base} Soft watercolor wash, single botanical element (leaf, branch, single flower silhouette), or atmospheric landscape silhouette. Muted earthy palette (sage, terracotta, cream). Quiet contemplative mood. Hand-drawn illustration style.`;

    case "웹소설":
      return `${base} Single dramatic character silhouette OR evocative cinematic scene, mood lighting, vivid color contrast. Webtoon-influenced painterly illustration. Story-rich dramatic atmosphere.`;

    case "전문서":
      return `${base} Geometric grid composition, single conceptual diagram or symbolic icon (network, atom, abstract graph). Cool palette: deep blue, charcoal, white. Authoritative academic mood. Minimalist structured layout.`;

    case "매뉴얼":
      return `${base} Schematic exploded-view diagram of generic tool, blueprint aesthetic, fine line work. Monochrome with single safety-orange (#f97316) accent. Functional clear technical drawing.`;

    case "실용서":
    default:
      return `${base} Modern minimalist composition, single bold geometric or symbolic icon centered. Clean white background, single accent color (orange #f97316). Editorial design.`;
  }
}

export function imagePrompt(type: KmongImageType, p: BookProject): string {
  switch (type) {
    case "cover":
      return coverPromptByGenre(p);

    case "thumb":
      return `Square 1:1 ebook marketplace thumbnail. Bold central visual metaphor — abstract icon or geometric shape representing growth/learning/insight. Bright color contrast with orange (#f97316) accent. Professional publishing aesthetic. ${NO_TEXT}`;

    case "toc":
      return `Square 1:1 abstract structural infographic. Vertical stack of horizontal lines or bars suggesting a hierarchical list, with subtle thin dividers. White background, monochrome with orange (#f97316) accent dots. Clean editorial. ${NO_TEXT}`;

    case "spec":
      return `Square 1:1 minimalist file format icon composition. Document icons (folded corner page shapes), grid layout, hairline borders. Modern flat design. Monochrome with single orange (#f97316) accent. Premium professional. ${NO_TEXT}`;

    case "audience":
      return `Square 1:1 friendly persona illustration. Single warm character portrait — head and shoulders, simple line illustration style, neutral expression. Soft warm palette (peach, cream, sage). White background. Modern editorial illustration. ${NO_TEXT}`;

    case "preview":
      return `Square 1:1 minimal flat-lay scene of an open paper book on a clean wooden desk, soft natural lighting from a side window, a small coffee cup nearby. Editorial product photography style. Pages visible but blurred — pure visual atmosphere. ${NO_TEXT}`;
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

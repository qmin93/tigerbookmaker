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
export function imagePrompt(type: KmongImageType, p: BookProject): string {
  const topic = p.topic.slice(0, 80);
  const audience = p.audience.slice(0, 50);

  switch (type) {
    case "cover":
      return `Modern minimalist Korean book cover design. Topic: "${topic}". Big bold typography centered, clean white background with single accent color (orange #f97316). Premium publishing aesthetic. Editorial design. Square 1:1. NO photo realism, NO complex illustration. Just typography + minimal geometric accent.`;

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

/**
 * AI 표지 이미지 prompt 합성기 (AI 이미지 시스템 통합 설계, Section 3.3).
 *
 * 설계 결정 — 왜 이 분리인가?
 *   - GENRE_MAP(`lib/cover-style-map.ts`)은 장르별 톤/사진키워드/추천 레이아웃을 선언만 한다.
 *   - 실제 OpenAI gpt-image-1로 보낼 영문 prompt 조립은 server-only 헬퍼인 이 파일에서 책임진다.
 *   - 한국어 책 주제(bookTopic)는 그대로 prompt에 넣되, AI는 "translate the concept into visuals,
 *     not the literal text" 지시를 받는다. 한글 폰트 렌더링은 AI가 못 하므로 Sharp가 별도 합성.
 *   - 레이아웃 키는 prompt 안에서 "structural instruction" 문장으로 풀어 쓴다.
 *     (예: full-bleed photo / split layout / isolated subject / abstract geometry)
 *   - negative 조건은 항상 강제: "no Korean text, no characters, no readable text".
 *
 * 사용처:
 *   - PR #2 이후 `app/api/generate/cover-variations/route.ts` 에서 호출.
 *   - 현재 PR(#1)에서는 export만 추가. 호출 측은 다음 PR에서 연결한다.
 */

import "server-only";
import {
  GENRE_MAP,
  type BookGenre,
  type LayoutKey,
} from "../cover-style-map";

export interface ComposePromptInput {
  /** 책 장르. GENRE_MAP의 키. */
  genre: BookGenre;
  /** 선택된 레이아웃 키. 보통 GENRE_MAP[genre].layouts에서 고른다. */
  layoutKey: LayoutKey;
  /** 사용자가 입력한 책 주제 (한국어 가능). */
  bookTopic: string;
  /** 선택. 대상 독자(한국어 가능). */
  bookAudience?: string;
  /** 선택. 출력 비율. default "3:4" (책 표지). */
  aspectRatio?: "3:4" | "1:1" | "9:16" | "16:9";
}

/**
 * GENRE_MAP + 레이아웃 + 책 주제로 영문 AI prompt 1개를 합성한다.
 *
 * @example
 *   composeCoverPrompt({
 *     genre: "self-dev",
 *     layoutKey: "full-photo-gradient",
 *     bookTopic: "직장인 새벽 루틴으로 인생 바꾸기",
 *     bookAudience: "30대 직장인",
 *   })
 *   // => "Full-bleed photographic composition with gradient overlay and clear space ..."
 */
export function composeCoverPrompt(input: ComposePromptInput): string {
  const aspectRatio = input.aspectRatio ?? "3:4";
  const match = GENRE_MAP[input.genre];

  const layoutInstruction = describeLayout(input.layoutKey);
  const aspectHint = describeAspectRatio(aspectRatio);
  const photoDescription = match.photoKeywords.join(", ");
  const toneDescriptor = describeToneEn(input.genre);

  const audienceLine = input.bookAudience && input.bookAudience.trim()
    ? `Target audience: ${input.bookAudience.trim()}. `
    : "";

  // 책 주제는 verbatim으로 넣되, "translate into visuals" 지시를 함께 준다.
  // AI가 한국어 그대로를 그림에 그리는 것을 막기 위함.
  const topicLine =
    `Book concept (translate this concept into a visual scene, do NOT render the literal Korean text): ${input.bookTopic.trim()}.`;

  const prompt = [
    `${layoutInstruction}`,
    `Visual elements: ${photoDescription}.`,
    `Mood and tone: ${toneDescriptor}.`,
    `${audienceLine}${topicLine}`,
    `Composition aspect ratio target: ${aspectHint}.`,
    `Editorial book cover aesthetic, premium publishing quality, single bold focal point.`,
    // CRITICAL — Sharp composites the Korean title later, so AI must NOT draw any text.
    `ABSOLUTE NEGATIVE: no Korean text, no characters, no readable text, no letters, no numbers, no captions, no labels, no logos, no watermarks. The image must be wordless so a separate text overlay can be composited on top.`,
  ].join(" ");

  return prompt;
}

/**
 * 레이아웃 키 → 영문 구조 지시 문장.
 *
 * Sharp 텍스트 합성이 자연스럽게 들어갈 수 있도록 "여백" 정보를 명시한다.
 * 새 레이아웃이 LayoutKey에 추가되면 여기 한 줄도 같이 추가해야 한다 (exhaustive switch).
 */
function describeLayout(key: LayoutKey): string {
  switch (key) {
    case "full-photo-gradient":
      return "Full-bleed photographic composition with a soft gradient overlay; leave the lower third visually clean for text overlay.";
    case "penguin-minimal":
      return "Penguin Modern Classics style minimalist layout: a single bold color block with one small centered visual motif and generous negative space.";
    case "polaroid-zine":
      return "Polaroid / zine-inspired layered composition with paper texture and an off-center photo frame; leave the bottom strip empty for handwritten-style text.";
    case "cinematic-overlay":
      return "Cinematic wide-shot composition with a dark gradient overlay; dramatic key light, leave the top or bottom band empty for a title overlay.";
    case "bw-photo-accent":
      return "High-contrast black-and-white photographic composition with a single accent color highlight; leave clean space in one corner for text.";
    case "korean-modern":
      return "Modern Korean editorial layout: clean sans-serif aesthetic, vertical balance, restrained palette, leave a vertical strip empty for the title.";
    case "nature-serif":
      return "Nature-inspired serif editorial composition: botanical or landscape photograph with quiet negative space and elegant top-of-frame area for a title.";
    case "vintage-photo":
      return "Vintage-toned photograph with subtle film grain and warm color cast; leave the top band clean for a serif title overlay.";
    case "movie-poster":
      return "Cinematic movie-poster composition: dramatic silhouette or subject against a moody backdrop, vertical key-art framing, bottom third reserved for text.";
    case "wuxia-asian":
      return "Asian wuxia / cinematic Hong Kong noir composition: brushwork textures, dramatic ink-style lighting, vertical scroll-like framing with empty top area for a title.";
    case "photo-split":
      return "Split layout: half clean colored background, half photographic subject; the colored half is reserved for the title block.";
    case "character-illustration":
      return "Friendly character illustration centered against a soft background; flat-style illustration with breathing room on the top half for a title.";
    case "magazine-circular":
      return "Magazine-style circular badge composition: a focal subject inside a circular frame on a clean background, leaving space above and below for headline and subhead.";
    case "academic-journal":
      return "Academic journal cover layout: restrained typography-friendly grid, single abstract geometric motif centered, large quiet header band for the title.";
    case "academic-metaphor":
      return "Conceptual visual metaphor for an academic non-fiction cover: one strong symbolic object on a minimal background, leaving the upper half empty for a title.";
    case "academic-bignumber":
      return "Big-number editorial cover composition (Atomic Habits style): an oversized abstract numeric or geometric form as the focal element, with clean space around it for text.";
    case "brutalist":
      return "Brutalist graphic composition: blocky color planes, hard edges, off-grid composition, lots of empty negative space for text overlay.";
    case "manual-oreilly":
      return "O'Reilly-inspired manual cover: a single detailed animal or object illustration centered on a clean cream background with a colored header band reserved for the title.";
    case "manual-isometric":
      return "Isometric 3D illustration of tools or architecture on a flat background; the upper band stays clean for the manual title.";
    case "neon-cyberpunk":
      return "Neon cyberpunk cityscape or interface composition with deep blacks and electric accent colors; leave the bottom band darker for a title overlay.";
    case "minimal-tech":
      return "Minimal tech composition: monospace grid feel, one small terminal-cursor or code-bracket motif, vast negative space for the title.";
    case "pop-art":
      return "Roy Lichtenstein-inspired pop art composition: halftone Ben-Day dot pattern, saturated primary colors (red / yellow / blue), comic-style bold outlines, leave the lower third clean for a speech-bubble-style title slot.";
    case "graffiti":
      return "Urban graffiti / street art composition: spray-paint textures on a brick or concrete wall, drip effects, layered tags and stencils, leave one large blank panel reserved for a clean title overlay.";
    case "manga-comic":
      return "Japanese manga / comic page composition: speed lines, halftone screentone shading, dynamic angled paneling, dramatic black-and-white ink work with a single accent color and a clean dialog-box area for the title.";
    case "monocle-magazine":
      return "Monocle magazine editorial composition: confident sans-serif masthead area at the top, a single hero photograph below, refined color palette of cream, navy and burgundy, generous gutters and column structure.";
    case "glitch-vhs":
      return "Glitch VHS aesthetic composition: scanlines, RGB channel-shift, chromatic aberration, VHS tracking artifacts and tape noise, retro CRT vignette, leave a darker band along the bottom for a title overlay.";
    case "kpop-y2k":
      return "K-pop Y2K composition: holographic chrome gradients of hot pink, lavender and cyan, sparkle and star motifs, glossy bubble surfaces, leave a clean center block for a stylized title with metallic sheen aesthetic.";
    case "retro-80s":
      return "Retro 80s synthwave composition: sunset gradient from magenta to orange to deep purple, perspective neon grid horizon, chrome accents and palm silhouettes, leave the upper-center band clean for a chunky retro title.";
    case "botanical":
      return "Botanical editorial composition: soft watercolor leaves, eucalyptus and pampas, muted sage and cream palette, hand-drawn elegance, leave the center quiet for a delicate serif title.";
    case "kawaii-pastel":
      return "Kawaii pastel composition: soft pastel pinks, mint and butter yellow, rounded cloud and bunny / heart shapes, hand-illustrated charm, leave the lower band clean for a friendly rounded title.";
    case "collage-zine":
      return "Indie magazine collage / zine composition: torn paper edges, mixed photographic clippings on slightly rotated planes, masking-tape pieces, handwritten margin notes, leave one rectangular white sticker area reserved for the title.";
    case "practical-hands":
      return "Marie Kondo-style practical how-to composition: top half showing real hands at work on a clean desk or notebook with natural light, bottom half a clean white frosted-glass band reserved for a confident title and a small result badge.";
    case "practical-before-after":
      return "Before / after comparison composition: vertical split with the left side a desaturated 'before' scene and the right side a bright clean 'after' scene, a small circular badge centered on the split, lower band reserved for a bold title.";
  }
}

/**
 * 장르별 톤을 영문으로 풀어준다. UI 톤(GENRE_MAP[g].tone)은 한국어라 prompt에 그대로 못 넣는다.
 */
function describeToneEn(genre: BookGenre): string {
  switch (genre) {
    case "self-dev":
      return "warm, inspiring, hopeful, quietly determined";
    case "finance":
      return "bold, decisive, success-driven, sharp";
    case "essay":
      return "soft, reflective, nostalgic, emotionally intimate";
    case "novel":
      return "cinematic, dark, suspenseful, dramatic";
    case "practical":
      return "friendly, clear, trustworthy, approachable";
    case "academic":
      return "authoritative, precise, credible, restrained";
    case "manual":
      return "futuristic, precise, technical, confident";
  }
}

function describeAspectRatio(ar: "3:4" | "1:1" | "9:16" | "16:9"): string {
  switch (ar) {
    case "3:4":
      return "vertical book cover (taller than wide)";
    case "1:1":
      return "square";
    case "9:16":
      return "tall vertical (story / reels)";
    case "16:9":
      return "wide landscape";
  }
}

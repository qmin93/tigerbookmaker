/**
 * 장르 ↔ 표지 레이아웃 매칭 테이블 (AI 이미지 시스템 통합 설계, Section 3.2).
 *
 * 책 카테고리(자기계발/재테크/에세이/웹소설/실용서/전문서/매뉴얼)별로
 *   - 추천 레이아웃 3~4개
 *   - AI 이미지 prompt에 주입할 사진 키워드(영문)
 *   - UI 표시용 톤 설명(한글)
 * 을 한 곳에 모은다.
 *
 * 사용처:
 *   - `lib/server/cover-prompt-composer.ts` — AI prompt 합성에 photoKeywords / tone 주입
 *   - `app/api/generate/cover-variations/route.ts` — 자동 추천 3장 생성 시 layouts[0..2]
 *   - `components/write/CoverRecommendation.tsx` — 추천 톤 라벨 UI
 *
 * 레이아웃 키(LayoutKey)는 향후 PR #2(`lib/cover-templates/`)에서 정의될 40개 템플릿 키와 1:1 매칭된다.
 * 현재 PR #1에서는 spec Section 3.1/3.2에 등장한 키들을 string literal union으로 선언만 해 둔다.
 */

export type BookGenre =
  | "self-dev"
  | "finance"
  | "essay"
  | "novel"
  | "practical"
  | "academic"
  | "manual";

/**
 * Sharp + AI prompt 패턴이 결합된 표지 템플릿 키.
 *
 * Spec Section 3.1 (스타일 라이브러리 7 카테고리) + 3.2 (장르 매칭) 에서 등장한 키들을
 * 그대로 사용한다. PR #2에서 각 키마다 `lib/cover-templates/<key>.ts` 정의 파일이 추가된다.
 */
export type LayoutKey =
  // 자기계발 추천
  | "full-photo-gradient"
  | "penguin-minimal"
  | "polaroid-zine"
  // 재테크 추천
  | "cinematic-overlay"
  | "bw-photo-accent"
  | "korean-modern"
  // 에세이 추천
  | "nature-serif"
  | "vintage-photo"
  // 웹소설 추천
  | "movie-poster"
  | "wuxia-asian"
  // 실용서 추천
  | "photo-split"
  | "character-illustration"
  | "magazine-circular"
  // 전문서 추천 (베스트셀러 톤 강화)
  | "academic-journal"
  | "academic-metaphor"
  | "academic-bignumber"
  | "brutalist"
  // 매뉴얼 추천 (베스트셀러 톤 강화)
  | "manual-oreilly"
  | "manual-isometric"
  | "neon-cyberpunk"
  | "minimal-tech"
  // PR #2: BOLD 카테고리 확장
  | "pop-art"
  | "graffiti"
  | "manga-comic"
  // PR #2: EDITORIAL 카테고리 확장
  | "monocle-magazine"
  // PR #2: TECH 카테고리 확장
  | "glitch-vhs"
  // PR #2: RETRO 카테고리
  | "kpop-y2k"
  | "retro-80s"
  // PR #2: SOFT 카테고리
  | "botanical"
  | "kawaii-pastel"
  // PR #2: EXPERIMENTAL 카테고리 확장
  | "collage-zine"
  // PR #2: 실용서 베스트셀러 톤 (Marie Kondo / Notion 가이드북)
  | "practical-hands"
  | "practical-before-after";

export interface GenreMatch {
  /** 추천 레이아웃 (자동 추천 시 앞에서 3개를 사용) */
  layouts: LayoutKey[];
  /** AI 이미지 prompt에 주입할 사진 키워드 (영문) */
  photoKeywords: string[];
  /** UI 노출용 톤 설명 (한글) */
  tone: string;
}

/**
 * Spec Section 3.2 원본 매핑 테이블. 키/값은 spec과 완전 동일하다.
 * 수정 시 반드시 spec(`docs/superpowers/specs/2026-05-13-ai-image-system-design.md`)도 함께 갱신할 것.
 */
const GENRE_MAP: Record<BookGenre, GenreMatch> = {
  "self-dev": {
    layouts: ["full-photo-gradient", "penguin-minimal", "polaroid-zine"],
    photoKeywords: ["sunrise", "morning coffee", "routine", "calm light"],
    tone: "따뜻 / 영감 / 의지",
  },
  finance: {
    layouts: ["cinematic-overlay", "bw-photo-accent", "korean-modern"],
    photoKeywords: ["city skyline", "finance charts", "night lights", "abstract data"],
    tone: "강렬 / 결단 / 성공",
  },
  essay: {
    layouts: ["polaroid-zine", "nature-serif", "vintage-photo"],
    photoKeywords: ["solitude", "empty room", "B&W moments", "window light"],
    tone: "부드러움 / 회상 / 감정",
  },
  novel: {
    layouts: ["movie-poster", "cinematic-overlay", "wuxia-asian"],
    photoKeywords: ["rainy night", "city noir", "silhouette", "dramatic light"],
    tone: "시네마틱 / 어두움 / 긴장",
  },
  practical: {
    layouts: ["photo-split", "character-illustration", "magazine-circular"],
    photoKeywords: ["workspace", "tools", "clean desk", "hands working"],
    tone: "친근 / 명확 / 신뢰",
  },
  academic: {
    layouts: [
      "academic-journal",
      "academic-metaphor",
      "academic-bignumber",
      "brutalist",
    ],
    photoKeywords: ["abstract geometry", "minimal patterns"],
    tone: "권위 / 정밀 / 신뢰",
  },
  manual: {
    layouts: [
      "manual-oreilly",
      "manual-isometric",
      "neon-cyberpunk",
      "minimal-tech",
    ],
    photoKeywords: ["code editor", "tools", "isometric architecture"],
    tone: "미래 / 정밀 / 테크",
  },
};

/** 알 수 없는 장르가 들어오면 가장 범용적인 self-dev 매칭으로 fallback. */
export function getMatchForGenre(genre: BookGenre): GenreMatch {
  return GENRE_MAP[genre] ?? GENRE_MAP["self-dev"];
}

/** 등록된 모든 장르 키 목록. UI 셀렉터 등에서 사용. */
export function getAllGenres(): BookGenre[] {
  return Object.keys(GENRE_MAP) as BookGenre[];
}

const GENRE_LABEL_KO: Record<BookGenre, string> = {
  "self-dev": "자기계발서",
  finance: "재테크",
  essay: "에세이",
  novel: "웹소설",
  practical: "실용서",
  academic: "전문서",
  manual: "매뉴얼",
};

/** UI 표시용 한글 라벨. */
export function genreLabelKo(genre: BookGenre): string {
  return GENRE_LABEL_KO[genre] ?? genre;
}

export { GENRE_MAP };

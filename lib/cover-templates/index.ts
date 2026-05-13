/**
 * 표지 템플릿 레지스트리 (AI 이미지 시스템 통합 설계, Section 3.1).
 *
 * - `COVER_TEMPLATES` — 모든 LayoutKey 에 대한 CoverTemplate 정의의 단일 출처.
 * - `getTemplate(key)` — 안전한 조회 (정의 없으면 undefined).
 * - `getAllTemplateKeys()` — 정의되어 있는 키 목록.
 *
 * v1 우선순위 24개 — 각 카테고리 핵심 + 베스트셀러 톤. spec Section 6.1 결정 그대로.
 */

import type { LayoutKey } from "../cover-style-map";
import type { CoverTemplate } from "./types";

// BOLD
import { brutalist } from "./templates/bold/brutalist";
import { popArt } from "./templates/bold/pop-art";
import { graffiti } from "./templates/bold/graffiti";
import { mangaComic } from "./templates/bold/manga-comic";

// EDITORIAL
import { penguinMinimal } from "./templates/editorial/penguin-minimal";
import { monocleMagazine } from "./templates/editorial/monocle-magazine";
import { academicJournal } from "./templates/editorial/academic-journal";

// TECH
import { neonCyberpunk } from "./templates/tech/neon-cyberpunk";
import { minimalTech } from "./templates/tech/minimal-tech";
import { glitchVhs } from "./templates/tech/glitch-vhs";

// CULTURAL
import { koreanModern } from "./templates/cultural/korean-modern";
import { wuxiaAsian } from "./templates/cultural/wuxia-asian";

// RETRO
import { kpopY2k } from "./templates/retro/kpop-y2k";
import { retro80s } from "./templates/retro/retro-80s";

// SOFT
import { botanical } from "./templates/soft/botanical";
import { kawaiiPastel } from "./templates/soft/kawaii-pastel";

// EXPERIMENTAL
import { moviePoster } from "./templates/experimental/movie-poster";
import { collageZine } from "./templates/experimental/collage-zine";

// BESTSELLER — academic
import { academicMetaphor } from "./templates/bestseller-academic/academic-metaphor";
import { academicBignumber } from "./templates/bestseller-academic/academic-bignumber";

// BESTSELLER — manual
import { manualOreilly } from "./templates/bestseller-manual/manual-oreilly";
import { manualIsometric } from "./templates/bestseller-manual/manual-isometric";

// BESTSELLER — practical
import { practicalHands } from "./templates/bestseller-practical/practical-hands";
import { practicalBeforeAfter } from "./templates/bestseller-practical/practical-before-after";

/**
 * v1 우선순위 24 템플릿.
 *
 * Partial<Record<LayoutKey, _>> 인 이유: `LayoutKey` union 에는 PR #2 에서 다루지 않는 키들도 있다
 * (full-photo-gradient, polaroid-zine, cinematic-overlay, bw-photo-accent, nature-serif, vintage-photo,
 *  photo-split, character-illustration, magazine-circular). 이들은 v1.5/v2 에서 채워진다.
 */
export const COVER_TEMPLATES: Partial<Record<LayoutKey, CoverTemplate>> = {
  // BOLD (4)
  "brutalist": brutalist,
  "pop-art": popArt,
  "graffiti": graffiti,
  "manga-comic": mangaComic,
  // EDITORIAL (3)
  "penguin-minimal": penguinMinimal,
  "monocle-magazine": monocleMagazine,
  "academic-journal": academicJournal,
  // TECH (3)
  "neon-cyberpunk": neonCyberpunk,
  "minimal-tech": minimalTech,
  "glitch-vhs": glitchVhs,
  // CULTURAL (2)
  "korean-modern": koreanModern,
  "wuxia-asian": wuxiaAsian,
  // RETRO (2)
  "kpop-y2k": kpopY2k,
  "retro-80s": retro80s,
  // SOFT (2)
  "botanical": botanical,
  "kawaii-pastel": kawaiiPastel,
  // EXPERIMENTAL (2)
  "movie-poster": moviePoster,
  "collage-zine": collageZine,
  // BESTSELLER — academic (2)
  "academic-metaphor": academicMetaphor,
  "academic-bignumber": academicBignumber,
  // BESTSELLER — manual (2)
  "manual-oreilly": manualOreilly,
  "manual-isometric": manualIsometric,
  // BESTSELLER — practical (2)
  "practical-hands": practicalHands,
  "practical-before-after": practicalBeforeAfter,
};

/** 안전한 lookup. 미정의 키는 undefined. */
export function getTemplate(key: LayoutKey): CoverTemplate | undefined {
  return COVER_TEMPLATES[key];
}

/** v1 에서 정의된 템플릿 키 목록. */
export function getAllTemplateKeys(): LayoutKey[] {
  return Object.keys(COVER_TEMPLATES) as LayoutKey[];
}

export type { CoverTemplate } from "./types";
export type {
  OverlayConfig,
  OverlayTextBlock,
  OverlayDecoration,
  OverlayBackground,
  OverlayFontSpec,
  OverlayPosition,
  CoverCategory,
} from "./types";

/**
 * 표지 템플릿 타입 정의 (AI 이미지 시스템 통합 설계, Section 3.1 + 3.5).
 *
 * 각 `LayoutKey` 마다 다음 두 가지가 한 쌍으로 묶여 있다:
 *   1. AI 이미지 prompt 힌트(`promptHint`) — `cover-prompt-composer.ts`가 사용
 *   2. Sharp 텍스트 합성 설정(`overlay`) — `lib/server/image-overlay.ts`가 사용
 *
 * 좌표계 규약:
 *   - 모든 position 은 9-grid 영역 + bleed 변형. anchor 점은 그 영역의 기준점.
 *   - offsetPx 는 (x, y) 픽셀 단위 보정. position 기준점에서 더해진다.
 *   - sizeRatio 는 0~1 정규화 (캔버스 width 기준).
 *
 * 변경 영향:
 *   - 새 필드 추가 시 `lib/server/image-overlay.ts` 의 SVG 합성 로직도 함께 갱신해야 한다.
 *   - 모든 템플릿은 한글 텍스트가 들어갈 수 있도록 Pretendard 폰트를 가정한다.
 */

import type { BookGenre, LayoutKey } from "../cover-style-map";

export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-bleed"
  | "bottom-bleed";

export interface OverlayFontSpec {
  /** Pretendard 700 = Bold, 800 = ExtraBold, 900 = Black. */
  weight: 400 | 500 | 600 | 700 | 800 | 900;
  /** 폰트 크기. 캔버스 너비 대비 비율(0~1). 0.06 = 캔버스 너비의 6%. */
  sizeRatio: number;
  /** 폰트 패밀리. default "Pretendard, sans-serif". */
  family?: string;
  /** 이탤릭 여부. default false. */
  italic?: boolean;
}

export interface OverlayTextBlock {
  field: "title" | "subtitle" | "author" | "badge" | "series" | "publisher" | "tagline";
  position: OverlayPosition;
  offsetPx?: [number, number];
  font: OverlayFontSpec;
  color: string;
  maxWidth?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
  shadow?: string;
  align?: "start" | "middle" | "end";
}

export interface OverlayBackground {
  area: "full" | "bottom-half" | "top-half" | "bottom-third" | "top-third";
  gradient?: string;
  color?: string;
  opacity?: number;
  cornerRadiusPx?: number;
}

export interface OverlayDecoration {
  type: "divider-line" | "badge-pill" | "circle" | "frame-border";
  position: OverlayPosition;
  size?: { width?: number; height?: number };
  color: string;
  offsetPx?: [number, number];
}

export interface OverlayConfig {
  textBlocks: OverlayTextBlock[];
  background?: OverlayBackground;
  decorations?: OverlayDecoration[];
}

export type CoverCategory =
  | "BOLD"
  | "EDITORIAL"
  | "TECH"
  | "CULTURAL"
  | "RETRO"
  | "SOFT"
  | "EXPERIMENTAL"
  | "BESTSELLER";

export interface CoverTemplate {
  /** `LayoutKey` 와 동일한 식별자. URL/저장 키로 사용. */
  key: LayoutKey;
  /** UI 갤러리에 노출되는 한글 라벨. */
  label: string;
  /** 7+1 카테고리 중 하나. */
  category: CoverCategory;
  /** UI 갤러리 카드에 노출되는 한글 한 줄 설명. */
  description: string;
  /** AI 이미지 prompt 에 합쳐질 영문 힌트. */
  promptHint: string;
  /** Sharp 합성 설정. */
  overlay: OverlayConfig;
  /** 자동 추천 정렬 우선순위에 쓰이는 장르 태그. */
  recommendedFor: BookGenre[];
}

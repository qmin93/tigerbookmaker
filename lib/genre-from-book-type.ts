/**
 * 한글 책 type → BookGenre 매핑.
 *
 * `project.type` (책 만들 때 사용자가 고르는 한글 라벨, 예: "실용서", "자기계발서") 을
 * `lib/cover-style-map.ts` 의 `BookGenre` union 으로 변환한다.
 *
 * Spec PR #3 (`docs/superpowers/specs/2026-05-13-ai-image-system-design.md` 3.4) 의
 * 매핑 규약을 그대로 구현. 알려지지 않은 한글 라벨(요리책/여행기/매거진/포트폴리오 등) 은
 * 가장 범용적인 "practical" 로 fallback.
 */

import type { BookGenre } from "./cover-style-map";

const BOOK_TYPE_TO_GENRE: Record<string, BookGenre> = {
  자기계발서: "self-dev",
  재테크: "finance",
  에세이: "essay",
  웹소설: "novel",
  동화: "novel",
  실용서: "practical",
  전문서: "academic",
  매뉴얼: "manual",
};

/**
 * 한글 책 type 라벨을 BookGenre 로 변환. 알 수 없는 라벨은 "practical" fallback.
 *
 * @example
 *   genreFromBookType("실용서")     // "practical"
 *   genreFromBookType("자기계발서") // "self-dev"
 *   genreFromBookType("요리책")     // "practical" (fallback)
 *   genreFromBookType(undefined)    // "practical"
 */
export function genreFromBookType(bookType: string | null | undefined): BookGenre {
  if (!bookType) return "practical";
  return BOOK_TYPE_TO_GENRE[bookType] ?? "practical";
}

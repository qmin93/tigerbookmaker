// 예제 책 fork 데이터 (v3 Phase 3.1)
// /examples 페이지에서 "이 책으로 시작 →" 클릭 → /new?fork=<id>
// /new 페이지가 이 id로 prefill할 topic/audience/type 조회.
//
// fork = 카피 아님. 새 프로젝트 form prefill일 뿐.
// 사용자는 본인 주제로 자유롭게 바꿔 만든다.

import type { BookType } from "@/lib/templates";
import type { ThemeColorKey } from "@/lib/storage";

export interface ExampleFork {
  id: string;
  /** /new form의 topic 필드 prefill */
  topic: string;
  /** /new form의 audience 필드 prefill */
  audience: string;
  /** /new form의 type 필드 prefill */
  type: BookType;
  /** /new form의 themeColor prefill — 장르에 어울리는 색 */
  themeColor: ThemeColorKey;
  /** /new form의 targetPages prefill */
  targetPages: number;
}

// /examples 페이지의 EXAMPLES 순서와 일치 (SAMPLE_BOOKS slice(0,5))
// id = `example-${idx+1}` (1-indexed)
export const EXAMPLE_FORKS: Record<string, ExampleFork> = {
  "example-1": {
    id: "example-1",
    topic: "아침 루틴, 30일이면 인생이 바뀝니다",
    audience: "번아웃 직전의 30대 직장인",
    type: "자기계발서",
    themeColor: "orange",
    targetPages: 65,
  },
  "example-2": {
    id: "example-2",
    topic: "월급만으로 부족함을 느끼나요",
    audience: "재테크 처음 시작하는 30대",
    type: "재테크",
    themeColor: "blue",
    targetPages: 70,
  },
  "example-3": {
    id: "example-3",
    topic: "나는 그래서 회사를 그만뒀습니다",
    audience: "퇴사를 고민하는 직장인",
    type: "에세이",
    themeColor: "slate",
    targetPages: 88,
  },
  "example-4": {
    id: "example-4",
    topic: "그날 밤, 도시에 비가 내렸다",
    audience: "추리·도시 미스터리 좋아하는 독자",
    type: "웹소설",
    themeColor: "indigo",
    targetPages: 110,
  },
  "example-5": {
    id: "example-5",
    topic: "행동경제학 실무 입문",
    audience: "기획·마케팅 실무 3~7년차",
    type: "전문서",
    themeColor: "slate",
    targetPages: 95,
  },
};

export function getExampleFork(id: string | null | undefined): ExampleFork | null {
  if (!id) return null;
  return EXAMPLE_FORKS[id] ?? null;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  placeholder: string;
  hint?: string;
}

// AI 동적 인터뷰 — 첫 질문만 universal hardcoded.
// 나머지는 /api/generate/interview-question 서버 호출로 동적 생성.
export const FIRST_QUESTION: InterviewQuestion = {
  id: "core_message",
  question: "이 책의 핵심 메시지를 한 문장으로 알려주세요.",
  placeholder: "예: 회사 그만두지 말고 사이드로 시작해라",
  hint: "독자가 책 한 권 다 읽고 단 한 줄만 기억한다면 그 한 줄.",
};

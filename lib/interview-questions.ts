export interface InterviewQuestion {
  id: string;
  question: string;
  placeholder: string;
  hint?: string;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: "core_message",
    question: "이 책의 핵심 메시지를 한 문장으로 알려주세요.",
    placeholder: "예: 회사 그만두지 말고 사이드로 시작해라",
    hint: "독자가 책 한 권 다 읽고 단 한 줄만 기억한다면 그 한 줄.",
  },
  {
    id: "reader_change",
    question: "독자가 다 읽고 어떤 행동·변화를 하면 성공인가요?",
    placeholder: "예: 첫 사이드 프로젝트 주말에 시작 / 본인 강점 한 가지 발견 / 자신감 회복",
    hint: "구체적인 행동 변화 1~3가지. 추상적이지 않게.",
  },
  {
    id: "personal_stories",
    question: "본인의 인상적인 경험·실패·성공 사례를 1~3개 알려주세요.",
    placeholder: "예: 2022년 3월, 부장님 앞에서 사이드 프로젝트 발각, 월급 깎임. 한 달 후 그 프로젝트가 본업 매출 절반 만듦.",
    hint: "구체적일수록 좋습니다 (시간·장소·금액·인물). 책 본문에 그대로 활용됩니다.",
  },
  {
    id: "skip_topics",
    question: "독자가 이미 잘 알고 있어서 책에서 건너뛸 내용은?",
    placeholder: "예: 사이드 프로젝트가 좋다는 일반론, 노션·피그마 사용법",
    hint: "당연한 얘기를 또 쓰면 책이 지루해집니다.",
  },
  {
    id: "differentiation",
    question: "이 책이 다른 비슷한 책과 다른 점은? (관점·접근·톤)",
    placeholder: "예: 직장 안 그만두는 전제. 9시 퇴근 후 2시간 활용 중심. 친한 형 말투.",
    hint: "차별화 포인트가 책 전체 톤과 구조를 결정합니다.",
  },
  {
    id: "references",
    question: "참고하고 싶은 책·유튜버·인물 있다면?",
    placeholder: "예: 책 '나는 4시간만 일한다' / 유튜버 '신사임당' / 인물 '폴 그레이엄'",
    hint: "이 책의 톤과 구조 참고용. 그대로 베끼는 건 아님.",
  },
  {
    id: "must_include",
    question: "책에 꼭 들어가야 할 단어·문구·예시·일화가 있나요?",
    placeholder: "예: '본업도 사이드도 다 잡는 사람이 진짜 강하다' / 본인의 첫 매출 100만원 일화",
    hint: "본인만 쓸 수 있는 표현이나 사례를 넣으면 책이 살아납니다.",
  },
];

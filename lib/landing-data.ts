// 7장르 × 1권. GenreBookCard의 CoverDesign이 장르 보고 자동 다른 디자인.
// 실제 png cover 안 씀 (디자인 다양성 위해 SVG 통일).
export const SAMPLE_BOOKS = [
  {
    title: "아침 루틴, 30일이면 인생이 바뀝니다",
    subtitle: "새벽 5시에 일어나는 사람의 진짜 비밀",
    audience: "번아웃 직전의 30대 직장인",
    category: "자기계발서" as const,
    chapters: 12,
    pages: 65,
  },
  {
    title: "월급만으로 부족함을 느끼나요",
    subtitle: "재테크의 시작은 자산 흐름을 보는 일",
    audience: "재테크 처음 시작하는 30대",
    category: "재테크" as const,
    chapters: 12,
    pages: 70,
  },
  {
    title: "나는 그래서 회사를 그만뒀습니다",
    subtitle: "13년 직장인이 쓴 첫 1년 기록",
    audience: "퇴사를 고민하는 직장인",
    category: "에세이" as const,
    chapters: 14,
    pages: 88,
  },
  {
    title: "그날 밤, 도시에 비가 내렸다",
    subtitle: "사라진 그를 찾는 일주일의 기록",
    audience: "추리·도시 미스터리 좋아하는 독자",
    category: "웹소설" as const,
    chapters: 15,
    pages: 110,
  },
  {
    title: "행동경제학 실무 입문",
    subtitle: "마케팅·UX·정책 결정에 쓰는 30가지 원칙",
    audience: "기획·마케팅 실무 3~7년차",
    category: "전문서" as const,
    chapters: 13,
    pages: 95,
  },
  {
    title: "Claude Code 협업 매뉴얼",
    subtitle: "팀 도입부터 코드 리뷰까지 표준 절차",
    audience: "5~20명 개발팀 리드",
    category: "매뉴얼" as const,
    chapters: 11,
    pages: 72,
  },
  {
    title: "노션으로 1인 사업 시작하기",
    subtitle: "외주 없이 한 달에 매출 300만원",
    audience: "1인 사업 준비 30대 직장인",
    category: "실용서" as const,
    chapters: 12,
    pages: 60,
  },
];

// 충전 패키지 — bonus 값은 /api/payment/prepare calcBonus()와 일치해야 함
// (서버: 30K → 5%, 50K → 10%; 그 외 0)
// 가격 정책 (Sang-nim 10x 인상, 2026-05): 권당 비용이 ₩4K~₩12K로 인상되어 desc 재계산
export const PRICING = [
  { amount: 5_000,  bonus: 0,     label: "스타터",   desc: "라이트 1권 또는 부가기능 시도",       featured: false as const },
  { amount: 10_000, bonus: 0,     label: "베이직",   desc: "라이트 2권 또는 표준 1권",           featured: false as const },
  { amount: 30_000, bonus: 1_500, label: "그로스",   desc: "표준 4권 또는 풀 2권 + 5% 보너스",   featured: true  as const },
  { amount: 50_000, bonus: 5_000, label: "프리미엄", desc: "표준 6-7권 또는 풀 4권 + 10% 보너스", featured: false as const },
];

export const TIER_CARDS = [
  { id: "basic",   emoji: "🌱", name: "베이직",   price: 500,   blurb: "빠른 초안. 가성비 최강.",          audience: "실용서, 회사 매뉴얼, 빠른 초안" },
  { id: "pro",     emoji: "⭐", name: "프로",     price: 1500,  blurb: "한국어 품질 균형. 베스트 셀러.",   audience: "자기계발서, 일반 출간, 크몽 등록", featured: true as const },
  { id: "premium", emoji: "🌟", name: "프리미엄", price: 7000,  blurb: "작가급 한국어. 출간용 완성도.",    audience: "에세이, 소설, 출판사 제출용" },
];

export const HERO_STATS = [
  { value: "30분", label: "권당 집필" },
  { value: "₩4,000~", label: "권당 평균 비용" },
  { value: "RAG", label: "내 자료 학습" },
  { value: "8가지", label: "내장 기능" },
  { value: "100%", label: "환불 보장" },
  { value: "₩5,000", label: "신규 크레딧" },
];

export const TRUST_ITEMS = [
  { title: "토스 안전결제", body: "PG 표준 보안 — 카드정보 우리 서버 비저장. 영수증 자동 발행." },
  { title: "잔액 환불 보장", body: "사용 안 한 잔액은 7일 내 100% 환불. 카드 등록·정기결제 없음." },
  { title: "개인정보 분리", body: "본문 데이터는 본인 계정에만. AI 학습 데이터로 사용 안 함." },
  { title: "장애 시 자동 환불", body: "AI 호출 실패하면 차감 안 됨. 본문 일부만 받았으면 자동 정정." },
];

export const PERFORMANCE_METRICS = [
  { value: "₩4,000~", label: "권당 평균 원가", note: "라이트 시나리오" },
  { value: "30s", label: "챕터당 평균 시간", note: "본문 + 요약 동시" },
  { value: "13ch", label: "권당 챕터 수", note: "목차 자동 생성" },
  { value: "100%", label: "성공률", note: "실패 시 자동 재시도" },
];

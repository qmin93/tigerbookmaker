export const SAMPLE_BOOKS = [
  {
    cover: "/samples/book-1-cover.png",
    title: "직장인을 위한 Claude Code 입문",
    subtitle: "첫 자동화 봇 30분에 만들기",
    audience: "개발 경험이 없는 직장인",
    category: "실용서",
    chapters: 12,
    pages: 63,
  },
  {
    cover: "/samples/book-2-cover.png",
    title: "노션으로 1인 사업 시작하기",
    subtitle: "외주 없이 한 달에 매출 300만원",
    audience: "1인 사업을 준비하는 30대 직장인",
    category: "실용서",
    chapters: 12,
    pages: 60,
  },
];

export const PRICING = [
  { amount: 1_000,  bonus: 0,     label: "최소" },
  { amount: 5_000,  bonus: 0,     label: "책 1.5권" },
  { amount: 10_000, bonus: 0,     label: "책 3권" },
  { amount: 30_000, bonus: 1_500, label: "책 10권", featured: true as const },
  { amount: 50_000, bonus: 5_000, label: "책 18권" },
];

export const TIER_CARDS = [
  { id: "basic",   emoji: "🌱", name: "베이직",   price: 500,   blurb: "빠른 초안. 가성비 최강.",          audience: "실용서, 회사 매뉴얼, 빠른 초안" },
  { id: "pro",     emoji: "⭐", name: "프로",     price: 1500,  blurb: "한국어 품질 균형. 베스트 셀러.",   audience: "자기계발서, 일반 출간, 크몽 등록", featured: true as const },
  { id: "premium", emoji: "🌟", name: "프리미엄", price: 7000,  blurb: "작가급 한국어. 출간용 완성도.",    audience: "에세이, 소설, 출판사 제출용" },
];

export const HERO_STATS = [
  { value: "30분", label: "권당 집필" },
  { value: "₩263", label: "권당 평균 비용" },
  { value: "13장", label: "자동 일관성" },
  { value: "12pt", label: "본문 표준" },
  { value: "100%", label: "환불 보장" },
  { value: "₩1,000", label: "신규 보너스" },
];

export const TRUST_ITEMS = [
  { title: "토스 안전결제", body: "PG 표준 보안 — 카드정보 우리 서버 비저장. 영수증 자동 발행." },
  { title: "잔액 환불 보장", body: "사용 안 한 잔액은 7일 내 100% 환불. 카드 등록·정기결제 없음." },
  { title: "개인정보 분리", body: "본문 데이터는 본인 계정에만. AI 학습 데이터로 사용 안 함." },
  { title: "장애 시 자동 환불", body: "AI 호출 실패하면 차감 안 됨. 본문 일부만 받았으면 자동 정정." },
];

export const PERFORMANCE_METRICS = [
  { value: "₩263", label: "권당 평균 원가", note: "Gemini Flash 기준" },
  { value: "30s", label: "챕터당 평균 시간", note: "본문 + 요약 동시" },
  { value: "13ch", label: "권당 챕터 수", note: "목차 자동 생성" },
  { value: "100%", label: "성공률", note: "실패 시 자동 재시도" },
];

import type { AIConfig, Provider } from "./ai";

export interface BookChapter {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  summary?: string;
  images: { placeholder: string; dataUrl?: string; caption?: string; alt?: string }[];
}

export interface ReferencesSummary {
  keyPoints: string[];
  coveredTopics: string[];
  gaps: string[];
  generatedAt: number;
  basedOnChunkCount: number;
}

export type TonePreset =
  | "friendly"
  | "professional"
  | "storytelling"
  | "lecture"
  | "essay"
  | "self-help";

export interface ToneSetting {
  mode: "auto" | "preset" | "reference-book";
  preset?: TonePreset;
  referenceBookExcerpt?: string;
  finalTone: string;
  generatedAt: number;
}

export type ThemeColorKey = "orange" | "blue" | "green" | "purple" | "red" | "gray";

export interface MarketingMeta {
  tagline?: string;
  description?: string;
  authorName?: string;
  authorBio?: string;
  ctaButtons?: Array<{ label: string; url: string }>;
  generatedAt?: number;
}

export interface MetaAdImage {
  type: "feed" | "story" | "link";
  aspectRatio: "1:1" | "9:16" | "16:9";
  base64: string;
  vendor: string;
  generatedAt: number;
  template?: string;          // Wave 3: SVG overlay template (minimal/bold/story/quote/cta)
}

export interface RepurposedContent {
  instagram?: {
    cards: Array<{ slideNum: number; title: string; body: string; designNote: string }>;
    caption: string;
    hashtags: string[];
    generatedAt: number;
  };
  youtube?: {
    title: string;
    script: string;          // 1-3분 분량
    thumbnailConcept: string; // 디자이너용 가이드
    chapterMarkers: Array<{ time: string; label: string }>;
    description: string;
    tags: string[];
    generatedAt: number;
  };
  blog?: {
    posts: Array<{
      order: number;
      title: string;
      body: string;          // 마크다운 1500자
      excerpt: string;
      tags: string[];
    }>;
    seriesTitle: string;
    generatedAt: number;
  };
  email?: {
    series: Array<{
      day: number;           // 1, 4, 8, 14
      subject: string;
      preheader: string;
      body: string;          // HTML-safe text
      cta: string;
    }>;
    generatedAt: number;
  };
  kakao?: {
    messages: Array<{
      order: number;
      hook: string;          // 짧은 후킹 (한 줄)
      body: string;          // 본문 (200자 이내)
      cta: string;
    }>;
    generatedAt: number;
  };
}

// Wave B3: 카드뉴스 인포그래픽 (Sharp 기반, AI 호출 X)
export interface InfographicSlide {
  slideNum: number;          // 1, 2, 3, 4, 5
  base64: string;            // 1080x1080 PNG
}

export interface Infographic {
  template: "minimal" | "bold" | "dark";
  slides: InfographicSlide[];   // 5장
  generatedAt: number;
}

export interface MetaAdPackage {
  headlines: string[];          // 3개, 각 ≤40자
  primaryTexts: string[];       // 3개, 각 ≤125자
  ctaButtons: string[];         // Meta 미리 정의된 한글 라벨 추천 (3~5개)
  audienceSuggestion: {
    ageMin: number;             // 18~65
    ageMax: number;
    interests: string[];        // 3~5개 한글 키워드 (예: "재테크", "자기계발")
    locations: string[];        // 기본 ["대한민국"]
  };
  generatedAt: number;
  basedOnProjectVersion?: string;  // 미래 — 책 변경 시 재생성 트리거
}

// Wave C1: 책 시리즈 — book_projects.data.seriesMembership 에 JSON으로 저장
// 같은 seriesId를 공유하는 책들이 한 시리즈를 이룬다. 별도 테이블 없음.
export interface SeriesMembership {
  seriesId: string;
  seriesTitle: string;
  orderInSeries: number;  // 1, 2, 3...
}

// Wave C2: 책 챗봇 thread (transient — DB 저장 안 함, 단순 메모리/응답용 타입)
export interface ChatThreadMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export interface ChatThread {
  bookId: string;
  messages: ChatThreadMessage[];
}

// Revenue tracking — 책별 채널별 매출 (사용자 직접 입력).
// /profile에서 비용 vs 매출 합산 ROI 계산.
export type RevenueChannel = "kmong" | "ridi" | "kyobo" | "aladdin" | "direct" | "other";

export interface BookRevenueChannel {
  channel: RevenueChannel;
  label?: string;          // for "other" or custom channel name
  grossKRW: number;        // 누적 매출
  feeRate?: number;        // 채널 수수료 비율 (0~1, default per channel)
}

export interface BookRevenue {
  channels: BookRevenueChannel[];
  netTotalKRW: number;     // 합산 순매출 (수수료 차감 후)
  updatedAt: number;
}

// Audiobook — 챕터별 TTS WAV (Gemini TTS, 24kHz/16-bit/mono).
// wavBase64는 큰 데이터 (1분 ≈ 1MB) — 일단 DB JSON에 저장. 나중에 S3/R2 이전 가능.
export interface AudiobookChapter {
  chapterIdx: number;
  title: string;
  wavBase64: string;
  durationMs: number;
  voiceName: string;
}

export interface Audiobook {
  chapters: AudiobookChapter[];
  voiceName: string;
  generatedAt: number;
}

// Course slides — 책 본문을 강사·코치용 슬라이드 outline + (옵션) PNG 렌더로 변환.
// outline만 (~₩40 AI cost) 또는 +Sharp PNG 렌더 (~+₩10/slide).
export interface CourseSlide {
  slideNum: number;
  title: string;
  bullets: string[];
  notes?: string;            // 스피커 노트 (강사 발표 스크립트)
  pngBase64?: string;        // optional — 1920x1080 PNG (없으면 outline만)
}

export interface CourseSlides {
  template: "minimal" | "bold" | "academic";
  slides: CourseSlide[];
  generatedAt: number;
}

// Wave B5: A/B 테스트 (마케팅 페이지)
// 같은 책에 2가지 marketing variant — /book/[id] 방문 시 cookie 기반 50/50 분기.
// track endpoint에 variantId 같이 보내 어느 variant가 클릭률 높은지 분석.
export interface ABTestVariant {
  taglineA?: string;
  taglineB?: string;
  descriptionA?: string;
  descriptionB?: string;
  enabled?: boolean;       // false면 분기 비활성 (marketingMeta만 사용)
  createdAt: number;
  updatedAt?: number;
}

// Wave B6: 미리보기 영상 frame sequence (1080x1920, 9:16 — 인스타 릴스/유튜브 쇼츠).
// 5장 PNG. 사용자가 본인 영상 편집기 (CapCut, 프리미어, 인스타)에 import 후 음악·트랜지션 추가.
// FFmpeg는 Vercel serverless에서 무거움 → frame 시퀀스만 제공 (Phase 2에서 풀 영상).
export interface PreviewVideoFrame {
  idx: number;             // 0..4
  template: "cover" | "excerpt" | "cta";
  base64: string;          // 1080x1920 PNG
}

export interface PreviewVideo {
  frames: PreviewVideoFrame[];   // 5장
  generatedAt: number;
}

// Wave C2: 책 번역 — 한국어 책 → 영어/일본어 (KDP 글로벌 진출용).
// AI 비용 ~₩200/책 (Gemini Flash, topic+audience 번역 ₩20 + 챕터 본문 12 × ~₩15).
export interface BookTranslation {
  language: "en" | "ja";
  topic: string;
  audience: string;
  chapters: Array<{ title: string; subtitle?: string; content: string }>;
  generatedAt: number;
}

export interface BookProject {
  id: string;
  topic: string;
  audience: string;
  type: "자기계발서" | "실용서" | "에세이" | "매뉴얼" | "재테크" | "웹소설" | "전문서";
  targetPages: number;
  translations?: BookTranslation[];   // Wave C2 — 책 번역 (영어/일본어)
  tier?: "basic" | "pro" | "premium";
  noImages?: boolean;  // true면 본문 [IMAGE: ...] placeholder 생성 X
  themeColor?: ThemeColorKey;  // 책별 색상 테마 (default "orange")
  marketingMeta?: MarketingMeta;  // Sub-project 3: /book/[id] 마케팅 페이지용 메타
  metaAdPackage?: MetaAdPackage;  // Sub-project 5: Meta(FB/IG) Ads Manager 카피 패키지
  metaAdImages?: MetaAdImage[];   // Part A: Meta 광고 이미지 3비율 (피드/스토리/링크)
  repurposedContent?: RepurposedContent;  // Wave 1: 5채널 콘텐츠 재가공 (인스타/유튜브/블로그/이메일/카톡)
  infographic?: Infographic;             // Wave B3: 카드뉴스 인포그래픽 5장 (Sharp 기반, AI 호출 X)
  seriesMembership?: SeriesMembership;   // Wave C1: 같은 seriesId 가진 책들이 한 시리즈
  referencesSummary?: ReferencesSummary;  // Phase 2: 참고자료 요약 (RAG)
  toneSetting?: ToneSetting;  // Phase 4: 톤 매칭 설정
  revenue?: BookRevenue;   // 책별 매출 (사용자 직접 입력) — /profile에서 ROI 계산
  audiobook?: Audiobook;   // 오디오북 — 챕터별 TTS WAV (Gemini TTS, 한국어)
  courseSlides?: CourseSlides;  // 강의 슬라이드 — 책 → 10-20장 outline (+선택적 PNG)
  abTest?: ABTestVariant;   // Wave B5: 마케팅 페이지 A/B variant
  previewVideo?: PreviewVideo;  // Wave B6: 미리보기 영상 5 frames (9:16 PNG)
  shareEnabled?: boolean;  // true면 /share/[id] public 접근 가능 (로그인 X)
  shareLinks?: {           // 공유 페이지에 보일 구매·다운로드 링크 (작가 입력)
    kmong?: string;
    ridi?: string;
    kyobo?: string;
    custom?: { label: string; url: string }[];
  };
  interview?: {
    questions: { q: string; a: string }[];
    completedAt: number;
    skipped: boolean;
    aiDriven?: boolean;
  };
  // Wave: 표지 다양화 — 한 번 클릭으로 3~5종 다른 스타일 표지 생성, 사용자 선택 후 메인 cover로 복사.
  // 사용자가 [이걸로 선택] 누르기 전까진 메인 cover에 들어가지 X.
  coverVariations?: {
    idx: number;          // 0,1,2 ... (style preset index)
    base64: string;       // PNG base64 (no data: prefix)
    vendor: string;       // "gemini" / "cloudflare" / "openai" / "pollinations"
    style: string;        // 사람이 읽는 라벨 (예: "Minimalist", "Bold", "Photorealistic")
    prompt?: string;      // 디버깅용
    generatedAt: number;
  }[];
  kmongPackage?: {
    images: { type: "cover" | "thumb" | "toc" | "spec" | "audience" | "preview"; base64: string; vendor: string; generatedAt: number }[];
    copy: {
      kmongDescription: string;
      kmongHighlights: string[];
      instagram: string;
      kakao: string;
      twitter: string;
      blogReview?: string;
      youtubeDescription?: string;
      naverCafe?: string;
    };
    generatedAt: number;
    totalCostKRW: number;
  };
  chapters: BookChapter[];
  createdAt: number;
  updatedAt: number;
}

const KEY_API = "tiger:ai-config";
const KEY_PROJECT = "tiger:current-project";

export function loadAIConfig(): AIConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_API);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveAIConfig(cfg: AIConfig) {
  localStorage.setItem(KEY_API, JSON.stringify(cfg));
}
export function clearAIConfig() { localStorage.removeItem(KEY_API); }

export function loadProject(): BookProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_PROJECT);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveProject(p: BookProject) {
  p.updatedAt = Date.now();
  localStorage.setItem(KEY_PROJECT, JSON.stringify(p));
}
export function clearProject() { localStorage.removeItem(KEY_PROJECT); }

export function newProject(init: Partial<BookProject>): BookProject {
  return {
    id: crypto.randomUUID(),
    topic: init.topic || "",
    audience: init.audience || "",
    type: init.type || "실용서",
    targetPages: init.targetPages || 120,
    chapters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

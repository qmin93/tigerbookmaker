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

export interface BookProject {
  id: string;
  topic: string;
  audience: string;
  type: "자기계발서" | "실용서" | "에세이" | "매뉴얼" | "재테크" | "웹소설" | "전문서";
  targetPages: number;
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

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

export interface BookProject {
  id: string;
  topic: string;
  audience: string;
  type: "자기계발서" | "실용서" | "에세이" | "매뉴얼" | "재테크" | "웹소설" | "전문서";
  targetPages: number;
  tier?: "basic" | "pro" | "premium";
  noImages?: boolean;  // true면 본문 [IMAGE: ...] placeholder 생성 X
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

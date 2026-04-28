// 3-tier 모델 매핑. 키 가용성에 따라 candidate chain이 달라짐.

import type { AIModel } from "./server/ai-server";

export type Tier = "basic" | "pro" | "premium";

export interface TierDisplay {
  id: Tier;
  emoji: string;
  name: string;
  price: number;       // 사용자 표시 가격 (KRW per book)
  estCostKRW: number;  // 우리 원가 추정
  blurb: string;       // 한 줄 설명
  audience: string;    // 적합한 책 유형
}

export const TIER_DISPLAY: Record<Tier, TierDisplay> = {
  basic: {
    id: "basic",
    emoji: "🌱",
    name: "베이직",
    price: 500,
    estCostKRW: 30,
    blurb: "빠른 초안. 가성비 최강.",
    audience: "실용서, 회사 매뉴얼, 빠른 초안",
  },
  pro: {
    id: "pro",
    emoji: "⭐",
    name: "프로",
    price: 1500,
    estCostKRW: 260,
    blurb: "한국어 품질 균형. 베스트 셀러.",
    audience: "자기계발서, 일반 출간, 크몽 등록",
  },
  premium: {
    id: "premium",
    emoji: "🌟",
    name: "프리미엄",
    price: 7000,
    estCostKRW: 2500,
    blurb: "작가급 한국어. 출간용 완성도.",
    audience: "에세이, 소설, 출판사 제출용",
  },
};

// 각 티어의 이상적 모델 chain (1순위 → fallback). 호출 시점에 키 가용성으로 필터.
const TIER_CHAIN_TEMPLATE: Record<Tier, AIModel[]> = {
  basic:   ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gpt-4o-mini"],
  pro:     ["gemini-flash-latest",      "gemini-2.5-flash",      "claude-haiku-4-5", "gpt-4.1-mini"],
  premium: ["claude-sonnet-4-6",        "gpt-4o",                "gemini-2.5-pro"],
};

// 모델별 필요 환경변수
const MODEL_VENDOR: Record<AIModel, "gemini" | "openai" | "anthropic"> = {
  "gemini-2.5-flash-lite":   "gemini",
  "gemini-flash-lite-latest":"gemini",
  "gemini-2.5-flash":        "gemini",
  "gemini-flash-latest":     "gemini",
  "gemini-2.5-pro":          "gemini",
  "gpt-4o-mini":             "openai",
  "gpt-4o":                  "openai",
  "gpt-4.1-mini":            "openai",
  "claude-haiku-4-5":        "anthropic",
  "claude-sonnet-4-6":       "anthropic",
};

const VENDOR_ENV: Record<"gemini" | "openai" | "anthropic", string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

// 서버에서만 호출 (process.env 사용). 사용 가능한 모델만 남김.
export function getModelChain(tier: Tier): AIModel[] {
  const template = TIER_CHAIN_TEMPLATE[tier];
  return template.filter(model => {
    const vendor = MODEL_VENDOR[model];
    const envName = VENDOR_ENV[vendor];
    return !!process.env[envName];
  });
}

export function isTierAvailable(tier: Tier): boolean {
  return getModelChain(tier).length > 0;
}

export function getAvailableTiers(): Array<TierDisplay & { available: boolean; reason?: string }> {
  return (Object.keys(TIER_DISPLAY) as Tier[]).map(t => {
    const available = isTierAvailable(t);
    return {
      ...TIER_DISPLAY[t],
      available,
      reason: available ? undefined : "결제 활성화 후 사용 가능",
    };
  });
}

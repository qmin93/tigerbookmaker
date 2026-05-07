import type { ThemeColorKey } from "./storage";

// 책별 테마 색상 — 6 presets
// 각 entry는 Tailwind class strings (실제 hex 변경하려면 tailwind.config.ts에서 함)

export interface ThemeClasses {
  // 미리보기용 single hex (UI swatch)
  hex: string;
  // 책 콘텐츠 영역 클래스
  accent: string;          // 강조 텍스트/border (예: "text-orange-600", "border-orange-500")
  accentBorder: string;    // border-l accent
  bg: string;              // 옅은 배경 (헤더, 챕터 카드)
  bgBold: string;          // 진한 배경 (CTA 버튼)
  bgBoldHover: string;     // hover
  textOnBold: string;      // 진한 배경 위 텍스트 (대부분 white)
  ring: string;            // focus ring
  label: string;           // UI 표시용 한국어 이름
}

export const THEME_COLOR_PRESETS: Record<ThemeColorKey, ThemeClasses> = {
  orange: {
    hex: "#f97316",
    accent: "text-orange-600 border-orange-500",
    accentBorder: "border-l-orange-500",
    bg: "bg-orange-50",
    bgBold: "bg-orange-500",
    bgBoldHover: "hover:bg-orange-600",
    textOnBold: "text-white",
    ring: "ring-orange-500/30",
    label: "🟠 오렌지 (기본)",
  },
  blue: {
    hex: "#3b82f6",
    accent: "text-blue-600 border-blue-500",
    accentBorder: "border-l-blue-500",
    bg: "bg-blue-50",
    bgBold: "bg-blue-500",
    bgBoldHover: "hover:bg-blue-600",
    textOnBold: "text-white",
    ring: "ring-blue-500/30",
    label: "🔵 블루",
  },
  green: {
    hex: "#10b981",
    accent: "text-emerald-600 border-emerald-500",
    accentBorder: "border-l-emerald-500",
    bg: "bg-emerald-50",
    bgBold: "bg-emerald-500",
    bgBoldHover: "hover:bg-emerald-600",
    textOnBold: "text-white",
    ring: "ring-emerald-500/30",
    label: "🟢 그린",
  },
  purple: {
    hex: "#8b5cf6",
    accent: "text-violet-600 border-violet-500",
    accentBorder: "border-l-violet-500",
    bg: "bg-violet-50",
    bgBold: "bg-violet-500",
    bgBoldHover: "hover:bg-violet-600",
    textOnBold: "text-white",
    ring: "ring-violet-500/30",
    label: "🟣 퍼플",
  },
  red: {
    hex: "#ef4444",
    accent: "text-red-600 border-red-500",
    accentBorder: "border-l-red-500",
    bg: "bg-red-50",
    bgBold: "bg-red-500",
    bgBoldHover: "hover:bg-red-600",
    textOnBold: "text-white",
    ring: "ring-red-500/30",
    label: "🔴 레드",
  },
  gray: {
    hex: "#6b7280",
    accent: "text-gray-700 border-gray-500",
    accentBorder: "border-l-gray-500",
    bg: "bg-gray-100",
    bgBold: "bg-gray-700",
    bgBoldHover: "hover:bg-gray-800",
    textOnBold: "text-white",
    ring: "ring-gray-500/30",
    label: "⚪ 그레이 (모노)",
  },
  // Wave 2: 신규 6 presets (기존 6개는 변경 금지 — 추가만)
  crimson: {
    hex: "#dc2626",
    accent: "text-red-700 border-red-600",
    accentBorder: "border-l-red-600",
    bg: "bg-red-50",
    bgBold: "bg-red-600",
    bgBoldHover: "hover:bg-red-700",
    textOnBold: "text-white",
    ring: "ring-red-500/30",
    label: "🔴 크림슨",
  },
  amber: {
    hex: "#d97706",
    accent: "text-amber-700 border-amber-600",
    accentBorder: "border-l-amber-600",
    bg: "bg-amber-50",
    bgBold: "bg-amber-600",
    bgBoldHover: "hover:bg-amber-700",
    textOnBold: "text-white",
    ring: "ring-amber-500/30",
    label: "🟡 앰버",
  },
  teal: {
    hex: "#0d9488",
    accent: "text-teal-700 border-teal-600",
    accentBorder: "border-l-teal-600",
    bg: "bg-teal-50",
    bgBold: "bg-teal-600",
    bgBoldHover: "hover:bg-teal-700",
    textOnBold: "text-white",
    ring: "ring-teal-500/30",
    label: "🟢 청록",
  },
  indigo: {
    hex: "#4f46e5",
    accent: "text-indigo-700 border-indigo-600",
    accentBorder: "border-l-indigo-600",
    bg: "bg-indigo-50",
    bgBold: "bg-indigo-600",
    bgBoldHover: "hover:bg-indigo-700",
    textOnBold: "text-white",
    ring: "ring-indigo-500/30",
    label: "🔵 인디고",
  },
  rose: {
    hex: "#e11d48",
    accent: "text-rose-700 border-rose-600",
    accentBorder: "border-l-rose-600",
    bg: "bg-rose-50",
    bgBold: "bg-rose-600",
    bgBoldHover: "hover:bg-rose-700",
    textOnBold: "text-white",
    ring: "ring-rose-500/30",
    label: "🌹 로즈",
  },
  slate: {
    hex: "#475569",
    accent: "text-slate-700 border-slate-600",
    accentBorder: "border-l-slate-600",
    bg: "bg-slate-100",
    bgBold: "bg-slate-600",
    bgBoldHover: "hover:bg-slate-700",
    textOnBold: "text-white",
    ring: "ring-slate-500/30",
    label: "⚫ 슬레이트",
  },
};

export function getTheme(key?: ThemeColorKey): ThemeClasses {
  return THEME_COLOR_PRESETS[key ?? "orange"];
}

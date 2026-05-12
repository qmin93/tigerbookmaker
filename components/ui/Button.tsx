// Button — clean-redesign v3 디자인 시스템 (spec 3.3)
// 변형 3종 (primary/secondary/ghost) × 사이즈 2종 (md/lg)
// Link로 렌더링하려면 ButtonLink 사용.

import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger-orange focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-tiger-orange text-white hover:bg-orange-600 shadow-glow-orange-sm",
  secondary:
    "border border-gray-300 hover:border-ink-900 text-ink-900 bg-white hover:bg-gray-50",
  ghost:
    "text-ink-900 hover:bg-gray-100",
};

const SIZE: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-sm min-h-[44px]", // 44px = iOS HIG 터치 타겟
  lg: "px-6 py-3.5 text-base min-h-[48px]",
};

function classes(variant: ButtonVariant, size: ButtonSize, extra = "") {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={classes(variant, size, className)}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonOwnProps & ComponentProps<typeof Link>) {
  return (
    <Link {...rest} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}

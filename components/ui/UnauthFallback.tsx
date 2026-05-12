// UnauthFallback — clean-redesign v3 (spec 3.5)
// 로그인 게이트 페이지에 비로그인 방문자가 도착했을 때 빈 "로딩 중..." 대신 의미 있는 마케팅 콘텐츠 + 로그인 CTA 노출.
// SEO·공유 링크·광고 LP 용도에 모두 도움. 클라이언트 사이드 useSession 체크 기반.

import Link from "next/link";
import { Section } from "./Section";
import { ButtonLink } from "./Button";

interface UnauthFallbackProps {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  bullets?: string[];
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  accent?: "tiger-orange" | "deep-navy" | "emerald";
}

export function UnauthFallback({
  eyebrow,
  title,
  description,
  bullets,
  primaryCta = { label: "무료로 시작 — ₩5,000 크레딧 받기 →", href: "/login" },
  secondaryCta = { label: "샘플 책 보기", href: "/#samples" },
  accent = "tiger-orange",
}: UnauthFallbackProps) {
  return (
    <Section
      eyebrow={eyebrow}
      title={title}
      description={description}
      accent={accent}
      divider={false}
    >
      {bullets && bullets.length > 0 && (
        <ul className="mt-2 space-y-3 mb-12 max-w-xl">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-3 text-gray-700">
              <span className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full ${
                accent === "deep-navy" ? "bg-deep-navy" :
                accent === "emerald" ? "bg-emerald-600" :
                "bg-tiger-orange"
              }`} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href={primaryCta.href} size="lg">{primaryCta.label}</ButtonLink>
        <ButtonLink href={secondaryCta.href} variant="secondary" size="lg">{secondaryCta.label}</ButtonLink>
      </div>
    </Section>
  );
}

import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

const SITE_URL = "https://tigerbookmaker.vercel.app";
const SITE_TITLE = "크몽에서 부수익, 30분에 한 권 — AI 전자책 자동 집필 | Tigerbookmaker";
const SITE_DESC = "한국어 전자책을 AI로 30분 만에. 주제 한 줄 + 본인 자료 1개 → 12챕터 본문 + 표지 + 크몽 등록 패키지까지 자동. 권당 ₩4,000부터, ₩5,000 무료 크레딧.";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s | Tigerbookmaker",
  },
  description: SITE_DESC,
  metadataBase: new URL(SITE_URL),
  keywords: [
    "AI 전자책",
    "크몽 부수익",
    "30분 책 만들기",
    "AI 책 자동 생성",
    "한국어 AI 책",
    "전자책 쓰는 법",
    "직장인 부수익",
    "크몽 등록 방법",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESC,
    url: SITE_URL,
    siteName: "Tigerbookmaker",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// JSON-LD 구조화 데이터 — 구글 리치 결과 자격
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Tigerbookmaker",
      url: SITE_URL,
      logo: `${SITE_URL}/opengraph-image`,
      description: SITE_DESC,
      sameAs: [],
    },
    {
      "@type": "WebSite",
      name: "Tigerbookmaker",
      url: SITE_URL,
      inLanguage: "ko-KR",
    },
    {
      "@type": "SoftwareApplication",
      name: "Tigerbookmaker",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "4000",
        priceCurrency: "KRW",
        description: "권당 ₩4,000부터 (충전식)",
      },
      description: "한국어 AI 전자책 자동 집필 도구. 30분에 12챕터 책 + 표지 + 크몽 등록 패키지까지 자동.",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-tiger-bg text-tiger-dark min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

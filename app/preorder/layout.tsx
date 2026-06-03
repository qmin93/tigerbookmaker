import type { Metadata } from "next";

const TITLE = "퇴근하고 30분, 첫 이북이 완성됩니다 — tigerbookmaker 베타 사전예약";
const DESC =
  "AI가 12챕터 + 표지 + 마케팅 카피까지 자동으로 만듭니다. 사전예약자에게 미니 이북과 크몽 키워드 체크리스트를 무료로 보내드립니다. 카드 정보 없음 · 한정 100명.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/preorder" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/preorder",
    type: "website",
    locale: "ko_KR",
    siteName: "tigerbookmaker",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PreorderLayout({ children }: { children: React.ReactNode }) {
  return children;
}

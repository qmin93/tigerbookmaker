import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tigerbookmaker — 30분이면 한 권. 한국어 AI 전자책",
  description: "주제만 입력하면 목차부터 12챕터 본문까지 30분에 자동 집필. PDF·DOCX 즉시 다운로드. 권당 ₩4,000~₩12,000. 회원가입 시 ₩5,000 자동 충전.",
  metadataBase: new URL("https://tigerbookmaker.vercel.app"),
  openGraph: {
    title: "Tigerbookmaker — 30분이면 한 권",
    description: "한국어 전자책을 AI로 자동 집필. PDF·DOCX 즉시 다운로드. 권당 ₩4,000부터.",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tigerbookmaker — 30분이면 한 권",
    description: "한국어 AI 전자책 자동 집필. 권당 ₩4,000부터.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-tiger-bg text-tiger-dark min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

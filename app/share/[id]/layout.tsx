// /share/[id] 동적 메타데이터 — 카톡·X·페이스북 공유 시 표지 + 책 정보 미리보기
import type { Metadata } from "next";

interface ShareSummary {
  topic: string;
  audience: string;
  type: string;
  shareEnabled?: boolean;
  hasCover?: boolean;
}

async function fetchShareSummary(id: string, baseUrl: string): Promise<ShareSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/share/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      topic: d.topic,
      audience: d.audience,
      type: d.type,
      shareEnabled: true,
      hasCover: !!d.cover,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // base URL — production은 vercel domain 또는 사용자 도메인
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tigerbookmaker.vercel.app");

  const data = await fetchShareSummary(id, baseUrl);
  if (!data) {
    return {
      title: "Tigerbookmaker — AI 한국어 전자책",
      description: "AI가 30분에 한국어 책 한 권을 자동 집필",
    };
  }

  const ogImageUrl = data.hasCover ? `${baseUrl}/api/share/${id}/og` : `${baseUrl}/og-default.png`;
  const desc = `${data.audience} 대상 ${data.type}. AI 자동 집필. 🐯 Tigerbookmaker로 30분에 만든 책.`;

  return {
    title: `${data.topic} — Tigerbookmaker`,
    description: desc,
    openGraph: {
      title: data.topic,
      description: desc,
      type: "article",
      url: `${baseUrl}/share/${id}`,
      siteName: "Tigerbookmaker",
      locale: "ko_KR",
      images: [{
        url: ogImageUrl,
        width: 1024,
        height: 1024,
        alt: data.topic,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: data.topic,
      description: desc,
      images: [ogImageUrl],
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

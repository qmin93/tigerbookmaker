// /book/[id] 동적 메타데이터 — 마케팅 랜딩 OG 태그
// 카톡·X·페이스북 공유 시 표지 + 광고 카피 미리보기
import type { Metadata } from "next";

interface BookSummary {
  topic: string;
  audience: string;
  type: string;
  hasCover?: boolean;
  tagline?: string;
  kmongDescription?: string;
}

async function fetchBookSummary(id: string, baseUrl: string): Promise<BookSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/book/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      topic: d.topic,
      audience: d.audience,
      type: d.type,
      hasCover: !!d.cover,
      tagline: d.marketingMeta?.tagline,
      kmongDescription: d.kmongCopy?.kmongDescription,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tigerbookmaker.vercel.app");

  const data = await fetchBookSummary(id, baseUrl);
  if (!data) {
    return {
      title: "Tigerbookmaker — AI 한국어 전자책",
      description: "AI가 30분에 한국어 책 한 권을 자동 집필",
    };
  }

  // OG 이미지: /share/[id]/og endpoint 재사용 (cover image)
  const ogImageUrl = data.hasCover ? `${baseUrl}/api/share/${id}/og` : `${baseUrl}/og-default.png`;

  // description 우선순위: tagline → kmongDescription snippet → fallback
  let desc: string;
  if (data.tagline) {
    desc = data.tagline;
  } else if (data.kmongDescription) {
    desc = data.kmongDescription.replace(/\s+/g, " ").trim().slice(0, 160);
  } else {
    desc = `${data.audience} 대상 ${data.type}. AI 자동 집필. 🐯 Tigerbookmaker로 30분에 만든 책.`;
  }

  return {
    title: `${data.topic} — Tigerbookmaker`,
    description: desc,
    openGraph: {
      title: data.topic,
      description: desc,
      type: "book",
      url: `${baseUrl}/book/${id}`,
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

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

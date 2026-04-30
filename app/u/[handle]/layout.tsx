// /u/[handle] 동적 메타데이터 — 작가 link-in-bio OG 태그
// 인스타·X·페북 공유 시 displayName + bio + avatar 미리보기
import type { Metadata } from "next";

interface ProfileSummary {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  books?: Array<unknown>;
}

async function fetchProfileSummary(handle: string, baseUrl: string): Promise<ProfileSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/u/${handle}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tigerbookmaker.vercel.app");

  const data = await fetchProfileSummary(params.handle, baseUrl);
  if (!data) {
    return {
      title: "Tigerbookmaker — AI 한국어 전자책",
      description: "AI가 30분에 한국어 책 한 권을 자동 집필",
    };
  }

  const desc = data.bio?.slice(0, 160) || `${data.displayName}의 책 ${data.books?.length ?? 0}권`;
  const ogImage = `${baseUrl}/og-default.png`;

  return {
    title: `${data.displayName} (@${data.handle}) — Tigerbookmaker`,
    description: desc,
    openGraph: {
      title: data.displayName,
      description: desc,
      type: "profile",
      url: `${baseUrl}/u/${data.handle}`,
      siteName: "Tigerbookmaker",
      locale: "ko_KR",
      images: [{ url: ogImage, width: 1024, height: 1024, alt: data.displayName }],
    },
    twitter: {
      card: "summary_large_image",
      title: data.displayName,
      description: desc,
      images: [ogImage],
    },
  };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

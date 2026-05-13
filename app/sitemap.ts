// Next.js 동적 sitemap.xml
// KEEP 페이지 + 공개 책. 작가 프로필(/u/*)은 spec v3에서 DEFER라 제외.

import type { MetadataRoute } from "next";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const revalidate = 3600; // 1h cache

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://tigerbookmaker.vercel.app";

  let books: Array<{ id: string; updated_at: string }> = [];

  try {
    const r = await sql<{ id: string; updated_at: string }>`
      SELECT id, updated_at FROM book_projects
      WHERE data->>'shareEnabled' = 'true'
      ORDER BY updated_at DESC LIMIT 1000
    `;
    books = r.rows;
  } catch {
    // DB 미가용 시 정적 페이지만 반환
  }

  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, priority: 1.0, changeFrequency: "weekly" },
    { url: `${baseUrl}/pricing`, lastModified: now, priority: 0.9, changeFrequency: "monthly" },
    { url: `${baseUrl}/publish`, lastModified: now, priority: 0.8, changeFrequency: "monthly" },
    { url: `${baseUrl}/login`, lastModified: now, priority: 0.5, changeFrequency: "yearly" },
    { url: `${baseUrl}/legal/terms`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${baseUrl}/legal/privacy`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    { url: `${baseUrl}/legal/refund`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
    ...books.map((b) => ({
      url: `${baseUrl}/book/${b.id}`,
      lastModified: new Date(b.updated_at),
      priority: 0.7,
      changeFrequency: "weekly" as const,
    })),
  ];
}

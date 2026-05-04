// Next.js 동적 sitemap.xml — Wave 5
// 정적 페이지 + 공개 책 (shareEnabled) + 모든 작가 프로필.

import type { MetadataRoute } from "next";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const revalidate = 3600; // 1h cache

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://tigerbookmaker.vercel.app";

  let books: Array<{ id: string; updated_at: string }> = [];
  let profiles: Array<{ handle: string; updated_at: string }> = [];

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

  try {
    const r = await sql<{ handle: string; updated_at: string }>`
      SELECT handle, updated_at FROM user_profiles
      ORDER BY updated_at DESC LIMIT 1000
    `;
    profiles = r.rows;
  } catch {
    // ignore
  }

  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: now, priority: 0.5 },
    ...books.map((b) => ({
      url: `${baseUrl}/book/${b.id}`,
      lastModified: new Date(b.updated_at),
      priority: 0.7,
    })),
    ...profiles.map((p) => ({
      url: `${baseUrl}/u/${p.handle}`,
      lastModified: new Date(p.updated_at),
      priority: 0.6,
    })),
  ];
}

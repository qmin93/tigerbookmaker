// GET /api/u/[handle] — 공개 프로필 + 공개 책 목록 (no auth)
// shareEnabled가 true인 자신의 책만 노출.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getProfileByHandle } from "@/lib/server/profile";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { handle: string } }) {
  const handle = (params.handle ?? "").toLowerCase();
  if (!handle) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const profile = await getProfileByHandle(handle);
  if (!profile) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // 이 사용자의 공개(shareEnabled) 책 목록
  const { rows: books } = await sql<{
    id: string; topic: string; type: string; data: any; created_at: string;
  }>`
    SELECT id, topic, type, data, created_at
    FROM book_projects
    WHERE user_id = ${profile.userId}
      AND data->>'shareEnabled' = 'true'
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    socialLinks: profile.socialLinks,
    books: books.map(b => ({
      id: b.id,
      topic: b.topic,
      type: b.type,
      themeColor: b.data?.themeColor ?? "orange",
      tagline: b.data?.marketingMeta?.tagline ?? null,
      cover: b.data?.kmongPackage?.images?.find((i: any) => i.type === "cover")
        ? { base64: b.data.kmongPackage.images.find((i: any) => i.type === "cover").base64 }
        : null,
      createdAt: b.created_at,
    })),
  });
}

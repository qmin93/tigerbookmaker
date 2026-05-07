// GET /api/book/[id] — 공개 마케팅 데이터 (public, no auth)
// shareEnabled가 true인 책만 응답. /book/[id] 마케팅 페이지용.
// 챕터 본문(content)은 제외 — /share/[id]에서만 읽기 제공.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!params.id || !UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  let rows: any[] = [];
  try {
    const r = await sql`
      SELECT id, topic, audience, type, data, created_at
      FROM book_projects WHERE id = ${params.id}
    `;
    rows = r.rows;
  } catch (e: any) {
    console.error("[/api/book/[id]] db error:", e?.message);
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (p.data?.shareEnabled !== true) {
    return NextResponse.json({ error: "NOT_SHARED", message: "비공개 책입니다." }, { status: 403 });
  }

  // 챕터: 제목·소제목만 (content 제외 — 마케팅 페이지는 읽기 X)
  const chapters = (p.data?.chapters ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
  }));

  // 1장 본문 미리보기 (600자 — fallback for non-flipbook display)
  const firstChapter = (p.data?.chapters ?? [])[0];
  const firstChapterContentRaw = firstChapter?.content ? String(firstChapter.content) : "";
  const firstChapterPreview = firstChapterContentRaw
    ? firstChapterContentRaw.slice(0, 600).trim() + (firstChapterContentRaw.length > 600 ? "…" : "")
    : null;
  const firstChapterTitle = firstChapter?.title ?? null;
  const firstChapterSubtitle = firstChapter?.subtitle ?? null;

  // Flipbook 미리보기 페이지 — 첫 2장의 첫 페이지만 노출 (마케팅 목적, 전체 본문은 /share/[id])
  const chap0 = p.data?.chapters?.[0];
  const chap1 = p.data?.chapters?.[1];
  const flipbookPages = [chap0, chap1]
    .filter(Boolean)
    .map((c: any, i: number) => ({
      chapterIdx: i,
      title: c.title,
      subtitle: c.subtitle ?? null,
      excerpt: c.content
        ? String(c.content).slice(0, 500).trim() + (String(c.content).length > 500 ? "…" : "")
        : null,
    }))
    .filter((p: any) => p.excerpt);

  // 표지: base64만 (메타 제외)
  const coverImg = p.data?.kmongPackage?.images?.find((i: any) => i.type === "cover");
  const cover = coverImg ? { base64: coverImg.base64 } : null;

  return NextResponse.json({
    id: p.id,
    topic: p.topic,
    audience: p.audience,
    type: p.type,
    cover,
    chapters,
    firstChapterPreview,
    firstChapterTitle,
    firstChapterSubtitle,
    flipbookPages,
    themeColor: p.data?.themeColor ?? "orange",
    marketingMeta: p.data?.marketingMeta ?? null,
    kmongCopy: p.data?.kmongPackage?.copy ?? null,
    // Wave B5: A/B 테스트 variants — 활성 시 클라이언트가 variant에 따라 tagline/description 분기.
    // enabled=false거나 두 variant 다 비어있으면 클라이언트는 무시.
    abTest: p.data?.abTest
      ? {
          enabled: p.data.abTest.enabled === true,
          taglineA: p.data.abTest.taglineA ?? null,
          taglineB: p.data.abTest.taglineB ?? null,
          descriptionA: p.data.abTest.descriptionA ?? null,
          descriptionB: p.data.abTest.descriptionB ?? null,
        }
      : null,
    createdAt: p.created_at,
  });
}

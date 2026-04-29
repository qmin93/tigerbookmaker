// GET /api/share/[id]/og — Open Graph 표지 이미지 (PNG/JPEG binary)
// 카톡·X·페이스북 공유 시 og:image URL로 사용. 캐시 적극 활용.

import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

function detectMime(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  return "image/png";
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { rows } = await sql`SELECT data FROM book_projects WHERE id = ${params.id}`;
    const p = rows[0];
    if (!p || p.data?.shareEnabled !== true) {
      return new Response("Not found", { status: 404 });
    }
    const cover = p.data?.kmongPackage?.images?.find((i: any) => i.type === "cover");
    if (!cover?.base64) return new Response("No cover", { status: 404 });

    const buf = Buffer.from(cover.base64, "base64");
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": detectMime(cover.base64),
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e: any) {
    console.error("[/api/share/[id]/og]", e);
    return new Response("Error", { status: 500 });
  }
}

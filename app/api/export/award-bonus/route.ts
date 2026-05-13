// POST /api/export/award-bonus
// body: { projectId }
// 응답: { awarded, newBalance, reason? }
//
// 클라이언트(/export 페이지)가 PDF/DOCX 다운로드 후 호출.
// EPUB 경로는 서버에서 자체 호출하므로 이 endpoint 불필요.
// 멱등 — 동일 (userId, projectId) 두 번 호출돼도 첫 번째만 ₩5,000 지급.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { awardFirstBookBonusIfEligible } from "@/lib/server/first-book-bonus";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const result = await awardFirstBookBonusIfEligible(session.user.id, projectId);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[/api/export/award-bonus] error", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

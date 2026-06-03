// GET /api/preorder/stats
// returns { count, capacity, remaining }
// /preorder 페이지에서 실시간 진행도 표시용. 5분 캐시.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const revalidate = 60; // 1분

const CAPACITY = 100;

export async function GET() {
  try {
    const { rows } = await sql<{ count: string }>`
      SELECT COUNT(*)::text AS count FROM preorders
    `;
    const count = Number(rows[0]?.count ?? 0);
    const remaining = Math.max(0, CAPACITY - count);
    return NextResponse.json(
      { count, capacity: CAPACITY, remaining },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    // DB 미연결 시 기본값으로 페이지가 깨지지 않게
    return NextResponse.json(
      { count: 0, capacity: CAPACITY, remaining: CAPACITY, fallback: true },
      { status: 200 }
    );
  }
}

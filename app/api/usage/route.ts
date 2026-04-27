// GET /api/usage — 내 사용 내역 + 통계 + 잔액 변동 로그
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;

  const [user, ai, txs] = await Promise.all([
    sql`SELECT balance_krw, total_charged, total_spent FROM users WHERE id = ${userId}`,
    sql`
      SELECT id, task, model, input_tokens, output_tokens, thoughts_tokens,
             cost_krw, duration_ms, project_id, chapter_idx, status, created_at
      FROM ai_usage WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 50
    `,
    sql`
      SELECT id, type, amount_krw, balance_after, reason, created_at
      FROM balance_transactions WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 50
    `,
  ]);

  // 통계 — 모델별 합계 + 작업별 합계 + 책당 평균 비용
  const stats = await sql`
    SELECT model, task, COUNT(*) AS calls, SUM(cost_krw) AS sum_krw, AVG(cost_krw) AS avg_krw
    FROM ai_usage WHERE user_id = ${userId} AND status = 'success'
    GROUP BY model, task
    ORDER BY sum_krw DESC
  `;

  return NextResponse.json({
    user: user.rows[0],
    aiUsage: ai.rows,
    transactions: txs.rows,
    stats: stats.rows.map(r => ({
      model: r.model,
      task: r.task,
      calls: Number(r.calls),
      sumKrw: Number(r.sum_krw),
      avgKrw: Math.round(Number(r.avg_krw)),
    })),
  });
}

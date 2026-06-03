// GET /api/cron/preorder-sequence
// Vercel Cron (vercel.json에 등록) — 매일 1회 실행.
// preorders 테이블 기준 created_at 으로부터 N일 지난 사용자에게 Day N 시퀀스 메일 발송.
// preorder_sequence_log 의 (preorder_id, step) UNIQUE 로 중복 발송 방지.
// CRON_SECRET 으로 Authorization 검증.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { sendPreorderEmail, PREORDER_STEPS } from "@/lib/server/preorder-emails";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PER_RUN = 200;
// Step 1~5 만 cron 처리 (step 0 = 신청 즉시 처리)
const STEPS = [1, 2, 3, 4, 5] as const;

interface DueRow {
  id: string;
  email: string;
  icp_signal: string | null;
  step: number;
}

export async function GET(req: Request) {
  // Vercel Cron 인증
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 각 step 별 due preorder 조회 후 발송.
  // - created_at <= NOW() - N days (해당 step 발송 가능 시각 도달)
  // - 같은 (preorder_id, step) 로그 없음
  let totalSent = 0;
  let totalFailed = 0;
  const results: Record<string, { sent: number; failed: number; skipped: number }> = {};

  for (const step of STEPS) {
    if (!PREORDER_STEPS[step]) continue;

    const { rows: due } = await sql<DueRow>`
      SELECT p.id, p.email, p.icp_signal, ${step} AS step
      FROM preorders p
      LEFT JOIN preorder_sequence_log l
        ON l.preorder_id = p.id AND l.step = ${step}
      WHERE l.id IS NULL
        AND p.intent = 'preorder'
        AND p.created_at <= NOW() - (${step} || ' days')::interval
        AND p.created_at >= NOW() - (${step + 14} || ' days')::interval
      ORDER BY p.created_at ASC
      LIMIT ${MAX_PER_RUN}
    `;

    let sent = 0;
    let failed = 0;

    for (const row of due) {
      const r = await sendPreorderEmail(step, {
        email: row.email,
        icpSignal: row.icp_signal,
      });

      if (r.ok) {
        await sql`
          INSERT INTO preorder_sequence_log (preorder_id, step)
          VALUES (${row.id}, ${step})
          ON CONFLICT (preorder_id, step) DO NOTHING
        `;
        sent++;
        totalSent++;
      } else {
        await sql`
          INSERT INTO preorder_sequence_log (preorder_id, step, failed_at, fail_reason)
          VALUES (${row.id}, ${step}, NOW(), ${r.reason})
          ON CONFLICT (preorder_id, step) DO NOTHING
        `;
        failed++;
        totalFailed++;
      }
    }

    results[`step_${step}`] = { sent, failed, skipped: 0 };
  }

  return NextResponse.json({
    ok: true,
    totalSent,
    totalFailed,
    perStep: results,
  });
}

// GET /api/cron/email-recovery — Vercel Cron 매시간 호출
// clean-redesign v3 spec 3.8.
//
// 3 트리거 + 옵트아웃 가드 + 트리거당 1회만 발송 (email_recovery_log 테이블로 dedup).
//
// vercel.json에 등록 (별도 commit):
//   { "path": "/api/cron/email-recovery", "schedule": "0 * * * *" }
//
// DB 마이그레이션 필요 (별도 PR — DB 변경은 v3 spec 미포함):
//   CREATE TABLE email_recovery_log (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//     trigger_name text NOT NULL,
//     project_id uuid REFERENCES book_projects(id) ON DELETE CASCADE,
//     meta jsonb NOT NULL DEFAULT '{}',
//     sent_at timestamptz NOT NULL DEFAULT NOW(),
//     UNIQUE (user_id, trigger_name, project_id)
//   );

import { NextResponse } from "next/server";
import { runEmailRecovery } from "@/lib/server/email-recovery";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron 보안 — CRON_SECRET 검증
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  try {
    const result = await runEmailRecovery();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("[email-recovery] failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// POST /api/preorder
// body: { email, icp_signal?, intent: 'preorder' | 'paid_intent', amount_won?, utm_* }
// Week 1 진단 — 리드 스퀴즈 사전예약 수집. 인증 불필요.
// IP+UA 해시는 같은 사람의 중복 응답 dedupe용 (visitor_hash). 이메일은 그대로 unique 아님 (의도 변경 가능).

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { sendPreorderEmail } from "@/lib/server/preorder-emails";

export const runtime = "nodejs";

function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

const VALID_ICP = new Set(["kmong_seller", "side_writer", "coach", "other"]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    const intent = String(body.intent ?? "");
    if (intent !== "preorder" && intent !== "paid_intent") {
      return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
    }

    const icpRaw = body.icp_signal;
    const icpSignal: string | null =
      typeof icpRaw === "string" && VALID_ICP.has(icpRaw) ? icpRaw : null;

    let amountWon: number | null = null;
    if (intent === "paid_intent") {
      const n = Number(body.amount_won);
      if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) {
        return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
      }
      amountWon = Math.floor(n);
    }

    const utmSource = body.utm_source ? String(body.utm_source).slice(0, 100) : null;
    const utmMedium = body.utm_medium ? String(body.utm_medium).slice(0, 100) : null;
    const utmCampaign = body.utm_campaign ? String(body.utm_campaign).slice(0, 100) : null;

    const ip = getIp(req);
    const ua = req.headers.get("user-agent") || "";
    const visitorHash = crypto
      .createHash("sha256")
      .update(`${ip}|${ua}`)
      .digest("hex")
      .slice(0, 32);

    // 같은 이메일이 이미 같은 intent로 신청한 경우 dedupe
    // (사용자가 의향가만 추가/변경하는 시나리오는 새 row로 허용)
    const { rows: dupRows } = await sql`
      SELECT id FROM preorders
      WHERE email = ${email}
        AND intent = ${intent}
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    if (dupRows.length > 0) {
      return NextResponse.json(
        { ok: true, deduped: true, message: "이미 24시간 내 같은 신청이 접수됐어요." },
        { status: 200 }
      );
    }

    const { rows: inserted } = await sql<{ id: string }>`
      INSERT INTO preorders
        (email, icp_signal, intent, amount_won, utm_source, utm_medium, utm_campaign, visitor_hash)
      VALUES
        (${email}, ${icpSignal}, ${intent}, ${amountWon}, ${utmSource}, ${utmMedium}, ${utmCampaign}, ${visitorHash})
      RETURNING id
    `;
    const preorderId = inserted[0]?.id;

    // Day 0 즉시 답장 (실패해도 응답은 200 유지 — 사용자 UX 우선)
    if (preorderId) {
      sendPreorderEmail(0, { email, icpSignal })
        .then(async (r) => {
          if (r.ok) {
            await sql`
              INSERT INTO preorder_sequence_log (preorder_id, step)
              VALUES (${preorderId}, 0)
              ON CONFLICT (preorder_id, step) DO NOTHING
            `;
          } else {
            await sql`
              INSERT INTO preorder_sequence_log (preorder_id, step, failed_at, fail_reason)
              VALUES (${preorderId}, 0, NOW(), ${r.reason})
              ON CONFLICT (preorder_id, step) DO NOTHING
            `;
          }
        })
        .catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "PREORDER_FAILED" }, { status: 500 });
  }
}

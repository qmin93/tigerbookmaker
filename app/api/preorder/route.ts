// POST /api/preorder
// body: { email, icp_signal?, intent: 'preorder' | 'paid_intent', amount_won?, utm_* }
// Week 1 진단 — 리드 스퀴즈 사전예약 수집. 인증 불필요.
// IP+UA 해시는 같은 사람의 중복 응답 dedupe용 (visitor_hash). 이메일은 그대로 unique 아님 (의도 변경 가능).

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

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

    await sql`
      INSERT INTO preorders
        (email, icp_signal, intent, amount_won, utm_source, utm_medium, utm_campaign, visitor_hash)
      VALUES
        (${email}, ${icpSignal}, ${intent}, ${amountWon}, ${utmSource}, ${utmMedium}, ${utmCampaign}, ${visitorHash})
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "PREORDER_FAILED" }, { status: 500 });
  }
}

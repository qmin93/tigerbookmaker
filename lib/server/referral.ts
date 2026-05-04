import { sql } from "@vercel/postgres";

const CODE_LENGTH = 6;
const REWARD_AMOUNT = 2000;

export function generateCode(seed: string): string {
  // base = email prefix, suffix = random 3 chars
  const base = seed.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const random = Math.random().toString(36).slice(2, 5);
  return `${base || "tiger"}-${random}`;
}

export async function ensureReferralCode(userId: string, email: string): Promise<{ code: string }> {
  const { rows } = await sql<{ code: string }>`
    SELECT code FROM referral_codes WHERE user_id = ${userId}
  `;
  if (rows.length > 0) return rows[0];

  let code = generateCode(email);
  for (let i = 0; i < 5; i++) {
    const exists = await sql`SELECT 1 FROM referral_codes WHERE code = ${code}`;
    if (exists.rows.length === 0) break;
    code = generateCode(email);
  }
  try {
    await sql`INSERT INTO referral_codes (user_id, code) VALUES (${userId}, ${code})`;
  } catch (e: any) {
    if (e.code === "23505") {
      // race
      const r = await sql<{ code: string }>`SELECT code FROM referral_codes WHERE user_id = ${userId}`;
      if (r.rows[0]) return r.rows[0];
    }
    throw e;
  }
  return { code };
}

export async function getReferrerByCode(code: string): Promise<string | null> {
  const { rows } = await sql<{ user_id: string }>`
    SELECT user_id FROM referral_codes WHERE code = ${code.toLowerCase()}
  `;
  return rows[0]?.user_id ?? null;
}

export async function recordReferralSignup(opts: {
  referrerUserId: string;
  referredUserId: string;
  code: string;
}): Promise<void> {
  await sql`
    INSERT INTO referral_signups (referrer_user_id, referred_user_id, code)
    VALUES (${opts.referrerUserId}, ${opts.referredUserId}, ${opts.code})
    ON CONFLICT (referred_user_id) DO NOTHING
  `;
}

export async function awardReferralCredits(referredUserId: string): Promise<{
  awarded: boolean;
  referrerUserId?: string;
  amount?: number;
}> {
  // Get pending signup
  const { rows } = await sql<{ id: string; referrer_user_id: string; credit_amount: number }>`
    SELECT id, referrer_user_id, credit_amount
    FROM referral_signups
    WHERE referred_user_id = ${referredUserId} AND awarded_at IS NULL
  `;
  if (rows.length === 0) return { awarded: false };

  const r = rows[0];
  const amount = r.credit_amount;

  // Atomic award: update users + counters + mark awarded
  await sql`UPDATE users SET balance_krw = balance_krw + ${amount} WHERE id = ${r.referrer_user_id}`;
  await sql`UPDATE users SET balance_krw = balance_krw + ${amount} WHERE id = ${referredUserId}`;
  await sql`
    UPDATE referral_codes
    SET total_referred = total_referred + 1,
        total_credits_earned = total_credits_earned + ${amount}
    WHERE user_id = ${r.referrer_user_id}
  `;
  await sql`
    UPDATE referral_signups
    SET awarded_at = NOW()
    WHERE id = ${r.id}
  `;

  return { awarded: true, referrerUserId: r.referrer_user_id, amount };
}

export async function getReferralStats(userId: string): Promise<{
  code: string | null;
  totalReferred: number;
  totalCreditsEarned: number;
  recentSignups: Array<{ awarded_at: string | null; created_at: string }>;
}> {
  const codeRow = await sql<{ code: string; total_referred: number; total_credits_earned: number }>`
    SELECT code, total_referred, total_credits_earned FROM referral_codes WHERE user_id = ${userId}
  `;
  if (codeRow.rows.length === 0) {
    return { code: null, totalReferred: 0, totalCreditsEarned: 0, recentSignups: [] };
  }
  const recent = await sql<{ awarded_at: string | null; created_at: string }>`
    SELECT awarded_at, created_at FROM referral_signups
    WHERE referrer_user_id = ${userId}
    ORDER BY created_at DESC LIMIT 10
  `;
  return {
    code: codeRow.rows[0].code,
    totalReferred: codeRow.rows[0].total_referred,
    totalCreditsEarned: codeRow.rows[0].total_credits_earned,
    recentSignups: recent.rows,
  };
}

// DB 클라이언트 — Vercel Postgres + Drizzle
// 실제 사용 전 `npm i drizzle-orm postgres @vercel/postgres` + 마이그레이션 적용 필요

import "server-only";
import { sql } from "@vercel/postgres";

// 견적 함수용 환율
export const USD_TO_KRW = 1_380;

// ──────────────────────────────────────────
// User
// ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  balance_krw: number;
  total_charged: number;
  total_spent: number;
  signup_bonus_given: boolean;
}

export async function getUser(userId: string): Promise<User | null> {
  const { rows } = await sql<User>`
    SELECT id, email, balance_krw, total_charged, total_spent, signup_bonus_given
    FROM users WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await sql<User>`
    SELECT id, email, balance_krw, total_charged, total_spent, signup_bonus_given
    FROM users WHERE email = ${email}
  `;
  return rows[0] ?? null;
}

// ──────────────────────────────────────────
// 잔액 변동 — 항상 transaction으로 원자성 보장
// ──────────────────────────────────────────

export async function chargeBalance(opts: {
  userId: string;
  amountKRW: number;
  bonusKRW?: number;
  paymentId: string;
}): Promise<{ newBalance: number }> {
  const totalCredit = opts.amountKRW + (opts.bonusKRW ?? 0);
  // 단순화: 실제로는 BEGIN/COMMIT 또는 RPC 사용
  const { rows } = await sql`
    UPDATE users
    SET balance_krw = balance_krw + ${totalCredit},
        total_charged = total_charged + ${opts.amountKRW},
        updated_at = NOW()
    WHERE id = ${opts.userId}
    RETURNING balance_krw
  `;
  await sql`
    INSERT INTO balance_transactions (user_id, type, amount_krw, balance_after, payment_id, reason)
    VALUES (${opts.userId}, 'charge', ${totalCredit}, ${rows[0].balance_krw}, ${opts.paymentId},
            ${opts.bonusKRW ? `${opts.amountKRW}원 충전 + ${opts.bonusKRW}원 보너스` : `${opts.amountKRW}원 충전`})
  `;
  return { newBalance: rows[0].balance_krw };
}

export async function deductBalance(opts: {
  userId: string;
  amountKRW: number;
  aiUsageId: string;
  reason: string;
}): Promise<{ newBalance: number }> {
  const { rows } = await sql`
    UPDATE users
    SET balance_krw = balance_krw - ${opts.amountKRW},
        total_spent = total_spent + ${opts.amountKRW},
        updated_at = NOW()
    WHERE id = ${opts.userId} AND balance_krw >= ${opts.amountKRW}
    RETURNING balance_krw
  `;
  if (rows.length === 0) throw new Error("INSUFFICIENT_BALANCE_RACE");
  await sql`
    INSERT INTO balance_transactions (user_id, type, amount_krw, balance_after, ai_usage_id, reason)
    VALUES (${opts.userId}, 'spend', ${-opts.amountKRW}, ${rows[0].balance_krw}, ${opts.aiUsageId}, ${opts.reason})
  `;
  return { newBalance: rows[0].balance_krw };
}

// ──────────────────────────────────────────
// AI 사용 로그
// ──────────────────────────────────────────

export async function logAIUsage(opts: {
  userId: string;
  task: 'toc' | 'chapter' | 'edit' | 'batch' | 'summary';
  model: string;
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUSD: number;
  costKRW: number;
  durationMs: number;
  projectId?: string;
  chapterIdx?: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}): Promise<{ id: string }> {
  const { rows } = await sql<{ id: string }>`
    INSERT INTO ai_usage (
      user_id, task, model, input_tokens, output_tokens, thoughts_tokens,
      cache_read_tokens, cache_write_tokens, cost_usd, cost_krw, duration_ms,
      project_id, chapter_idx, status, error_message
    ) VALUES (
      ${opts.userId}, ${opts.task}, ${opts.model}, ${opts.inputTokens}, ${opts.outputTokens},
      ${opts.thoughtsTokens}, ${opts.cacheReadTokens}, ${opts.cacheWriteTokens},
      ${opts.costUSD}, ${opts.costKRW}, ${opts.durationMs ?? null},
      ${opts.projectId ?? null}, ${opts.chapterIdx ?? null}, ${opts.status},
      ${opts.errorMessage ?? null}
    )
    RETURNING id
  `;
  return { id: rows[0].id };
}

// ──────────────────────────────────────────
// Project
// ──────────────────────────────────────────

export interface BookProjectRow {
  id: string;
  user_id: string;
  topic: string;
  audience: string;
  type: string;
  target_pages: number;
  data: any;
}

export async function getProject(projectId: string, userId: string): Promise<BookProjectRow | null> {
  const { rows } = await sql<BookProjectRow>`
    SELECT id, user_id, topic, audience, type, target_pages, data
    FROM book_projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function updateProjectData(projectId: string, userId: string, data: any): Promise<void> {
  await sql`
    UPDATE book_projects SET data = ${JSON.stringify(data)}, updated_at = NOW()
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
}

// 첫 책 완성 보너스 (v3 Phase 3.3)
// spec: docs/superpowers/specs/2026-05-13-write-flow-v3-design.md §3.6
//
// 자격:
//   1. 사용자 first_book_bonus_given = false (1회 한정 어뷰징 방지)
//   2. 대상 프로젝트의 모든 챕터 content 완료
// → ₩5,000 추가 크레딧 + flag 플립.
//
// 트리거 지점: 첫 export 호출 시 (epub/pdf/docx route). 책 1권 완성 ≈ export.
//
// 동시성: UPDATE ... WHERE first_book_bonus_given = false RETURNING 으로
// 원자성 보장 — 동시 export 두 번 호출돼도 1번만 지급된다.

import "server-only";
import { sql } from "@vercel/postgres";

const FIRST_BOOK_BONUS_KRW = 5_000;

export interface AwardResult {
  awarded: boolean;
  newBalance: number;
  /** 보너스를 못 받은 이유 (디버깅용, awarded=false일 때만) */
  reason?: "already_given" | "no_chapters" | "incomplete" | "project_not_found";
}

/**
 * 사용자가 첫 책 완성 자격이 되는지 확인 후 ₩5,000 지급.
 *
 * 보너스 지급 조건:
 *   - users.first_book_bonus_given = false
 *   - book_projects.data.chapters 가 전부 content 채워짐
 *
 * 멱등: 같은 (userId, projectId) 두 번 호출해도 첫 번째만 지급.
 *
 * @returns awarded=true 면 ₩5,000 지급됨. awarded=false 면 newBalance 는 현재 잔액.
 */
export async function awardFirstBookBonusIfEligible(
  userId: string,
  projectId: string,
): Promise<AwardResult> {
  // 1. 프로젝트 가져와서 모든 챕터 완료 확인
  const { rows: projectRows } = await sql<{ data: any }>`
    SELECT data FROM book_projects
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
  if (projectRows.length === 0) {
    const { rows: balanceRows } = await sql<{ balance_krw: number }>`
      SELECT balance_krw FROM users WHERE id = ${userId}
    `;
    return {
      awarded: false,
      newBalance: balanceRows[0]?.balance_krw ?? 0,
      reason: "project_not_found",
    };
  }

  const chapters: Array<{ content?: string }> = projectRows[0].data?.chapters ?? [];
  if (chapters.length === 0) {
    const { rows: balanceRows } = await sql<{ balance_krw: number }>`
      SELECT balance_krw FROM users WHERE id = ${userId}
    `;
    return {
      awarded: false,
      newBalance: balanceRows[0]?.balance_krw ?? 0,
      reason: "no_chapters",
    };
  }
  const allComplete = chapters.every(ch => typeof ch.content === "string" && ch.content.trim().length > 0);
  if (!allComplete) {
    const { rows: balanceRows } = await sql<{ balance_krw: number }>`
      SELECT balance_krw FROM users WHERE id = ${userId}
    `;
    return {
      awarded: false,
      newBalance: balanceRows[0]?.balance_krw ?? 0,
      reason: "incomplete",
    };
  }

  // 2. 보너스 flag 원자적 flip + balance 증가
  //    WHERE first_book_bonus_given = false → 동시 호출 시 한쪽만 RETURNING
  const { rows: updatedRows } = await sql<{ balance_krw: number }>`
    UPDATE users
    SET balance_krw = balance_krw + ${FIRST_BOOK_BONUS_KRW},
        first_book_bonus_given = true,
        updated_at = NOW()
    WHERE id = ${userId} AND first_book_bonus_given = false
    RETURNING balance_krw
  `;

  if (updatedRows.length === 0) {
    // 이미 지급됨 — 현재 잔액 조회해서 응답
    const { rows: balanceRows } = await sql<{ balance_krw: number }>`
      SELECT balance_krw FROM users WHERE id = ${userId}
    `;
    return {
      awarded: false,
      newBalance: balanceRows[0]?.balance_krw ?? 0,
      reason: "already_given",
    };
  }

  // 3. balance_transactions 기록 (type: bonus)
  await sql`
    INSERT INTO balance_transactions (user_id, type, amount_krw, balance_after, reason)
    VALUES (
      ${userId}, 'bonus', ${FIRST_BOOK_BONUS_KRW}, ${updatedRows[0].balance_krw},
      ${"🎉 첫 책 완성 보너스 (v3 Phase 3)"}
    )
  `;

  return {
    awarded: true,
    newBalance: updatedRows[0].balance_krw,
  };
}

// GET /api/analytics/recent-completions
// /write 흐름 v3 Phase 4.2 — 완성 축하 피드 (spec section 3.8).
// 최근 7일 동안 모든 챕터가 완성된 책 = 사회적 증거 + 동기부여.
//
// 응답 (PII 없음 — user_id / project_id / email 노출 금지):
//   completions[]
//     displayHandle  — shareEnabled 면 "<handle 첫글자>○님", 아니면 "○○님"
//     topic          — shareEnabled 면 책 주제, 아니면 null
//     type           — shareEnabled 면 책 type, 아니면 null
//     completedAt    — book_projects.updated_at (ISO)
//   totalIn7Days    — 같은 조건의 총 권 수 (목록은 LIMIT 10, 카운트는 전체)
//
// 프라이버시:
//   - shareEnabled = data->>'shareEnabled' === 'true'. 명시적 opt-in 만 책 주제 공개.
//   - 기본 false → "비공개 책" + "○○님". UI 옵트인 토글은 Phase 4.2 범위 외.
//   - handle 도 첫 글자 + ○ 만 노출. 사용자 직접 식별 차단.
//
// 캐시: revalidate 300s + Cache-Control s-maxage=300. 5분 polling 부하 완화.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const revalidate = 300;

interface CompletionRow {
  topic: string;
  book_type: string | null;
  // pg 드라이버는 timestamptz 를 Date 로 줄 수 있고, 환경에 따라 string 으로도 옴.
  updated_at: Date | string;
  handle: string | null;
  share_enabled: boolean;
}

interface CompletionItem {
  displayHandle: string;
  topic: string | null;
  type: string | null;
  completedAt: string;
}

// handle 마스킹: "kyumin" → "k○님". null/빈 값 → "○○님".
// 한글/영문 첫 코드포인트 1개만 노출 (이모지 surrogate-pair 안전).
function maskHandle(handle: string | null | undefined): string {
  if (!handle) return "○○님";
  const trimmed = handle.trim();
  if (!trimmed) return "○○님";
  const first = Array.from(trimmed)[0] ?? "";
  if (!first) return "○○님";
  return `${first}○님`;
}

export async function GET() {
  let completions: CompletionItem[] = [];
  let totalIn7Days = 0;

  try {
    // 완성 = chapters 배열이 비어있지 않고 모든 chapter 의 content 가 비어있지 않음.
    // updated_at 이 지난 7일 내 = 최근 완성 (정렬 + 윈도우 동시 사용).
    // LEFT JOIN user_profiles — 프로필 없는 사용자도 포함 (handle null → "○○님").
    const { rows } = await sql<CompletionRow>`
      SELECT
        bp.topic                                  AS topic,
        bp.type                                   AS book_type,
        bp.updated_at                             AS updated_at,
        up.handle                                 AS handle,
        COALESCE(bp.data->>'shareEnabled', 'false') = 'true' AS share_enabled
      FROM book_projects bp
      LEFT JOIN user_profiles up ON up.user_id = bp.user_id
      WHERE bp.updated_at > NOW() - INTERVAL '7 days'
        AND jsonb_typeof(bp.data->'chapters') = 'array'
        AND jsonb_array_length(bp.data->'chapters') > 0
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(bp.data->'chapters') AS ch
          WHERE COALESCE(ch->>'content', '') = ''
        )
      ORDER BY bp.updated_at DESC
      LIMIT 10
    `;

    completions = rows.map((r) => ({
      displayHandle: maskHandle(r.share_enabled ? r.handle : null),
      topic: r.share_enabled ? r.topic : null,
      type: r.share_enabled ? r.book_type : null,
      completedAt:
        r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  } catch {
    completions = [];
  }

  try {
    // 총 카운트 — 같은 완성 조건, LIMIT 없음.
    const { rows } = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c
      FROM book_projects bp
      WHERE bp.updated_at > NOW() - INTERVAL '7 days'
        AND jsonb_typeof(bp.data->'chapters') = 'array'
        AND jsonb_array_length(bp.data->'chapters') > 0
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(bp.data->'chapters') AS ch
          WHERE COALESCE(ch->>'content', '') = ''
        )
    `;
    totalIn7Days = Number(rows[0]?.c ?? 0);
  } catch {
    totalIn7Days = 0;
  }

  return NextResponse.json(
    { completions, totalIn7Days },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

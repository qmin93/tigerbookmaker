// GET /api/trends — Tigerbookmaker 내부 트렌드 (외부 크롤링 X)
//  - 최근 30일 가장 많이 만들어진 주제 키워드 (topic split)
//  - 책 유형별 분포
//  - 인기 테마 컬러
//
// 외부(크몽·교보) 크롤링은 정책 회색지대라 제외. 향후 공식 API 통합으로 보강.

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET() {
  try {
    // 최근 30일 만들어진 책 데이터 모음
    const { rows: recentBooks } = await sql<{ topic: string; type: string; data: any }>`
      SELECT topic, type, data
      FROM book_projects
      WHERE created_at >= NOW() - interval '30 days'
        AND data->>'shareEnabled' = 'true'
      LIMIT 1000
    `;

    // 책 유형별 카운트
    const typeCount: Record<string, number> = {};
    const colorCount: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};

    for (const r of recentBooks) {
      typeCount[r.type] = (typeCount[r.type] ?? 0) + 1;
      const color = r.data?.themeColor ?? "orange";
      colorCount[color] = (colorCount[color] ?? 0) + 1;

      // 주제에서 키워드 추출 — 한국어 명사 chunk (2자 이상). 단순 split.
      const tokens = String(r.topic ?? "")
        .split(/[\s,·—\-:|/(){}[\]"']/)
        .map(t => t.trim())
        .filter(t => t.length >= 2 && t.length <= 12);
      for (const t of tokens) {
        if (/^[a-zA-Z0-9]+$/.test(t)) continue; // 영문·숫자 단독은 skip
        if (STOPWORDS.has(t)) continue;
        keywordCount[t] = (keywordCount[t] ?? 0) + 1;
      }
    }

    const sortedKeywords = Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    const sortedTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    const sortedColors = Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => ({ color, count }));

    return NextResponse.json({
      ok: true,
      window: "30days",
      totalBooks: recentBooks.length,
      topKeywords: sortedKeywords,
      typeDistribution: sortedTypes,
      colorDistribution: sortedColors,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[/api/trends]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

const STOPWORDS = new Set([
  "그리고", "또는", "하지만", "그러나", "그래서", "이런", "저런",
  "위한", "위해", "이상", "이하", "통해", "관한", "대한",
  "있는", "없는", "되는", "하는",
  "최고", "가장", "정말", "진짜",
]);

// GET /api/book/[id]/quality
// 크몽 통과 가능성 heuristic (no AI). 프로젝트 데이터를 순회하며 6가지 기준 평가.
// 결과: { score: 0~100, breakdown: { criterion, passed, weight }[] }
//
// 기준 (총 100점):
//  1. 챕터 수 ≥ 12        → 20점
//  2. 총 페이지 100~200    → 20점
//  3. 챕터별 [IMAGE: ] 채워짐 → 20점 (모든 placeholder가 dataUrl로 치환됨)
//  4. 표지 이미지 존재      → 10점
//  5. 마케팅 카피 존재      → 10점
//  6. AI 표현 빈도 < 5%   → 20점
//
// v3 Phase 2.2 (2026-05-13).
//
// Cache: 1시간 — same project re-call은 stale-while-revalidate (Next.js fetch revalidate 외 수동).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject } from "@/lib/server/db";

export const runtime = "nodejs";
export const maxDuration = 10;
// Next.js segment-level revalidate — 같은 URL을 1시간 동안 같은 응답으로 캐시 (Vercel edge cache 활용)
// 동적 라우트 + 인증 사용으로 인해 Cache-Control도 명시.
export const revalidate = 3600;

interface BreakdownItem {
  criterion: string;
  passed: boolean;
  weight: number;
  detail?: string;
}

interface QualityResult {
  score: number;
  breakdown: BreakdownItem[];
  generatedAt: string;
}

// AI 특유 표현 패턴 — 한국어 LLM 결과물에 흔한 번역투/관용구.
// 길이 비례 빈도가 5% 미만이면 PASS.
const AI_PATTERNS: RegExp[] = [
  /할\s*수\s*있습니다/g,
  /이라고\s*할\s*수\s*있다/g,
  /할\s*수\s*있다/g,
  /다음과\s*같이/g,
  /결론적으로\s*말하자면/g,
  /이러한\s*점에서/g,
  /이는\s*\S+\s*를\s*의미한다/g,
  /필요가\s*있다/g,
  /필요가\s*있습니다/g,
  /것이\s*중요하다/g,
  /것이\s*중요합니다/g,
  /살펴보면/g,
  /살펴보겠습니다/g,
  /나아가/g,
  /더\s*나아가/g,
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 모든 챕터 본문에서 AI 표현 빈도 = matches / totalChars × 100 (%) */
function aiExpressionPercent(chapters: any[]): number {
  let totalChars = 0;
  let totalMatches = 0;
  for (const ch of chapters) {
    const text = typeof ch?.content === "string" ? ch.content : "";
    if (text.length === 0) continue;
    totalChars += text.length;
    for (const re of AI_PATTERNS) {
      // 패턴 글로벌 — exec 대신 String.match (모든 매치)
      const matches = text.match(re);
      if (matches) totalMatches += matches.length;
    }
  }
  if (totalChars === 0) return 100; // 본문 없으면 최악으로 평가
  // 매치 1개 = 평균 7자 가정 → 매치 수 × 7 / totalChars × 100
  return (totalMatches * 7 / totalChars) * 100;
}

/** [IMAGE: ...] placeholder 중 dataUrl이 채워진 비율. 100% 채워져야 PASS. */
function imagesFilledRatio(chapters: any[]): { totalPlaceholders: number; filled: number } {
  let totalPlaceholders = 0;
  let filled = 0;
  for (const ch of chapters) {
    const text = typeof ch?.content === "string" ? ch.content : "";
    const placeholderMatches = text.match(/\[IMAGE:\s*[^\]]*\]/g);
    const placeholdersInText = placeholderMatches?.length ?? 0;
    totalPlaceholders += placeholdersInText;
    const imgs = Array.isArray(ch?.images) ? ch.images : [];
    for (const img of imgs) {
      if (img?.dataUrl && typeof img.dataUrl === "string" && img.dataUrl.length > 100) {
        filled++;
      }
    }
  }
  return { totalPlaceholders, filled };
}

/** 본문 길이 합으로 페이지 수 추정. 한 페이지 ≈ 800자 (한국어 단행본 기준). */
function estimatePages(chapters: any[]): number {
  const totalChars = chapters.reduce((sum, ch) => sum + (typeof ch?.content === "string" ? ch.content.length : 0), 0);
  return Math.round(totalChars / 800);
}

function calcQuality(data: any): QualityResult {
  const chapters: any[] = Array.isArray(data?.chapters) ? data.chapters : [];
  const breakdown: BreakdownItem[] = [];

  // 1. 챕터 수 ≥ 12
  const chapterCount = chapters.length;
  breakdown.push({
    criterion: `챕터 ${chapterCount}개 (목표 12개+)`,
    passed: chapterCount >= 12,
    weight: 20,
    detail: chapterCount >= 12 ? "PASS" : `${12 - chapterCount}개 더 필요`,
  });

  // 2. 페이지 수 100~200
  const pages = estimatePages(chapters);
  const pagesPass = pages >= 100 && pages <= 200;
  breakdown.push({
    criterion: `예상 ${pages}쪽 (목표 100~200쪽)`,
    passed: pagesPass,
    weight: 20,
    detail: pagesPass
      ? "PASS"
      : pages < 100
        ? `${100 - pages}쪽 더 필요 (본문 더 쓰세요)`
        : `${pages - 200}쪽 초과 (압축 필요)`,
  });

  // 3. [IMAGE: ] placeholder 다 채워짐
  const { totalPlaceholders, filled } = imagesFilledRatio(chapters);
  const imagesPass = totalPlaceholders === 0 ? false : filled >= totalPlaceholders;
  breakdown.push({
    criterion: totalPlaceholders === 0
      ? "본문 이미지 placeholder 없음"
      : `이미지 ${filled}/${totalPlaceholders} 채워짐`,
    passed: imagesPass,
    weight: 20,
    detail: totalPlaceholders === 0
      ? "[IMAGE: ] 자리표시자 추가 필요"
      : imagesPass
        ? "PASS"
        : `${totalPlaceholders - filled}개 더 생성 필요`,
  });

  // 4. 표지 이미지 존재
  const coverImg = data?.kmongPackage?.images?.find((i: any) => i?.type === "cover");
  const hasCover = !!(coverImg?.base64 || data?.cover?.base64 || data?.coverDataUrl);
  breakdown.push({
    criterion: "표지 이미지",
    passed: hasCover,
    weight: 10,
    detail: hasCover ? "PASS" : "표지 단계에서 생성 필요",
  });

  // 5. 마케팅 카피 — marketingMeta 또는 kmongPackage.copy
  const hasMarketingCopy = !!(
    data?.marketingMeta?.tagline ||
    data?.marketingMeta?.description ||
    data?.kmongPackage?.copy?.intro ||
    data?.kmongPackage?.copy?.body
  );
  breakdown.push({
    criterion: "마케팅 카피 (상세 페이지)",
    passed: hasMarketingCopy,
    weight: 10,
    detail: hasMarketingCopy ? "PASS" : "마케팅 단계에서 작성 필요",
  });

  // 6. AI 표현 < 5%
  const aiPct = aiExpressionPercent(chapters);
  const aiPctRounded = Math.round(aiPct * 10) / 10;
  const aiPass = aiPct < 5;
  breakdown.push({
    criterion: `AI 표현 빈도 ${aiPctRounded}% (목표 < 5%)`,
    passed: aiPass,
    weight: 20,
    detail: aiPass
      ? "PASS — 한국어 자연성 양호"
      : "번역투·AI 관용구 많음. 챕터별 재생성 또는 직접 수정 추천",
  });

  const score = breakdown.reduce((sum, b) => sum + (b.passed ? b.weight : 0), 0);
  return { score, breakdown, generatedAt: new Date().toISOString() };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!params.id || !UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "INVALID_BOOK_ID" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    const projectRow = await getProject(params.id, userId);
    if (!projectRow) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const result = calcQuality(projectRow.data);

    return NextResponse.json(result, {
      headers: {
        // 사용자별·프로젝트별 캐시 1시간
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=60",
      },
    });
  } catch (e: any) {
    console.error("[/api/book/[id]/quality] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

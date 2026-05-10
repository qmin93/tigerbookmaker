// GET /api/profile/badges — 본인 작가 등급 + 챌린지 진행 상황 (auth 필요)
// 응답: {
//   ok, badges: { bookCount, seriesCount, totalRevenueKRW, level, levelEmoji, nextLevel, nextLevelTarget, progress }
// }
//
// Level 산정:
// - 신인작가:    첫 책 1권 완성
// - 성장작가:    책 5권 OR 시리즈 1개
// - 베스트셀러:  책 10권 + 누적 매출 ₩50,000+
// - 마스터:      책 30권 OR 누적 매출 ₩1,000,000+

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

type Level = "신인작가" | "성장작가" | "베스트셀러 작가" | "마스터 작가" | "예비작가";

interface LevelInfo {
  level: Level;
  emoji: string;
  blurb: string;
}

const LEVEL_INFO: Record<Level, LevelInfo> = {
  "예비작가":         { level: "예비작가",         emoji: "🐯", blurb: "첫 책을 완성해보세요!" },
  "신인작가":         { level: "신인작가",         emoji: "🌱", blurb: "첫 책 완성! 작가 입문" },
  "성장작가":         { level: "성장작가",         emoji: "🌿", blurb: "책 5권 또는 시리즈 1개 달성" },
  "베스트셀러 작가":  { level: "베스트셀러 작가", emoji: "🌟", blurb: "10권 + 매출 ₩50,000+ 달성" },
  "마스터 작가":      { level: "마스터 작가",      emoji: "👑", blurb: "30권 또는 매출 ₩1,000,000+ 달성" },
};

function computeLevel(bookCount: number, seriesCount: number, totalRevenueKRW: number):
  { current: Level; next: Level | null; nextTargetText: string; progress: number } {
  // master: 30권 OR 매출 1M+
  if (bookCount >= 30 || totalRevenueKRW >= 1_000_000) {
    return { current: "마스터 작가", next: null, nextTargetText: "최고 등급 달성", progress: 1 };
  }
  // best: 10권 AND 매출 50,000+
  if (bookCount >= 10 && totalRevenueKRW >= 50_000) {
    // master까지 — 30권 OR 1M 매출 중 가까운 쪽
    const byBook = Math.min(1, bookCount / 30);
    const byRev = Math.min(1, totalRevenueKRW / 1_000_000);
    const progress = Math.max(byBook, byRev);
    const nextTargetText = `${30 - bookCount}권 또는 ₩${Math.max(0, 1_000_000 - totalRevenueKRW).toLocaleString()} 매출 추가`;
    return { current: "베스트셀러 작가", next: "마스터 작가", nextTargetText, progress };
  }
  // 성장: 5권 OR 시리즈 1개
  if (bookCount >= 5 || seriesCount >= 1) {
    // 베스트셀러까지 — 10권 + 50,000원
    const byBook = Math.min(1, bookCount / 10);
    const byRev = Math.min(1, totalRevenueKRW / 50_000);
    const progress = Math.min(byBook, byRev); // 둘 다 충족 필요
    const need: string[] = [];
    if (bookCount < 10) need.push(`${10 - bookCount}권`);
    if (totalRevenueKRW < 50_000) need.push(`₩${(50_000 - totalRevenueKRW).toLocaleString()} 매출`);
    return {
      current: "성장작가",
      next: "베스트셀러 작가",
      nextTargetText: need.join(" + ") || "조건 충족 — 곧 승급!",
      progress,
    };
  }
  // 신인: 1권+
  if (bookCount >= 1) {
    // 성장까지 — 5권 OR 시리즈 1개
    const byBook = Math.min(1, bookCount / 5);
    const bySeries = Math.min(1, seriesCount); // 1 이상이면 1
    const progress = Math.max(byBook, bySeries);
    return {
      current: "신인작가",
      next: "성장작가",
      nextTargetText: `${5 - bookCount}권 또는 시리즈 1개 추가`,
      progress,
    };
  }
  // 책 0권 — 예비
  return {
    current: "예비작가",
    next: "신인작가",
    nextTargetText: "첫 책 1권 완성하기",
    progress: 0,
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = session.user.id;

    // 책 수 — chapters 1개 이상 본문 작성된 것만 "완성된" 책으로 카운트
    // (간단하게는 그냥 모든 row, 더 엄격하게는 chapters[].content 1개 이상)
    const { rows: bookRows } = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c FROM book_projects WHERE user_id = ${userId}
    `;
    const bookCount = Number(bookRows[0]?.c ?? 0);

    // 시리즈 수 — 본인 책 중 distinct seriesId 개수
    let seriesCount = 0;
    try {
      const { rows: srRows } = await sql<{ c: string }>`
        SELECT COUNT(DISTINCT data->'seriesMembership'->>'seriesId')::text AS c
        FROM book_projects
        WHERE user_id = ${userId}
          AND data->'seriesMembership'->>'seriesId' IS NOT NULL
      `;
      seriesCount = Number(srRows[0]?.c ?? 0);
    } catch {
      // ignore
    }

    // 누적 매출 (사용자 직접 입력)
    let totalRevenueKRW = 0;
    try {
      const { rows: revRows } = await sql<{ total_revenue: string }>`
        SELECT COALESCE(SUM((data->'revenue'->>'netTotalKRW')::bigint), 0)::text AS total_revenue
        FROM book_projects
        WHERE user_id = ${userId} AND data->'revenue' IS NOT NULL
      `;
      totalRevenueKRW = Number(revRows[0]?.total_revenue ?? 0);
    } catch {
      // ignore
    }

    const levelData = computeLevel(bookCount, seriesCount, totalRevenueKRW);
    const info = LEVEL_INFO[levelData.current];
    const nextInfo = levelData.next ? LEVEL_INFO[levelData.next] : null;

    // 추가 detail — achievement 계산용
    let multiTypes = 0;
    let bookWithMarketing = 0;
    let bookWithMetaAds = 0;
    let bookWithAudiobook = 0;
    let bookFullPackage = 0; // 본문+표지+마케팅+Meta광고 다 있는 책
    try {
      const { rows: detailRows } = await sql<any>`
        SELECT type, data FROM book_projects WHERE user_id = ${userId}
      `;
      const typeSet = new Set<string>();
      for (const r of detailRows) {
        if (r.type) typeSet.add(r.type);
        const d = r.data ?? {};
        const hasMarketing = !!d?.marketingMeta?.tagline;
        const hasMetaCopy = !!d?.metaAdPackage;
        const hasMetaImg = Array.isArray(d?.metaAdImages) && d.metaAdImages.length > 0;
        const hasCover = !!(d?.kmongPackage?.images?.some((i: any) => i.type === "cover") || d?.coverVariations?.length);
        const hasAudio = Array.isArray(d?.audiobook?.chapters) && d.audiobook.chapters.length > 0;
        if (hasMarketing) bookWithMarketing++;
        if (hasMetaCopy && hasMetaImg) bookWithMetaAds++;
        if (hasAudio) bookWithAudiobook++;
        if (hasMarketing && hasCover && hasMetaCopy && hasMetaImg) bookFullPackage++;
      }
      multiTypes = typeSet.size;
    } catch {}

    // Achievement badges — 조건 충족 시 unlocked
    const achievements = [
      { key: "first_book",       emoji: "🎉", title: "첫 책 완성",        unlocked: bookCount >= 1,            desc: "축하합니다! 첫 책을 완성했어요." },
      { key: "five_books",       emoji: "📚", title: "다섯 권의 작가",    unlocked: bookCount >= 5,            desc: "5권 이상 출간" },
      { key: "ten_books",        emoji: "🏅", title: "두 자릿수 작가",    unlocked: bookCount >= 10,           desc: "10권 이상 출간" },
      { key: "first_series",     emoji: "🔗", title: "시리즈 작가",       unlocked: seriesCount >= 1,          desc: "시리즈 1개 이상 보유" },
      { key: "multi_series",     emoji: "🌐", title: "멀티 시리즈",       unlocked: seriesCount >= 3,          desc: "시리즈 3개 이상 보유" },
      { key: "multi_genre",      emoji: "🎭", title: "장르 마스터",       unlocked: multiTypes >= 3,           desc: "3가지 이상 장르 출간" },
      { key: "marketing_pro",    emoji: "📝", title: "마케팅 프로",       unlocked: bookWithMarketing >= 3,    desc: "3권 이상 마케팅 카피 완성" },
      { key: "meta_ads_pro",     emoji: "📣", title: "광고 셀러",         unlocked: bookWithMetaAds >= 3,      desc: "3권 이상 Meta 광고 패키지 완성" },
      { key: "audio_creator",    emoji: "🎧", title: "오디오 크리에이터", unlocked: bookWithAudiobook >= 1,    desc: "오디오북 1권 이상 제작" },
      { key: "full_package",     emoji: "💎", title: "풀패키지 제작자",   unlocked: bookFullPackage >= 1,      desc: "1권 이상에서 풀패키지 (본문+표지+마케팅+광고) 완성" },
      { key: "revenue_50k",      emoji: "💰", title: "첫 매출 ₩50,000",   unlocked: totalRevenueKRW >= 50_000, desc: "누적 매출 ₩50,000 돌파" },
      { key: "revenue_500k",     emoji: "💵", title: "매출 ₩500,000",     unlocked: totalRevenueKRW >= 500_000, desc: "누적 매출 ₩500,000 돌파" },
      { key: "revenue_1m",       emoji: "💎", title: "매출 ₩1,000,000",   unlocked: totalRevenueKRW >= 1_000_000, desc: "누적 매출 ₩1,000,000 돌파" },
    ];
    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return NextResponse.json({
      ok: true,
      badges: {
        bookCount,
        seriesCount,
        totalRevenueKRW,
        level: info.level,
        levelEmoji: info.emoji,
        levelBlurb: info.blurb,
        nextLevel: nextInfo?.level ?? null,
        nextLevelEmoji: nextInfo?.emoji ?? null,
        nextLevelTarget: levelData.nextTargetText,
        progress: levelData.progress, // 0~1
      },
      achievements,
      achievementsUnlocked: unlockedCount,
      achievementsTotal: achievements.length,
    });
  } catch (e: any) {
    console.error("[/api/profile/badges]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}

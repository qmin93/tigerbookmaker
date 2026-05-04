// /api/projects/[id]
// GET    — 프로젝트 상세 (data 포함)
// PUT    — 프로젝트 데이터 업데이트 (chapters, etc.)
// PATCH  — 부분 업데이트 (현재: themeColor만)
// DELETE — 프로젝트 삭제

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { getProject, updateProjectData } from "@/lib/server/db";

export const runtime = "nodejs";

const VALID_THEME_COLORS = ["orange", "blue", "green", "purple", "red", "gray"] as const;
type ThemeColorKey = typeof VALID_THEME_COLORS[number];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { rows } = await sql`
    SELECT id, topic, audience, type, target_pages, data, created_at, updated_at
    FROM book_projects
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    id: p.id,
    topic: p.topic,
    audience: p.audience,
    type: p.type,
    targetPages: p.target_pages,
    chapters: p.data?.chapters ?? [],
    kmongPackage: p.data?.kmongPackage,
    interview: p.data?.interview,
    tier: p.data?.tier,
    shareEnabled: p.data?.shareEnabled === true,
    shareLinks: p.data?.shareLinks,
    noImages: p.data?.noImages === true,
    themeColor: p.data?.themeColor ?? "orange",
    marketingMeta: p.data?.marketingMeta,
    metaAdPackage: p.data?.metaAdPackage,
    repurposedContent: p.data?.repurposedContent,
    revenue: p.data?.revenue,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;
  const projectId = params.id;

  const body = await req.json().catch(() => ({}));
  const { themeColor, marketingMeta, metaAdPackage, repurposedContent, coverFromVariation, cover } = body ?? {};

  const projectRow = await getProject(projectId, userId);
  if (!projectRow) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const updates: any = {};

  if (themeColor !== undefined) {
    if (typeof themeColor !== "string" || !(VALID_THEME_COLORS as readonly string[]).includes(themeColor)) {
      return NextResponse.json({ error: "INVALID_THEME", message: "themeColor must be one of: " + VALID_THEME_COLORS.join(", ") }, { status: 400 });
    }
    updates.themeColor = themeColor as ThemeColorKey;
  }

  if (marketingMeta !== undefined) {
    if (typeof marketingMeta !== "object" || marketingMeta === null) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "marketingMeta는 object여야 합니다" }, { status: 400 });
    }
    const sanitized: any = {};
    if (typeof marketingMeta.tagline === "string") sanitized.tagline = marketingMeta.tagline.slice(0, 200);
    if (typeof marketingMeta.description === "string") sanitized.description = marketingMeta.description.slice(0, 3000);
    if (typeof marketingMeta.authorName === "string") sanitized.authorName = marketingMeta.authorName.slice(0, 50);
    if (typeof marketingMeta.authorBio === "string") sanitized.authorBio = marketingMeta.authorBio.slice(0, 300);
    if (Array.isArray(marketingMeta.ctaButtons)) {
      sanitized.ctaButtons = marketingMeta.ctaButtons
        .slice(0, 5)
        .filter((c: any) => typeof c?.label === "string" && typeof c?.url === "string")
        .map((c: any) => ({ label: c.label.slice(0, 30), url: c.url.slice(0, 500) }));
    }
    sanitized.generatedAt = Date.now();
    // 기존 marketingMeta가 있으면 부분 업데이트로 머지
    const existing = (projectRow.data as any)?.marketingMeta ?? {};
    updates.marketingMeta = { ...existing, ...sanitized };
  }

  if (metaAdPackage !== undefined) {
    if (typeof metaAdPackage !== "object" || metaAdPackage === null) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "metaAdPackage는 object여야 합니다" }, { status: 400 });
    }
    const sanitized: any = {};
    if (Array.isArray(metaAdPackage.headlines)) {
      sanitized.headlines = metaAdPackage.headlines.slice(0, 3).map((s: any) => String(s ?? "").slice(0, 40)).filter(Boolean);
    }
    if (Array.isArray(metaAdPackage.primaryTexts)) {
      sanitized.primaryTexts = metaAdPackage.primaryTexts.slice(0, 3).map((s: any) => String(s ?? "").slice(0, 125)).filter(Boolean);
    }
    if (Array.isArray(metaAdPackage.ctaButtons)) {
      const META_CTAS_PATCH = ["학습하기", "자세히 알아보기", "구독하기", "신청하기", "무료 체험"];
      const filtered = metaAdPackage.ctaButtons
        .slice(0, 5)
        .map((s: any) => String(s ?? ""))
        .filter((s: string) => META_CTAS_PATCH.includes(s));
      sanitized.ctaButtons = filtered.length > 0 ? filtered : ["자세히 알아보기"];
    }
    if (typeof metaAdPackage.audienceSuggestion === "object" && metaAdPackage.audienceSuggestion) {
      const aud = metaAdPackage.audienceSuggestion;
      let ageMin = Math.max(18, Math.min(65, Number(aud.ageMin) || 25));
      let ageMax = Math.max(18, Math.min(65, Number(aud.ageMax) || 45));
      if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
      sanitized.audienceSuggestion = {
        ageMin,
        ageMax,
        interests: Array.isArray(aud.interests) ? aud.interests.slice(0, 5).map((s: any) => String(s).slice(0, 30)).filter(Boolean) : [],
        locations: Array.isArray(aud.locations) && aud.locations.length > 0 ? aud.locations.slice(0, 3).map((s: any) => String(s).slice(0, 50)) : ["대한민국"],
      };
    }
    sanitized.generatedAt = Date.now();
    const existing = (projectRow.data as any)?.metaAdPackage ?? {};
    updates.metaAdPackage = { ...existing, ...sanitized };
  }

  if (repurposedContent !== undefined) {
    if (typeof repurposedContent !== "object" || repurposedContent === null) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "repurposedContent는 object여야 합니다" }, { status: 400 });
    }
    // 5 채널 (instagram, youtube, blog, email, kakao) — 기존과 머지
    const ALLOWED_CHANNELS = ["instagram", "youtube", "blog", "email", "kakao"] as const;
    const sanitized: any = { ...((projectRow.data as any)?.repurposedContent ?? {}) };
    for (const ch of ALLOWED_CHANNELS) {
      const ch_value = (repurposedContent as any)[ch];
      if (ch_value !== undefined) {
        if (typeof ch_value === "object" && ch_value !== null) {
          sanitized[ch] = { ...ch_value, generatedAt: Date.now() };
        }
      }
    }
    updates.repurposedContent = sanitized;
  }

  // 표지 다양화 — variation idx 또는 직접 base64 받아 메인 cover로 복사.
  // body: { coverFromVariation: number } 또는 { cover: { base64: string, vendor?: string } }
  const wantsCoverUpdate =
    typeof coverFromVariation === "number" ||
    (cover && typeof cover === "object" && typeof cover.base64 === "string");

  if (wantsCoverUpdate) {
    const existingData: any = projectRow.data ?? {};
    let pickedBase64: string | null = null;
    let pickedVendor = "user-selected";

    if (typeof coverFromVariation === "number") {
      const variations: any[] = Array.isArray(existingData.coverVariations) ? existingData.coverVariations : [];
      const v = variations[coverFromVariation];
      if (!v || typeof v.base64 !== "string") {
        return NextResponse.json({ error: "INVALID_VARIATION", message: `coverVariations[${coverFromVariation}] 없음` }, { status: 400 });
      }
      pickedBase64 = v.base64;
      pickedVendor = v.vendor ?? "user-selected";
    } else if (cover && typeof cover.base64 === "string") {
      // base64 sanity — 너무 작거나 비어있으면 거부
      if (cover.base64.length < 100) {
        return NextResponse.json({ error: "INVALID_INPUT", message: "cover.base64가 비어있거나 너무 짧습니다" }, { status: 400 });
      }
      pickedBase64 = cover.base64;
      if (typeof cover.vendor === "string") pickedVendor = cover.vendor;
    }

    if (pickedBase64) {
      const existingPkg: any = existingData.kmongPackage ?? {
        images: [],
        copy: { kmongDescription: "", kmongHighlights: [], instagram: "", kakao: "", twitter: "", blogReview: "", youtubeDescription: "", naverCafe: "" },
        generatedAt: Date.now(),
        totalCostKRW: 0,
      };
      const others = (existingPkg.images ?? []).filter((i: any) => i.type !== "cover");
      const newCover = { type: "cover", base64: pickedBase64, vendor: pickedVendor, generatedAt: Date.now() };
      updates.kmongPackage = {
        ...existingPkg,
        images: [...others, newCover],
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
  }

  await updateProjectData(projectId, userId, { ...(projectRow.data ?? {}), ...updates });
  return NextResponse.json({ ok: true, updates: { ...updates, kmongPackage: updates.kmongPackage ? { coverUpdated: true, imageCount: updates.kmongPackage.images.length } : undefined } });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json();
  // body.data 통째로 받음 (chapters, images, settings 모두)
  const { data } = body;
  if (!data) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // 기존 data와 spread merge — 클라이언트가 부분 update해도 나머지 필드 보존.
  // (favorite/archived 토글, chapters만 저장, kmongPackage 단독 update 모두 안전)
  const { rows: existing } = await sql<{ data: any }>`
    SELECT data FROM book_projects WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  const existingData = existing[0]?.data ?? {};
  const merged = { ...existingData, ...data };

  const { rowCount } = await sql`
    UPDATE book_projects SET data = ${JSON.stringify(merged)}, updated_at = NOW()
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  if (rowCount === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { rowCount } = await sql`
    DELETE FROM book_projects
    WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  if (rowCount === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

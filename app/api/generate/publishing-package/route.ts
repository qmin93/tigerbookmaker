// POST /api/generate/publishing-package
// 다중 플랫폼 통합 출판 패키지 생성 (clean-redesign v3 spec 3.7).
// body: { projectId, platform: "kmong" | "bookk" | "upaper" }
//
// 크몽: 기존 /api/generate/kmong-package 위임 (이미 완전 구현)
// 부크크 / 유페이퍼: scaffolding 단계 — 플랫폼별 정책 메타 + 카피 생성 가이드만 반환.
//   실제 본문 생성·이미지 생성은 후속 PR에서 부크크/유페이퍼 정책에 맞춰 추가.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject } from "@/lib/server/db";

export const runtime = "nodejs";
export const maxDuration = 30;

type Platform = "kmong" | "bookk" | "upaper";

interface PlatformMeta {
  name: string;
  format: string;
  titleMaxChars: number;
  recommendedPriceRangeKRW: [number, number];
  notes: string[];
}

const PLATFORM_META: Record<Platform, PlatformMeta> = {
  kmong: {
    name: "크몽 (Kmong)",
    format: "PDF · 이메일 발송",
    titleMaxChars: 30,
    recommendedPriceRangeKRW: [9_900, 49_000],
    notes: [
      "AI 도구로 보조한 인간 저작물 허용",
      "카테고리 정책 자주 바뀜 — 등록 전 확인",
      "환불 분쟁 줄이려면 상세설명 명확하게",
    ],
  },
  bookk: {
    name: "부크크 (Bookk)",
    format: "종이책 + 이북 동시 출판",
    titleMaxChars: 60,
    recommendedPriceRangeKRW: [9_900, 25_000],
    notes: [
      "종이책 = ISBN 자동 발급",
      "이북은 EPUB · PDF 둘 다 지원",
      "표지 규격: 5×8 inch 권장 (종이책)",
      "수익 = 정가 × 약 25% (이북 35%)",
    ],
  },
  upaper: {
    name: "유페이퍼 (UPaper)",
    format: "이북 전용 (PDF · EPUB)",
    titleMaxChars: 40,
    recommendedPriceRangeKRW: [3_000, 19_900],
    notes: [
      "카테고리 26개 — 세분화 잘 됨",
      "키워드 30개까지 가능",
      "DRM 옵션 선택 가능",
      "수익 = 정가 × 약 70%",
    ],
  },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { projectId, platform } = body as { projectId?: string; platform?: Platform };

  if (!projectId) return NextResponse.json({ error: "INVALID_INPUT", message: "projectId required" }, { status: 400 });
  if (!platform || !(platform in PLATFORM_META)) {
    return NextResponse.json({
      error: "INVALID_PLATFORM",
      message: "platform must be one of: kmong, bookk, upaper",
      supported: Object.keys(PLATFORM_META),
    }, { status: 400 });
  }

  const project = await getProject(projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  const meta = PLATFORM_META[platform];

  // 크몽: 기존 kmong-package 라우트로 위임 (이미 완전 구현)
  if (platform === "kmong") {
    return NextResponse.json({
      ok: true,
      platform,
      meta,
      // 프론트엔드는 이 응답을 받고 /api/generate/kmong-package 호출
      delegate: "/api/generate/kmong-package",
      message: "크몽 등록 패키지는 기존 kmong-package API로 호출하세요.",
    });
  }

  // 부크크/유페이퍼: scaffolding — 정책 메타 + 가이드만 반환
  // 후속 PR에서 플랫폼별 prompts (제목 길이, 카테고리 매핑, 키워드 정책) 추가 + 실제 생성
  return NextResponse.json({
    ok: true,
    platform,
    meta,
    status: "scaffolding",
    message: `${meta.name} 통합 등록은 v2에서 추가됩니다. 지금은 정책 가이드만 제공.`,
    guide: {
      title: `책 제목: ${meta.titleMaxChars}자 이내로 다듬어주세요.`,
      pricing: `권장 가격: ₩${meta.recommendedPriceRangeKRW[0].toLocaleString()} ~ ₩${meta.recommendedPriceRangeKRW[1].toLocaleString()}`,
      format: meta.format,
      notes: meta.notes,
    },
  });
}

// GET /api/generate/publishing-package?platform=kmong
// 플랫폼 정책 조회만 — pricing-recommend, BookEditor 등에서 호출.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as Platform | null;

  if (!platform) {
    return NextResponse.json({ ok: true, platforms: PLATFORM_META });
  }

  if (!(platform in PLATFORM_META)) {
    return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, platform, meta: PLATFORM_META[platform] });
}

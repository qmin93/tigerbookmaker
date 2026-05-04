// POST /api/generate/meta-images
// body: { projectId, regenerateOnly?: ("feed"|"story"|"link")[] }
// 응답: { ok, images: [{ type, base64, aspectRatio, vendor }], newBalance, totalCostKRW }
//
// 3 비율 자동 생성 (Vercel 60s 한도 안에서 순차):
//  - feed:  1:1
//  - story: 9:16
//  - link:  16:9

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/auth";
import { callImageGeneration, type AspectRatio } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { overlayTextOnImage, type OverlayTemplate } from "@/lib/server/image-overlay";
import { generateImagePromptAI, type ImagePurpose } from "@/lib/server/image-prompt-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type MetaImageType = "feed" | "story" | "link";

const TYPE_TO_AR: Record<MetaImageType, AspectRatio> = {
  feed: "1:1",
  story: "9:16",
  link: "16:9",
};

// Wave 3: target 픽셀 dimension (Sharp resize + overlay)
const TYPE_TO_DIMS: Record<MetaImageType, { w: number; h: number }> = {
  feed: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  link: { w: 1200, h: 628 },
};

const ALL_TYPES: MetaImageType[] = ["feed", "story", "link"];
const VALID_TEMPLATES: OverlayTemplate[] = ["minimal", "bold", "story", "quote", "cta"];

function metaImagePrompt(project: any, type: MetaImageType): string {
  const layout = type === "story"
    ? "세로 (9:16, Instagram Story / Reels)"
    : type === "link"
    ? "가로 (16:9, Facebook 링크 광고)"
    : "정사각 (1:1, Instagram Feed)";

  // 장르별 시각 모티프 — generic mood 사진 방지
  const visualHintByType: Record<string, string> = {
    "자기계발서": "책상·노트·아침 햇살·계단·도전·성장 같은 모티프",
    "재테크":    "차트·그래프·동전·노트북·계산기·캘린더 같은 모티프 (글자 X)",
    "에세이":    "카페·창가·책 더미·산책길·일상의 따뜻한 풍경",
    "매뉴얼":    "도구·체크리스트·플로우 도형 시각화 (글자 X)",
    "실용서":    "구체적 도구·만드는 과정·완성된 결과물",
    "웹소설":    "장면·인물 실루엣·드라마틱 라이팅·미스터리한 분위기",
    "전문서":    "책·자료·연구실·도서관·프로페셔널 톤",
  };
  const visualHint = visualHintByType[project.type] ?? "책 주제와 직접 관련된 시각 요소";

  return `한국어 책 광고 이미지. ${layout}.

[책 정보 — 이미지가 이걸 직관적으로 보여줘야 함]
- 주제: ${project.topic}
- 대상: ${project.audience}
- 유형: ${project.type}

[디자인 지침 — 매우 중요]
1. 위 주제와 직접 관련된 시각 요소 포함 (${visualHint})
2. 단순 mood 사진 절대 X. 책 주제를 한 눈에 알 수 있어야 함
3. Pinterest / Behance 디자인 톤. 깔끔한 모던 룩
4. 색상 팔레트: 2~3 색으로 통일 (난잡 X)
5. 텍스트 합성 금지 — 한국어 글자는 별도 overlay로 들어감

[배치 — 텍스트 overlay 공간 확보]
- 하단 30% 영역: 단순한 색조 또는 빈 배경 (텍스트 들어갈 곳)
- 시각 요소: 상단 또는 중단에 배치
- 너무 어둡지 않게 (텍스트 가독성 확보)
- 배경에 너무 detail 많지 않게 (텍스트가 묻힐까봐)`;
}

function buildHeadline(project: any): string {
  const tagline = project?.marketingMeta?.tagline;
  if (typeof tagline === "string" && tagline.trim().length > 0) return tagline.trim();
  // fallback — 주제 기반 단순 헤드라인
  const topic = String(project?.topic ?? "").trim() || "당신을 위한 책";
  return topic.length > 30 ? topic.slice(0, 28) + "…" : topic;
}

const THEME_MAP: Record<string, { hex: string; name: string }> = {
  orange: { hex: "#f97316", name: "warm orange" },
  blue: { hex: "#3b82f6", name: "deep blue" },
  green: { hex: "#10b981", name: "fresh emerald" },
  purple: { hex: "#a855f7", name: "rich violet" },
  red: { hex: "#ef4444", name: "vibrant red" },
  gray: { hex: "#6b7280", name: "neutral gray" },
};

const TYPE_TO_PURPOSE: Record<MetaImageType, ImagePurpose> = {
  feed: "meta-feed",
  story: "meta-story",
  link: "meta-link",
};

// AI Meta-prompting + RAG context. 실패 시 기존 template으로 fallback.
async function getSmartPromptForType(
  project: any,
  type: MetaImageType,
  projectId: string,
  headline: string,
): Promise<string> {
  // chapter 1 발췌 (300자)
  const ch1 = project?.chapters?.[0];
  const chapterExcerpt = ch1?.content ? String(ch1.content).slice(0, 300) : undefined;

  // top 2 reference chunks (있으면)
  let referenceChunks: { content: string; filename: string }[] = [];
  try {
    const { rows } = await sql<{ content: string; filename: string }>`
      SELECT rc.content, br.filename
      FROM reference_chunks rc
      JOIN book_references br ON br.id = rc.reference_id
      WHERE br.project_id = ${projectId}
      LIMIT 2
    `;
    referenceChunks = rows.map(r => ({ content: r.content, filename: r.filename }));
  } catch {
    // RAG context는 optional — 실패해도 진행
  }

  const themeKey = (project?.themeColor as string | undefined) ?? "orange";
  const theme = THEME_MAP[themeKey] ?? THEME_MAP.orange;
  const ar = TYPE_TO_AR[type];

  try {
    const r = await generateImagePromptAI({
      bookTopic: String(project?.topic ?? ""),
      bookAudience: String(project?.audience ?? ""),
      bookType: String(project?.type ?? ""),
      themeColorHex: theme.hex,
      themeColorName: theme.name,
      purpose: TYPE_TO_PURPOSE[type],
      aspectRatio: ar,
      chapterExcerpt,
      referenceChunks,
      headline,
    });
    return r.prompt;
  } catch (e: any) {
    console.warn("[meta-images] AI meta-prompting failed, falling back to template:", e?.message);
    return metaImagePrompt(project, type);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`meta-img:${userId}`, 3, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { projectId, regenerateOnly, template: templateRaw } = body as {
      projectId?: string;
      regenerateOnly?: MetaImageType[];
      template?: string;
    };
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    // Wave 3: SVG overlay template (default "bold")
    const template: OverlayTemplate = VALID_TEMPLATES.includes(templateRaw as OverlayTemplate)
      ? (templateRaw as OverlayTemplate)
      : "bold";

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    // Imagen 4 Fast ~₩28/장 × 3 = ~₩90. 잔액 사전 체크.
    if (user.balance_krw < 100) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액이 부족합니다 (Meta 광고 이미지 3장 약 ₩90 필요).",
        current: user.balance_krw,
      }, { status: 402 });
    }

    // 생성할 type 결정 (regenerateOnly 지정되면 그것만, 아니면 전부)
    const targets: MetaImageType[] = (regenerateOnly && regenerateOnly.length > 0)
      ? regenerateOnly.filter((t): t is MetaImageType => ALL_TYPES.includes(t as MetaImageType))
      : ALL_TYPES;

    if (targets.length === 0) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "생성할 type이 없습니다." }, { status: 400 });
    }

    const headline = buildHeadline(project);
    const subhead = String(project?.audience ?? "").trim() || undefined;

    let totalCostKRW = 0;
    const newImages: Array<{
      type: MetaImageType;
      aspectRatio: AspectRatio;
      base64: string;
      vendor: string;
      generatedAt: number;
      template?: string;
    }> = [];

    // 순차 생성 (Vercel 60s — 3장 × ~10s = ~30s)
    for (const type of targets) {
      const ar = TYPE_TO_AR[type];
      try {
        const smartPrompt = await getSmartPromptForType(project, type, projectId, headline);
        const img = await callImageGeneration({
          prompt: smartPrompt,
          timeoutMs: 30000,
          preferPaid: true,    // 한국어 글자 가독성 — Imagen 4 Fast 우선
          aspectRatio: ar,
        });
        const costKRW = Math.ceil(img.costUSD * USD_TO_KRW);
        totalCostKRW += costKRW;

        const { id: usageId } = await logAIUsage({
          userId, task: "edit",
          model: img.vendor === "cloudflare" ? "flux-1-schnell"
               : img.vendor === "gemini" ? "imagen-4-fast"
               : img.vendor === "openai" ? "gpt-image-1"
               : "pollinations-flux",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: img.costUSD, costKRW,
          durationMs: img.durationMs,
          projectId, status: "success",
        });
        if (costKRW > 0) {
          await deductBalance({
            userId, amountKRW: costKRW, aiUsageId: usageId,
            reason: `Meta 광고 ${type} ${ar} (${img.vendor})`,
          });
        }

        // Wave 3: Sharp으로 한국어 헤드라인 overlay (실패 시 raw로 fallback)
        const dims = TYPE_TO_DIMS[type];
        const overlaid = await overlayTextOnImage({
          imageBase64: img.base64,
          width: dims.w,
          height: dims.h,
          headline,
          subhead,
          template,
        }).catch((err: any) => {
          console.warn("[meta-images] overlay failed for", type, err?.message);
          return img.base64;  // fallback to raw if overlay fails
        });

        newImages.push({
          type, aspectRatio: ar, base64: overlaid, vendor: img.vendor,
          generatedAt: Date.now(), template,
        });
      } catch (e: any) {
        await logAIUsage({
          userId, task: "edit", model: "image-generation",
          inputTokens: 0, outputTokens: 0, thoughtsTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0,
          costUSD: 0, costKRW: 0, durationMs: 0,
          projectId, status: "failed",
          errorMessage: `meta-img-${type}: ${e?.message?.slice(0, 400)}`,
        }).catch(() => {});
      }
    }

    // 기존 이미지 배열과 병합 (regenerateOnly: 같은 type만 교체)
    const existingImages: any[] = Array.isArray((project as any).metaAdImages)
      ? (project as any).metaAdImages
      : [];
    const replacedTypes = new Set(newImages.map(i => i.type));
    const mergedImages = [
      ...existingImages.filter((i: any) => !replacedTypes.has(i.type)),
      ...newImages,
    ];

    await updateProjectData(projectId, userId, { ...project, metaAdImages: mergedImages });

    const refreshedUser = await getUser(userId);
    return NextResponse.json({
      ok: true,
      images: newImages,
      newBalance: refreshedUser?.balance_krw ?? user.balance_krw - totalCostKRW,
      totalCostKRW,
      generatedTypes: newImages.map(i => i.type),
      failedTypes: targets.filter(t => !newImages.find(i => i.type === t)),
    });
  } catch (e: any) {
    console.error("[/api/generate/meta-images] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

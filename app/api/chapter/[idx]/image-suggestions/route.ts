// POST /api/chapter/[idx]/image-suggestions
// Body: { projectId }
// 응답: { ok, suggestions: [{ position, keywords, description, placeholder }], inserted: number, costKRW, newBalance }
//
// spec PR #4 (`docs/superpowers/specs/2026-05-13-ai-image-system-design.md` 3.6) — 본문 이미지 활성화.
// 챕터 본문을 AI가 분석해 1~3개 이미지 컨셉을 추천하고, 본문에 [IMAGE: 캡션] placeholder를 자동 삽입한다.
// 실제 이미지 생성은 호출하지 않음 — placeholder만 만들어 두고, 추후 `/api/generate/chapter-image`
// 또는 `/api/book/[id]/generate-chapter-images` 가 실제 그림을 만든다.
//
// 비용: ~₩50 (Gemini Flash Lite 분석만, 이미지 생성 비용 아님).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { GENRE_MAP } from "@/lib/cover-style-map";
import { genreFromBookType } from "@/lib/genre-from-book-type";

export const runtime = "nodejs";
export const maxDuration = 30;

type Position = "start" | "middle" | "end";

interface RawSuggestion {
  position: Position;
  keywords: string;     // 영문 3~5단어
  description: string;  // 한글 캡션 (placeholder에 들어감)
}

interface StoredSuggestion extends RawSuggestion {
  placeholder: string;
}

function clampPosition(p: any): Position {
  return p === "start" || p === "end" ? p : "middle";
}

/**
 * AI 응답을 파싱. 코드펜스/주변 텍스트 허용.
 */
function parseSuggestions(text: string): RawSuggestion[] {
  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");
  // 가능하면 { ... } 블록만 추출
  if (!cleaned.startsWith("{")) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) cleaned = m[0];
  }
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  return arr
    .filter((s: any) => s && typeof s.keywords === "string" && typeof s.description === "string")
    .slice(0, 3)
    .map((s: any) => ({
      position: clampPosition(s.position),
      keywords: String(s.keywords).slice(0, 200),
      description: String(s.description).slice(0, 200),
    }));
}

/**
 * 본문에 [IMAGE: caption] placeholder를 위치별로 삽입한다.
 *   - start  : 본문 맨 앞 (첫 단락 직전)
 *   - middle : 본문 길이의 약 50% 지점 (가장 가까운 단락 경계)
 *   - end    : 본문 마지막 단락 뒤
 * 이미 동일 caption의 placeholder가 있으면 중복 삽입하지 않는다.
 */
function insertPlaceholders(
  content: string,
  suggestions: RawSuggestion[],
): { content: string; suggestions: StoredSuggestion[] } {
  let result = content;
  const stored: StoredSuggestion[] = [];

  // 위치별로 정렬 — end → middle → start 순서로 적용해야
  // 앞에서 삽입한 placeholder가 뒤쪽 offset을 깨뜨리지 않는다.
  const order: Position[] = ["end", "middle", "start"];
  const sorted = [...suggestions].sort(
    (a, b) => order.indexOf(a.position) - order.indexOf(b.position),
  );

  for (const s of sorted) {
    const caption = s.description.trim().replace(/\]/g, ")");
    const placeholder = `[IMAGE: ${caption}]`;
    if (result.includes(placeholder)) {
      // 중복 — 그래도 suggestion 메타로는 보관
      stored.push({ ...s, placeholder });
      continue;
    }
    if (s.position === "start") {
      result = `${placeholder}\n\n${result}`;
    } else if (s.position === "end") {
      result = `${result.trimEnd()}\n\n${placeholder}\n`;
    } else {
      // middle: 단락 경계 (\n\n) 중 본문 중앙에 가장 가까운 곳
      const target = Math.floor(result.length / 2);
      const paragraphBreaks: number[] = [];
      const re = /\n\n+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(result)) !== null) {
        paragraphBreaks.push(m.index + m[0].length);
      }
      let insertAt = target;
      if (paragraphBreaks.length > 0) {
        insertAt = paragraphBreaks.reduce(
          (best, cur) => (Math.abs(cur - target) < Math.abs(best - target) ? cur : best),
          paragraphBreaks[0],
        );
      }
      result = `${result.slice(0, insertAt)}${placeholder}\n\n${result.slice(insertAt)}`;
    }
    stored.push({ ...s, placeholder });
  }

  // 원래 사용자에게 보여주는 순서는 start → middle → end가 자연스러움.
  stored.sort((a, b) => {
    const display: Position[] = ["start", "middle", "end"];
    return display.indexOf(a.position) - display.indexOf(b.position);
  });

  return { content: result, suggestions: stored };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ idx: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`img-suggest:${userId}`, 30, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { idx } = await params;
    const chapterIdx = Number(idx);
    if (!Number.isFinite(chapterIdx) || chapterIdx < 0) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "chapterIdx 형식 오류" }, { status: 400 });
    }

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) {
      return NextResponse.json({ error: "INVALID_INPUT", message: "projectId 누락" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;
    const ch = project.chapters?.[chapterIdx];
    if (!ch) return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });

    if (!ch.content || String(ch.content).trim().length < 20) {
      return NextResponse.json({
        error: "EMPTY_CHAPTER",
        message: "본문이 충분히 채워진 뒤 추천을 받을 수 있습니다.",
      }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    // 잔액 사전 체크 — 추천 ~₩50
    if (user.balance_krw < 50) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액이 부족합니다 (이미지 추천 1회 약 ₩50).",
        current: user.balance_krw,
      }, { status: 402 });
    }

    // 표지와 톤 일관성 — GENRE_MAP photoKeywords를 prompt에 힌트로 주입
    const genre = genreFromBookType(project.type ?? projectRow.type);
    const genreMatch = GENRE_MAP[genre];
    const photoKeywordHint = genreMatch?.photoKeywords?.slice(0, 4).join(", ") ?? "";
    const toneHint = genreMatch?.tone ?? "";

    // 본문이 너무 길면 첫 4000자만 — 토큰 절약, 추천에는 충분
    const excerpt = String(ch.content).slice(0, 4000);

    const systemPrompt = `당신은 책 본문에 어울리는 일러스트레이션 컨셉을 짚어주는 비주얼 에디터입니다.
출력은 항상 순수 JSON. 추가 설명 금지.`;

    const userPrompt = `[책 정보]
주제: ${project.topic ?? ""}
대상 독자: ${project.audience ?? ""}
유형: ${project.type ?? projectRow.type ?? ""}
표지 톤 (이미지 일관성 위해 참고): ${toneHint}
표지 사진 키워드 힌트: ${photoKeywordHint}

[챕터 ${chapterIdx + 1}장]
제목: ${ch.title ?? ""}
${ch.subtitle ? `부제: ${ch.subtitle}\n` : ""}본문:
${excerpt}

[요구사항]
이 챕터에 어울리는 일러스트레이션 1~3개를 추천하세요.
- 본문 분량/내용에 따라 자연스러운 개수 (짧은 챕터는 1개, 풍부하면 3개)
- 각 컨셉은 시각적으로 명확한 단일 주제 (책/문서/페이지 같은 메타 시각 금지)
- 표지 톤과 일관된 분위기 유지

[출력 형식 — 순수 JSON]
{
  "suggestions": [
    {
      "position": "start" | "middle" | "end",
      "keywords": "3~5 영문 단어 (예: morning coffee, soft window light)",
      "description": "한글 1~2문장 캡션 — 이미지 자리에 그대로 들어갈 설명"
    }
  ]
}`;

    const started = Date.now();
    const result = await callAIServer({
      model: "gemini-flash-lite-latest",
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 1200,
      temperature: 0.7,
      timeoutMs: 20000,
      retries: 1,
    });

    const suggestionsRaw = parseSuggestions(result.text);
    if (suggestionsRaw.length === 0) {
      return NextResponse.json({
        error: "PARSE_FAILED",
        message: "AI 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.",
      }, { status: 502 });
    }

    // 사용량/비용 기록 — ₩50 미만은 0 처리될 수도 있어서 Math.max
    const costKRW = Math.max(50, Math.ceil(result.usage.costUSD * USD_TO_KRW));
    const { id: usageId } = await logAIUsage({
      userId,
      task: "edit",
      model: "gemini-flash-lite-latest",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thoughtsTokens: result.usage.thoughtsTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      costUSD: result.usage.costUSD,
      costKRW,
      durationMs: Date.now() - started,
      projectId,
      chapterIdx,
      status: "success",
    });

    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `${chapterIdx + 1}장 이미지 컨셉 추천`,
      });
      newBalance = r.newBalance;
    }

    // 본문에 placeholder 자동 삽입 + suggestions 저장
    const { content: newContent, suggestions } = insertPlaceholders(ch.content, suggestionsRaw);

    const updatedChapters = [...project.chapters];
    updatedChapters[chapterIdx] = {
      ...ch,
      content: newContent,
      imageSuggestions: suggestions,
    };
    await updateProjectData(projectId, userId, {
      ...project,
      chapters: updatedChapters,
    });

    return NextResponse.json({
      ok: true,
      suggestions,
      inserted: suggestions.length,
      costKRW,
      newBalance,
    });
  } catch (e: any) {
    console.error("[/api/chapter/[idx]/image-suggestions] uncaught:", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}

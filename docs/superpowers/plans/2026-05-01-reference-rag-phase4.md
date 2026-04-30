# Reference RAG Phase 4 — 말투 매칭 (Sub-project 7 통합)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 작가가 책 톤·말투를 명시적으로 정할 수 있게. 자동 추천 + 6개 preset 선택 + "좋아하는 책" 발췌 분석으로 톤 학습.

**디자인 doc 참조:** `docs/superpowers/specs/2026-04-29-reference-rag-design.md` 3.5 Phase 4.

**핵심 흐름**
1. 인터뷰 완료 후 새 화면 `/write/tone` (또는 setup의 마지막 단계로 통합)
2. 자동 톤 추천 — 장르 + 레퍼런스 분석 → AI가 추천 1개
3. 사용자 옵션:
   - 추천 그대로 사용
   - 6개 preset 중 선택 (친근체 / 전문체 / 스토리텔링 / 강의체 / 에세이체 / 자기계발체)
   - "좋아하는 책" 발췌 붙여넣기 → AI가 분석해서 그 톤으로 매칭
4. 선택된 톤 → `project.toneSetting`에 저장
5. 챕터 본문 생성 시 `chapterPrompt`가 `toneSetting`을 참고

---

## Tasks

### Task 1: 타입 정의

**Files:** Modify `lib/storage.ts`

새 타입 추가:

```typescript
export type TonePreset =
  | "friendly"      // 친근체 — 반말 톤, 대화하듯 ("우리 같이 해봐요")
  | "professional"  // 전문체 — 정보 전달 중심, 차분 ("본 챕터에서는 ~를 다룬다")
  | "storytelling"  // 스토리텔링 — 이야기·일화로 시작 ("어느 날 ~한 일이 있었습니다")
  | "lecture"       // 강의체 — 단계별 설명, 명확 ("먼저 A를 살펴봅시다. 그 다음 B를")
  | "essay"         // 에세이체 — 사색적, 1인칭 자주 사용
  | "self-help";    // 자기계발체 — 동기부여, 행동 유도, 강한 단언

export interface ToneSetting {
  mode: "auto" | "preset" | "reference-book";
  preset?: TonePreset;             // mode = "preset" 일 때
  referenceBookExcerpt?: string;   // mode = "reference-book" 일 때 (사용자가 붙여넣은 발췌)
  finalTone: string;               // AI가 분석·정리한 최종 톤 설명 (chapterPrompt에 주입할 1~2문단)
  generatedAt: number;
}
```

`BookProject`에 `toneSetting?: ToneSetting` 추가.

Commit: `feat(types): TonePreset + ToneSetting`

---

### Task 2: Tone 추천/분석 prompts

**Files:** Modify `lib/prompts.ts`

세 함수 추가:

1. **`autoTonePrompt`** — 장르 + 레퍼런스 분석 → 톤 추천 (1개)
2. **`tonePresetDescriptions`** — preset별 finalTone 텍스트 (정적, 6개)
3. **`referenceBookTonePrompt`** — 사용자 발췌 → 톤 분석 → finalTone 정리

```typescript
// 자동 톤 추천 (mode = "auto")
export function autoTonePrompt(
  project: { topic: string; audience: string; type: string; targetPages: number },
  chunks: { content: string; referenceFilename: string; chunkIdx: number }[],
): string {
  const refsText = chunks.length > 0
    ? `\n[작가가 제공한 자료]\n${chunks.map(c => c.content).join("\n\n").slice(0, 5000)}\n`
    : "";
  return `당신은 책 톤·문체를 추천하는 편집자입니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
${refsText}

[작업]
이 책에 가장 잘 맞을 톤을 한국어 1~2문단(150~300자)으로 정의하세요.
- 어떤 어조 (친근/전문/스토리텔링/강의/에세이/자기계발 등)
- 어떤 문장 스타일 (단문/장문, 1인칭/3인칭, 직접화법 빈도)
- 어떤 표현 패턴 (예시·일화·통계 위주 등)
- 피해야 할 표현 (예: "확실합니다" 같은 단언 X)

출력은 finalTone 한국어 문단만. 다른 설명·서문 없이.`;
}

// preset → finalTone 텍스트
export const tonePresetDescriptions: Record<TonePreset, string> = {
  "friendly": "친근하고 따뜻한 톤. 가끔 가벼운 농담 OK. 독자에게 직접 말 거는 듯한 2인칭 사용. 예: '우리 같이 해봐요', '~하시면 좋아요'. 단문 위주, 문단당 3~5줄.",
  "professional": "정보 전달 중심의 차분한 전문가 톤. 단언보다 근거·통계 우선. 3인칭 또는 객관적 1인칭. 예: '본 장에서는 ~를 다룬다', '연구에 따르면 ~'. 중문~장문 혼합.",
  "storytelling": "이야기·일화로 시작해서 핵심으로 자연스럽게 연결. 시간·장소·인물이 보이는 구체적 장면 묘사. 직접화법 빈번. 예: \"그날 오후, 김 대표는 회의실에 앉아 ~\".",
  "lecture": "강의식 단계별 설명. 명확한 신호어 사용 (먼저 / 다음으로 / 마지막으로). 각 개념마다 예시 + 요약. 청자에게 말 거는 듯 부드러운 명령형 가능 (예: '~해보세요').",
  "essay": "사색적·내성적 1인칭 톤. '나는 ~라고 생각한다', '~하다는 것이 무엇인지 곱씹어 본다' 류. 결론 강요 X. 독자가 함께 생각하게 유도. 문단 간 호흡 길게.",
  "self-help": "강한 동기부여 + 행동 유도. 단호한 단언 OK ('당신은 할 수 있습니다'). 짧고 임팩트 있는 문장. 챕터마다 행동 과제 제시. 2인칭 직설.",
};

// "좋아하는 책" 발췌 → 톤 분석
export function referenceBookTonePrompt(excerpt: string): string {
  return `당신은 책 톤·문체를 분석하는 편집자입니다.

[작가가 좋아하는 책의 발췌]
"""
${excerpt.slice(0, 3000)}
"""

[작업]
위 발췌의 톤·문체를 한국어 1~2문단(150~300자)으로 정리하세요. 다른 작가가 이 톤으로 새 글을 쓸 수 있게.
- 어조 (친근/전문/스토리텔링 등 + 강도)
- 문장 스타일 (단문/장문, 인칭, 직접화법 빈도)
- 표현 패턴 (자주 쓰는 어휘·신호어, 비유 빈도, 단언 강도)
- 특징적 표현 1~2개 ("~하기 마련이다", "그런 것이다" 같은 어미 등)

출력은 finalTone 한국어 문단만. 다른 설명·서문 없이.`;
}
```

또 `chapterPrompt`/`continueChapterPrompt`에 `toneSetting` 파라미터 추가하고 본문 [작성 지침] 안에 톤 instruction 주입:

```typescript
${toneSetting ? `
[톤·문체 가이드]
${toneSetting.finalTone}

위 톤을 본문 전체에 일관되게 적용하세요. 챕터마다 흔들리지 않도록.
` : ""}
```

Commit: `feat(prompts): 톤 추천/분석 prompts + chapterPrompt에 toneSetting 적용`

---

### Task 3: Tone Recommend API

**Files:** Create `app/api/generate/tone-recommend/route.ts`

```typescript
// POST /api/generate/tone-recommend
// body: { projectId, mode: "auto" | "preset" | "reference-book", preset?, excerpt? }
// 응답: { ok, toneSetting, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { autoTonePrompt, referenceBookTonePrompt, tonePresetDescriptions } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";
import type { TonePreset, ToneSetting } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`tone:${userId}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId, mode, preset, excerpt } = await req.json().catch(() => ({}));
    if (!projectId || !["auto", "preset", "reference-book"].includes(mode)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    let finalTone = "";
    let costKRW = 0;
    let actualModel: any = null;
    let usageId: string | null = null;

    if (mode === "preset") {
      if (!preset || !(preset in tonePresetDescriptions)) {
        return NextResponse.json({ error: "INVALID_PRESET" }, { status: 400 });
      }
      finalTone = tonePresetDescriptions[preset as TonePreset];
      // preset은 AI 호출 X — 비용 0
    } else {
      // auto 또는 reference-book — AI 호출
      if (user.balance_krw < 30) {
        return NextResponse.json({
          error: "INSUFFICIENT_BALANCE",
          message: "잔액 부족 (톤 분석 약 ₩20)",
          current: user.balance_krw,
        }, { status: 402 });
      }

      const tier: Tier = (project as any).tier ?? "basic";
      const candidates = getModelChain(tier);
      if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

      let promptText = "";
      if (mode === "auto") {
        // 레퍼런스 chunks 가져오기 (있으면 활용)
        const { rows: chunks } = await sql<{ content: string; filename: string; chunk_idx: number }>`
          SELECT rc.content, br.filename, rc.chunk_idx
          FROM reference_chunks rc
          JOIN book_references br ON br.id = rc.reference_id
          WHERE br.project_id = ${projectId}
          ORDER BY br.uploaded_at, rc.chunk_idx
          LIMIT 10
        `;
        promptText = autoTonePrompt(
          { topic: project.topic, audience: project.audience, type: project.type, targetPages: project.targetPages },
          chunks.map(c => ({ content: c.content, referenceFilename: c.filename, chunkIdx: c.chunk_idx })),
        );
      } else {
        // reference-book
        const ex = String(excerpt ?? "").trim();
        if (ex.length < 100) {
          return NextResponse.json({ error: "EXCERPT_TOO_SHORT", message: "최소 100자 발췌 필요" }, { status: 400 });
        }
        promptText = referenceBookTonePrompt(ex);
      }

      let result: any = null;
      let lastError: any = null;
      for (const candidate of candidates) {
        try {
          result = await callAIServer({
            model: candidate,
            system: "당신은 책 톤·문체 분석가입니다. 1~2문단의 한국어 finalTone만 출력합니다.",
            user: promptText,
            maxTokens: 800,
            temperature: 0.5,
            timeoutMs: 20000,
            retries: 0,
          });
          actualModel = candidate;
          break;
        } catch (e: any) {
          lastError = e;
          const msg = String(e?.message ?? "");
          const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|429|quota/i.test(msg);
          if (!transient) {
            return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
          }
        }
      }
      if (!result) return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message }, { status: 502 });

      finalTone = result.text.trim();
      costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
      const log = await logAIUsage({
        userId, task: "edit", model: actualModel,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        thoughtsTokens: result.usage.thoughtsTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
        costUSD: result.usage.costUSD, costKRW,
        durationMs: result.usage.durationMs,
        projectId, status: "success",
      });
      usageId = log.id;
    }

    let newBalance = user.balance_krw;
    if (costKRW > 0 && usageId) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `톤 분석 (${actualModel ?? mode})`,
      });
      newBalance = r.newBalance;
    }

    const toneSetting: ToneSetting = {
      mode: mode as ToneSetting["mode"],
      ...(mode === "preset" ? { preset: preset as TonePreset } : {}),
      ...(mode === "reference-book" ? { referenceBookExcerpt: String(excerpt).slice(0, 3000) } : {}),
      finalTone,
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, toneSetting });

    return NextResponse.json({ ok: true, toneSetting, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/tone-recommend] uncaught:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
```

Commit: `feat(api): POST /api/generate/tone-recommend (auto/preset/reference-book)`

---

### Task 4: Chapter routes — toneSetting 전달

**Files:** Modify `app/api/generate/chapter/route.ts`, `app/api/generate/chapter-continue/route.ts`

각 route에서 `chapterPrompt(...)` / `continueChapterPrompt(...)` 호출 시 `toneSetting` 인자 추가:

```typescript
const toneSetting = (project as any).toneSetting ?? undefined;
// ... 기존 RAG ...
user: chapterPrompt(project, chapterIdx, ch.title, ch.subtitle, chapterChunks, toneSetting),
```

Task 2에서 chapterPrompt/continueChapterPrompt signature가 확장되었으므로 6번째/7번째 인자.

Commit: `feat(api): chapter routes에 toneSetting 전달`

---

### Task 5: UI — `/write/setup` 톤 섹션 (인터뷰 완료 후 표시)

**Files:** Modify `app/write/setup/page.tsx`

인터뷰 완료(또는 사용자가 "인터뷰 끝내기" 클릭) 후, 다음 단계로 톤 선택 화면 표시. 또는 **간단히** setup 페이지 하단(인터뷰 박스 아래)에 항상 표시되는 박스.

각 mode별 UI:

**A. mode 선택 (3 라디오)**
- 자동 추천 (₩20) — AI가 장르+자료 보고 톤 1개 추천
- preset 선택 (무료) — 6개 카드 중 선택
- 좋아하는 책 발췌 (₩20) — 텍스트 붙여넣기

**B. mode = "auto"**: "🪄 자동 추천" 버튼 → tone-recommend POST
**C. mode = "preset"**: 6개 카드 그리드 (각 카드에 title + description 미리보기). 클릭 시 confirm + POST.
**D. mode = "reference-book"**: textarea (최소 100자) + "분석" 버튼 → POST

결과 표시: `toneSetting.finalTone` 박스 + "다시" 버튼.

**state**:
```typescript
const [toneSetting, setToneSetting] = useState<any>(null);
const [toneMode, setToneMode] = useState<"auto" | "preset" | "reference-book">("auto");
const [toneExcerpt, setToneExcerpt] = useState("");
const [toneBusy, setToneBusy] = useState(false);
```

**함수**:
```typescript
const requestTone = async (opts: { mode: string; preset?: string; excerpt?: string }) => {
  if (!projectId) return;
  setToneBusy(true);
  setError(null);
  try {
    const res = await fetch("/api/generate/tone-recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...opts }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `톤 분석 실패 (${res.status})`);
    setToneSetting(data.toneSetting);
    if (typeof data.newBalance === "number") setBalance(data.newBalance);
  } catch (e: any) {
    setError(e.message);
  } finally {
    setToneBusy(false);
  }
};
```

**JSX** — references 박스 아래 (또는 인터뷰 박스 아래) 새 박스:

```tsx
<div className="mb-6 p-5 bg-purple-50/50 border border-purple-300 rounded-xl">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-bold text-ink-900">🎨 톤·말투 설정</h3>
    {toneSetting && <button onClick={() => setToneSetting(null)} className="text-[10px] text-gray-400 hover:text-red-600">다시 설정</button>}
  </div>

  {!toneSetting && (
    <>
      <p className="text-xs text-gray-600 mb-3">
        선택한 톤이 모든 챕터 본문에 일관되게 적용됩니다.
      </p>
      <div className="flex gap-2 mb-3">
        {(["auto", "preset", "reference-book"] as const).map(m => (
          <button
            key={m}
            onClick={() => setToneMode(m)}
            className={`flex-1 px-2 py-1.5 text-xs rounded font-bold ${toneMode === m ? 'bg-purple-500 text-white' : 'bg-white border border-purple-300 text-purple-700'}`}
          >
            {m === "auto" ? "🪄 자동 추천 (₩20)" : m === "preset" ? "📋 6개 중 선택 (무료)" : "📖 좋아하는 책 (₩20)"}
          </button>
        ))}
      </div>

      {toneMode === "auto" && (
        <button
          onClick={() => requestTone({ mode: "auto" })}
          disabled={toneBusy}
          className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50 text-sm"
        >
          {toneBusy ? "⏳ 분석 중..." : "🪄 AI 자동 추천"}
        </button>
      )}

      {toneMode === "preset" && (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["friendly", "💬 친근체"],
            ["professional", "🎓 전문체"],
            ["storytelling", "📚 스토리텔링"],
            ["lecture", "🎤 강의체"],
            ["essay", "✍️ 에세이체"],
            ["self-help", "🚀 자기계발체"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => requestTone({ mode: "preset", preset: key })}
              disabled={toneBusy}
              className="text-left p-2 bg-white border border-purple-200 rounded-lg hover:border-purple-500 disabled:opacity-50"
            >
              <div className="text-xs font-bold text-purple-900">{label}</div>
            </button>
          ))}
        </div>
      )}

      {toneMode === "reference-book" && (
        <div>
          <textarea
            value={toneExcerpt}
            onChange={e => setToneExcerpt(e.target.value)}
            placeholder="좋아하는 책 발췌 1~3문단 (100자 이상)"
            rows={5}
            className="w-full text-xs px-3 py-2 border border-purple-300 rounded mb-2 focus:border-purple-500 focus:outline-none resize-y"
          />
          <button
            onClick={() => requestTone({ mode: "reference-book", excerpt: toneExcerpt })}
            disabled={toneBusy || toneExcerpt.trim().length < 100}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50 text-sm"
          >
            {toneBusy ? "⏳ 분석 중..." : `📖 분석 (${toneExcerpt.trim().length}자)`}
          </button>
        </div>
      )}
    </>
  )}

  {toneSetting && (
    <div className="bg-white rounded-lg p-3">
      <div className="text-xs font-bold text-ink-900 mb-2">현재 톤 ({toneSetting.mode})</div>
      <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{toneSetting.finalTone}</div>
    </div>
  )}
</div>
```

`useEffect`로 project.toneSetting 동기화:
```typescript
useEffect(() => {
  if (project?.toneSetting) setToneSetting(project.toneSetting);
}, [project]);
```

Commit: `feat(ui): /write/setup 톤·말투 설정 섹션 (auto/preset/reference-book)`

---

### Task 6: 빌드 + merge + push

- `npm run build`
- `git checkout main && git merge --ff-only feature/phase4-tone-matching && git push origin main`

---

*— end of Phase 4 plan*

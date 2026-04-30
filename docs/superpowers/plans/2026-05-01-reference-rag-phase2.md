# Reference RAG Phase 2 — 레퍼런스 요약 + 빈 부분만 질문

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` syntax.

**Goal:** 레퍼런스가 있을 때 AI가 모든 chunks를 읽고 "핵심 5가지 + 다룬 주제"를 정리해 보여주고, 사용자 확인 후 인터뷰는 빈 부분만 5-7개 질문하게 한다.

**디자인 doc 참조:** `docs/superpowers/specs/2026-04-29-reference-rag-design.md` 3.2 Phase 2.

**핵심 데이터 흐름**
1. /write/setup: 사용자가 PDF 등 1+ 업로드 → "🤖 AI가 자료 정리하기" 버튼 등장
2. 클릭 → POST /api/generate/reference-summary → 모든 chunks 조합 → AI가 `{ keyPoints: string[5], coveredTopics: string[], gaps: string[] }` 반환
3. UI에 5 핵심 카드 + "다룬 주제" + "더 알아야 할 것" 표시
4. 사용자 "이대로 인터뷰 시작" or "다시 분석"
5. 인터뷰 시작 시 summary가 prompt에 주입 → AI가 "이미 자료에 있는 X는 묻지 않고, gaps 위주로" 질문

---

## File Structure

| 파일 | 역할 | 새로/수정 |
|---|---|---|
| `lib/storage.ts` | BookProject에 `referencesSummary?: ReferencesSummary` 추가 | 수정 |
| `lib/server/db.ts` | (변경 없음 — project.data jsonb 안에 들어감) | - |
| `app/api/generate/reference-summary/route.ts` | POST — 모든 chunks → AI 요약 → DB 저장 | 새로 |
| `lib/prompts.ts` | `referenceSummaryPrompt` 추가 + `interviewerPrompt`에 `summary` 파라미터 | 수정 |
| `app/api/generate/interview-question/route.ts` | summary를 prompt에 전달 | 수정 |
| `app/write/setup/page.tsx` | "AI 분석" 버튼 + 결과 카드 + 재분석 + 수동 인터뷰 옵션 | 수정 |

---

## Tasks

### Task 1: 타입 정의

**Files:**
- Modify: `lib/storage.ts`

- [ ] **Step 1: `ReferencesSummary` interface 추가**

`lib/storage.ts`의 BookProject 타입 근처에 추가:

```typescript
export interface ReferencesSummary {
  keyPoints: string[];           // 핵심 5가지 (한 줄씩)
  coveredTopics: string[];       // 자료가 다룬 주제 (인터뷰에서 안 물어볼 것)
  gaps: string[];                // 빠진 부분 (인터뷰에서 물어볼 것)
  generatedAt: number;
  basedOnChunkCount: number;     // 분석 시점의 chunk 수 (재생성 트리거용)
}
```

`BookProject` interface에 optional 필드 추가:

```typescript
export interface BookProject {
  // ... 기존 필드들
  referencesSummary?: ReferencesSummary;
}
```

(BookProject interface 정확한 위치는 파일 보고 적절히 삽입)

- [ ] **Step 2: Build + commit**
- `npm run build` 통과 확인
- Commit: `feat(types): ReferencesSummary 타입 + BookProject에 optional 필드`

---

### Task 2: Reference Summary Prompt

**Files:**
- Modify: `lib/prompts.ts`

- [ ] **Step 1: `referenceSummaryPrompt` 함수 추가**

`lib/prompts.ts`에 신규 export 추가 (위치는 `referencesBlock` 근처):

```typescript
export function referenceSummaryPrompt(
  project: { topic: string; audience: string; type: string; targetPages: number },
  chunks: { content: string; referenceFilename: string; chunkIdx: number }[],
): string {
  const refsText = chunks.map(c =>
    `[${c.referenceFilename} 발췌 #${c.chunkIdx + 1}]\n${c.content}`
  ).join("\n\n---\n\n");

  return `당신은 책 작가가 제공한 레퍼런스를 분석해서 책 작성에 필요한 핵심을 추출하는 분석가입니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
- 목표 분량: ${project.targetPages}쪽

[작가가 제공한 레퍼런스]
${refsText}

[작업]
위 레퍼런스를 모두 읽고 다음 3가지를 한국어 JSON으로 정리하세요.

1. keyPoints (배열, 정확히 5개): 책의 핵심 메시지 5가지. 한 줄씩, 구체적이고 차별화된 내용. 일반적 이야기 X.
2. coveredTopics (배열, 5~10개): 이 자료가 이미 다룬 주제. 인터뷰에서 다시 묻지 않을 것들.
3. gaps (배열, 3~7개): 자료에서 빠졌거나 작가 본인 경험·의견이 필요한 부분. 인터뷰에서 물어볼 것.

[출력 형식 — JSON만]
{
  "keyPoints": ["...", "...", "...", "...", "..."],
  "coveredTopics": ["...", "..."],
  "gaps": ["...", "..."]
}
`;
}
```

- [ ] **Step 2: `interviewerPrompt` signature 확장**

기존:
```typescript
export function interviewerPrompt(
  p: BookProject,
  history: { q: string; a: string }[],
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
): string
```

새 4번째 optional 파라미터 추가:
```typescript
export function interviewerPrompt(
  p: BookProject,
  history: { q: string; a: string }[],
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
  summary?: { keyPoints: string[]; coveredTopics: string[]; gaps: string[] },
): string
```

함수 본문에 summary block 주입 (`referencesBlock(references)` 직후):

```typescript
${summary ? `
[자료 분석 결과 — 인터뷰 전략]
- 자료가 이미 다룬 주제 (다시 묻지 마세요): ${summary.coveredTopics.join(", ")}
- 빈 부분 (작가 경험·의견 필요 — 우선 질문): ${summary.gaps.join(", ")}
- 핵심 메시지 5가지 (인터뷰 흐름의 기준):
${summary.keyPoints.map((k, i) => `  ${i+1}. ${k}`).join("\n")}
` : ""}
```

또 `[중요 규칙]` 또는 `[레퍼런스 활용]` 섹션 다음에 새 instruction 추가:

```
[빈 부분 채우기 모드 — summary 있을 때만]
- 위 "빈 부분" 항목들 위주로 5~7개 질문에 인터뷰 마무리
- "이미 자료에 있는 X는..." 처럼 자료를 인지하고 있다는 신호 포함
- coveredTopics에 있는 주제 다시 묻기 X
```

- [ ] **Step 3: Build + commit**
- Commit: `feat(prompts): referenceSummary 프롬프트 + interviewer summary-aware`

---

### Task 3: Reference Summary API

**Files:**
- Create: `app/api/generate/reference-summary/route.ts`

- [ ] **Step 1: route 작성**

```typescript
// POST /api/generate/reference-summary
// body: { projectId }
// 모든 reference chunks 가져와서 AI에게 요약 시킴 → project.data.referencesSummary 저장

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import {
  getUser, getProject, updateProjectData,
  deductBalance, logAIUsage, USD_TO_KRW,
} from "@/lib/server/db";
import { referenceSummaryPrompt } from "@/lib/prompts";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHUNKS_FOR_SUMMARY = 30;  // 토큰 한계 — 너무 많으면 sample

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`ref-summary:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 30) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액 부족 (요약 약 ₩20 필요)",
        current: user.balance_krw,
      }, { status: 402 });
    }

    // 모든 chunks 가져오기 (project 권한 검증된 후)
    const { rows: allChunks } = await sql<{
      content: string;
      filename: string;
      chunk_idx: number;
    }>`
      SELECT rc.content, br.filename, rc.chunk_idx
      FROM reference_chunks rc
      JOIN book_references br ON br.id = rc.reference_id
      WHERE br.project_id = ${projectId}
      ORDER BY br.uploaded_at, rc.chunk_idx
    `;

    if (allChunks.length === 0) {
      return NextResponse.json({ error: "NO_REFERENCES", message: "레퍼런스 먼저 업로드하세요" }, { status: 400 });
    }

    // 너무 많으면 evenly sample
    let chunksForSummary = allChunks;
    if (allChunks.length > MAX_CHUNKS_FOR_SUMMARY) {
      const stride = Math.floor(allChunks.length / MAX_CHUNKS_FOR_SUMMARY);
      chunksForSummary = allChunks.filter((_, i) => i % stride === 0).slice(0, MAX_CHUNKS_FOR_SUMMARY);
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });
    }

    const promptText = referenceSummaryPrompt(
      { topic: project.topic, audience: project.audience, type: project.type, targetPages: project.targetPages },
      chunksForSummary.map(c => ({ content: c.content, referenceFilename: c.filename, chunkIdx: c.chunk_idx })),
    );

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국어 책 분석가입니다. JSON만 출력합니다.",
          user: promptText,
          maxTokens: 2048,
          temperature: 0.4,
          timeoutMs: 25000,
          retries: 0,
        });
        actualModel = candidate;
        break;
      } catch (e: any) {
        lastError = e;
        const msg = String(e?.message ?? "");
        const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|시간 초과|429|quota/i.test(msg);
        if (!transient) {
          return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
        }
      }
    }
    if (!result) {
      return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message ?? "all candidates failed" }, { status: 502 });
    }

    let parsed: { keyPoints: string[]; coveredTopics: string[]; gaps: string[] };
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
      if (!Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.coveredTopics) || !Array.isArray(parsed.gaps)) {
        throw new Error("missing arrays");
      }
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    const summary = {
      keyPoints: parsed.keyPoints.slice(0, 5),
      coveredTopics: parsed.coveredTopics.slice(0, 10),
      gaps: parsed.gaps.slice(0, 7),
      generatedAt: Date.now(),
      basedOnChunkCount: allChunks.length,
    };

    await updateProjectData(projectId, userId, { ...project, referencesSummary: summary });

    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
    const { id: usageId } = await logAIUsage({
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
    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({
        userId, amountKRW: costKRW, aiUsageId: usageId,
        reason: `자료 요약 (${actualModel})`,
      });
      newBalance = r.newBalance;
    }

    return NextResponse.json({ ok: true, summary, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/reference-summary] uncaught:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build + commit**
- Commit: `feat(api): POST /api/generate/reference-summary — 모든 chunks → 5 핵심 + gaps`

---

### Task 4: Interview Route — Summary 전달

**Files:**
- Modify: `app/api/generate/interview-question/route.ts`

- [ ] **Step 1: summary 추출 + interviewerPrompt 호출 시 전달**

기존 `interviewerPrompt(project, history, ragChunks)` 호출을:

```typescript
const summary = (project as any).referencesSummary ?? undefined;
// ... 기존 RAG 검색 ...
user: interviewerPrompt(project, history, ragChunks, summary),
```

- [ ] **Step 2: Build + commit**
- Commit: `feat(api): interview question에 referencesSummary 전달 (빈 부분 모드)`

---

### Task 5: /write/setup UI — AI 분석 섹션

**Files:**
- Modify: `app/write/setup/page.tsx`

- [ ] **Step 1: state + 함수 추가**

새 state:

```typescript
const [summaryBusy, setSummaryBusy] = useState(false);
const [referencesSummary, setReferencesSummary] = useState<{
  keyPoints: string[]; coveredTopics: string[]; gaps: string[];
  generatedAt: number; basedOnChunkCount: number;
} | null>(null);
```

useEffect (project 로드 시 summary 동기화):

```typescript
useEffect(() => {
  if (project?.referencesSummary) setReferencesSummary(project.referencesSummary);
}, [project]);
```

함수:

```typescript
const generateSummary = async () => {
  if (!projectId || references.length === 0) return;
  setSummaryBusy(true);
  setError(null);
  try {
    const res = await fetch("/api/generate/reference-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `요약 실패 (${res.status})`);
    setReferencesSummary(data.summary);
    if (typeof data.newBalance === "number") setBalance(data.newBalance);
  } catch (e: any) {
    setError(e.message);
  } finally {
    setSummaryBusy(false);
  }
};

const clearSummary = () => {
  if (!confirm("요약을 지우고 다시 만들까요?")) return;
  setReferencesSummary(null);
};
```

- [ ] **Step 2: UI 섹션 추가**

레퍼런스 박스 아래에 새 박스 추가 (references.length > 0일 때만):

```tsx
{references.length > 0 && (
  <div className="mb-6 p-5 bg-yellow-50/50 border border-tiger-orange/40 rounded-xl">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-bold text-ink-900">🤖 AI 자료 분석</h3>
      {referencesSummary && (
        <button onClick={clearSummary} className="text-[10px] text-gray-400 hover:text-red-600">다시 분석</button>
      )}
    </div>

    {!referencesSummary && !summaryBusy && (
      <>
        <p className="text-xs text-gray-600 mb-3">
          AI가 모든 자료를 읽고 핵심 5가지 + 빠진 부분을 정리합니다. 그 후 인터뷰는 빈 부분만 짧게 (5~7개) 진행됩니다.
          <br/><span className="text-tiger-orange font-bold">예상 비용 ₩20</span>
        </p>
        <button
          onClick={generateSummary}
          disabled={summaryBusy}
          className="w-full px-4 py-3 bg-tiger-orange text-white rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50"
        >
          🚀 AI가 자료 정리하기
        </button>
      </>
    )}

    {summaryBusy && (
      <div className="p-3 bg-white rounded-lg text-xs text-tiger-orange text-center">
        ⏳ AI가 자료를 읽고 있어요... (10~30초)
      </div>
    )}

    {referencesSummary && (
      <div className="space-y-3">
        <div className="bg-white rounded-lg p-3">
          <div className="text-xs font-bold text-ink-900 mb-2">📌 핵심 5가지</div>
          <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
            {referencesSummary.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-lg p-3">
          <div className="text-xs font-bold text-ink-900 mb-2">✅ 자료가 다룬 주제 ({referencesSummary.coveredTopics.length})</div>
          <div className="flex flex-wrap gap-1">
            {referencesSummary.coveredTopics.map((t, i) => (
              <span key={i} className="text-[10px] bg-green-50 text-green-800 px-2 py-0.5 rounded border border-green-200">{t}</span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-3">
          <div className="text-xs font-bold text-ink-900 mb-2">❓ 인터뷰에서 물어볼 부분 ({referencesSummary.gaps.length})</div>
          <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
            {referencesSummary.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        <div className="text-[10px] text-gray-500 text-center">
          {new Date(referencesSummary.generatedAt).toLocaleString("ko-KR")} · {referencesSummary.basedOnChunkCount} chunks 기반
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Build + commit**
- Commit: `feat(ui): /write/setup AI 자료 분석 섹션 (5 핵심 + 다룬 주제 + gaps)`

---

### Task 6: 통합 빌드 + push

- [ ] **Step 1: 최종 빌드**
- `npm run build`
- 모든 새 route가 빌드 output에 보이는지 확인

- [ ] **Step 2: main merge + push**
- `git checkout main && git merge --ff-only feature/phase2-reference-summary`
- `git push origin main`
- Vercel auto-deploy 대기 + 검증

---

*— end of Phase 2 plan*

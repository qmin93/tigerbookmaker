# Reference RAG Phase 3 — 챕터 본문 자동 RAG

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` syntax.

**Goal:** 매 챕터 본문 생성 시 자동으로 RAG 검색 → 관련 chunks를 prompt에 주입해서 AI가 자료의 인용·예시를 자연스럽게 사용. 또한 chapter-edit (AI 챗) 자연어 지시에 자료 활용 가능.

**디자인 doc 참조:** `docs/superpowers/specs/2026-04-29-reference-rag-design.md` 3.5 Phase 3.

**핵심 흐름**
- `/api/generate/chapter`: 챕터 시작 시 `chapter title + subtitle`을 query로 RAG 검색 (top 4) → `chapterPrompt`에 chunks 주입.
- `/api/generate/chapter-continue`: 동일.
- `/api/generate/chapter-edit`: 사용자 지시(instruction)를 query로 RAG 검색 → `editPrompt`에 주입. 자료가 없는 프로젝트면 검색 skip.

**최적화**
- 프로젝트에 레퍼런스 0개일 때 RAG 검색 자체를 skip (`hasReferences` quick check).
- RAG 실패 시 degraded mode (자료 없이 진행). 본문 생성 절대 차단 X.

---

## File Structure

| 파일 | 역할 | 수정 |
|---|---|---|
| `lib/server/rag.ts` | `hasReferences(projectId)` helper 추가 (count > 0 quick check) | 수정 |
| `lib/prompts.ts` | `chapterPrompt` + `continueChapterPrompt` + `editPrompt`에 references 파라미터 | 수정 |
| `app/api/generate/chapter/route.ts` | RAG 검색 → prompt에 전달 | 수정 |
| `app/api/generate/chapter-continue/route.ts` | RAG 검색 → prompt에 전달 | 수정 |
| `app/api/generate/chapter-edit/route.ts` | instruction 기반 RAG 검색 → prompt에 전달 | 수정 |

---

## Tasks

### Task 1: `hasReferences` helper

**Files:**
- Modify: `lib/server/rag.ts`

- [ ] **Step 1: helper 추가**

`lib/server/rag.ts` 끝부분에 추가:

```typescript
// 빠른 체크 — 프로젝트에 레퍼런스 1개라도 있는지
// 챕터 생성 시 "이 프로젝트는 레퍼런스 없으니 RAG 자체 skip" 판단용
export async function hasReferences(projectId: string): Promise<boolean> {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS(
      SELECT 1 FROM book_references WHERE project_id = ${projectId} LIMIT 1
    ) AS exists
  `;
  return rows[0]?.exists ?? false;
}
```

- [ ] **Step 2: Build + commit**
- Commit: `feat(rag): hasReferences helper — 빠른 존재 체크`

---

### Task 2: `chapterPrompt` + `continueChapterPrompt` + `editPrompt`에 references 추가

**Files:**
- Modify: `lib/prompts.ts`

- [ ] **Step 1: 3개 함수 signature 확장**

각 함수의 마지막 파라미터로 optional `references` 추가:

```typescript
export function chapterPrompt(
  p: BookProject,
  chapterIdx: number,
  chapterTitle: string,
  chapterSubtitle?: string,
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
) {
  // ... 기존 본문 ...
  // [전체 목차] 블록 직전에 references block 주입:
  //
  //   ${references.length > 0 ? referencesBlock(references) : ""}
  //
  // 그리고 [이 챕터 작성 지침] 섹션 앞에 새 instruction 블록 추가:
  //
  //   [레퍼런스 활용]
  //   - 위 자료에서 이 챕터 주제와 관련된 부분 발견 시 자연스럽게 인용·예시로 녹여 쓰세요
  //   - 자료의 표현·용어를 이어 쓰면 일관성 ↑ (단, 그대로 통째로 베끼기 X)
  //   - 자료 인용 시 "[파일명]에 따르면..." 같은 자연스러운 도입 사용
  //   - 자료 없으면 (위 블록이 비어있으면) 일반적으로 작성
}
```

같은 패턴으로 `continueChapterPrompt`, `editPrompt`에도 적용.

`continueChapterPrompt`: `seedText` 파라미터 다음에 `references` 추가.
`editPrompt`: 마지막에 `references` 추가.

각 함수에서 references block 주입 위치는 적절한 곳 (가급적 [전체 목차] 또는 본문 앞에).

- [ ] **Step 2: Build + commit**
- Commit: `feat(prompts): chapterPrompt/continueChapterPrompt/editPrompt에 references 파라미터`

---

### Task 3: `/api/generate/chapter` — RAG 주입

**Files:**
- Modify: `app/api/generate/chapter/route.ts`

- [ ] **Step 1: route 수정**

기존 imports에 추가:
```typescript
import { ragSearch, hasReferences } from "@/lib/server/rag";
```

`chapterPrompt(...)` 호출 직전에 RAG 검색 추가:

```typescript
// 챕터 RAG — 자료 있으면 챕터 주제 기반 검색
let chapterChunks: Awaited<ReturnType<typeof ragSearch>> = [];
try {
  if (await hasReferences(projectId)) {
    chapterChunks = await ragSearch({
      projectId,
      query: `${ch.title}${ch.subtitle ? " — " + ch.subtitle : ""}`,
      topN: 4,
      maxDistance: 0.7,
    });
  }
} catch (e: any) {
  console.warn("[chapter] RAG search failed:", e?.message);
  // degraded mode
}
```

`chapterPrompt(...)` 호출에 5번째 인자로 `chapterChunks` 추가:

```typescript
user: chapterPrompt(project, chapterIdx, ch.title, ch.subtitle, chapterChunks),
```

- [ ] **Step 2: Build + commit**
- Commit: `feat(api): /api/generate/chapter RAG 자동 주입`

---

### Task 4: `/api/generate/chapter-continue` — RAG 주입

**Files:**
- Modify: `app/api/generate/chapter-continue/route.ts`

- [ ] **Step 1: route 수정**

같은 패턴으로 RAG 검색 추가. query는 `${ch.title}${seedText}` 앞 200자 정도 사용 (seedText가 더 구체적이라 우선).

`continueChapterPrompt(...)` 호출에 references 인자 추가.

- [ ] **Step 2: Build + commit**
- Commit: `feat(api): /api/generate/chapter-continue RAG 자동 주입`

---

### Task 5: `/api/generate/chapter-edit` — RAG 주입

**Files:**
- Modify: `app/api/generate/chapter-edit/route.ts`

- [ ] **Step 1: route 수정**

`editPrompt(...)` 호출 직전에:

```typescript
let editChunks: Awaited<ReturnType<typeof ragSearch>> = [];
try {
  if (await hasReferences(projectId)) {
    editChunks = await ragSearch({
      projectId,
      query: inst,  // 사용자 자연어 지시
      topN: 3,
      maxDistance: 0.7,
    });
  }
} catch (e: any) {
  console.warn("[chapter-edit] RAG failed:", e?.message);
}
```

`editPrompt(project, ch, inst, editChunks)` 호출 (signature는 Task 2에서 references 추가했으므로).

- [ ] **Step 2: Build + commit**
- Commit: `feat(api): /api/generate/chapter-edit RAG 자동 주입 (자연어 지시 기반)`

---

### Task 6: 통합 빌드 + merge + push

- [ ] **Step 1: 최종 빌드 + diff 검토**
- `npm run build` 통과
- `git log --oneline main..HEAD` 6개 commit 확인

- [ ] **Step 2: main merge + push**
- `git checkout main && git merge --ff-only feature/phase3-chapter-rag`
- `git push origin main`
- Vercel 배포 검증

---

*— end of Phase 3 plan*

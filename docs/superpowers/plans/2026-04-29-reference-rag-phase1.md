# Reference RAG Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 PDF/URL/텍스트 형식 레퍼런스 업로드하면 chunk 단위로 embedding 저장하고, AI 인터뷰 시 관련 chunk 검색해서 prompt에 주입.

**Architecture:** Neon Postgres에 pgvector extension 활성화. 레퍼런스 → text 추출 → 500자 chunk → Gemini text-embedding-004 → DB 저장. 인터뷰 question 생성 시 사용자 답변 기반 vector 검색 → top-5 chunks를 prompt context로 주입.

**Tech Stack:** Next.js 14 App Router, Neon Postgres + pgvector, Drizzle ORM, Gemini text-embedding-004 API, pdfjs-dist (PDF), @mozilla/readability + jsdom (URL).

**프로젝트 컨텍스트 (engineer가 알아야 할 것)**
- Vercel hobby plan (function timeout 60s)
- 기존 NextAuth 인증 + Drizzle adapter
- 모든 AI 호출은 차감 + ai_usage 로그 패턴 (lib/server/db.ts 참고)
- 환경변수: `GEMINI_API_KEY` (이미 paid Tier 1 활성화), `POSTGRES_URL_NON_POOLING`
- 베타 단계 — TDD 엄격 X, 핵심 helper만 unit test, route는 manual E2E test

---

## File Structure

| 파일 | 역할 | 새로/수정 |
|---|---|---|
| `db/migrations/0005_pgvector_references.sql` | pgvector extension + 새 테이블 2개 | 새로 |
| `db/schema.ts` | Drizzle schema에 bookReferences, referenceChunks 추가 | 수정 |
| `lib/server/pdf-parser.ts` | PDF binary → text 추출 | 새로 |
| `lib/server/url-extractor.ts` | URL → readable text | 새로 |
| `lib/server/chunker.ts` | text → chunks (500자 + 50자 overlap) | 새로 |
| `lib/server/embeddings.ts` | Gemini embedding API 호출 wrapper | 새로 |
| `lib/server/rag.ts` | query → embedding → vector search → chunks | 새로 |
| `app/api/reference/upload/route.ts` | POST — 업로드 처리 | 새로 |
| `app/api/reference/list/route.ts` | GET — 책별 레퍼런스 목록 | 새로 |
| `app/api/reference/[id]/route.ts` | DELETE — 레퍼런스 삭제 | 새로 |
| `app/api/generate/interview-question/route.ts` | RAG context 주입 | 수정 |
| `lib/prompts.ts` | interviewerPrompt에 referencesBlock 추가 | 수정 |
| `app/write/setup/page.tsx` | 레퍼런스 업로드 UI 섹션 | 수정 |
| `lib/storage.ts` | BookProject에 references 필드 (optional, frontend 표시용) | 수정 |

---

## Tasks

### Task 1: DB Migration — pgvector + 새 테이블 2개

**Files:**
- Create: `db/migrations/0005_pgvector_references.sql`

- [ ] **Step 1: SQL migration 파일 작성**

```sql
-- 0005_pgvector_references.sql
-- pgvector extension + 레퍼런스 저장 테이블 2개

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS book_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('pdf', 'url', 'text')),
  source_url text,
  total_chars integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_references_project ON book_references(project_id);
CREATE INDEX IF NOT EXISTS idx_book_references_user ON book_references(user_id);

CREATE TABLE IF NOT EXISTS reference_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES book_references(id) ON DELETE CASCADE,
  chunk_idx integer NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_chunks_ref ON reference_chunks(reference_id);
-- HNSW index — vector 유사도 검색용 (cosine distance)
CREATE INDEX IF NOT EXISTS idx_reference_chunks_embedding
  ON reference_chunks USING hnsw (embedding vector_cosine_ops);
```

- [ ] **Step 2: Migration 실행**

Run: `node scripts/migrate.mjs`
Expected: `▶ 0005_pgvector_references.sql` `✓ applied`

- [ ] **Step 3: DB 검증**

Run (psql 또는 Neon console):
```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
SELECT count(*) FROM information_schema.tables WHERE table_name IN ('book_references', 'reference_chunks');
```
Expected: vector extension 1행, 테이블 2개 확인.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/0005_pgvector_references.sql
git commit -m "feat(db): pgvector extension + book_references/reference_chunks tables"
```

---

### Task 2: Drizzle Schema 추가

**Files:**
- Modify: `db/schema.ts`

- [ ] **Step 1: schema 추가**

`db/schema.ts` 끝에 추가 (기존 `balanceTransactions` 다음):

```typescript
// ─── 레퍼런스 RAG (Phase 1 — 2026-04-29) ───
export const bookReferences = pgTable("book_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => bookProjects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  sourceType: text("source_type").notNull(),  // 'pdf' | 'url' | 'text'
  sourceUrl: text("source_url"),
  totalChars: integer("total_chars").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// embedding은 Drizzle pgvector type 미지원 — raw SQL로 처리. Drizzle에선 컬럼 정의만.
export const referenceChunks = pgTable("reference_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  referenceId: uuid("reference_id").notNull().references(() => bookReferences.id, { onDelete: "cascade" }),
  chunkIdx: integer("chunk_idx").notNull(),
  content: text("content").notNull(),
  // embedding vector(768) — Drizzle 직접 type 없음. 필요 시 raw SQL 사용
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: TypeScript 빌드 통과 확인**

Run: `npm run build`
Expected: build 성공 (단순 타입 추가라 issue 없어야)

- [ ] **Step 3: Commit**

```bash
git add db/schema.ts
git commit -m "feat(schema): bookReferences + referenceChunks Drizzle types"
```

---

### Task 3: PDF Parser Helper

**Files:**
- Create: `lib/server/pdf-parser.ts`
- Modify: `package.json` (deps)

- [ ] **Step 1: pdfjs-dist 설치**

Run: `npm install --save pdfjs-dist@^4.0.0`
Expected: package.json에 `pdfjs-dist: ^4.0.0` 추가

- [ ] **Step 2: PDF parser 작성**

`lib/server/pdf-parser.ts`:

```typescript
// PDF binary → 추출된 plain text
// pdfjs-dist는 Vercel serverless에서 worker 설정 필요 — Node 환경에선 legacy build 사용

export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  // dynamic import — bundle size 줄임
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // worker 비활성화 (Node 환경)
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjs.getDocument({
    data: buffer,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(" ");
    pages.push(text);
  }
  await pdf.destroy();
  return pages.join("\n\n").trim();
}
```

- [ ] **Step 3: 수동 테스트 스크립트로 검증**

`scripts/test-pdf-parser.mjs` (임시 파일, gitignore 또는 commit X):

```javascript
import { readFileSync } from "fs";
import { extractPdfText } from "../lib/server/pdf-parser.ts";

const buf = readFileSync("./test.pdf");  // 작은 PDF 미리 준비
const text = await extractPdfText(new Uint8Array(buf));
console.log(`Extracted ${text.length} chars`);
console.log(text.slice(0, 500));
```

Run: `npx tsx scripts/test-pdf-parser.mjs` (tsx 필요 시 설치)
Expected: PDF 텍스트 일부 출력. 글자 깨짐 없음.

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공. pdfjs-dist Vercel 호환 issue 시 webpack config 추가.

- [ ] **Step 5: Commit**

```bash
git add lib/server/pdf-parser.ts package.json package-lock.json
git commit -m "feat(rag): PDF text extraction helper (pdfjs-dist)"
```

---

### Task 4: URL Extractor Helper

**Files:**
- Create: `lib/server/url-extractor.ts`
- Modify: `package.json`

- [ ] **Step 1: 의존성 설치**

Run: `npm install --save jsdom @mozilla/readability`

- [ ] **Step 2: URL extractor 작성**

`lib/server/url-extractor.ts`:

```typescript
// URL → fetch HTML → Readability로 메인 콘텐츠 추출 → plain text

export async function extractUrlText(url: string, timeoutMs = 15000): Promise<{
  title: string;
  text: string;
}> {
  // URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs supported");
  }

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Tigerbookmaker/1.0)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`URL fetch timeout (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }

  // Readability로 메인 콘텐츠 추출
  const { JSDOM } = await import("jsdom");
  const { Readability } = await import("@mozilla/readability");
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) throw new Error("Could not extract readable content");

  return {
    title: article.title || parsed.hostname,
    text: (article.textContent || "").trim(),
  };
}
```

- [ ] **Step 3: 수동 테스트**

Test URL: `https://blog.naver.com/...` (네이버 블로그) 또는 `https://brunch.co.kr/...`

Run (Node REPL 또는 임시 스크립트):
```javascript
const { extractUrlText } = await import("./lib/server/url-extractor.ts");
const r = await extractUrlText("https://brunch.co.kr/@some-author/123");
console.log(r.title, r.text.slice(0, 500));
```
Expected: 제목 + 본문 일부 출력.

- [ ] **Step 4: Commit**

```bash
git add lib/server/url-extractor.ts package.json package-lock.json
git commit -m "feat(rag): URL → readable text extractor (jsdom + Readability)"
```

---

### Task 5: Text Chunker

**Files:**
- Create: `lib/server/chunker.ts`

- [ ] **Step 1: chunker 작성**

`lib/server/chunker.ts`:

```typescript
// text → chunks (500자 + 50자 overlap)
// 한국어 특화 — 단어 단위 자르기 X (대부분 1자 단위 처리)
// 문단(\n\n) > 문장(. ! ? 줄바꿈) 우선으로 자르되, 없으면 글자 단위

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE;
    if (end >= cleaned.length) {
      chunks.push(cleaned.slice(start).trim());
      break;
    }
    // 가까운 문단·문장 경계 찾기 (end 기준 ±50자)
    const window = cleaned.slice(start, end + 50);
    const paragraphBreak = window.lastIndexOf("\n\n");
    const sentenceBreak = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf(".\n"),
      window.lastIndexOf("다.\n"),
      window.lastIndexOf("다. "),
    );
    if (paragraphBreak > CHUNK_SIZE - 100) {
      end = start + paragraphBreak + 2;
    } else if (sentenceBreak > CHUNK_SIZE - 100) {
      end = start + sentenceBreak + 1;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }
  return chunks.filter(c => c.length > 0);
}
```

- [ ] **Step 2: 수동 테스트**

`scripts/test-chunker.mjs`:

```javascript
import { chunkText } from "../lib/server/chunker.ts";

const sample = `이것은 첫 번째 문단입니다. 한국어 chunker 테스트.

이것은 두 번째 문단입니다. 적절히 잘리는지 확인하세요.

` + "긴 텍스트 ".repeat(200);

const chunks = chunkText(sample);
console.log(`총 ${chunks.length} chunks`);
chunks.forEach((c, i) => console.log(`[${i}] (${c.length}자) ${c.slice(0, 100)}...`));
```

Run: `npx tsx scripts/test-chunker.mjs`
Expected: 여러 chunks, 각 ~500자, overlap 잘 작동.

- [ ] **Step 3: Commit**

```bash
git add lib/server/chunker.ts
git commit -m "feat(rag): text chunker (500자 + 50자 overlap, 문단/문장 경계 우선)"
```

---

### Task 6: Embeddings Helper

**Files:**
- Create: `lib/server/embeddings.ts`

- [ ] **Step 1: Embeddings helper 작성**

`lib/server/embeddings.ts`:

```typescript
// Gemini text-embedding-004 — 768 dim, 한국어 OK
// 무료 tier: 분당 1500 RPM (paid Tier 1), 무료 분당 30
// rate limit hit 시 자동 retry 1회 + 1초 백오프

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIM = 768;

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429 && attempt === 0) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`Embedding API ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json();
      const values = data?.embedding?.values;
      if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
        throw new Error(`Invalid embedding response (expected ${EMBEDDING_DIM} dim)`);
      }
      return values;
    } catch (e: any) {
      if (attempt >= 1) throw e;
    }
  }
  throw new Error("Embedding failed after retry");
}

// batch embedding — 여러 chunks 한 번에 (현재 Gemini API는 1개씩, 순차 호출)
export async function embedBatch(texts: string[], onProgress?: (done: number, total: number) => void): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const v = await embed(texts[i]);
    results.push(v);
    onProgress?.(i + 1, texts.length);
  }
  return results;
}
```

- [ ] **Step 2: 수동 테스트**

`scripts/test-embeddings.mjs`:

```javascript
import "dotenv/config";
import { embed } from "../lib/server/embeddings.ts";

const v = await embed("한국어 임베딩 테스트입니다.");
console.log(`Got vector of dim ${v.length}, first 5:`, v.slice(0, 5));
```

Run: `npx tsx scripts/test-embeddings.mjs`
Expected: dim 768, 숫자 5개 출력.

- [ ] **Step 3: Commit**

```bash
git add lib/server/embeddings.ts
git commit -m "feat(rag): Gemini text-embedding-004 wrapper (retry, batch)"
```

---

### Task 7: RAG Search Helper

**Files:**
- Create: `lib/server/rag.ts`

- [ ] **Step 1: RAG search helper 작성**

`lib/server/rag.ts`:

```typescript
// query → embedding → vector search → top-N chunks
// pgvector cosine distance 사용 (1 - cosine similarity, 작을수록 유사)

import { sql } from "@vercel/postgres";
import { embed } from "./embeddings";

export interface RagChunk {
  content: string;
  referenceFilename: string;
  chunkIdx: number;
  distance: number;  // 0~2 (cosine, 작을수록 유사)
}

export async function ragSearch(opts: {
  projectId: string;
  query: string;
  topN?: number;
  maxDistance?: number;  // 이 거리 초과 chunk는 결과에서 제외
}): Promise<RagChunk[]> {
  const { projectId, query, topN = 5, maxDistance = 0.7 } = opts;

  const queryEmbedding = await embed(query);
  // pgvector vector literal: '[0.1,0.2,...]'
  const vec = `[${queryEmbedding.join(",")}]`;

  const { rows } = await sql<{
    content: string;
    filename: string;
    chunk_idx: number;
    distance: number;
  }>`
    SELECT
      rc.content,
      br.filename,
      rc.chunk_idx,
      rc.embedding <=> ${vec}::vector AS distance
    FROM reference_chunks rc
    JOIN book_references br ON br.id = rc.reference_id
    WHERE br.project_id = ${projectId}
      AND rc.embedding IS NOT NULL
    ORDER BY distance
    LIMIT ${topN}
  `;

  return rows
    .filter(r => Number(r.distance) <= maxDistance)
    .map(r => ({
      content: r.content,
      referenceFilename: r.filename,
      chunkIdx: r.chunk_idx,
      distance: Number(r.distance),
    }));
}

// prompt 주입용 — chunks를 마크다운 블록으로 포맷
export function formatRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map(c =>
    `--- [${c.referenceFilename} #${c.chunkIdx + 1}]\n${c.content}\n`
  );
  return `\n[작가가 제공한 레퍼런스 — 참고 자료]\n${blocks.join("\n")}\n`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/rag.ts
git commit -m "feat(rag): vector search helper (pgvector cosine + topN + maxDistance filter)"
```

---

### Task 8: Reference Upload API

**Files:**
- Create: `app/api/reference/upload/route.ts`

- [ ] **Step 1: Upload route 작성**

`app/api/reference/upload/route.ts`:

```typescript
// POST /api/reference/upload
// FormData (PDF) 또는 JSON ({type, url, text})
// 응답: { id, chunkCount, totalChars }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";
import { extractPdfText } from "@/lib/server/pdf-parser";
import { extractUrlText } from "@/lib/server/url-extractor";
import { chunkText } from "@/lib/server/chunker";
import { embedBatch } from "@/lib/server/embeddings";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;  // 10MB
const MAX_TEXT_LENGTH = 500_000;          // 500k 글자
const MAX_CHUNKS = 1000;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`ref-upload:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const contentType = req.headers.get("content-type") || "";
    let projectId: string;
    let sourceType: "pdf" | "url" | "text";
    let sourceUrl: string | null = null;
    let filename: string;
    let rawText: string;

    if (contentType.includes("multipart/form-data")) {
      // PDF 파일 업로드
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      projectId = String(formData.get("projectId") ?? "");
      if (!file || !projectId) return NextResponse.json({ error: "INVALID_INPUT", message: "file과 projectId 필요" }, { status: 400 });
      if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE", message: "PDF는 10MB 이하만 가능" }, { status: 400 });
      const buf = new Uint8Array(await file.arrayBuffer());
      try {
        rawText = await extractPdfText(buf);
      } catch (e: any) {
        return NextResponse.json({ error: "PDF_PARSE_FAILED", message: `PDF 처리 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
      }
      sourceType = "pdf";
      filename = file.name;
    } else {
      // JSON: { projectId, type, url?, text? }
      const body = await req.json().catch(() => ({}));
      projectId = String(body.projectId ?? "");
      const type = body.type;
      if (!projectId || !["url", "text"].includes(type)) {
        return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
      }
      if (type === "url") {
        const url = String(body.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "INVALID_INPUT", message: "url 필요" }, { status: 400 });
        try {
          const r = await extractUrlText(url);
          rawText = r.text;
          filename = r.title;
          sourceUrl = url;
        } catch (e: any) {
          return NextResponse.json({ error: "URL_FETCH_FAILED", message: `URL 처리 실패: ${e?.message?.slice(0, 200)}` }, { status: 400 });
        }
        sourceType = "url";
      } else {
        const text = String(body.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "INVALID_INPUT", message: "text 필요" }, { status: 400 });
        if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: "TEXT_TOO_LONG", message: `${MAX_TEXT_LENGTH}자 이하` }, { status: 400 });
        rawText = text;
        filename = `텍스트 메모 — ${new Date().toLocaleString("ko-KR")}`;
        sourceType = "text";
      }
    }

    // 프로젝트 권한 검증
    const { rows: projRows } = await sql`
      SELECT id FROM book_projects WHERE id = ${projectId} AND user_id = ${userId}
    `;
    if (projRows.length === 0) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
    }

    if (rawText.length < 50) {
      return NextResponse.json({ error: "TEXT_TOO_SHORT", message: "최소 50자 필요" }, { status: 400 });
    }
    if (rawText.length > MAX_TEXT_LENGTH) {
      rawText = rawText.slice(0, MAX_TEXT_LENGTH);
    }

    // chunk
    const chunks = chunkText(rawText);
    if (chunks.length === 0) return NextResponse.json({ error: "NO_CHUNKS" }, { status: 400 });
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json({ error: "TOO_MANY_CHUNKS", message: `${MAX_CHUNKS} chunk 한도 초과 (현재 ${chunks.length})` }, { status: 400 });
    }

    // book_references row 먼저 INSERT
    const { rows: refRows } = await sql<{ id: string }>`
      INSERT INTO book_references (project_id, user_id, filename, source_type, source_url, total_chars, chunk_count)
      VALUES (${projectId}, ${userId}, ${filename}, ${sourceType}, ${sourceUrl}, ${rawText.length}, ${chunks.length})
      RETURNING id
    `;
    const refId = refRows[0].id;

    // embedding (순차) + chunks INSERT
    let embedded = 0;
    try {
      const vectors = await embedBatch(chunks, (done, total) => {
        embedded = done;
      });
      // bulk INSERT — pgvector vector literal
      for (let i = 0; i < chunks.length; i++) {
        const vec = `[${vectors[i].join(",")}]`;
        await sql`
          INSERT INTO reference_chunks (reference_id, chunk_idx, content, embedding)
          VALUES (${refId}, ${i}, ${chunks[i]}, ${vec}::vector)
        `;
      }
    } catch (e: any) {
      // embedding 실패 시 reference row 삭제 (cascade로 chunks도)
      await sql`DELETE FROM book_references WHERE id = ${refId}`;
      return NextResponse.json({
        error: "EMBEDDING_FAILED",
        message: `Embedding 실패 (${embedded}/${chunks.length} 처리됨): ${e?.message?.slice(0, 200)}`,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: refId,
      filename,
      sourceType,
      chunkCount: chunks.length,
      totalChars: rawText.length,
    });
  } catch (e: any) {
    console.error("[/api/reference/upload]", e);
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: e?.message || String(e),
    }, { status: 500 });
  }
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add app/api/reference/upload/route.ts
git commit -m "feat(api): POST /api/reference/upload — PDF/URL/text → chunks → embeddings"
```

---

### Task 9: Reference List + Delete API

**Files:**
- Create: `app/api/reference/list/route.ts`
- Create: `app/api/reference/[id]/route.ts`

- [ ] **Step 1: List route 작성**

`app/api/reference/list/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { rows } = await sql`
    SELECT id, filename, source_type, source_url, total_chars, chunk_count, uploaded_at
    FROM book_references
    WHERE project_id = ${projectId} AND user_id = ${session.user.id}
    ORDER BY uploaded_at DESC
  `;

  return NextResponse.json({
    references: rows.map(r => ({
      id: r.id,
      filename: r.filename,
      sourceType: r.source_type,
      sourceUrl: r.source_url,
      totalChars: r.total_chars,
      chunkCount: r.chunk_count,
      uploadedAt: r.uploaded_at,
    })),
  });
}
```

- [ ] **Step 2: Delete route 작성**

`app/api/reference/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { rowCount } = await sql`
    DELETE FROM book_references WHERE id = ${params.id} AND user_id = ${session.user.id}
  `;
  if (rowCount === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/reference/list/route.ts app/api/reference/\[id\]/route.ts
git commit -m "feat(api): reference list (GET) + delete (DELETE) endpoints"
```

---

### Task 10: Interview Prompt — RAG Context 주입

**Files:**
- Modify: `lib/prompts.ts` (interviewerPrompt 함수 수정)
- Modify: `app/api/generate/interview-question/route.ts`

- [ ] **Step 1: prompts.ts에 referencesBlock helper 추가**

`lib/prompts.ts`의 interviewerPrompt 직전에 추가:

```typescript
// RAG context block — 인터뷰·목차·챕터 prompt에 주입할 레퍼런스 chunks
export function referencesBlock(chunks: { content: string; referenceFilename: string; chunkIdx: number }[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map(c =>
    `[${c.referenceFilename} 발췌 #${c.chunkIdx + 1}]\n${c.content}`
  ).join("\n\n");
  return `\n[작가가 제공한 레퍼런스 — 다음 자료를 정확히 이해하고 질문에 활용]\n${blocks}\n`;
}
```

- [ ] **Step 2: interviewerPrompt signature 변경**

기존:
```typescript
export function interviewerPrompt(p: BookProject, history: { q: string; a: string }[]): string {
```

수정:
```typescript
export function interviewerPrompt(
  p: BookProject,
  history: { q: string; a: string }[],
  references: { content: string; referenceFilename: string; chunkIdx: number }[] = [],
): string {
```

함수 본문 안에 `[책 정보]` 직후에 `${referencesBlock(references)}` 추가:

```typescript
return `당신은 책 작가의 차별화 정보를 끌어내는 인터뷰어입니다.

[책 정보]
- 주제: ${p.topic}
- 대상 독자: ${p.audience}
- 책 유형: ${p.type}
- 목표 분량: ${p.targetPages}쪽
${referencesBlock(references)}
[지금까지 인터뷰 ${history.length}회]
...
```

또 prompt instructions에 추가 (`[중요 규칙]` 섹션 다음에):

```
[레퍼런스 활용 — 매우 중요]
- 위 레퍼런스가 있으면 그 내용을 정확히 이해하고 질문에 구체적으로 활용
- 일반적 질문 X. "방금 본 [파일명] 발췌 #2에서 X라 하셨는데, 본인 경험으로 풀어주실 수 있나요?" 같이 구체적
- 레퍼런스 없으면 (위 블록이 비어있으면) 일반 인터뷰 진행
```

- [ ] **Step 3: interview-question route 수정**

`app/api/generate/interview-question/route.ts`에서 prompt 호출 직전에 RAG 검색:

```typescript
// (기존 imports 위에 추가)
import { ragSearch } from "@/lib/server/rag";
```

prompt 생성 부분에 RAG 검색 추가 (interviewerPrompt 호출 직전):

```typescript
// RAG 검색 — 사용자 마지막 답변 또는 책 주제로 query
const lastAnswer = history.length > 0 ? history[history.length - 1].a : "";
const ragQuery = lastAnswer.trim().length > 20 ? lastAnswer : project.topic;

let ragChunks: Awaited<ReturnType<typeof ragSearch>> = [];
try {
  ragChunks = await ragSearch({
    projectId,
    query: ragQuery,
    topN: 3,
    maxDistance: 0.7,
  });
} catch (e: any) {
  console.warn("[interview-question] RAG search failed:", e?.message);
  // RAG 실패해도 인터뷰는 진행 (degraded mode)
}

const promptText = interviewerPrompt(project, history, ragChunks);
```

기존 `interviewerPrompt(project, history)` 호출은 위 코드로 대체.

- [ ] **Step 4: 빌드 + commit**

Run: `npm run build`
Expected: 통과.

```bash
git add lib/prompts.ts app/api/generate/interview-question/route.ts
git commit -m "feat(rag): interview question 생성 시 RAG context 자동 주입"
```

---

### Task 11: /write/setup UI — 레퍼런스 업로드 섹션

**Files:**
- Modify: `app/write/setup/page.tsx`

- [ ] **Step 1: state + 함수 추가**

`/write/setup/page.tsx` 컴포넌트 안에 state 추가:

```typescript
const [references, setReferences] = useState<{ id: string; filename: string; sourceType: string; chunkCount: number; totalChars: number }[]>([]);
const [refUploadBusy, setRefUploadBusy] = useState(false);
const [refUploadMode, setRefUploadMode] = useState<"none" | "pdf" | "url" | "text">("none");
const [refUrlInput, setRefUrlInput] = useState("");
const [refTextInput, setRefTextInput] = useState("");
```

useEffect 추가 (page mount 시 references 로드):

```typescript
useEffect(() => {
  if (!projectId) return;
  fetch(`/api/reference/list?projectId=${projectId}`)
    .then(r => r.ok ? r.json() : { references: [] })
    .then(d => setReferences(d.references || []))
    .catch(() => {});
}, [projectId]);
```

업로드·삭제 함수:

```typescript
const uploadPdfReference = async (file: File) => {
  if (!projectId) return;
  setRefUploadBusy(true);
  setError(null);
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);
    const res = await fetch("/api/reference/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
    setReferences(prev => [{
      id: data.id, filename: data.filename, sourceType: data.sourceType,
      chunkCount: data.chunkCount, totalChars: data.totalChars,
    }, ...prev]);
    setRefUploadMode("none");
  } catch (e: any) {
    setError(e.message);
  } finally {
    setRefUploadBusy(false);
  }
};

const uploadUrlReference = async () => {
  if (!projectId || !refUrlInput.trim()) return;
  setRefUploadBusy(true);
  setError(null);
  try {
    const res = await fetch("/api/reference/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, type: "url", url: refUrlInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
    setReferences(prev => [data, ...prev]);
    setRefUrlInput("");
    setRefUploadMode("none");
  } catch (e: any) {
    setError(e.message);
  } finally {
    setRefUploadBusy(false);
  }
};

const uploadTextReference = async () => {
  if (!projectId || refTextInput.trim().length < 50) return;
  setRefUploadBusy(true);
  setError(null);
  try {
    const res = await fetch("/api/reference/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, type: "text", text: refTextInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `업로드 실패 (${res.status})`);
    setReferences(prev => [data, ...prev]);
    setRefTextInput("");
    setRefUploadMode("none");
  } catch (e: any) {
    setError(e.message);
  } finally {
    setRefUploadBusy(false);
  }
};

const deleteReference = async (id: string) => {
  if (!confirm("이 레퍼런스를 삭제할까요? 해당 내용은 더 이상 인터뷰·목차·본문에 활용되지 않습니다.")) return;
  try {
    const res = await fetch(`/api/reference/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("삭제 실패");
    setReferences(prev => prev.filter(r => r.id !== id));
  } catch (e: any) {
    setError(e.message);
  }
};
```

- [ ] **Step 2: UI 섹션 추가**

`/write/setup` 페이지에서 인터뷰 시작 전 (예: 첫 화면 또는 인터뷰 시작 버튼 위)에 레퍼런스 업로드 섹션 추가. 정확한 위치는 기존 page 구조에 맞춰 (예: 인터뷰 진행 박스 위):

```tsx
{/* 레퍼런스 업로드 — Phase 1 */}
<div className="mb-6 p-5 bg-orange-50/50 border border-tiger-orange/30 rounded-xl">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-bold text-ink-900">📚 참고 자료 ({references.length})</h3>
    {refUploadMode === "none" && (
      <div className="flex gap-1">
        <label className="text-xs px-2 py-1 bg-tiger-orange text-white rounded font-bold cursor-pointer hover:bg-orange-600">
          PDF
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => e.target.files?.[0] && uploadPdfReference(e.target.files[0])}
            disabled={refUploadBusy}
          />
        </label>
        <button onClick={() => setRefUploadMode("url")} disabled={refUploadBusy} className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100">URL</button>
        <button onClick={() => setRefUploadMode("text")} disabled={refUploadBusy} className="text-xs px-2 py-1 border border-tiger-orange text-tiger-orange rounded font-bold hover:bg-orange-100">텍스트</button>
      </div>
    )}
  </div>
  <p className="text-xs text-gray-600 mb-3">
    PDF·블로그 URL·메모 등을 올리면 AI가 정확히 읽고 인터뷰·목차·본문에 활용합니다. (10MB 이하 PDF, 정적 HTML URL, 50~50만자 텍스트)
  </p>

  {refUploadBusy && (
    <div className="p-3 bg-white rounded-lg text-xs text-tiger-orange">⏳ 처리 중... (PDF는 페이지 수에 따라 10~60초)</div>
  )}

  {refUploadMode === "url" && (
    <div className="flex gap-2 mb-3">
      <input
        type="url"
        value={refUrlInput}
        onChange={e => setRefUrlInput(e.target.value)}
        placeholder="https://brunch.co.kr/@..."
        className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded focus:border-tiger-orange focus:outline-none"
      />
      <button onClick={uploadUrlReference} disabled={refUploadBusy || !refUrlInput.trim()} className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50">가져오기</button>
      <button onClick={() => { setRefUploadMode("none"); setRefUrlInput(""); }} className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900">취소</button>
    </div>
  )}

  {refUploadMode === "text" && (
    <div className="mb-3">
      <textarea
        value={refTextInput}
        onChange={e => setRefTextInput(e.target.value)}
        placeholder="참고할 텍스트를 붙여넣으세요 (50~500,000자)"
        rows={5}
        className="w-full text-xs px-3 py-2 border border-gray-300 rounded focus:border-tiger-orange focus:outline-none mb-2 resize-y"
      />
      <div className="flex gap-2 items-center">
        <button onClick={uploadTextReference} disabled={refUploadBusy || refTextInput.trim().length < 50} className="text-xs px-3 py-2 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 disabled:opacity-50">저장</button>
        <button onClick={() => { setRefUploadMode("none"); setRefTextInput(""); }} className="text-xs px-2 py-2 text-gray-500 hover:text-ink-900">취소</button>
        <span className="text-[10px] text-gray-500 ml-auto">{refTextInput.length}자</span>
      </div>
    </div>
  )}

  {references.length > 0 && (
    <div className="space-y-1.5">
      {references.map(r => (
        <div key={r.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 text-xs">
          <span className="text-base">
            {r.sourceType === "pdf" ? "📄" : r.sourceType === "url" ? "🌐" : "📝"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-ink-900 truncate">{r.filename}</div>
            <div className="text-[10px] text-gray-500">{r.totalChars.toLocaleString()}자 · {r.chunkCount} chunks</div>
          </div>
          <button onClick={() => deleteReference(r.id)} className="text-[10px] text-gray-400 hover:text-red-600">삭제</button>
        </div>
      ))}
    </div>
  )}

  {references.length === 0 && refUploadMode === "none" && !refUploadBusy && (
    <div className="text-center py-4 text-xs text-gray-400">
      참고 자료 없이 인터뷰만 진행해도 OK. 자료 있으면 더 정확한 책이 됩니다.
    </div>
  )}
</div>
```

- [ ] **Step 3: 빌드 + commit**

Run: `npm run build`
Expected: 통과.

```bash
git add app/write/setup/page.tsx
git commit -m "feat(ui): /write/setup 레퍼런스 업로드 섹션 (PDF/URL/텍스트)"
```

---

### Task 12: 통합 테스트 (manual E2E)

**Files:**
- 새 파일 X (manual test)

- [ ] **Step 1: 빌드 + push**

```bash
npm run build
git push origin main
```

Vercel auto-deploy 1~2분 대기.

- [ ] **Step 2: production E2E 시나리오**

1. 본인 계정 로그인 → /new → 새 책 생성 (예: "재테크")
2. /write/setup 진입 → 레퍼런스 섹션 보임 확인
3. 작은 PDF 1개 업로드 (5쪽 정도) → "처리 중" → 완료 후 list에 표시 (chunk count 표시)
4. URL 1개 추가 (예: brunch.co.kr 글) → 완료
5. 텍스트 메모 1개 추가 (200자+) → 완료
6. 인터뷰 시작 → 첫 질문 받음 → 답변 → 다음 질문에 **레퍼런스 내용 반영된 구체적 질문 나오는지** 확인
7. /usage 가서 ai_usage 로그 확인 — embedding 호출 (gemini text-embedding-004) 보임
8. /write로 진입 → 일반 동작 정상

**관찰 포인트**:
- PDF 처리 시간 (페이지당 약 1초 + embedding 0.5초)
- 인터뷰 질문 톤 (레퍼런스 인용 자연스러운가)
- 에러 메시지 친절한가

- [ ] **Step 3: 발견된 이슈 정리**

테스트 중 발견된 작은 이슈는 즉시 fix + 재push. 큰 이슈는 별도 issue로 정리.

- [ ] **Step 4: 사용자 검증 + 피드백 받음**

이 시점이 Phase 1 완료. Phase 2 진행 결정 받기.

---

## Self-Review Checklist

**1. Spec coverage** — design doc Section 3.3 (Phase 1 architecture) 모든 구성요소 task 매핑 확인:
- ✅ pgvector + 테이블 (Task 1, 2)
- ✅ pdfjs-dist (Task 3)
- ✅ readability (Task 4)
- ✅ chunker (Task 5)
- ✅ embedding (Task 6)
- ✅ rag.ts (Task 7)
- ✅ POST /api/reference/upload (Task 8)
- ✅ GET /api/reference/list + DELETE (Task 9)
- ✅ interview-question RAG 주입 (Task 10)
- ✅ /write/setup UI (Task 11)
- ✅ E2E 검증 (Task 12)

**2. Placeholder scan** — TBD/TODO/"add appropriate" 없음 ✓

**3. Type consistency** — `RagChunk` interface 일관 (Task 7 정의 → Task 10 import). embedBatch signature 일치.

**4. 빠진 부분 — pdfjs-dist Vercel webpack config**: Vercel build 시 pdfjs worker issue 가능. Task 3에서 발견되면 `next.config.js`에 webpack 설정 추가 필요. plan에 명시 X — engineer가 발견 시 수정.

수정 사항 없음. 진행.

---

## Execution Handoff

Plan 완성. `docs/superpowers/plans/2026-04-29-reference-rag-phase1.md` 저장.

**두 가지 실행 옵션**:

**1. Subagent-Driven (recommended)** — 매 task마다 fresh subagent dispatch + 두 단계 review. 빠른 iteration, context 깨끗.

**2. Inline Execution** — 현재 session에서 직접 execute. checkpoint마다 review.

**어느 쪽?**

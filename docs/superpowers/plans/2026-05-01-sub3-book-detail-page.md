# Sub-project 3 — 책 상세 페이지 (마케팅)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 작가가 SNS·블로그·DM에 "내 책!" 자랑·홍보할 수 있는 마케팅 페이지. 기존 `/share/[id]` (읽기용)과 분리해서, `/book/[id]`는 cover hero + 책 정보 + 목차 + CTA 위주.

**디자인 doc 참조:** Q3 + 회의8 항목 "책 상세 페이지 (마케팅 page)".

**핵심 차이**
- `/share/[id]` = **읽기**용 (전체 챕터 본문, 책장 UX)
- `/book/[id]` = **홍보**용 (cover + 설명 + 목차 + CTA + share buttons + 작가 정보)

**활용 시나리오**
- 인스타 link-in-bio: `/book/[id]`
- 카톡 공유: OG preview에 cover + tagline
- 친구·SNS 첫인상: 5초 안에 "이 책 뭐다" 판단

---

## File Structure

| 파일 | 역할 | 새로/수정 |
|---|---|---|
| `lib/storage.ts` | `MarketingMeta` 타입 + `BookProject.marketingMeta?` | 수정 |
| `app/api/book/[id]/route.ts` | GET — public 마케팅 데이터 (no chapter content) | 새로 |
| `app/book/[id]/page.tsx` | 마케팅 랜딩 페이지 | 새로 |
| `app/book/[id]/layout.tsx` | OG metadata (재활용 share layout 패턴) | 새로 |
| `app/api/projects/[id]/route.ts` | PATCH에 `marketingMeta` 허용 | 수정 |
| `app/write/page.tsx` (또는 setup) | "🔗 마케팅 페이지" 링크 + 편집 | 수정 |
| `app/api/generate/marketing-meta/route.ts` | AI가 자동 tagline+description 생성 (kmongPackage 활용) | 새로 |

---

## Tasks

### Task 1: 타입 정의

**Files:**
- Modify: `lib/storage.ts`

```typescript
export interface MarketingMeta {
  tagline?: string;          // 한 줄 요약 (인스타 caption 같은)
  description?: string;      // 2~4문단 (책 광고)
  authorName?: string;       // 작가 표시명 (default: 사용자 이메일 prefix)
  authorBio?: string;        // 작가 한 줄 소개
  ctaButtons?: Array<{ label: string; url: string }>;  // 외부 구매 링크 등
  generatedAt?: number;
}

export interface BookProject {
  // ... 기존
  marketingMeta?: MarketingMeta;
}
```

Commit: `feat(types): MarketingMeta 타입`

---

### Task 2: 공개 API

**Files:**
- Create: `app/api/book/[id]/route.ts`

기존 `/api/share/[id]/route.ts` 패턴 그대로 따라가되, **챕터 본문은 제외** (제목·부제만):

```typescript
// GET /api/book/[id] — 공개 마케팅 데이터 (no auth, no chapter content)
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { rows } = await sql<{ data: any; created_at: string }>`
    SELECT data, created_at FROM book_projects WHERE id = ${id} LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const p = rows[0];

  // shareEnabled가 false면 비공개 (마케팅 페이지도 공유 동의 후 접근 가능)
  if (!p.data?.shareEnabled) {
    return NextResponse.json({ error: "PRIVATE", message: "이 책은 비공개입니다." }, { status: 403 });
  }

  return NextResponse.json({
    id,
    topic: p.data.topic,
    audience: p.data.audience,
    type: p.data.type,
    cover: p.data.cover ? { base64: p.data.cover.base64 } : null,
    chapters: (p.data.chapters || []).map((c: any) => ({
      title: c.title,
      subtitle: c.subtitle,
      // content는 의도적으로 제외 — /book은 마케팅용
    })),
    themeColor: p.data.themeColor ?? "orange",
    marketingMeta: p.data.marketingMeta ?? null,
    kmongCopy: p.data.kmongPackage?.copy ?? null,  // fallback 광고 카피 (있으면 활용)
    createdAt: p.created_at,
  });
}
```

Commit: `feat(api): GET /api/book/[id] — 공개 마케팅 데이터`

---

### Task 3: 마케팅 페이지 + OG metadata

**Files:**
- Create: `app/book/[id]/page.tsx`
- Create: `app/book/[id]/layout.tsx`

**`layout.tsx`** — `/share/[id]/layout.tsx` 그대로 복사하고 endpoint·URL만 `/book/[id]`로 변경. tagline 있으면 description으로 사용:

```typescript
// /book/[id] 동적 메타데이터 — SNS 공유 미리보기
import type { Metadata } from "next";

interface BookSummary {
  topic: string;
  audience: string;
  type: string;
  hasCover?: boolean;
  tagline?: string;
}

async function fetchBookSummary(id: string, baseUrl: string): Promise<BookSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/book/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      topic: d.topic,
      audience: d.audience,
      type: d.type,
      hasCover: !!d.cover,
      tagline: d.marketingMeta?.tagline ?? d.kmongCopy?.kmongDescription?.slice(0, 100),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tigerbookmaker.vercel.app");
  const data = await fetchBookSummary(id, baseUrl);
  if (!data) return { title: "Tigerbookmaker", description: "AI가 만든 한국어 책" };

  const ogImageUrl = data.hasCover ? `${baseUrl}/api/share/${id}/og` : `${baseUrl}/og-default.png`;
  const desc = data.tagline || `${data.audience} 대상 ${data.type}. 🐯 Tigerbookmaker.`;

  return {
    title: `${data.topic} — Tigerbookmaker`,
    description: desc,
    openGraph: {
      title: data.topic,
      description: desc,
      type: "book",
      url: `${baseUrl}/book/${id}`,
      siteName: "Tigerbookmaker",
      locale: "ko_KR",
      images: [{ url: ogImageUrl, width: 1024, height: 1024, alt: data.topic }],
    },
    twitter: { card: "summary_large_image", title: data.topic, description: desc, images: [ogImageUrl] },
  };
}

export default function BookLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
```

**`page.tsx`** — 클라이언트 컴포넌트, 마케팅 랜딩:

레이아웃 (위에서 아래로):
1. **Hero** — 표지(왼쪽) + 책 제목(큰), tagline, audience+type chip (오른쪽)
2. **CTA bar** — "📖 읽어보기" → `/share/[id]`, "💬 공유" (kakaotalk/twitter/copy URL)
3. **설명** — marketingMeta.description 또는 kmongCopy.kmongDescription
4. **목차** — chapter title 리스트 (subtitle 함께)
5. **작가 정보** — authorName + authorBio (선택)
6. **다른 책 보기** — link-in-bio 페이지로 (sub-project 4 placeholder; 일단 비활성화)
7. **Footer CTA** — "🐯 나도 30분에 책 만들기" → `/`

`getTheme(themeColor)` 활용해서 책 테마 색상 적용 (Sub-project 2 통합).

코드 길어서 여기 생략 — 약 200~250줄. 기존 `/share/[id]/page.tsx`의 hero 부분 참고하면 빠름.

Commit: `feat(ui): /book/[id] 마케팅 페이지 + OG metadata`

---

### Task 4: PATCH endpoint에 marketingMeta 허용

**Files:**
- Modify: `app/api/projects/[id]/route.ts`

기존 PATCH 핸들러가 `themeColor`만 받고 있음. `marketingMeta`도 허용하게 확장:

```typescript
const { themeColor, marketingMeta } = body;
const updates: any = {};
if (themeColor !== undefined) {
  if (!VALID_THEMES.includes(themeColor)) return NextResponse.json({ error: "INVALID_THEME" }, { status: 400 });
  updates.themeColor = themeColor;
}
if (marketingMeta !== undefined) {
  if (typeof marketingMeta !== "object" || marketingMeta === null) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "marketingMeta는 object여야 합니다" }, { status: 400 });
  }
  // sanitize: 길이 제한
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
  updates.marketingMeta = sanitized;
}
if (Object.keys(updates).length === 0) return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
await updateProjectData(projectId, userId, { ...projectRow.data, ...updates });
return NextResponse.json({ ok: true, updates });
```

기존 themeColor-only 로직을 위 패턴으로 통합.

Commit: `feat(api): PATCH /api/projects/[id]에 marketingMeta 허용 + sanitize`

---

### Task 5: AI 자동 marketing meta 생성 API

**Files:**
- Create: `app/api/generate/marketing-meta/route.ts`

`kmongPackage.copy`가 있으면 그걸 변환만 (AI 호출 X). 없으면 AI에게 새로 생성.

```typescript
// POST /api/generate/marketing-meta
// body: { projectId }
// kmongCopy 있으면 변환만 (cost 0). 없으면 AI 호출 (~₩15)
// 응답: { ok, marketingMeta, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`mkt:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    // kmongCopy 있으면 그대로 변환
    const kCopy = (project as any).kmongPackage?.copy;
    if (kCopy?.kmongDescription && kCopy.kmongHighlights?.length) {
      const tagline = kCopy.kmongHighlights[0] ?? "";
      const description = kCopy.kmongDescription;
      const marketingMeta = {
        tagline: tagline.slice(0, 200),
        description: description.slice(0, 3000),
        generatedAt: Date.now(),
      };
      await updateProjectData(projectId, userId, { ...project, marketingMeta });
      return NextResponse.json({ ok: true, marketingMeta, newBalance: null, costKRW: 0, source: "kmong" });
    }

    // AI 생성
    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 30) {
      return NextResponse.json({ error: "INSUFFICIENT_BALANCE", message: "잔액 부족 (~₩20)", current: user.balance_krw }, { status: 402 });
    }
    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    const promptText = `당신은 책 광고 카피라이터입니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
- 챕터: ${(project.chapters || []).slice(0, 8).map((c: any, i: number) => `${i+1}. ${c.title}`).join(", ")}

[작업]
이 책의 마케팅 페이지에 들어갈 한국어 JSON 출력:

{
  "tagline": "한 줄 요약 (50~80자, 호기심 유발)",
  "description": "2~3문단 광고문 (300~500자, 누구를 위한 책 + 무엇을 얻는가 + 다른 책과 차별점)"
}

JSON만 출력. 다른 설명 X.`;

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 한국어 책 광고 카피라이터입니다. JSON만 출력합니다.",
          user: promptText,
          maxTokens: 1024,
          temperature: 0.7,
          timeoutMs: 20000,
          retries: 0,
        });
        actualModel = candidate;
        break;
      } catch (e: any) {
        lastError = e;
        const msg = String(e?.message ?? "");
        const transient = /\b50[23]\b|UNAVAILABLE|overloaded|timeout|429|quota/i.test(msg);
        if (!transient) return NextResponse.json({ error: "AI_CALL_FAILED", message: msg }, { status: 502 });
      }
    }
    if (!result) return NextResponse.json({ error: "AI_CALL_FAILED", message: lastError?.message }, { status: 502 });

    let parsed: { tagline: string; description: string };
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    const marketingMeta = {
      tagline: String(parsed.tagline ?? "").slice(0, 200),
      description: String(parsed.description ?? "").slice(0, 3000),
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, marketingMeta });

    const costKRW = Math.ceil(result.usage.costUSD * USD_TO_KRW);
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
    let newBalance = user.balance_krw;
    if (costKRW > 0) {
      const r = await deductBalance({ userId, amountKRW: costKRW, aiUsageId: log.id, reason: `마케팅 메타 (${actualModel})` });
      newBalance = r.newBalance;
    }
    return NextResponse.json({ ok: true, marketingMeta, newBalance, costKRW, source: "ai" });
  } catch (e: any) {
    console.error("[/api/generate/marketing-meta]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
```

Commit: `feat(api): POST /api/generate/marketing-meta (kmongCopy 재활용 또는 AI 생성)`

---

### Task 6: /write 페이지에 "마케팅 페이지" 링크 + 편집

**Files:**
- Modify: `app/write/page.tsx` (또는 적절한 위치)

`/write` 페이지의 책 편집 UI에 작은 박스 추가 (예: 사이드바 또는 상단 부근):

```tsx
<div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-bold">🔗 마케팅 페이지</h3>
    <a href={`/book/${projectId}`} target="_blank" className="text-xs text-tiger-orange hover:underline">미리보기 →</a>
  </div>
  {project?.marketingMeta?.tagline ? (
    <div className="text-xs text-gray-600">
      <div className="line-clamp-1">📌 {project.marketingMeta.tagline}</div>
      <button onClick={openMarketingEditor} className="text-[10px] text-tiger-orange mt-1 hover:underline">편집</button>
      · <button onClick={copyMarketingUrl} className="text-[10px] text-tiger-orange hover:underline">URL 복사</button>
    </div>
  ) : (
    <button onClick={generateMarketingMeta} className="w-full px-3 py-2 bg-tiger-orange text-white rounded text-xs font-bold hover:bg-orange-600">
      🤖 AI가 마케팅 카피 생성
    </button>
  )}
</div>
```

함수들:
- `generateMarketingMeta` → POST `/api/generate/marketing-meta`
- `openMarketingEditor` → modal 또는 inline form (tagline + description + authorName + authorBio textarea들)
- `copyMarketingUrl` → `navigator.clipboard.writeText(`${origin}/book/${projectId}`)`

작은 modal로 충분 — 풀스케일 form 만들 필요 X.

Commit: `feat(ui): /write 마케팅 페이지 링크 + AI 카피 생성 버튼 + 편집 modal`

---

### Task 7: 빌드 + merge + push

- `npm run build`
- `git checkout main && git merge --ff-only feature/sub3-book-detail && git push origin main`

---

*— end of Sub-project 3 plan*

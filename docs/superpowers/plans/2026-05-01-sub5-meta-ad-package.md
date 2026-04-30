# Sub-project 5 — Meta 광고 패키지

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Meta(Facebook+Instagram) Ads Manager에 바로 붙여 쓸 수 있는 광고 카피 묶음 생성. 헤드라인 3종 + 본문 3종 + CTA 추천 + 타겟팅 제안.

**디자인 doc 참조:** Q5 + 회의11 항목 "메타 광고 패키지".

**Scope clarification (MVP)**
- **이번 sub-project:** 카피 생성 위주 (텍스트만, AI 1번 호출 ~₩30)
- **이미지:** 기존 kmongPackage cover (1:1 정사각 1080x1080) 재사용. 새 인스타 스토리 (9:16) 이미지 생성은 ★★★급 — Phase 2로 미룸.
- **다운로드:** zip 패키징 X. 인라인 preview + copy-to-clipboard 버튼.

**Meta Ads Manager 요구사항 매칭**
- 헤드라인: 최대 40자
- 본문: 최대 125자 (see more 제외)
- CTA 버튼: Meta 미리 정의된 라벨에서 선택 (학습하기 / 자세히 알아보기 / 구독하기 / 신청하기 / 무료 체험 등)
- 타겟팅: age range + interests + ko region

---

## File Structure

| 파일 | 역할 | 수정 |
|---|---|---|
| `lib/storage.ts` | `MetaAdPackage` 타입 + `BookProject.metaAdPackage?` | 수정 |
| `app/api/generate/meta-package/route.ts` | POST — Gemini로 카피 생성 + 저장 | 새로 |
| `app/api/projects/[id]/route.ts` | PATCH에 `metaAdPackage` 허용 (수동 편집 위해) | 수정 |
| `app/write/page.tsx` (또는 setup) | "Meta 광고 패키지" 버튼 + preview + copy 버튼 | 수정 |

---

## Tasks

### Task 1: 타입 정의

**Files:** Modify `lib/storage.ts`

```typescript
export interface MetaAdPackage {
  headlines: string[];          // 3개, 각 ≤40자
  primaryTexts: string[];       // 3개, 각 ≤125자
  ctaButtons: string[];         // Meta 미리 정의된 한글 라벨 추천 (3~5개)
  audienceSuggestion: {
    ageMin: number;             // 18~65
    ageMax: number;
    interests: string[];        // 3~5개 한글 키워드 (예: "재테크", "자기계발")
    locations: string[];        // 기본 ["대한민국"]
  };
  generatedAt: number;
  basedOnProjectVersion?: string;  // 미래 — 책 변경 시 재생성 트리거
}

export interface BookProject {
  // ... 기존
  metaAdPackage?: MetaAdPackage;
}
```

Commit: `feat(types): MetaAdPackage 타입`

---

### Task 2: Meta 카피 생성 API

**Files:** Create `app/api/generate/meta-package/route.ts`

```typescript
// POST /api/generate/meta-package
// body: { projectId }
// 응답: { ok, metaAdPackage, newBalance, costKRW }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callAIServer } from "@/lib/server/ai-server";
import { getModelChain, type Tier } from "@/lib/tiers";
import { getUser, getProject, updateProjectData, deductBalance, logAIUsage, USD_TO_KRW } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const META_CTAS = ["학습하기", "자세히 알아보기", "구독하기", "신청하기", "무료 체험"];

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const userId = session.user.id;

    const rl = rateLimit(`meta:${userId}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "RATE_LIMITED", resetIn: rl.resetIn }, { status: 429 });

    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const projectRow = await getProject(projectId, userId);
    if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const project = projectRow.data;

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    if (user.balance_krw < 50) {
      return NextResponse.json({
        error: "INSUFFICIENT_BALANCE",
        message: "잔액 부족 (~₩40)",
        current: user.balance_krw,
      }, { status: 402 });
    }

    const tier: Tier = (project as any).tier ?? "basic";
    const candidates = getModelChain(tier);
    if (candidates.length === 0) return NextResponse.json({ error: "TIER_UNAVAILABLE" }, { status: 503 });

    // 기존 marketingMeta·kmongCopy 활용 (있으면 더 좋은 결과)
    const tagline = (project as any).marketingMeta?.tagline ?? "";
    const description = (project as any).marketingMeta?.description ?? (project as any).kmongPackage?.copy?.kmongDescription ?? "";

    const promptText = `당신은 Meta(Facebook/Instagram) 광고 카피라이터입니다. 한국어로 광고 카피 패키지를 만듭니다.

[책 정보]
- 주제: ${project.topic}
- 대상 독자: ${project.audience}
- 책 유형: ${project.type}
${tagline ? `- 한 줄 요약: ${tagline}` : ""}
${description ? `- 설명: ${description.slice(0, 500)}` : ""}

[Meta Ads 제약]
- 헤드라인은 정확히 40자 이내
- 본문은 정확히 125자 이내
- CTA는 ["학습하기", "자세히 알아보기", "구독하기", "신청하기", "무료 체험"] 중에서 추천

[작업 — JSON 출력]
{
  "headlines": ["...", "...", "..."],     // 3개, 각 다른 hook (호기심·결과·문제 제시 등)
  "primaryTexts": ["...", "...", "..."],  // 3개, 각 본문 (125자 이하 — 매우 중요)
  "ctaButtons": ["...", "...", "..."],    // Meta 라벨 중 가장 적합한 3개
  "audienceSuggestion": {
    "ageMin": 25,                          // 책 대상에 맞춰 18~65
    "ageMax": 45,
    "interests": ["...", "...", "..."],   // 한글 관심사 키워드 3~5개
    "locations": ["대한민국"]
  }
}

JSON만 출력. 다른 설명 X. 모든 텍스트 한국어.`;

    let result: any = null;
    let actualModel = candidates[0];
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        result = await callAIServer({
          model: candidate,
          system: "당신은 Meta 광고 카피라이터입니다. 한국어 JSON만 출력합니다.",
          user: promptText,
          maxTokens: 2048,
          temperature: 0.8,
          timeoutMs: 25000,
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

    let parsed: any;
    try {
      let txt = result.text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: "INVALID_AI_OUTPUT", raw: result.text.slice(0, 500) }, { status: 502 });
    }

    // sanitize + 길이 강제
    const headlines = (Array.isArray(parsed.headlines) ? parsed.headlines : [])
      .slice(0, 3).map((s: any) => String(s ?? "").slice(0, 40)).filter(Boolean);
    const primaryTexts = (Array.isArray(parsed.primaryTexts) ? parsed.primaryTexts : [])
      .slice(0, 3).map((s: any) => String(s ?? "").slice(0, 125)).filter(Boolean);
    const ctaButtons = (Array.isArray(parsed.ctaButtons) ? parsed.ctaButtons : [])
      .slice(0, 5).map((s: any) => String(s ?? "")).filter((s: string) => META_CTAS.includes(s));
    const aud = parsed.audienceSuggestion ?? {};
    const audienceSuggestion = {
      ageMin: Math.max(18, Math.min(65, Number(aud.ageMin) || 25)),
      ageMax: Math.max(18, Math.min(65, Number(aud.ageMax) || 45)),
      interests: (Array.isArray(aud.interests) ? aud.interests : [])
        .slice(0, 5).map((s: any) => String(s ?? "").slice(0, 30)).filter(Boolean),
      locations: Array.isArray(aud.locations) && aud.locations.length > 0
        ? aud.locations.slice(0, 3).map((s: any) => String(s ?? "").slice(0, 50))
        : ["대한민국"],
    };

    if (headlines.length === 0 || primaryTexts.length === 0) {
      return NextResponse.json({ error: "INSUFFICIENT_OUTPUT", message: "AI가 충분한 카피를 생성하지 못함. 다시 시도하세요." }, { status: 502 });
    }

    const metaAdPackage = {
      headlines,
      primaryTexts,
      ctaButtons: ctaButtons.length > 0 ? ctaButtons : ["자세히 알아보기"],
      audienceSuggestion,
      generatedAt: Date.now(),
    };

    await updateProjectData(projectId, userId, { ...project, metaAdPackage });

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
      const r = await deductBalance({ userId, amountKRW: costKRW, aiUsageId: log.id, reason: `Meta 광고 패키지 (${actualModel})` });
      newBalance = r.newBalance;
    }
    return NextResponse.json({ ok: true, metaAdPackage, newBalance, costKRW });
  } catch (e: any) {
    console.error("[/api/generate/meta-package]", e);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
```

Commit: `feat(api): POST /api/generate/meta-package — Meta 광고 카피 + 타겟팅`

---

### Task 3: PATCH endpoint에 metaAdPackage 허용

**Files:** Modify `app/api/projects/[id]/route.ts`

기존 PATCH가 `themeColor`와 `marketingMeta`를 받음. `metaAdPackage`도 추가:

```typescript
const { themeColor, marketingMeta, metaAdPackage } = body;
// ... 기존 themeColor / marketingMeta 처리 ...

if (metaAdPackage !== undefined) {
  if (typeof metaAdPackage !== "object" || metaAdPackage === null) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "metaAdPackage는 object여야 합니다" }, { status: 400 });
  }
  // sanitize 비슷하게
  const sanitized: any = {};
  if (Array.isArray(metaAdPackage.headlines)) {
    sanitized.headlines = metaAdPackage.headlines.slice(0, 3).map((s: any) => String(s ?? "").slice(0, 40)).filter(Boolean);
  }
  if (Array.isArray(metaAdPackage.primaryTexts)) {
    sanitized.primaryTexts = metaAdPackage.primaryTexts.slice(0, 3).map((s: any) => String(s ?? "").slice(0, 125)).filter(Boolean);
  }
  if (Array.isArray(metaAdPackage.ctaButtons)) {
    sanitized.ctaButtons = metaAdPackage.ctaButtons.slice(0, 5).map((s: any) => String(s ?? "")).filter(Boolean);
  }
  if (typeof metaAdPackage.audienceSuggestion === "object" && metaAdPackage.audienceSuggestion) {
    const aud = metaAdPackage.audienceSuggestion;
    sanitized.audienceSuggestion = {
      ageMin: Math.max(18, Math.min(65, Number(aud.ageMin) || 25)),
      ageMax: Math.max(18, Math.min(65, Number(aud.ageMax) || 45)),
      interests: Array.isArray(aud.interests) ? aud.interests.slice(0, 5).map((s: any) => String(s).slice(0, 30)).filter(Boolean) : [],
      locations: Array.isArray(aud.locations) && aud.locations.length > 0 ? aud.locations.slice(0, 3).map((s: any) => String(s).slice(0, 50)) : ["대한민국"],
    };
  }
  sanitized.generatedAt = Date.now();
  const existing = projectRow.data.metaAdPackage ?? {};
  updates.metaAdPackage = { ...existing, ...sanitized };
}
```

Commit: `feat(api): PATCH metaAdPackage 허용 + sanitize`

---

### Task 4: /write 페이지에 Meta 광고 패키지 섹션

**Files:** Modify `app/write/page.tsx`

기존 marketingMeta 박스 근처(또는 sidebar)에 새 박스 추가:

3가지 state:
- 없음 — "🎯 Meta 광고 패키지 만들기 (~₩40)" 버튼
- 생성 중 — "⏳ AI 분석 중..."
- 있음 — preview cards (헤드라인 3 / 본문 3 / CTA / 타겟팅)
  - 각 카드에 "📋 복사" 버튼 (clipboard.writeText)
  - 하단 "🔄 다시 생성" 버튼

state:
```typescript
const [metaAdPackage, setMetaAdPackage] = useState<any>(null);
const [metaAdBusy, setMetaAdBusy] = useState(false);
const [metaCopiedIdx, setMetaCopiedIdx] = useState<string | null>(null);
```

useEffect 동기화:
```typescript
useEffect(() => {
  if (project?.metaAdPackage) setMetaAdPackage(project.metaAdPackage);
}, [project]);
```

함수:
```typescript
const generateMetaPackage = async () => {
  if (!projectId) return;
  setMetaAdBusy(true); setError(null);
  try {
    const res = await fetch("/api/generate/meta-package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `생성 실패 (${res.status})`);
    setMetaAdPackage(data.metaAdPackage);
    if (typeof data.newBalance === "number") setBalance(data.newBalance);
  } catch (e: any) {
    setError(e.message);
  } finally {
    setMetaAdBusy(false);
  }
};

const copyMetaItem = async (text: string, key: string) => {
  await navigator.clipboard.writeText(text);
  setMetaCopiedIdx(key);
  setTimeout(() => setMetaCopiedIdx(null), 1500);
};
```

UI:
```tsx
<div className="mb-3 p-3 bg-blue-50/50 border border-blue-300/40 rounded-lg">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-bold text-ink-900">🎯 Meta 광고</h3>
    {metaAdPackage && (
      <button onClick={generateMetaPackage} disabled={metaAdBusy} className="text-[10px] text-blue-600 hover:underline">🔄 다시</button>
    )}
  </div>

  {!metaAdPackage && !metaAdBusy && (
    <button
      onClick={generateMetaPackage}
      disabled={metaAdBusy}
      className="w-full px-3 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 text-xs"
    >
      🎯 Meta 광고 카피 생성 (~₩40)
    </button>
  )}

  {metaAdBusy && (
    <div className="text-xs text-blue-700 text-center py-2">⏳ AI 카피 생성 중...</div>
  )}

  {metaAdPackage && (
    <div className="space-y-3 text-xs">
      <div>
        <div className="font-bold text-ink-900 mb-1">📰 헤드라인 (≤40자)</div>
        {metaAdPackage.headlines.map((h: string, i: number) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-white rounded mb-1">
            <span className="flex-1 break-all">{h}</span>
            <button onClick={() => copyMetaItem(h, `h${i}`)} className="text-[10px] text-blue-600 hover:underline shrink-0">
              {metaCopiedIdx === `h${i}` ? "✓ 복사됨" : "복사"}
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="font-bold text-ink-900 mb-1">📝 본문 (≤125자)</div>
        {metaAdPackage.primaryTexts.map((p: string, i: number) => (
          <div key={i} className="flex items-start gap-2 p-2 bg-white rounded mb-1">
            <span className="flex-1 break-all whitespace-pre-wrap">{p}</span>
            <button onClick={() => copyMetaItem(p, `p${i}`)} className="text-[10px] text-blue-600 hover:underline shrink-0">
              {metaCopiedIdx === `p${i}` ? "✓ 복사됨" : "복사"}
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="font-bold text-ink-900 mb-1">🔘 CTA 버튼</div>
        <div className="flex flex-wrap gap-1">
          {metaAdPackage.ctaButtons.map((c: string, i: number) => (
            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{c}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="font-bold text-ink-900 mb-1">🎯 타겟팅 추천</div>
        <div className="p-2 bg-white rounded space-y-1">
          <div>나이: {metaAdPackage.audienceSuggestion?.ageMin}~{metaAdPackage.audienceSuggestion?.ageMax}세</div>
          <div>관심사: {metaAdPackage.audienceSuggestion?.interests?.join(", ")}</div>
          <div>지역: {metaAdPackage.audienceSuggestion?.locations?.join(", ")}</div>
          <button
            onClick={() => copyMetaItem(JSON.stringify(metaAdPackage.audienceSuggestion, null, 2), "aud")}
            className="text-[10px] text-blue-600 hover:underline"
          >
            {metaCopiedIdx === "aud" ? "✓ 복사됨" : "JSON 복사"}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
```

Commit: `feat(ui): /write Meta 광고 패키지 섹션 (헤드라인/본문/CTA/타겟팅 + 복사)`

---

### Task 5: 빌드 + merge + push

- `npm run build`
- `git checkout main && git merge --ff-only feature/sub5-meta-ad && git push origin main`

---

*— end of Sub-project 5 plan*

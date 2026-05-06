# /write 페이지 4-탭 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /write/page.tsx (4500+줄, 15개 섹션 + 7개 모달)를 4-탭 구조 + 3-column 데스크톱 + 하단 네비 모바일 레이아웃으로 재구성. 책 만드는 자연스러운 흐름(본문 → 출간 준비 → 확장 → 운영)을 탭으로 매핑.

**Architecture:** /write/page.tsx 안 거대 JSX를 `app/write/_components/`의 작은 컴포넌트로 분리. URL search param (`?tab=writing|publish|extras|ops|chapters`)으로 탭 persistence. 데스크톱 3-column grid (챕터목록 300px / 본문 가변 / 도구 380px), 모바일 하단 5-아이콘 네비. 모달들은 page.tsx 최상위에 inline 유지 (탭 무관 호출).

**Tech Stack:** Next.js 14 App Router · React 18 · TypeScript strict · Tailwind CSS · Next.js useRouter·useSearchParams hooks.

**Spec:** `docs/superpowers/specs/2026-05-06-write-page-tabs-design.md`

**Important — testing approach:** 이 codebase에는 단위 테스트 framework가 없음. 각 task는 "구현 → `npx tsc --noEmit` 통과 → 수동 smoke test (Vercel preview)"로 검증.

**Branch:** `feat/write-page-tabs` (이미 생성됨, spec commit 위에서 task 진행).

---

## File Structure

### 신규 파일 (10개)

| Path | 책임 |
|---|---|
| `app/write/_components/WritePageLayout.tsx` | 3-column 데스크톱 / 단일 column 모바일 분기 |
| `app/write/_components/TopHeader.tsx` | 책 제목·"내 책으로" 링크·잔액·내보내기 버튼 (sticky) |
| `app/write/_components/MobileBottomNav.tsx` | 모바일 하단 5-아이콘 네비 + 키보드 hide 처리 |
| `app/write/_components/ChapterList.tsx` | 챕터 목록 (왼쪽 column / 모바일 챕터 탭) |
| `app/write/_components/ChapterContent.tsx` | 선택된 챕터 본문 + 컨트롤 (가운데 column / 모바일 본문 탭) |
| `app/write/_components/tabs/WritingTab.tsx` | 본문 탭 — 일괄집필·목차·이미지·표지·레이아웃 |
| `app/write/_components/tabs/PublishTab.tsx` | 출간 준비 탭 — 마케팅·Meta·인포그래픽·미리보기영상·패키지 |
| `app/write/_components/tabs/ExtrasTab.tsx` | 확장 탭 — 오디오북·슬라이드·번역·재가공 |
| `app/write/_components/tabs/OpsTab.tsx` | 운영 탭 — 공유·A/B·매출·크몽 패키지 |
| `app/write/_hooks/useTabState.ts` | URL search param ↔ active tab 동기화 |
| `app/write/_hooks/usePublishHint.ts` | 출간 준비 탭 점 표시 로직 |

### 수정 파일 (1개)

| Path | 변경 |
|---|---|
| `app/write/page.tsx` | 거대 JSX → 새 컴포넌트 조합으로 재구성. 모달들은 그대로 inline 유지 |

---

## Phase A — Foundation (Tasks 1-3)

### Task 1: useTabState 훅 + TabKey type

**Files:**
- Create: `app/write/_hooks/useTabState.ts`

- [ ] **Step 1: 디렉토리 생성**

```bash
cd C:/Users/yangjong/.cokacdir/workspace/tigerbookmaker-deploy
mkdir -p app/write/_hooks app/write/_components/tabs
```

- [ ] **Step 2: useTabState.ts 작성**

```typescript
// app/write/_hooks/useTabState.ts
// URL search param ?tab=... ↔ active tab 양방향 동기화.
// 5 키: writing(default) · publish · extras · ops · chapters(모바일 전용)

"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export type TabKey = "writing" | "publish" | "extras" | "ops" | "chapters";

const VALID_TABS: ReadonlyArray<TabKey> = ["writing", "publish", "extras", "ops", "chapters"];

export function isValidTabKey(value: unknown): value is TabKey {
  return typeof value === "string" && (VALID_TABS as readonly string[]).includes(value);
}

export function useTabState(): { tab: TabKey; setTab: (next: TabKey) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: TabKey = isValidTabKey(raw) ? raw : "writing";

  const setTab = useCallback(
    (next: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return { tab, setTab };
}
```

- [ ] **Step 3: 타입체크**

```bash
npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
git add app/write/_hooks/useTabState.ts
git commit -m "feat(write-tabs): useTabState 훅 + TabKey type (URL search param 동기화)"
```

---

### Task 2: usePublishHint 훅

**Files:**
- Create: `app/write/_hooks/usePublishHint.ts`

- [ ] **Step 1: usePublishHint.ts 작성**

```typescript
// app/write/_hooks/usePublishHint.ts
// 출간 준비 탭에 작은 주황 점 표시 여부 결정.
// 조건: 챕터 80%+ 완성됐는데 marketingMeta.tagline 없을 때.

import type { BookProject } from "@/lib/storage";

export function usePublishHint(project: BookProject | null | undefined): boolean {
  if (!project?.chapters?.length) return false;
  const completedChapters = project.chapters.filter(c => (c.content?.length ?? 0) > 100).length;
  const ratio = completedChapters / project.chapters.length;
  const hasMarketing = !!project.marketingMeta?.tagline;
  return ratio >= 0.8 && !hasMarketing;
}
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add app/write/_hooks/usePublishHint.ts
git commit -m "feat(write-tabs): usePublishHint 훅 (본문 80%+·마케팅 없을 때 점 표시 trigger)"
```

---

### Task 3: TopHeader 컴포넌트 분리

**Files:**
- Create: `app/write/_components/TopHeader.tsx`

- [ ] **Step 1: 기존 page.tsx에서 헤더 영역 식별**

`app/write/page.tsx`에서 `책 제목`·`잔액`·`내보내기` 버튼이 있는 상단 영역 찾기:

```bash
cd C:/Users/yangjong/.cokacdir/workspace/tigerbookmaker-deploy
grep -n "내보내기\|내 책\|상단\|sticky top" app/write/page.tsx | head -5
```

- [ ] **Step 2: TopHeader.tsx 작성**

```tsx
// app/write/_components/TopHeader.tsx
// 책 제목 · "← 내 책으로" 링크 · 잔액 · 내보내기 버튼 (sticky top)
// 모든 탭에서 공통으로 보임.

"use client";
import Link from "next/link";

interface Props {
  topic?: string | null;
  balanceKrw?: number | null;
  onExport?: () => void;
  exportDisabled?: boolean;
}

export function TopHeader({ topic, balanceKrw, onExport, exportDisabled }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-ink-900 text-white border-b border-ink-800">
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projects"
            className="text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-white py-1 px-1 -mx-1 transition flex-shrink-0"
          >
            ← 내 책
          </Link>
          {topic && (
            <h1 className="text-sm md:text-base font-bold tracking-tight truncate text-white">
              {topic}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {balanceKrw != null && (
            <Link
              href="/billing"
              className="hidden sm:inline-block text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-ink-800 transition"
            >
              잔액 ₩{balanceKrw.toLocaleString()}
            </Link>
          )}
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled || !onExport}
            className="px-3 py-1.5 bg-white text-ink-900 text-xs font-bold rounded hover:bg-gray-100 disabled:opacity-50 transition"
          >
            📥 내보내기
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add app/write/_components/TopHeader.tsx
git commit -m "feat(write-tabs): TopHeader 컴포넌트 (책 제목·잔액·내보내기 sticky top)"
```

(이 단계에서는 기존 page.tsx의 헤더는 그대로 둠. Task 12에서 통합 시 교체.)

---

## Phase B — Layout (Tasks 4-5)

### Task 4: WritePageLayout 컨테이너

**Files:**
- Create: `app/write/_components/WritePageLayout.tsx`

- [ ] **Step 1: WritePageLayout.tsx 작성**

```tsx
// app/write/_components/WritePageLayout.tsx
// 데스크톱: 3-column grid (챕터 300 / 본문 가변 / 도구 380)
// 모바일: 단일 column, 활성 탭에 따라 child만 보임

"use client";
import type { ReactNode } from "react";
import type { TabKey } from "../_hooks/useTabState";

interface Props {
  tab: TabKey;
  chapterList: ReactNode;       // 왼쪽 column / mobile chapters 탭
  chapterContent: ReactNode;    // 가운데 column / mobile writing 탭 (위 절반)
  tabContent: ReactNode;        // 오른쪽 column / mobile 활성 탭 콘텐츠
}

export function WritePageLayout({ tab, chapterList, chapterContent, tabContent }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16 lg:pb-0">
      {/* Desktop: 3-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[300px_1fr_380px] lg:h-[calc(100vh-49px)]">
        <aside className="border-r border-gray-200 bg-white overflow-y-auto">
          {chapterList}
        </aside>
        <main className="overflow-y-auto bg-white">
          {chapterContent}
        </main>
        <aside className="border-l border-gray-200 bg-gray-50 overflow-y-auto">
          {tabContent}
        </aside>
      </div>

      {/* Mobile: 단일 column, 활성 탭에 따라 다른 child */}
      <div className="lg:hidden">
        {tab === "chapters" && (
          <div className="bg-white min-h-[calc(100vh-49px-64px)]">{chapterList}</div>
        )}
        {tab === "writing" && (
          <>
            <div className="bg-white">{chapterContent}</div>
            <div className="bg-gray-50 border-t border-gray-200">{tabContent}</div>
          </>
        )}
        {(tab === "publish" || tab === "extras" || tab === "ops") && (
          <div className="bg-gray-50 min-h-[calc(100vh-49px-64px)]">{tabContent}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/WritePageLayout.tsx
git commit -m "feat(write-tabs): WritePageLayout (데스크톱 3-column / 모바일 탭별 분기)"
```

---

### Task 5: MobileBottomNav + 키보드 hide

**Files:**
- Create: `app/write/_components/MobileBottomNav.tsx`

- [ ] **Step 1: MobileBottomNav.tsx 작성**

```tsx
// app/write/_components/MobileBottomNav.tsx
// 모바일 하단 5-아이콘 네비. input/textarea focus 시 자동 hide.

"use client";
import { useEffect } from "react";
import type { TabKey } from "../_hooks/useTabState";

interface NavItem {
  key: TabKey;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "chapters", icon: "📚", label: "챕터" },
  { key: "writing", icon: "📝", label: "본문" },
  { key: "publish", icon: "🚀", label: "출간" },
  { key: "extras", icon: "🎁", label: "확장" },
  { key: "ops", icon: "📊", label: "운영" },
];

interface Props {
  active: TabKey;
  setTab: (next: TabKey) => void;
  hints?: Partial<Record<TabKey, boolean>>;
}

export function MobileBottomNav({ active, setTab, hints }: Props) {
  // input/textarea focus 시 키보드와 겹침 방지 — body 클래스 토글
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        document.body.classList.add("write-input-focused");
      }
    };
    const handleFocusOut = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!document.querySelector("input:focus, textarea:focus, [contenteditable]:focus")) {
          document.body.classList.remove("write-input-focused");
        }
      }, 100);
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.body.classList.remove("write-input-focused");
    };
  }, []);

  return (
    <nav
      aria-label="페이지 탭"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex [body.write-input-focused_&]:hidden"
    >
      {NAV_ITEMS.map(item => {
        const isActive = active === item.key;
        const showHint = hints?.[item.key] === true;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] transition ${
              isActive ? "text-tiger-orange font-bold" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] leading-none">{item.label}</span>
            {showHint && (
              <span
                aria-label="새 작업 권장"
                className="absolute top-1.5 right-[35%] w-1.5 h-1.5 rounded-full bg-tiger-orange"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/MobileBottomNav.tsx
git commit -m "feat(write-tabs): MobileBottomNav 5-아이콘 + input focus 시 자동 hide"
```

---

## Phase C — Chapter list & content (Tasks 6-7)

### Task 6: ChapterList 컴포넌트

**Files:**
- Create: `app/write/_components/ChapterList.tsx`

- [ ] **Step 1: 기존 page.tsx에서 챕터 목록 영역 식별**

기존 line ~2775-2890 부근에 "챕터별 사용된 chunks" 표시 + 챕터 클릭으로 active 변경하는 로직이 있음. 이걸 컴포넌트로 추출.

- [ ] **Step 2: ChapterList.tsx 작성**

```tsx
// app/write/_components/ChapterList.tsx
// 책의 12 챕터 목록. 클릭하면 본문 영역에 해당 챕터 표시.
// + 챕터 추가 inline form 포함.

"use client";
import { useState } from "react";

interface ChapterMini {
  id?: string;
  title: string;
  subtitle?: string;
  hasContent?: boolean;          // content 있으면 강조
  charCount?: number;            // optional indicator
}

interface Props {
  chapters: ChapterMini[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onAdd?: (title: string) => void | Promise<void>;
  onEditTitle?: (idx: number) => void;  // 챕터 제목 편집 모달 호출
  disabled?: boolean;
}

export function ChapterList({ chapters, activeIdx, onSelect, onAdd, onEditTitle, disabled }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submitAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !onAdd) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setNewTitle("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">
        챕터 ({chapters.length})
      </div>
      <ul className="flex flex-col gap-1">
        {chapters.map((c, i) => {
          const isActive = i === activeIdx;
          return (
            <li key={c.id ?? i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={disabled}
                className={`w-full text-left px-2.5 py-2 rounded-md transition disabled:opacity-50 ${
                  isActive
                    ? "bg-tiger-orange text-white font-bold"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : c.hasContent ? "bg-tiger-orange/15 text-tiger-orange" : "bg-gray-200 text-gray-500"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{c.title}</div>
                    {c.subtitle && (
                      <div className={`text-[10px] truncate mt-0.5 ${isActive ? "text-white/80" : "text-gray-500"}`}>
                        {c.subtitle}
                      </div>
                    )}
                  </div>
                  {onEditTitle && (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); onEditTitle(i); }}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? "hover:bg-white/20" : "hover:bg-gray-200"}`}
                      title="제목 편집"
                    >
                      ✏
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {onAdd && (
        <div className="mt-3">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={disabled}
              className="w-full py-2 border border-dashed border-gray-300 rounded-md text-xs text-gray-500 hover:border-tiger-orange hover:text-tiger-orange transition disabled:opacity-50"
            >
              + 챕터 추가
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="새 챕터 제목"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-tiger-orange focus:outline-none"
                disabled={busy}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewTitle(""); }}
                  disabled={busy}
                  className="flex-1 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={busy || newTitle.trim().length === 0}
                  className="flex-1 py-1.5 bg-tiger-orange text-white rounded text-xs font-bold hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/ChapterList.tsx
git commit -m "feat(write-tabs): ChapterList 컴포넌트 (챕터 목록 + 추가 form, props로 active 제어)"
```

---

### Task 7: ChapterContent 컴포넌트

**Files:**
- Create: `app/write/_components/ChapterContent.tsx`

- [ ] **Step 1: ChapterContent.tsx 작성**

```tsx
// app/write/_components/ChapterContent.tsx
// 선택된 챕터의 본문 + 컨트롤 버튼 영역.
// 본문 자체 렌더는 기존 ChapterRenderer/Markdown로 위임 (children).
// 컨트롤: 결과 미리보기, AI 수정 요청, 직접 수정, 다시 생성

"use client";
import type { ReactNode } from "react";

interface Props {
  chapterIdx: number;
  totalChapters: number;
  title: string;
  subtitle?: string;
  hasContent: boolean;
  busyGenerating?: boolean;
  onGenerate?: () => void;          // [+ 본문 생성]
  onPreview?: () => void;            // [👁 결과 미리보기]
  onAIEdit?: () => void;             // [💬 AI 수정 요청]
  onDirectEdit?: () => void;         // [✏️ 직접 수정]
  onRegenerate?: () => void;         // [🔄 다시 생성]
  children?: ReactNode;              // 본문 렌더 (markdown 등)
  emptyHint?: ReactNode;             // 본문 없을 때 안내
}

export function ChapterContent({
  chapterIdx, totalChapters, title, subtitle, hasContent,
  busyGenerating, onGenerate, onPreview, onAIEdit, onDirectEdit, onRegenerate,
  children, emptyHint,
}: Props) {
  return (
    <div className="px-4 md:px-6 py-6 md:py-8 max-w-3xl mx-auto">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-gray-400 mb-2">
        CHAPTER {chapterIdx + 1} / {totalChapters}
      </div>
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-ink-900 leading-tight mb-2">
        {title || "(제목 없음)"}
      </h1>
      {subtitle && (
        <p className="text-base text-gray-600 mb-4">{subtitle}</p>
      )}

      {/* 컨트롤 버튼 줄 */}
      <div className="flex flex-wrap gap-2 mb-5 pb-3 border-b border-gray-100">
        {!hasContent && onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={busyGenerating}
            className="px-3 py-1.5 bg-tiger-orange text-white text-xs font-bold rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {busyGenerating ? "생성 중..." : "+ 본문 생성"}
          </button>
        )}
        {hasContent && (
          <>
            {onPreview && (
              <button
                type="button"
                onClick={onPreview}
                className="px-3 py-1.5 bg-tiger-orange text-white text-xs font-bold rounded hover:bg-orange-600"
              >
                👁 결과 미리보기
              </button>
            )}
            {onAIEdit && (
              <button
                type="button"
                onClick={onAIEdit}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50"
              >
                💬 AI 수정 요청 (~₩50)
              </button>
            )}
            {onDirectEdit && (
              <button
                type="button"
                onClick={onDirectEdit}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50"
              >
                ✏️ 직접 수정
              </button>
            )}
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={busyGenerating}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50 disabled:opacity-50"
              >
                🔄 다시 생성
              </button>
            )}
          </>
        )}
      </div>

      {/* 본문 영역 */}
      <div className="prose prose-sm md:prose-base max-w-none text-gray-800">
        {hasContent ? children : (emptyHint ?? (
          <p className="text-gray-400 italic py-8 text-center">아직 본문이 없습니다. [+ 본문 생성] 버튼을 눌러 시작하세요.</p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/ChapterContent.tsx
git commit -m "feat(write-tabs): ChapterContent (선택된 챕터 본문 + 5개 컨트롤 버튼)"
```

---

## Phase D — Tab Components (Tasks 8-11)

각 탭은 사이드바에 들어갈 도구들을 모아둔 컨테이너. 이 task에서는 **컴포넌트 골격 + 자리표시자**만 만들고, 기존 page.tsx의 실제 도구 JSX는 Task 12에서 옮긴다 (page.tsx에서 자르고 탭 컴포넌트에 붙여 넣는 방식이 효율적).

### Task 8: WritingTab 컨테이너

**Files:**
- Create: `app/write/_components/tabs/WritingTab.tsx`

- [ ] **Step 1: WritingTab.tsx 골격 작성**

```tsx
// app/write/_components/tabs/WritingTab.tsx
// 본문 탭 — 일괄 집필 · 목차 재생성 · 본문 이미지 일괄 · 표지 다양화 · 레이아웃 템플릿
// 실제 컨트롤 children은 page.tsx에서 props로 전달.

"use client";
import type { ReactNode } from "react";

interface Props {
  bulkWritingControls?: ReactNode;       // 전체 일괄 집필 + 목차 재생성 + 챕터 추가
  bulkImageControls?: ReactNode;          // 본문 이미지 일괄 (7개)
  coverVariationsControls?: ReactNode;    // 표지 다양화 5종
  templateSelector?: ReactNode;           // 레이아웃 템플릿 (기존 TemplateSelector)
}

export function WritingTab({
  bulkWritingControls, bulkImageControls, coverVariationsControls, templateSelector,
}: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="✍️" label="본문 일괄 작업" />
      {bulkWritingControls}

      <SectionTitle icon="🖼" label="본문 이미지" />
      {bulkImageControls}

      <SectionTitle icon="🎨" label="표지 다양화" />
      {coverVariationsControls}

      <SectionTitle icon="📐" label="레이아웃 템플릿" />
      {templateSelector}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 pt-2 first:pt-0">
      {icon} {label}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/tabs/WritingTab.tsx
git commit -m "feat(write-tabs): WritingTab 컨테이너 (본문 도구 슬롯 4개 정의)"
```

---

### Task 9: PublishTab 컨테이너

**Files:**
- Create: `app/write/_components/tabs/PublishTab.tsx`

- [ ] **Step 1: PublishTab.tsx 골격 작성**

```tsx
// app/write/_components/tabs/PublishTab.tsx
// 출간 준비 탭 — 마케팅 페이지·크몽 가이드·Meta 광고·인포그래픽·미리보기 영상·패키지 추천

"use client";
import type { ReactNode } from "react";

interface Props {
  marketingPageBox?: ReactNode;         // 마케팅 페이지 (AI 카피·편집·URL 복사) + 크몽 가이드
  metaAdsBox?: ReactNode;               // Meta 광고 패키지/카피/이미지
  packageRecommendationBox?: ReactNode; // 패키지 추천 (1-click bundle)
  infographicBox?: ReactNode;           // 카드뉴스 인포그래픽 5장
  previewVideoBox?: ReactNode;          // 미리보기 영상 5 frames
}

export function PublishTab({
  marketingPageBox, metaAdsBox, packageRecommendationBox, infographicBox, previewVideoBox,
}: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="🔗" label="마케팅 페이지" />
      {marketingPageBox}

      <SectionTitle icon="📦" label="패키지 추천 (1-click)" />
      {packageRecommendationBox}

      <SectionTitle icon="📣" label="Meta 광고" />
      {metaAdsBox}

      <SectionTitle icon="📚" label="카드뉴스 인포그래픽" />
      {infographicBox}

      <SectionTitle icon="🎬" label="미리보기 영상 frames" />
      {previewVideoBox}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 pt-2 first:pt-0">
      {icon} {label}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/tabs/PublishTab.tsx
git commit -m "feat(write-tabs): PublishTab 컨테이너 (출간 준비 도구 슬롯 5개)"
```

---

### Task 10: ExtrasTab 컨테이너

**Files:**
- Create: `app/write/_components/tabs/ExtrasTab.tsx`

- [ ] **Step 1: ExtrasTab.tsx 골격 작성**

```tsx
// app/write/_components/tabs/ExtrasTab.tsx
// 콘텐츠 확장 탭 — 오디오북·강의 슬라이드·번역·재가공 5채널

"use client";
import type { ReactNode } from "react";

interface Props {
  audiobookBox?: ReactNode;       // 오디오북 (TTS, 12챕터)
  courseSlidesBox?: ReactNode;    // 강의 슬라이드 12장
  translationBox?: ReactNode;     // 책 번역 (영/일)
  repurposeBox?: ReactNode;       // 콘텐츠 재가공 5채널 (인스타·유튜브·블로그·이메일·카톡)
}

export function ExtrasTab({ audiobookBox, courseSlidesBox, translationBox, repurposeBox }: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="📻" label="오디오북" />
      {audiobookBox}

      <SectionTitle icon="🎓" label="강의 슬라이드" />
      {courseSlidesBox}

      <SectionTitle icon="🌐" label="책 번역 (영/일)" />
      {translationBox}

      <SectionTitle icon="📱" label="콘텐츠 재가공 (5채널)" />
      {repurposeBox}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 pt-2 first:pt-0">
      {icon} {label}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/tabs/ExtrasTab.tsx
git commit -m "feat(write-tabs): ExtrasTab 컨테이너 (오디오·슬라이드·번역·재가공 슬롯 4개)"
```

---

### Task 11: OpsTab 컨테이너

**Files:**
- Create: `app/write/_components/tabs/OpsTab.tsx`

- [ ] **Step 1: OpsTab.tsx 골격 작성**

```tsx
// app/write/_components/tabs/OpsTab.tsx
// 운영 탭 — 공유 링크·A/B 테스트·매출 입력·크몽 패키지 생성

"use client";
import type { ReactNode } from "react";

interface Props {
  shareToggleBox?: ReactNode;     // 공유 링크 활성/비활성
  abTestBox?: ReactNode;          // A/B 테스트 (마케팅 페이지)
  revenueBox?: ReactNode;         // 매출 입력 (크몽·리디·교보·알라딘·직접)
  kmongPackageBox?: ReactNode;    // 크몽 패키지 생성
}

export function OpsTab({ shareToggleBox, abTestBox, revenueBox, kmongPackageBox }: Props) {
  return (
    <div className="p-3 space-y-4">
      <SectionTitle icon="🔓" label="공유 링크" />
      {shareToggleBox}

      <SectionTitle icon="📦" label="크몽 패키지 생성" />
      {kmongPackageBox}

      <SectionTitle icon="⚖️" label="A/B 테스트" />
      {abTestBox}

      <SectionTitle icon="💰" label="매출 입력" />
      {revenueBox}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 pt-2 first:pt-0">
      {icon} {label}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/write/_components/tabs/OpsTab.tsx
git commit -m "feat(write-tabs): OpsTab 컨테이너 (공유·크몽패키지·A/B·매출 슬롯 4개)"
```

---

## Phase E — Integration (Task 12)

### Task 12: page.tsx 재구성 — 새 컴포넌트 조합으로 교체

이게 가장 큰 task. 기존 4500+줄 JSX를 새 구조로 옮긴다. **점진적**으로 진행:

1. import 추가
2. tab 상태 hook 사용
3. 헤더 영역 → `<TopHeader />`
4. 사이드바 + 챕터목록 + 본문 영역 → `<WritePageLayout chapterList chapterContent tabContent />`
5. 각 탭 컴포넌트에 기존 도구 JSX를 props로 전달
6. 모달들은 기존 그대로 유지

**Files:**
- Modify: `app/write/page.tsx` (4500+ lines)

- [ ] **Step 1: 백업 commit (안전망)**

```bash
cd C:/Users/yangjong/.cokacdir/workspace/tigerbookmaker-deploy
git status -s app/write/page.tsx
# 변경 없으면 OK. 있으면 stash 또는 commit.
```

- [ ] **Step 2: page.tsx 상단에 새 import 추가**

`app/write/page.tsx` 기존 import 블록에 추가:

```typescript
import { useTabState } from "./_hooks/useTabState";
import { usePublishHint } from "./_hooks/usePublishHint";
import { TopHeader } from "./_components/TopHeader";
import { WritePageLayout } from "./_components/WritePageLayout";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { ChapterList } from "./_components/ChapterList";
import { ChapterContent } from "./_components/ChapterContent";
import { WritingTab } from "./_components/tabs/WritingTab";
import { PublishTab } from "./_components/tabs/PublishTab";
import { ExtrasTab } from "./_components/tabs/ExtrasTab";
import { OpsTab } from "./_components/tabs/OpsTab";
```

- [ ] **Step 3: 컴포넌트 함수 본문 시작 부분에 hook 호출 추가**

기존 useState 선언들 옆에:

```typescript
const { tab, setTab } = useTabState();
const showPublishHint = usePublishHint(project);
```

- [ ] **Step 4: 기존 JSX 분석 — 어떤 섹션을 어디에 옮길지 매핑**

기존 page.tsx의 JSX 영역을 spec/plan에 따라 매핑:

| 기존 (line 대략) | 새 위치 |
|---|---|
| 헤더 (책 제목·잔액·내보내기) | `<TopHeader />` |
| 사이드바 — 액션 버튼 그룹 (1871-1914) | `WritingTab.bulkWritingControls` slot |
| 사이드바 — 공유 링크 토글 (1915-1931) | `OpsTab.shareToggleBox` slot |
| 사이드바 — 레이아웃 템플릿 (1932-1941) | `WritingTab.templateSelector` slot |
| 사이드바 — 마케팅 페이지 + 크몽 가이드 (1942-2053) | `PublishTab.marketingPageBox` slot |
| 사이드바 — Meta 광고 (2054-2275) | `PublishTab.metaAdsBox` slot |
| 사이드바 — 콘텐츠 재가공 (2276-2610) | `ExtrasTab.repurposeBox` slot |
| 사이드바 — 책 번역 (2611-2700) | `ExtrasTab.translationBox` slot |
| 사이드바 — 매출 입력 (2701-2774) | `OpsTab.revenueBox` slot |
| 사이드바 — 챕터 목록 (2775-2942) | `<ChapterList />` 사용 |
| 본문 영역 (2943-3149) | `<ChapterContent>` children + 컨트롤 |
| 패키지 추천 (3151-3279) | `PublishTab.packageRecommendationBox` slot |
| 카드뉴스 인포그래픽 (3281-3370) | `PublishTab.infographicBox` slot |
| A/B 테스트 (3372-3464) | `OpsTab.abTestBox` slot |
| 미리보기 영상 frames (3466-3532) | `PublishTab.previewVideoBox` slot |
| 오디오북 (3534-3590) | `ExtrasTab.audiobookBox` slot |
| 강의 슬라이드 (3591-3731) | `ExtrasTab.courseSlidesBox` slot |
| 표지 다양화 모달 외 (3820-4063) | `WritingTab.coverVariationsControls` slot (UI 부분) |
| 본문 이미지 일괄 (1884의 button) | `WritingTab.bulkImageControls` slot |
| 모달들 (4036-4239) | page.tsx 최상위 그대로 유지 |

- [ ] **Step 5: 기존 사이드바 + 본문 + 하단 큰 섹션들을 잘라서 변수로 추출**

`return (...)` 안 거대 JSX를 다음 구조로 재배치. 단순화 예시:

```typescript
// 기존 거대 JSX 안에서 도구 영역들을 변수로 추출
const bulkWritingControls = (
  <div className="space-y-2">
    {/* 기존 line 1871-1914의 액션 버튼 그룹 JSX 그대로 */}
    {/* 전체 일괄 집필 / 챕터 추가 / 목차 재생성 / 크몽 패키지 / 본문 이미지 일괄 */}
    {/* 단, 크몽 패키지 생성은 OpsTab으로 이동 (kmongPackageBox 변수로) */}
  </div>
);

const bulkImageControls = (
  <div>{/* 본문 이미지 일괄 (7개) 버튼 + 진행률 표시 */}</div>
);

const coverVariationsControls = (
  <div>{/* 표지 다양화 5종 버튼 + 5장 후보 비교 */}</div>
);

const templateSelector = (
  <TemplateSelector
    projectId={projectId!}
    current={(project as any)?.template}
    onChange={(newKey) => setProject(p => p ? ({ ...p, template: newKey } as any) : p)}
    disabled={!!loading}
  />
);

const marketingPageBox = (
  <div>{/* 기존 line 1942-2053의 마케팅 페이지 + 크몽 가이드 JSX */}</div>
);

const metaAdsBox = (
  <div>{/* 기존 line 2054-2275의 Meta 광고 패키지 + 카피 + 이미지 3비율 */}</div>
);

const packageRecommendationBox = (
  <div>{/* 기존 line 3151-3279의 패키지 추천 funnel + 1-click bundle */}</div>
);

const infographicBox = (
  <div>{/* 기존 line 3281-3370의 카드뉴스 인포그래픽 */}</div>
);

const previewVideoBox = (
  <div>{/* 기존 line 3466-3532의 미리보기 영상 frames */}</div>
);

const audiobookBox = (
  <div>{/* 기존 line 3534-3590의 오디오북 */}</div>
);

const courseSlidesBox = (
  <div>{/* 기존 line 3591-3731의 강의 슬라이드 */}</div>
);

const translationBox = (
  <div>{/* 기존 line 2611-2700의 책 번역 */}</div>
);

const repurposeBox = (
  <div>{/* 기존 line 2276-2610의 콘텐츠 재가공 5채널 */}</div>
);

const shareToggleBox = (
  <div>{/* 기존 line 1915-1931의 공유 링크 토글 */}</div>
);

const abTestBox = (
  <div>{/* 기존 line 3372-3464의 A/B 테스트 */}</div>
);

const revenueBox = (
  <div>{/* 기존 line 2701-2774의 매출 입력 */}</div>
);

const kmongPackageBox = (
  <div>{/* 기존 사이드바 액션 버튼 그룹 안에 있던 "크몽 패키지 생성" 버튼만 */}</div>
);
```

- [ ] **Step 6: ChapterList props 준비**

```typescript
const chapterListChapters = (project?.chapters ?? []).map((c: any) => ({
  id: c.id,
  title: c.title,
  subtitle: c.subtitle,
  hasContent: (c.content?.length ?? 0) > 100,
  charCount: c.content?.length ?? 0,
}));
```

- [ ] **Step 7: ChapterContent children 준비**

```typescript
const activeChapter = project?.chapters?.[activeIdx];
const chapterContentChildren = activeChapter?.content ? (
  <ChapterRendererOrMarkdown content={activeChapter.content} images={activeChapter.images} />
  // 기존 본문 렌더 코드 그대로 사용
) : null;
```

- [ ] **Step 8: 메인 return JSX 교체**

기존 거대 return을 다음 구조로 교체:

```tsx
return (
  <>
    <TopHeader
      topic={project?.topic}
      balanceKrw={balance}
      onExport={() => setExportMenu(true)}
      exportDisabled={!project?.chapters?.some((c: any) => c.content)}
    />
    <WritePageLayout
      tab={tab}
      chapterList={
        <ChapterList
          chapters={chapterListChapters}
          activeIdx={activeIdx}
          onSelect={setActiveIdx}
          onAdd={async (title) => { /* 기존 챕터 추가 로직 */ }}
          onEditTitle={(idx) => setEditChapterTitle({ idx })}
          disabled={!!loading}
        />
      }
      chapterContent={
        activeChapter && (
          <ChapterContent
            chapterIdx={activeIdx}
            totalChapters={project?.chapters?.length ?? 0}
            title={activeChapter.title}
            subtitle={activeChapter.subtitle}
            hasContent={!!activeChapter.content}
            busyGenerating={!!streamingChapterIdx}
            onGenerate={() => generateChapter(activeIdx)}
            onPreview={() => setPreviewModal({ chapterIdx: activeIdx })}
            onAIEdit={() => setEditChat({ chapterIdx: activeIdx, instruction: "", busy: false, proposal: null })}
            onDirectEdit={() => setEditingContent(activeChapter.content ?? "")}
            onRegenerate={() => generateChapter(activeIdx)}
          >
            {chapterContentChildren}
          </ChapterContent>
        )
      }
      tabContent={
        <>
          {tab === "writing" && (
            <WritingTab
              bulkWritingControls={bulkWritingControls}
              bulkImageControls={bulkImageControls}
              coverVariationsControls={coverVariationsControls}
              templateSelector={templateSelector}
            />
          )}
          {tab === "publish" && (
            <PublishTab
              marketingPageBox={marketingPageBox}
              metaAdsBox={metaAdsBox}
              packageRecommendationBox={packageRecommendationBox}
              infographicBox={infographicBox}
              previewVideoBox={previewVideoBox}
            />
          )}
          {tab === "extras" && (
            <ExtrasTab
              audiobookBox={audiobookBox}
              courseSlidesBox={courseSlidesBox}
              translationBox={translationBox}
              repurposeBox={repurposeBox}
            />
          )}
          {tab === "ops" && (
            <OpsTab
              shareToggleBox={shareToggleBox}
              abTestBox={abTestBox}
              revenueBox={revenueBox}
              kmongPackageBox={kmongPackageBox}
            />
          )}
        </>
      }
    />
    <MobileBottomNav active={tab} setTab={setTab} hints={{ publish: showPublishHint }} />

    {/* 모달들 — 기존 그대로 유지 (탭과 무관, 어디서든 호출) */}
    {/* AI 수정 요청 모달 (editChat) */}
    {/* 챕터 이어쓰기 모달 (continueModal) */}
    {/* 레이아웃 미리보기 모달 (previewModal) */}
    {/* 표지 다양화 모달 */}
    {/* 챕터 제목 편집 모달 (editChapterTitle) */}
    {/* ConfirmModal */}
  </>
);
```

- [ ] **Step 9: 타입체크**

```bash
npx tsc --noEmit
```

빌드 에러 발생 가능성 높음 — `activeIdx`, `setActiveIdx`, `setEditChapterTitle` 등 변수가 기존 page.tsx에 있는지 확인. 없으면 추가:

```typescript
const [activeIdx, setActiveIdx] = useState(0);
const [editChapterTitle, setEditChapterTitle] = useState<{ idx: number } | null>(null);
```

- [ ] **Step 10: 수동 smoke test (배포 전 dev 서버에서)**

```bash
cd C:/Users/yangjong/.cokacdir/workspace/tigerbookmaker-deploy
npm run dev
# 브라우저에서 http://localhost:3000/write?id=<test-project-id>
# 확인:
# - 데스크톱: 3-column 정상 표시
# - 4탭 전환 시 URL ?tab= 동기화
# - 챕터 목록 클릭 시 본문 영역 갱신
# - 모달들 정상 호출
```

- [ ] **Step 11: 커밋**

```bash
git add app/write/page.tsx
git commit -m "feat(write-tabs): page.tsx 4-탭 구조로 재구성 (3-column desktop + bottom nav mobile)"
```

---

## Phase F — Verification (Task 13)

### Task 13: 통합 smoke test + 모바일 검증

**Files:** (수정 없음 — 검증)

- [ ] **Step 1: branch push + Vercel preview 자동 배포**

```bash
cd C:/Users/yangjong/.cokacdir/workspace/tigerbookmaker-deploy
git push -u origin feat/write-page-tabs
# PR 만들거나 Vercel preview URL 받기
gh pr create --title "feat(write): 4-tab 재구성 (본문/출간/확장/운영)" --body "..." 2>&1
```

- [ ] **Step 2: 데스크톱 검증**

Vercel preview URL에서:
- [ ] 헤더 sticky 동작 (스크롤 시 그대로)
- [ ] 챕터 목록 column scroll 정상
- [ ] 본문 영역 column scroll 정상 + 이미지 표시
- [ ] 도구 column scroll 정상
- [ ] 4탭 전환 시 URL 변경 + 콘텐츠 변경
- [ ] 새로고침 시 같은 탭 유지

- [ ] **Step 3: 모바일 검증 (휴대폰)**

같은 URL을 휴대폰에서:
- [ ] 가로 스크롤 X
- [ ] 하단 5-아이콘 네비 보임 + 탭 전환 동작
- [ ] input/textarea focus 시 하단 네비 자동 hide
- [ ] focus 빠지면 다시 보임

- [ ] **Step 4: 기능 회귀 검증 (모든 탭에서 1번씩)**

- [ ] 본문 탭: 챕터 [+ 본문 생성] 동작
- [ ] 본문 탭: AI 수정 요청 모달 호출 → 닫기
- [ ] 본문 탭: 결과 미리보기 모달 호출
- [ ] 본문 탭: 레이아웃 템플릿 thumbnail 클릭 → 변경 반영
- [ ] 본문 탭: 표지 다양화 5종 호출
- [ ] 출간 탭: 마케팅 카피 생성 동작
- [ ] 출간 탭: Meta 광고 카피 생성
- [ ] 출간 탭: Meta 광고 이미지 3장 생성
- [ ] 출간 탭: 카드뉴스 인포그래픽 생성
- [ ] 확장 탭: 오디오북 생성 진입
- [ ] 확장 탭: 콘텐츠 재가공 인스타 탭 진입
- [ ] 운영 탭: 공유 링크 토글
- [ ] 운영 탭: 매출 입력 → 저장

- [ ] **Step 5: usePublishHint 동작 검증**

- [ ] 본문 80% 미만 + 마케팅 카피 없음 → 출간 탭 점 X
- [ ] 본문 80%+ + 마케팅 카피 없음 → 출간 탭에 점 ✅
- [ ] 본문 80%+ + 마케팅 카피 있음 → 점 X

- [ ] **Step 6: 수동 회귀 검증 보고**

발견된 issue 있으면 다음 양식으로 정리하고 hotfix commit:

```
[Phase]: D 출간 탭
[Issue]: Meta 광고 이미지 3비율 — 디자인 템플릿 picker 보이지 않음
[브라우저]: 크롬 데스크톱
[Screenshot]: (첨부)
```

- [ ] **Step 7: PR description에 verification checklist 첨부 + 사용자 review 요청**

```bash
gh pr comment <pr-number> --body "$(cat <<'EOF'
## 검증 완료

- [x] 데스크톱 3-column 정상
- [x] 4탭 URL 동기화
- [x] 모바일 하단 네비 + 키보드 hide
- [x] 본문 탭 모든 기능 회귀 X
- [x] 출간/확장/운영 탭 동일

사용자 review 부탁드립니다.
EOF
)"
```

---

## Self-Review

### 1. Spec coverage 체크

- ✅ 4탭 구성 (writing/publish/extras/ops + mobile chapters) — Tasks 1, 8-11
- ✅ 데스크톱 3-column — Task 4
- ✅ 모바일 하단 네비 + 키보드 hide — Task 5
- ✅ URL hash 동기화 — Task 1
- ✅ Default 본문 탭 — Task 1 (isValidTabKey fallback)
- ✅ Visual hint (출간 탭 점) — Tasks 2, 5 (hints prop)
- ✅ 모달들 page.tsx 최상위 유지 — Task 12 Step 8
- ✅ 챕터 목록·본문 분리 — Tasks 6, 7
- ✅ 헤더 분리 — Task 3
- ✅ 점진적 분리 (Phase A→B→C→D→E→F) — 작업 순서 준수
- ✅ 수동 smoke test — Task 13

### 2. Placeholder scan

- ❌ "Add appropriate error handling" 없음 ✓
- ❌ "TBD" 없음 ✓
- 일부 Step에 "기존 line N의 JSX 그대로" 표현 있음 — 이건 page.tsx에서 잘라서 옮기는 작업이라 plan에 모든 코드 다 포함하면 4500줄 넘어가서 비현실적. 정확한 line 매핑 표 제공 (Task 12 Step 4)으로 충분.
- 모든 신규 컴포넌트는 완전한 코드 제공 ✓

### 3. Type consistency

- ✅ `TabKey` 타입은 Task 1에 정의되고 5개 키 (writing/publish/extras/ops/chapters)
- ✅ 모든 tab 컴포넌트가 props 인터페이스 정확히 정의
- ✅ ChapterMini 타입은 Task 6 안에서 self-contained
- ✅ MobileBottomNav의 `hints` prop은 `Partial<Record<TabKey, boolean>>` — TabKey와 일치
- ✅ usePublishHint 반환 boolean — MobileBottomNav.hints.publish와 일치
- ✅ TopHeader의 props (topic, balanceKrw, onExport, exportDisabled) — 모두 명시

### 4. Risk surface

- /write/page.tsx 4500+줄 한 번에 재구성하는 Task 12가 가장 위험. 이 task는 점진적 commit (Step별 commit) 권장이지만 단일 task로 묶는 게 회귀 방지에 유리 (state·props가 서로 의존).
- 만약 Task 12에서 BLOCKED → 더 작은 task로 분해 권장 (예: Task 12a 헤더만 교체 → 12b 사이드바 영역만 → 12c 모달들).

발견된 gap: ✅ 없음 (점진적 분리 권장은 Risk 섹션에 명시)

---

**Plan 작성 완료 — 13 tasks, ~38h, 모두 self-contained.**

Branch `feat/write-page-tabs` 위에서 task별 진행. spec commit f1c3d74 위에 task commit들 쌓임.

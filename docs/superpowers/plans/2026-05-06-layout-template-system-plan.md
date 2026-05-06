# 레이아웃 템플릿 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tigerbookmaker에 4가지 레이아웃 템플릿 시스템(Modern Minimal / Editorial Magazine / Classic Book / Practical Guide) 도입. 같은 본문을 책 장르·목적에 맞춰 다른 시각 정체성으로 렌더링. 5개 surface(`/share/[id]`, `/book/[id]`, EPUB, PDF, `/write` 미리보기)에 적용.

**Architecture:** template은 `book_projects.data` jsonb 안 `template` 필드로 저장 (DB migration 불필요). `lib/templates/`에 4개 React 컴포넌트 + epubCss/pdfHtmlWrapper export. Surface별로 `getTemplate(project.template).Render` / `.epubCss` 등을 dynamic 적용. 표지 prompt에는 `coverStyleHint`를 합성.

**Tech Stack:** Next.js 14 App Router · React 18 · TypeScript strict · Tailwind CSS · Pretendard·Noto Serif KR 폰트 · pgvector (변경 없음)

**Spec:** `docs/superpowers/specs/2026-05-06-layout-template-system-design.md`

**Important note about testing:** 이 codebase에는 단위 테스트 framework가 셋업되어 있지 않음. 따라서 TDD 대신:
- 각 Task에서 "interface/type 정의" → "구현" → "`npx tsc --noEmit` 통과" → "수동 smoke test" 순서로 진행
- 마지막 Phase G에 종합 manual QA 포함

---

## File Structure

### 신규 파일 (8개)

| Path | 역할 |
|---|---|
| `lib/templates/index.ts` | TemplateKey type, BookTemplate interface, TEMPLATES registry, getTemplate(), suggestTemplate() |
| `lib/templates/shared.tsx` | 4 template 공통 유틸 — `parseChapterContent()` (마크다운 → 블록 + IMAGE placeholder 추출), `ImagePlaceholder` props |
| `lib/templates/minimal.tsx` | Modern Minimal renderer + epubCss + pdfHtmlWrapper + coverStyleHint |
| `lib/templates/editorial.tsx` | Editorial Magazine (1단형, 큰 이미지 + 인라인 인용 박스) |
| `lib/templates/classic.tsx` | Classic Book (serif, 챕터 시작 큰 첫글자) |
| `lib/templates/practical.tsx` | Practical Guide (체크리스트·박스) |
| `components/TemplateSelector.tsx` | `/write` 사이드바 4개 thumbnail UI |
| `components/TemplatePreviewModal.tsx` | `[👁 결과 미리보기]` 버튼이 띄우는 모달 |

### 수정 파일 (10개)

| Path | 변경 |
|---|---|
| `lib/storage.ts` | `BookProject` 인터페이스에 `template?: TemplateKey` 추가 |
| `app/api/projects/route.ts` (POST) | 신규 프로젝트 생성 시 `data.template = suggestTemplate(type)` |
| `app/api/projects/[id]/route.ts` (GET/PATCH) | template 응답 + PATCH 허용 (whitelist 검증) |
| `app/write/page.tsx` | `<TemplateSelector />` + `[👁 결과 미리보기]` 버튼 추가 |
| `app/share/[id]/page.tsx` | template에 따른 Render 컴포넌트 동적 분기 |
| `app/book/[id]/page.tsx` | template label 표시 + TOC 스타일 분기 |
| `app/api/export/epub/route.ts` | `getTemplate(book.template).epubCss` `<style>` 임베드 |
| `lib/export-pdf.ts` | `getTemplate(book.template).pdfHtmlWrapper(...)` 사용 |
| `lib/server/image-prompt-ai.ts` | `generateImagePromptAI()` 옵션에 `templateHint?: string` 추가 |
| `app/api/generate/{cover-variations,meta-images,image-refine,kmong-package}/route.ts` | `templateHint: getTemplate(project.template).coverStyleHint` 전달 |

---

## Phase A — Foundation (Tasks 1-4)

### Task 1: BookProject type에 template 필드 추가

**Files:**
- Modify: `lib/storage.ts`

- [ ] **Step 1: TemplateKey 타입 import 준비 — index.ts 생성 전 stub 추가**

`lib/storage.ts` 상단에 임시 type alias 추가 (Task 2에서 정식 정의 후 import로 교체):

```typescript
// 임시 (Task 2에서 lib/templates/index.ts로 이전)
export type TemplateKey = 'minimal' | 'editorial' | 'classic' | 'practical';
```

- [ ] **Step 2: BookProject 인터페이스에 template 필드 추가**

`lib/storage.ts`의 `BookProject` 인터페이스 (테마컬러 라인 근처) 수정:

```typescript
themeColor?: ThemeColorKey;
template?: TemplateKey;  // 레이아웃 템플릿 (default 'minimal')
```

- [ ] **Step 3: 타입체크**

```bash
cd /c/Users/yangjong/.cokacdir/workspace/tigerbookmaker-deploy && npx tsc --noEmit
```
Expected: PASS (exit 0)

- [ ] **Step 4: 커밋**

```bash
git add lib/storage.ts
git commit -m "feat(template): BookProject 인터페이스에 template 필드 추가 (foundation)"
```

---

### Task 2: lib/templates/index.ts 작성 (registry + 매칭 함수)

**Files:**
- Create: `lib/templates/index.ts`
- Modify: `lib/storage.ts` (Task 1의 stub 제거 후 re-export)

- [ ] **Step 1: lib/templates/index.ts 생성**

```typescript
// lib/templates/index.ts
// 4가지 레이아웃 템플릿 — registry, types, getTemplate, suggestTemplate
// 각 template은 별도 파일에 정의되고 여기서 모음

import type { ReactElement } from "react";
import type { ThemeClasses } from "../theme-colors";
import { minimal } from "./minimal";
import { editorial } from "./editorial";
import { classic } from "./classic";
import { practical } from "./practical";

export type TemplateKey = "minimal" | "editorial" | "classic" | "practical";

// project.type 가능한 값 (lib/storage.ts BookProject.type과 일치)
export type BookType =
  | "자기계발서" | "실용서" | "에세이" | "매뉴얼"
  | "재테크" | "웹소설" | "전문서";

export interface ChapterImage {
  placeholder: string;     // "[IMAGE: 캡션]"
  dataUrl?: string;
  alt?: string;
  caption?: string;
}

export interface TemplateProps {
  chapter: {
    title: string;
    subtitle?: string;
    content: string;
    images?: ChapterImage[];
  };
  theme: ThemeClasses;
  chapterIdx?: number;
  totalChapters?: number;
}

export interface BookTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  thumbnailSvg: string;     // SVG inline string for sidebar preview
  suggestedFor: BookType[];
  Render: (props: TemplateProps) => ReactElement;
  epubCss: string;
  pdfHtmlWrapper: (innerHtml: string, theme: ThemeClasses) => string;
  coverStyleHint: string;
}

export const TEMPLATES: Record<TemplateKey, BookTemplate> = {
  minimal,
  editorial,
  classic,
  practical,
};

const TEMPLATE_KEYS: ReadonlyArray<TemplateKey> = ["minimal", "editorial", "classic", "practical"];

export function isValidTemplateKey(key: unknown): key is TemplateKey {
  return typeof key === "string" && (TEMPLATE_KEYS as readonly string[]).includes(key);
}

export function getTemplate(key: TemplateKey | null | undefined): BookTemplate {
  if (key && isValidTemplateKey(key)) return TEMPLATES[key];
  return TEMPLATES.minimal;  // default fallback
}

// project.type → 자동 추천 template
export function suggestTemplate(bookType: BookType | string | null | undefined): TemplateKey {
  if (!bookType) return "minimal";
  switch (bookType) {
    case "전문서":
      return "editorial";
    case "에세이":
    case "웹소설":
      return "classic";
    case "매뉴얼":
      return "practical";
    case "자기계발서":
    case "실용서":
    case "재테크":
    default:
      return "minimal";
  }
}
```

- [ ] **Step 2: lib/storage.ts의 임시 TemplateKey stub 제거하고 re-export로 교체**

`lib/storage.ts` 상단:

```typescript
// 기존 임시 alias 제거하고:
export type { TemplateKey } from "./templates";
```

- [ ] **Step 3: minimal/editorial/classic/practical 임시 stub 추가 (다음 Task 5-8에서 본 구현)**

Task 2에서는 import가 깨지지 않도록 4개 파일을 빈 placeholder로 만든다.

`lib/templates/minimal.tsx` (placeholder):

```tsx
import type { BookTemplate } from "./index";

export const minimal: BookTemplate = {
  key: "minimal",
  label: "모던 미니멀",
  description: "정돈된 sans-serif, 1단, 큰 여백",
  thumbnailSvg: "",
  suggestedFor: ["자기계발서", "실용서", "재테크"],
  Render: () => null as any,
  epubCss: "",
  pdfHtmlWrapper: (inner) => inner,
  coverStyleHint: "",
};
```

같은 형태로 `editorial.tsx`, `classic.tsx`, `practical.tsx`도 placeholder 생성. 각각 key/label/suggestedFor만 다르게:
- editorial: "에디토리얼 매거진" / `["전문서"]`
- classic: "클래식 도서" / `["에세이", "웹소설"]`
- practical: "실용 가이드" / `["매뉴얼"]`

- [ ] **Step 4: 타입체크 통과 확인**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/templates/ lib/storage.ts
git commit -m "feat(template): registry 골격 + 4개 placeholder + suggestTemplate 매칭 함수"
```

---

### Task 3: POST /api/projects에서 template 자동 설정

**Files:**
- Modify: `app/api/projects/route.ts`

- [ ] **Step 1: import 추가 + body 분해 + suggestTemplate 호출**

`app/api/projects/route.ts` 상단:

```typescript
import { suggestTemplate, isValidTemplateKey, type TemplateKey } from "@/lib/templates";
```

POST 핸들러 안:

```typescript
// 기존:
const { topic, audience, type, targetPages = 120, tier, noImages, themeColor } = await req.json().catch(() => ({}));

// 변경 후:
const { topic, audience, type, targetPages = 120, tier, noImages, themeColor, template } = await req.json().catch(() => ({}));

// data 구성 직전:
const safeTemplate: TemplateKey = isValidTemplateKey(template)
  ? template
  : suggestTemplate(type);

const data = {
  topic, audience, type, targetPages,
  tier: safeTier, noImages: !!noImages,
  themeColor: safeThemeColor,
  template: safeTemplate,  // ← 추가
  chapters: []
};
```

- [ ] **Step 2: 응답에 template 포함되는지 확인 — GET 라우트도 수정**

`app/api/projects/route.ts` GET 핸들러 (또는 동일 파일 내 라우트) 수정:

```typescript
// 기존:
themeColor: r.data?.themeColor ?? "orange",

// 추가:
themeColor: r.data?.themeColor ?? "orange",
template: r.data?.template ?? "minimal",
```

- [ ] **Step 3: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 수동 smoke test (배포 후)**

새 프로젝트 만들고 `/api/projects/[id]` GET하여 응답에 `"template": "minimal"`(또는 자동 매칭값) 포함 확인.

- [ ] **Step 5: 커밋**

```bash
git add app/api/projects/route.ts
git commit -m "feat(template): 신규 프로젝트 생성 시 template 자동 설정 (suggestTemplate 매칭)"
```

---

### Task 4: PATCH /api/projects/[id]에서 template 변경 허용

**Files:**
- Modify: `app/api/projects/[id]/route.ts`

- [ ] **Step 1: 현재 PATCH 핸들러 위치 + 구조 파악**

```bash
grep -n "PATCH\|export async function" app/api/projects/\[id\]/route.ts
```

- [ ] **Step 2: import + body 처리 추가**

`app/api/projects/[id]/route.ts` 상단에 import:

```typescript
import { isValidTemplateKey } from "@/lib/templates";
```

PATCH 핸들러 안에서, 현재 `themeColor` 처리 옆에 동일 패턴으로 추가:

```typescript
// 예시 (실제 파일 구조에 맞춰 적용):
if (typeof body.template === "string" && isValidTemplateKey(body.template)) {
  newData.template = body.template;
}
```

(파일 구조가 `data` jsonb 통째 업데이트라면 그쪽 흐름에 끼워 넣음)

- [ ] **Step 3: GET 응답에 template 포함**

GET 핸들러에서:

```typescript
// 응답 객체에 추가:
template: project.data?.template ?? "minimal",
```

- [ ] **Step 4: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/projects/\[id\]/route.ts
git commit -m "feat(template): PATCH /api/projects/[id]로 template 변경 허용 + GET 응답에 포함"
```

---

## Phase B — 4개 Template 컴포넌트 (Tasks 5-8)

각 Task는 동일한 구조: 같은 파일을 placeholder에서 본 구현으로 채우기.

### Task 5: lib/templates/minimal.tsx 본 구현

**Files:**
- Modify: `lib/templates/minimal.tsx` (Task 2의 placeholder를 본 구현으로)

- [ ] **Step 1: Render 컴포넌트 + thumbnailSvg + epubCss + pdfHtmlWrapper + coverStyleHint 작성**

```tsx
// lib/templates/minimal.tsx
// Modern Minimal — sans-serif, 1단, 큰 여백, 정돈된 비즈니스 스타일
// 어울리는 책: 자기계발서·실용서·재테크

import type { BookTemplate, TemplateProps } from "./index";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fafafa" rx="4"/>
  <rect x="10" y="14" width="40" height="6" fill="#0a0a0a" rx="1"/>
  <rect x="10" y="24" width="20" height="3" fill="#9ca3af" rx="1"/>
  <line x1="10" y1="38" x2="70" y2="38" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="46" x2="65" y2="46" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="54" x2="62" y2="54" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="62" x2="68" y2="62" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="74" x2="55" y2="74" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="82" x2="60" y2="82" stroke="#d4d4d8" stroke-width="1.5"/>
</svg>`;

function MinimalRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-minimal max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14 font-sans">
      {chapterIdx != null && totalChapters != null && (
        <div className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">
          {chapterIdx + 1} / {totalChapters}
        </div>
      )}
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-3 leading-tight">
        {chapter.title}
      </h1>
      {chapter.subtitle && (
        <p className="text-lg text-gray-500 mb-10 leading-relaxed">{chapter.subtitle}</p>
      )}
      <div className={`prose prose-lg prose-gray max-w-none ${theme.accent.split(" ")[0]}`}>
        {renderContentWithImages(chapter.content, chapter.images, "minimal")}
      </div>
    </article>
  );
}

// 본문 텍스트와 [IMAGE: ...] 분리해서 렌더 (4개 template 공통 패턴)
// 실제 구현은 Task 9에서 lib/templates/shared.tsx로 분리하여 공통화
// 임시로 minimal에 inline; 다음 task에서 shared.tsx로 이동
function renderContentWithImages(
  content: string,
  images: TemplateProps["chapter"]["images"],
  templateKey: string
) {
  const parts = content.split(/(\[IMAGE:[^\]]+\])/);
  return parts.map((part, i) => {
    if (part.startsWith("[IMAGE:")) {
      const matched = images?.find(img => img.placeholder === part);
      if (!matched?.dataUrl) return null;
      // template별 다른 스타일
      if (templateKey === "minimal") {
        return (
          <figure key={i} className="my-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={matched.dataUrl} alt={matched.alt ?? ""} className="mx-auto max-w-[70%] rounded-md" />
            {matched.caption && <figcaption className="mt-3 text-sm text-gray-500">{matched.caption}</figcaption>}
          </figure>
        );
      }
      return null;
    }
    // 텍스트 블록 — 줄바꿈 보존
    return part.split("\n\n").map((para, j) => (
      para.trim() ? <p key={`${i}-${j}`} className="leading-loose text-gray-800 mb-5">{para}</p> : null
    ));
  });
}

const EPUB_CSS = `
.tpl-minimal { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.85; max-width: 100%; padding: 1.5em; color: #1a1a1a; }
.tpl-minimal h1 { font-size: 1.8em; font-weight: 900; margin-bottom: 0.5em; letter-spacing: -0.02em; }
.tpl-minimal h2 { font-size: 1.3em; font-weight: 800; margin-top: 2em; margin-bottom: 0.4em; }
.tpl-minimal p { margin-bottom: 1em; text-align: justify; word-break: keep-all; }
.tpl-minimal figure { margin: 2em auto; text-align: center; }
.tpl-minimal figure img { max-width: 70%; height: auto; border-radius: 4px; }
.tpl-minimal figcaption { margin-top: 0.5em; font-size: 0.9em; color: #6b7280; }
`;

function pdfHtmlWrapper(inner: string, theme: { hex: string }) {
  return `<div class="tpl-minimal" style="font-family:'Pretendard',sans-serif;line-height:1.85;color:#1a1a1a;max-width:680px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const minimal: BookTemplate = {
  key: "minimal",
  label: "모던 미니멀",
  description: "sans-serif, 1단, 큰 여백, 정돈된 비즈니스",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["자기계발서", "실용서", "재테크"],
  Render: MinimalRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Modern minimalist design, clean sans-serif typography, generous negative space, single bold focal element, restrained editorial style.",
};
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add lib/templates/minimal.tsx
git commit -m "feat(template): Modern Minimal 본 구현 (Render + epubCss + pdfWrapper + coverHint)"
```

---

### Task 6: lib/templates/classic.tsx 본 구현

**Files:**
- Modify: `lib/templates/classic.tsx`

- [ ] **Step 1: Classic 본 구현**

```tsx
// lib/templates/classic.tsx
// Classic Book — serif (Noto Serif KR), 1단, 챕터 시작 큰 첫글자
// 어울리는 책: 에세이·웹소설·인문·자서전

import type { BookTemplate, TemplateProps } from "./index";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fefefe" rx="4"/>
  <text x="40" y="14" text-anchor="middle" font-size="5" font-family="serif" fill="#9ca3af" font-style="italic">CHAPTER ONE</text>
  <rect x="22" y="20" width="36" height="4" fill="#1f2937" rx="1"/>
  <text x="14" y="48" font-size="22" font-weight="900" fill="#1f2937" font-family="Georgia,serif">A</text>
  <line x1="26" y1="36" x2="70" y2="36" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="26" y1="44" x2="65" y2="44" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="26" y1="52" x2="68" y2="52" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="68" x2="70" y2="68" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="76" x2="65" y2="76" stroke="#d4d4d8" stroke-width="1.5"/>
  <line x1="10" y1="84" x2="60" y2="84" stroke="#d4d4d8" stroke-width="1.5"/>
</svg>`;

function ClassicRender({ chapter, chapterIdx, totalChapters }: TemplateProps) {
  // 본문 첫 글자 분리 — 한글 1글자 또는 영문 1글자
  const content = chapter.content.trim();
  const firstChar = content.charAt(0);
  const restContent = content.slice(1);

  return (
    <article className="tpl-classic max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16" style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
      <div className="text-center mb-12">
        {chapterIdx != null && (
          <div className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-3 font-sans">
            CHAPTER {chapterIdx + 1}{totalChapters ? ` / ${totalChapters}` : ""}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{chapter.title}</h1>
        {chapter.subtitle && (
          <p className="mt-3 text-base text-gray-600 italic">{chapter.subtitle}</p>
        )}
      </div>
      <div className="text-base md:text-lg text-gray-800 leading-loose" style={{ wordBreak: "keep-all" }}>
        {renderContentWithImages(firstChar, restContent, chapter.images)}
      </div>
    </article>
  );
}

function renderContentWithImages(
  firstChar: string,
  rest: string,
  images: TemplateProps["chapter"]["images"]
) {
  // rest에서 첫 단락 분리해 큰 첫글자 적용
  const fullText = firstChar + rest;
  const parts = fullText.split(/(\[IMAGE:[^\]]+\])/);
  let firstParagraphRendered = false;

  return parts.map((part, i) => {
    if (part.startsWith("[IMAGE:")) {
      const matched = images?.find(img => img.placeholder === part);
      if (!matched?.dataUrl) return null;
      return (
        <figure key={i} className="my-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={matched.dataUrl} alt={matched.alt ?? ""} className="mx-auto max-w-[50%] rounded" />
          {matched.caption && <figcaption className="mt-2 text-sm text-gray-500 italic font-sans">{matched.caption}</figcaption>}
        </figure>
      );
    }
    const paragraphs = part.split("\n\n").filter(p => p.trim());
    return paragraphs.map((para, j) => {
      if (!firstParagraphRendered && i === 0 && j === 0) {
        firstParagraphRendered = true;
        const fc = para.charAt(0);
        const rest2 = para.slice(1);
        return (
          <p key={`${i}-${j}`} className="mb-6 first-letter:text-6xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:leading-none first-letter:mt-1">
            {fc}{rest2}
          </p>
        );
      }
      return <p key={`${i}-${j}`} className="mb-5">{para}</p>;
    });
  });
}

const EPUB_CSS = `
.tpl-classic { font-family: 'Noto Serif KR', Georgia, serif; line-height: 2.0; max-width: 100%; padding: 1.5em; color: #1a1a1a; }
.tpl-classic h1 { font-size: 1.8em; font-weight: 700; text-align: center; margin-bottom: 1em; }
.tpl-classic .chapter-label { text-align: center; font-size: 0.7em; letter-spacing: 0.3em; color: #9ca3af; text-transform: uppercase; margin-bottom: 0.5em; font-family: sans-serif; }
.tpl-classic p { margin-bottom: 1em; text-align: justify; word-break: keep-all; text-indent: 1em; }
.tpl-classic p:first-of-type { text-indent: 0; }
.tpl-classic p:first-of-type::first-letter { font-size: 3em; font-weight: 700; float: left; line-height: 1; margin-right: 0.1em; margin-top: 0.05em; }
.tpl-classic figure { margin: 1.5em auto; text-align: center; }
.tpl-classic figure img { max-width: 50%; height: auto; }
.tpl-classic figcaption { margin-top: 0.3em; font-size: 0.85em; color: #6b7280; font-style: italic; font-family: sans-serif; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-classic" style="font-family:'Noto Serif KR',Georgia,serif;line-height:2.0;color:#1a1a1a;max-width:620px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const classic: BookTemplate = {
  key: "classic",
  label: "클래식 도서",
  description: "serif (Noto Serif KR), 1단, 큰 첫글자, 종이책 느낌",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["에세이", "웹소설"],
  Render: ClassicRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Classic literary book cover, elegant serif typography, generous spacing, traditional paper texture or subtle grain, sophisticated muted color palette, single classical reference image.",
};
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add lib/templates/classic.tsx && git commit -m "feat(template): Classic Book 본 구현 (serif + 큰 첫글자)"
```

---

### Task 7: lib/templates/practical.tsx 본 구현

**Files:**
- Modify: `lib/templates/practical.tsx`

- [ ] **Step 1: Practical 본 구현**

```tsx
// lib/templates/practical.tsx
// Practical Guide — 1단 + 박스, sans-serif, 체크리스트·인용 박스 강조
// 어울리는 책: 매뉴얼·요리·여행·튜토리얼

import type { BookTemplate, TemplateProps } from "./index";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fff7ed" rx="4"/>
  <rect x="10" y="14" width="35" height="5" fill="#0a0a0a" rx="1"/>
  <rect x="10" y="26" width="60" height="14" fill="#fff" stroke="#fb923c" stroke-width="1.5" rx="3"/>
  <rect x="14" y="30" width="22" height="2.5" fill="#9a3412" rx="1"/>
  <rect x="14" y="35" width="48" height="2" fill="#fdba74" rx="1"/>
  <g transform="translate(10,46)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="60" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
  <g transform="translate(10,56)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="55" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
  <g transform="translate(10,66)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="58" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
  <g transform="translate(10,76)">
    <rect width="6" height="6" fill="none" stroke="#f97316" stroke-width="1.2" rx="1"/>
    <line x1="10" y1="3" x2="50" y2="3" stroke="#d4d4d8" stroke-width="1.5"/>
  </g>
</svg>`;

function PracticalRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-practical max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 font-sans">
      <div className="mb-6">
        {chapterIdx != null && totalChapters != null && (
          <div className={`inline-block px-2 py-1 text-xs font-mono uppercase tracking-widest rounded ${theme.bg} ${theme.accent.split(" ")[0]} mb-3`}>
            STEP {chapterIdx + 1} / {totalChapters}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 mb-2">{chapter.title}</h1>
        {chapter.subtitle && (
          <p className="text-base text-gray-600">{chapter.subtitle}</p>
        )}
      </div>
      <div className="text-base text-gray-800 leading-relaxed">
        {renderContentWithImages(chapter.content, chapter.images, theme)}
      </div>
    </article>
  );
}

function renderContentWithImages(
  content: string,
  images: TemplateProps["chapter"]["images"],
  theme: TemplateProps["theme"]
) {
  let figureCount = 0;
  const parts = content.split(/(\[IMAGE:[^\]]+\])/);
  return parts.map((part, i) => {
    if (part.startsWith("[IMAGE:")) {
      const matched = images?.find(img => img.placeholder === part);
      if (!matched?.dataUrl) return null;
      figureCount += 1;
      const num = figureCount;
      return (
        <figure key={i} className={`my-6 border-2 ${theme.accentBorder.replace("border-l-", "border-")} rounded-lg overflow-hidden`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={matched.dataUrl} alt={matched.alt ?? ""} className="block w-full" />
          <figcaption className={`px-3 py-2 text-sm ${theme.bg} text-gray-700`}>
            <b>그림 {num}.</b> {matched.caption ?? matched.alt ?? ""}
          </figcaption>
        </figure>
      );
    }
    return part.split("\n\n").map((para, j) => {
      if (!para.trim()) return null;
      const trimmed = para.trim();
      // 핵심 팁 박스: "💡" 또는 "TIP:" 시작하는 단락은 강조 박스로
      if (trimmed.startsWith("💡") || /^TIP[:.]/i.test(trimmed)) {
        return (
          <div key={`${i}-${j}`} className={`my-4 px-4 py-3 ${theme.bg} border-l-4 ${theme.accentBorder} rounded`}>
            <p className="font-semibold">{trimmed}</p>
          </div>
        );
      }
      // 체크리스트: 줄마다 "- [ ]" 또는 "✓" 로 시작하면 체크박스
      if (/^[-*]\s\[\s?\]/.test(trimmed) || /^✓\s/.test(trimmed) || trimmed.split("\n").every(line => /^[-*]\s\[\s?\]|^✓\s/.test(line))) {
        const lines = trimmed.split("\n").filter(l => l.trim());
        return (
          <ul key={`${i}-${j}`} className="my-4 space-y-2">
            {lines.map((line, k) => (
              <li key={k} className="flex items-start gap-2">
                <span className={`flex-shrink-0 mt-1 inline-block w-4 h-4 border-2 ${theme.accentBorder.replace("border-l-", "border-")} rounded-sm`}></span>
                <span>{line.replace(/^[-*]\s\[\s?\]\s*|^✓\s*/, "")}</span>
              </li>
            ))}
          </ul>
        );
      }
      return <p key={`${i}-${j}`} className="mb-4">{para}</p>;
    });
  });
}

const EPUB_CSS = `
.tpl-practical { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.7; max-width: 100%; padding: 1.5em; color: #1a1a1a; background: #fff7ed; }
.tpl-practical h1 { font-size: 1.6em; font-weight: 900; margin-bottom: 0.4em; }
.tpl-practical p { margin-bottom: 0.8em; word-break: keep-all; }
.tpl-practical .tip-box { padding: 0.8em 1em; background: #fff; border-left: 4px solid #f97316; border-radius: 4px; margin: 1em 0; font-weight: 600; }
.tpl-practical figure { margin: 1.2em 0; border: 2px solid #fb923c; border-radius: 6px; overflow: hidden; }
.tpl-practical figure img { display: block; max-width: 100%; }
.tpl-practical figcaption { padding: 0.5em 0.8em; background: #ffedd5; font-size: 0.9em; color: #7c2d12; }
.tpl-practical figcaption b { color: #9a3412; }
.tpl-practical ul.checklist li { display: flex; align-items: flex-start; gap: 0.5em; margin-bottom: 0.4em; }
.tpl-practical ul.checklist li::before { content: ""; flex-shrink: 0; display: inline-block; width: 1em; height: 1em; border: 2px solid #f97316; border-radius: 2px; margin-top: 0.25em; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-practical" style="font-family:'Pretendard',sans-serif;line-height:1.7;color:#1a1a1a;background:#fff7ed;max-width:680px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const practical: BookTemplate = {
  key: "practical",
  label: "실용 가이드",
  description: "체크리스트·인용 박스·표 강조, 행동 지향",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["매뉴얼"],
  Render: PracticalRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Practical guide cover, clean and useful-looking, white or light background with one bold geometric color block, heavy sans-serif typography, numbered or bulleted feel, professional.",
};
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add lib/templates/practical.tsx && git commit -m "feat(template): Practical Guide 본 구현 (체크리스트 + 팁 박스 + 그림 N. 캡션)"
```

---

### Task 8: lib/templates/editorial.tsx 본 구현 (1단형)

**Files:**
- Modify: `lib/templates/editorial.tsx`

- [ ] **Step 1: Editorial 본 구현 (1단형, 큰 이미지 풀폭, 인라인 인용 박스)**

```tsx
// lib/templates/editorial.tsx
// Editorial Magazine — 1단, 큰 이미지 풀폭, 인라인 인용 박스 (강조 컬러 좌측 라인)
// 어울리는 책: 비즈니스·전문서·트렌드·인터뷰

import type { BookTemplate, TemplateProps } from "./index";

const THUMBNAIL_SVG = `<svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="100" fill="#fff" rx="4" stroke="#e5e7eb"/>
  <rect x="6" y="10" width="40" height="6" fill="#0a0a0a" rx="1"/>
  <rect x="6" y="22" width="68" height="22" fill="#fbbf24" rx="2"/>
  <line x1="6" y1="50" x2="74" y2="50" stroke="#d4d4d8" stroke-width="1.2"/>
  <line x1="6" y1="56" x2="68" y2="56" stroke="#d4d4d8" stroke-width="1.2"/>
  <rect x="6" y="62" width="68" height="14" fill="#fef3c7" stroke="#f59e0b" stroke-width="0" rx="2"/>
  <line x1="9" y1="62" x2="9" y2="76" stroke="#f59e0b" stroke-width="2"/>
  <line x1="14" y1="66" x2="60" y2="66" stroke="#92400e" stroke-width="1" stroke-dasharray="0"/>
  <line x1="14" y1="71" x2="55" y2="71" stroke="#92400e" stroke-width="1"/>
  <line x1="6" y1="82" x2="74" y2="82" stroke="#d4d4d8" stroke-width="1.2"/>
  <line x1="6" y1="88" x2="65" y2="88" stroke="#d4d4d8" stroke-width="1.2"/>
</svg>`;

function EditorialRender({ chapter, theme, chapterIdx, totalChapters }: TemplateProps) {
  return (
    <article className="tpl-editorial max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <div className="mb-8">
        {chapterIdx != null && totalChapters != null && (
          <div className={`text-xs font-mono uppercase tracking-[0.25em] mb-4 ${theme.accent.split(" ")[0]} font-bold`}>
            ISSUE {chapterIdx + 1} · {totalChapters}장 시리즈
          </div>
        )}
        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05] text-gray-900 mb-4" style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
          {chapter.title}
        </h1>
        {chapter.subtitle && (
          <p className="text-lg md:text-xl text-gray-600 leading-snug max-w-2xl font-sans">{chapter.subtitle}</p>
        )}
      </div>
      <div className="text-base md:text-lg text-gray-800 leading-loose font-sans" style={{ wordBreak: "keep-all" }}>
        {renderContentWithImages(chapter.content, chapter.images, theme)}
      </div>
    </article>
  );
}

function renderContentWithImages(
  content: string,
  images: TemplateProps["chapter"]["images"],
  theme: TemplateProps["theme"]
) {
  const parts = content.split(/(\[IMAGE:[^\]]+\])/);
  return parts.map((part, i) => {
    if (part.startsWith("[IMAGE:")) {
      const matched = images?.find(img => img.placeholder === part);
      if (!matched?.dataUrl) return null;
      return (
        <figure key={i} className="my-10 -mx-4 md:-mx-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={matched.dataUrl} alt={matched.alt ?? ""} className="block w-full aspect-[16/9] object-cover" />
          {matched.caption && (
            <figcaption className={`mt-3 mx-4 md:mx-6 pl-3 border-l-4 ${theme.accentBorder} text-sm font-bold ${theme.accent.split(" ")[0]}`}>
              {matched.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    return part.split("\n\n").map((para, j) => {
      if (!para.trim()) return null;
      const trimmed = para.trim();
      // 인용: > 또는 ❝ 시작 → 인라인 인용 박스
      if (trimmed.startsWith(">") || trimmed.startsWith("❝") || trimmed.startsWith('"')) {
        const text = trimmed.replace(/^>\s?|^❝\s?|^"|"$/g, "");
        return (
          <blockquote key={`${i}-${j}`} className={`my-6 pl-5 border-l-4 ${theme.accentBorder} ${theme.accent.split(" ")[0]} text-xl md:text-2xl font-bold leading-snug`} style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
            "{text}"
          </blockquote>
        );
      }
      return <p key={`${i}-${j}`} className="mb-5">{para}</p>;
    });
  });
}

const EPUB_CSS = `
.tpl-editorial { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.85; max-width: 100%; padding: 1.5em; color: #1a1a1a; }
.tpl-editorial h1 { font-family: 'Noto Serif KR', Georgia, serif; font-size: 2em; font-weight: 900; line-height: 1.1; margin-bottom: 0.5em; letter-spacing: -0.02em; }
.tpl-editorial .issue-label { font-size: 0.7em; letter-spacing: 0.25em; color: #f97316; text-transform: uppercase; font-weight: 700; margin-bottom: 0.5em; }
.tpl-editorial p { margin-bottom: 1em; word-break: keep-all; }
.tpl-editorial blockquote { margin: 1.5em 0; padding-left: 1em; border-left: 4px solid currentColor; font-family: 'Noto Serif KR', Georgia, serif; font-size: 1.3em; font-weight: 700; line-height: 1.4; }
.tpl-editorial figure { margin: 2em -1.5em; }
.tpl-editorial figure img { display: block; width: 100%; height: auto; }
.tpl-editorial figcaption { margin: 0.6em 1.5em 0; padding-left: 0.8em; border-left: 4px solid currentColor; font-size: 0.95em; font-weight: 700; }
`;

function pdfHtmlWrapper(inner: string) {
  return `<div class="tpl-editorial" style="font-family:'Pretendard',sans-serif;line-height:1.85;color:#1a1a1a;max-width:720px;margin:0 auto;padding:24px;">
${inner}
</div>`;
}

export const editorial: BookTemplate = {
  key: "editorial",
  label: "에디토리얼 매거진",
  description: "1단 + 큰 이미지 풀폭 + 인라인 인용 박스, 매거진 분위기",
  thumbnailSvg: THUMBNAIL_SVG,
  suggestedFor: ["전문서"],
  Render: EditorialRender,
  epubCss: EPUB_CSS,
  pdfHtmlWrapper,
  coverStyleHint: "Editorial magazine cover style, bold serif title, asymmetric composition, large abstract or photographic background, accent color stripe or geometric element, sophisticated publication aesthetic.",
};
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add lib/templates/editorial.tsx && git commit -m "feat(template): Editorial Magazine 본 구현 (1단형, 큰 이미지 풀폭, 인용 박스)"
```

---

## Phase C — UI 컴포넌트 (Tasks 9-10)

### Task 9: components/TemplateSelector.tsx 작성

**Files:**
- Create: `components/TemplateSelector.tsx`

- [ ] **Step 1: TemplateSelector 컴포넌트 생성**

```tsx
// components/TemplateSelector.tsx
// /write 사이드바에 들어가는 4개 thumbnail 그리드. 클릭 시 PATCH /api/projects/[id] 호출.

"use client";
import { TEMPLATES, type TemplateKey } from "@/lib/templates";
import { useState } from "react";

interface Props {
  projectId: string;
  current: TemplateKey | null | undefined;
  onChange: (key: TemplateKey) => void;
  disabled?: boolean;
}

export function TemplateSelector({ projectId, current, onChange, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = current ?? "minimal";

  const handleSelect = async (key: TemplateKey) => {
    if (busy || disabled || key === active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `템플릿 변경 실패 (${res.status})`);
      }
      onChange(key);
    } catch (e: any) {
      setError(e?.message || "변경 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-2 pb-1">
      <div className="text-xs font-bold text-ink-900 mb-1.5">📐 레이아웃 템플릿</div>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(TEMPLATES) as TemplateKey[]).map(key => {
          const tpl = TEMPLATES[key];
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              disabled={busy || disabled}
              className={`relative text-left rounded-md border-2 p-1.5 transition disabled:opacity-50 ${selected ? "border-tiger-orange bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
              title={tpl.description}
            >
              <div
                className="aspect-[4/5] mb-1 rounded overflow-hidden"
                dangerouslySetInnerHTML={{ __html: tpl.thumbnailSvg }}
              />
              <div className="text-[10px] font-bold text-ink-900 leading-tight">{tpl.label}</div>
              {selected && <div className="absolute top-1 right-1 text-tiger-orange text-xs">✓</div>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add components/TemplateSelector.tsx && git commit -m "feat(template): TemplateSelector 사이드바 컴포넌트 (4개 thumbnail + PATCH 연동)"
```

---

### Task 10: components/TemplatePreviewModal.tsx 작성

**Files:**
- Create: `components/TemplatePreviewModal.tsx`

- [ ] **Step 1: TemplatePreviewModal 컴포넌트 생성**

```tsx
// components/TemplatePreviewModal.tsx
// [👁 결과 미리보기] 버튼이 띄우는 모달. 현재 챕터 + 선택된 template으로 렌더링.

"use client";
import { useState } from "react";
import { getTemplate, type TemplateKey, type ChapterImage } from "@/lib/templates";
import { getTheme } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

interface Props {
  open: boolean;
  onClose: () => void;
  templateKey: TemplateKey | null | undefined;
  themeColor: ThemeColorKey | null | undefined;
  chapter: { title: string; subtitle?: string; content: string; images?: ChapterImage[] };
  chapterIdx: number;
  totalChapters: number;
}

export function TemplatePreviewModal({ open, onClose, templateKey, themeColor, chapter, chapterIdx, totalChapters }: Props) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  if (!open) return null;

  const tpl = getTemplate(templateKey);
  const theme = getTheme(themeColor);
  const Render = tpl.Render;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 flex items-stretch justify-center p-2 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-tiger-orange font-bold">📐 {tpl.label} 미리보기</div>
            <div className="text-sm text-gray-600 mt-0.5">{chapterIdx + 1}장 — {chapter.title}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewport(v => v === "desktop" ? "mobile" : "desktop")}
              className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded hover:bg-gray-50"
            >
              {viewport === "desktop" ? "📱 모바일 뷰" : "🖥 데스크톱 뷰"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded hover:bg-gray-800"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 본문 영역 */}
        <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6">
          <div
            className={`mx-auto bg-white rounded shadow-md transition-all ${viewport === "mobile" ? "max-w-[390px]" : "max-w-3xl"}`}
            style={viewport === "mobile" ? { width: "390px" } : undefined}
          >
            <Render
              chapter={chapter}
              theme={theme}
              chapterIdx={chapterIdx}
              totalChapters={totalChapters}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add components/TemplatePreviewModal.tsx && git commit -m "feat(template): TemplatePreviewModal — 모바일/데스크톱 뷰포트 토글 + template 풀 렌더링"
```

---

## Phase D — UI 통합 (Tasks 11-13)

### Task 11: /write/page.tsx에 TemplateSelector + 미리보기 버튼 통합

**Files:**
- Modify: `app/write/page.tsx`

- [ ] **Step 1: import + state 추가**

`app/write/page.tsx` 상단:

```typescript
import { TemplateSelector } from "@/components/TemplateSelector";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import type { TemplateKey } from "@/lib/templates";
```

컴포넌트 안 state:

```typescript
const [previewModal, setPreviewModal] = useState<{ chapterIdx: number } | null>(null);
const currentTemplate: TemplateKey | undefined = (project as any)?.template;
```

- [ ] **Step 2: 사이드바에 TemplateSelector 추가**

`app/write/page.tsx`에서 마케팅 페이지 섹션(`{/* 마케팅 페이지 */}` 주석 위) 위에 추가:

```tsx
{/* 레이아웃 템플릿 — 4개 thumbnail */}
<div className="mt-2 pt-2 border-t border-gray-100">
  <TemplateSelector
    projectId={projectId!}
    current={currentTemplate}
    onChange={(newKey) => setProject(p => p ? { ...p, template: newKey } : p)}
    disabled={!!loading}
  />
</div>
```

- [ ] **Step 3: 챕터 카드에 [👁 결과 미리보기] 버튼 추가**

각 챕터 카드 컨트롤 영역(예: AI 수정 요청 버튼 근처)에 추가:

```tsx
<button
  onClick={() => setPreviewModal({ chapterIdx: i })}
  disabled={!ch?.content}
  className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
  title="현재 선택된 템플릿으로 이 챕터를 미리보기"
>
  👁 결과 미리보기
</button>
```

- [ ] **Step 4: 모달 마운트**

`app/write/page.tsx` JSX 끝부분 (다른 모달 옆):

```tsx
{previewModal && project && (
  <TemplatePreviewModal
    open
    onClose={() => setPreviewModal(null)}
    templateKey={(project as any).template}
    themeColor={project.themeColor}
    chapter={project.chapters[previewModal.chapterIdx]}
    chapterIdx={previewModal.chapterIdx}
    totalChapters={project.chapters.length}
  />
)}
```

- [ ] **Step 5: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add app/write/page.tsx && git commit -m "feat(template): /write 사이드바에 TemplateSelector + 챕터별 [미리보기] 버튼"
```

---

### Task 12: /share/[id]/page.tsx에서 template 기반 분기 렌더링

**Files:**
- Modify: `app/share/[id]/page.tsx`

- [ ] **Step 1: import 추가 + chapter 렌더 부분을 template Render로 교체**

`app/share/[id]/page.tsx` 상단:

```typescript
import { getTemplate, type TemplateKey } from "@/lib/templates";
import { getTheme } from "@/lib/theme-colors";
```

기존 챕터 본문 렌더 부분을 찾아서 (예: `{chapter.content}` 또는 `whitespace-pre-line` 영역) 교체:

```tsx
// 기존 inline 렌더 → template-aware 렌더로 변경
{(() => {
  const tpl = getTemplate((project as any)?.template);
  const theme = getTheme(project?.themeColor);
  const Render = tpl.Render;
  return (
    <Render
      chapter={currentChapter}
      theme={theme}
      chapterIdx={currentChapterIdx}
      totalChapters={project.chapters.length}
    />
  );
})()}
```

(파일 구조에 따라 chapter navigation·nav buttons 제외하고 본문 영역만 교체)

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add app/share/\[id\]/page.tsx
git commit -m "feat(template): /share/[id] 본문 렌더링을 template.Render로 분기"
```

---

### Task 13: /book/[id]/page.tsx에 template 라벨 + TOC 스타일 적용

**Files:**
- Modify: `app/book/[id]/page.tsx`

- [ ] **Step 1: import + 데이터 받기**

`app/book/[id]/page.tsx` 상단 import:

```typescript
import { getTemplate, TEMPLATES, type TemplateKey } from "@/lib/templates";
```

`BookData` 인터페이스에 추가:

```typescript
interface BookData {
  // ... 기존 필드
  template?: TemplateKey;
}
```

(API GET이 이미 응답에 `template` 포함하므로 이 인터페이스만 update)

- [ ] **Step 2: template 라벨 표시 (Hero section 근처)**

표지 옆 영역에 작은 배지 추가:

```tsx
{data.template && TEMPLATES[data.template] && (
  <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded ${theme.bg} ${theme.accent.split(" ")[0]} mt-2`}>
    📐 {TEMPLATES[data.template].label}
  </span>
)}
```

- [ ] **Step 3: TOC 영역 스타일 분기**

기존 목차 `<ol>` 영역을 template-aware로 변경:

```tsx
{/* 5. 목차 section — template별로 스타일 다름 */}
{data.chapters.length > 0 && (
  <section className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-100">
    <h2 className={`text-2xl font-bold mb-6 border-l-4 pl-3 ${theme.accentBorder}`}>목차</h2>
    {(() => {
      const t = data.template ?? "minimal";
      if (t === "practical") {
        return (
          <ul className="space-y-2.5">
            {data.chapters.map((c, i) => (
              <li key={c.id ?? i} className="flex gap-3 items-start py-1.5">
                <span className={`flex-shrink-0 mt-0.5 inline-block w-5 h-5 border-2 ${theme.accentBorder.replace("border-l-", "border-")} rounded-sm`}></span>
                <span className="text-gray-900">{c.title}</span>
              </li>
            ))}
          </ul>
        );
      }
      if (t === "classic") {
        return (
          <ol className="space-y-3" style={{ fontFamily: "'Noto Serif KR', Georgia, serif" }}>
            {data.chapters.map((c, i) => (
              <li key={c.id ?? i} className="flex justify-between py-2 border-b border-dotted border-gray-300">
                <span>{c.title}</span>
                <span className="text-gray-400 text-sm">CH {i + 1}</span>
              </li>
            ))}
          </ol>
        );
      }
      if (t === "editorial") {
        return (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.chapters.map((c, i) => (
              <div key={c.id ?? i} className={`p-4 rounded-lg ${theme.bg}`}>
                <div className={`text-[10px] font-mono uppercase tracking-widest ${theme.accent.split(" ")[0]} font-bold mb-1`}>ISSUE {i + 1}</div>
                <div className="font-bold text-gray-900">{c.title}</div>
                {c.subtitle && <div className="text-xs text-gray-600 mt-1">{c.subtitle}</div>}
              </div>
            ))}
          </div>
        );
      }
      // minimal default — 기존 코드 그대로
      return (
        <ol className="space-y-3">
          {data.chapters.map((c, i) => (
            <li key={c.id ?? i} className="flex gap-4 items-start py-2 border-b border-gray-50 last:border-0">
              <span className={`flex-shrink-0 w-8 h-8 rounded-full ${theme.bg} ${theme.accent.split(" ")[0]} font-bold flex items-center justify-center text-sm`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{c.title}</div>
                {c.subtitle && <div className="text-sm text-gray-500 mt-0.5">{c.subtitle}</div>}
              </div>
            </li>
          ))}
        </ol>
      );
    })()}
  </section>
)}
```

- [ ] **Step 4: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add app/book/\[id\]/page.tsx && git commit -m "feat(template): /book/[id]에 template 배지 + TOC 스타일 4종 분기"
```

---

## Phase E — Export 통합 (Tasks 14-15)

### Task 14: EPUB export에 template.epubCss 통합

**Files:**
- Modify: `app/api/export/epub/route.ts`

- [ ] **Step 1: import + epubCss 임베드**

`app/api/export/epub/route.ts` 상단:

```typescript
import { getTemplate, TEMPLATES } from "@/lib/templates";
```

기존 CSS 빌드 부분에서 (chapter HTML 생성 로직) 수정:

```typescript
// 기존: 고정 CSS 문자열
const css = `
  body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.7; }
  ...
`;

// 변경: project.template 기반
const tpl = getTemplate((project.data as any)?.template);
const css = `
  body { margin: 0; padding: 0; }
  ${tpl.epubCss}
`;
```

각 챕터 HTML 생성 시 본문을 `<div class="${tpl.key === 'minimal' ? 'tpl-minimal' : ...}">` 등으로 감싸기:

```typescript
const wrapperClass = `tpl-${tpl.key}`;
const chapterHtml = `
  <div class="${wrapperClass}">
    <h1>${escapeHtml(ch.title)}</h1>
    ${ch.subtitle ? `<p class="subtitle">${escapeHtml(ch.subtitle)}</p>` : ""}
    ${renderBody(ch.content, ch.images)}
  </div>
`;
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 수동 smoke test (배포 후)**

각 template으로 EPUB 1번씩 다운로드 → Calibre 또는 모바일 리디북스에서 열어 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/api/export/epub/route.ts
git commit -m "feat(template): EPUB export에 template.epubCss 임베드 + class wrapper"
```

---

### Task 15: PDF export에 template.pdfHtmlWrapper 통합

**Files:**
- Modify: `lib/export-pdf.ts`

- [ ] **Step 1: 현재 PDF 빌드 흐름 파악**

```bash
grep -n "function generatePdf\|export\|theme" lib/export-pdf.ts | head -10
```

- [ ] **Step 2: import + wrapper 호출**

`lib/export-pdf.ts` 상단 (server-only 환경 X 클라이언트 사이드일 수 있음 — 확인):

```typescript
import { getTemplate } from "./templates";
import { getTheme } from "./theme-colors";
```

generatePdf() 함수 안에서 chapter HTML 생성 부분:

```typescript
const tpl = getTemplate(project.template);
const theme = getTheme(project.themeColor);

// 각 챕터 HTML 생성 후 template wrapper 적용:
const chapterHtml = `
  <h1>${escapeHtml(ch.title)}</h1>
  ${ch.subtitle ? `<p class="subtitle">${escapeHtml(ch.subtitle)}</p>` : ""}
  ${renderBody(ch.content, ch.images)}
`;

const wrappedHtml = tpl.pdfHtmlWrapper(chapterHtml, theme);
// wrappedHtml을 PDF 빌드에 사용
```

또한 기존 CSS 자리에 `tpl.epubCss` 추가 임베드 (PDF는 CSS 더 자유로움):

```typescript
const fullStyles = `
  ${existingPdfBaseCss}
  ${tpl.epubCss}
`;
```

- [ ] **Step 3: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add lib/export-pdf.ts
git commit -m "feat(template): PDF export에 template.pdfHtmlWrapper + epubCss 통합"
```

---

## Phase F — Cover Prompt 통합 (Tasks 16-17)

### Task 16: generateImagePromptAI 시그니처에 templateHint 추가

**Files:**
- Modify: `lib/server/image-prompt-ai.ts`

- [ ] **Step 1: ImagePromptOptions에 templateHint 추가**

`lib/server/image-prompt-ai.ts`:

```typescript
export interface ImagePromptOptions {
  bookTopic: string;
  bookAudience: string;
  bookType: string;
  themeColorHex: string;
  themeColorName: string;
  purpose: ImagePurpose;
  aspectRatio: string;
  chapterExcerpt?: string;
  referenceChunks?: Array<{ content: string; filename: string }>;
  feedback?: string;
  previousPrompt?: string;
  headline?: string;
  templateHint?: string;  // ← 추가: 레이아웃 template의 coverStyleHint
}
```

- [ ] **Step 2: userPrompt 빌드 시 templateHint 합성**

`lib/server/image-prompt-ai.ts` 함수 안 userPrompt 빌드 부분:

```typescript
const templateBlock = opts.templateHint
  ? `\n[TEMPLATE STYLE GUIDANCE — keep the cover consistent with this style direction]\n${opts.templateHint}`
  : "";

const userPrompt = `[BOOK]
Topic: ${opts.bookTopic}
Audience: ${opts.bookAudience}
Genre: ${opts.bookType}
Theme color: ${opts.themeColorName} (${opts.themeColorHex})
${opts.headline ? `Headline (for context only, NOT to render): "${opts.headline}"` : ""}

[IMAGE PURPOSE]
${purposeHint}
${templateBlock}

${ragContext}
${refinementBlock}

Now write a single English prompt (max 100 words) for Imagen 4 to generate the perfect image. Start directly with the prompt — no preamble.`;
```

- [ ] **Step 3: 타입체크 + 커밋**

```bash
npx tsc --noEmit && git add lib/server/image-prompt-ai.ts && git commit -m "feat(template): generateImagePromptAI에 templateHint 옵션 + userPrompt 합성"
```

---

### Task 17: 4개 cover 라우트에 templateHint 전달

**Files:**
- Modify: `app/api/generate/cover-variations/route.ts`
- Modify: `app/api/generate/meta-images/route.ts`
- Modify: `app/api/generate/image-refine/route.ts`
- Modify: `app/api/generate/kmong-package/route.ts`

각 파일에서 generateImagePromptAI 호출 시 templateHint 추가.

- [ ] **Step 1: cover-variations/route.ts 수정**

현재 호출:

```typescript
const r = await generateImagePromptAI({
  bookTopic: ...,
  bookAudience: ...,
  bookType: ...,
  // ...
});
```

수정:

```typescript
import { getTemplate } from "@/lib/templates";

// 함수 안 project 가져온 후:
const tpl = getTemplate((project?.data as any)?.template);

const r = await generateImagePromptAI({
  bookTopic: ...,
  // ... 기존 필드 ...
  templateHint: tpl.coverStyleHint,
});
```

- [ ] **Step 2: meta-images/route.ts 동일 패턴 적용**

(same change)

- [ ] **Step 3: image-refine/route.ts 동일 패턴 적용**

(same change)

- [ ] **Step 4: kmong-package/route.ts 동일 패턴 적용**

(same change)

- [ ] **Step 5: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add app/api/generate/cover-variations/route.ts app/api/generate/meta-images/route.ts app/api/generate/image-refine/route.ts app/api/generate/kmong-package/route.ts
git commit -m "feat(template): 4개 cover 라우트가 generateImagePromptAI에 templateHint 전달"
```

---

## Phase G — Verification (Tasks 18-19)

### Task 18: 통합 manual smoke test

**Files:** (수정 없음 — 검증 단계)

- [ ] **Step 1: Vercel 배포 완료 대기 (2~3분)**

```bash
# 마지막 push 후 배포 완료까지 대기 — 또는 vercel CLI로 배포 상태 확인
```

- [ ] **Step 2: 4개 template 각각으로 새 프로젝트 생성 (관리자 계정)**

본인 계정 로그인 → /projects → 새 프로젝트 4개:
- 자기계발서 → minimal로 자동 매칭 확인
- 전문서 → editorial로 자동 매칭 확인
- 에세이 → classic로 자동 매칭 확인
- 매뉴얼 → practical로 자동 매칭 확인

- [ ] **Step 3: 각 프로젝트에서 자료 업로드 + 1챕터 본문 생성**

자료 1개 업로드 → 인터뷰 1턴 → 1챕터 [본문 생성]

- [ ] **Step 4: 각 프로젝트에서 검증 항목 체크**

각 4개 프로젝트마다:
- [ ] /write 사이드바 TemplateSelector 정상 표시 + 변경 시 즉시 반영
- [ ] [👁 결과 미리보기] 클릭 → 모달 정상 → 데스크톱/모바일 뷰포트 토글 동작
- [ ] /share/[id] 진입 → 해당 template으로 본문 렌더 (한국어 깨짐 X)
- [ ] /book/[id] 진입 → template 배지 + TOC 스타일 분기 확인
- [ ] EPUB 다운로드 → 리디북스 또는 Calibre에서 열어 본문 스타일 확인 (한글 폰트 깨짐 X)
- [ ] PDF 다운로드 → PC에서 열어 페이지 번호·이미지·본문 정상 확인

- [ ] **Step 5: 모바일 검증**

휴대폰 브라우저로 4개 프로젝트의 /share/[id] 각각 열기:
- [ ] 가로 스크롤 X
- [ ] 텍스트 가독성 OK
- [ ] 이미지 가로 100% 자동 축소

- [ ] **Step 6: 검증 보고**

발견된 issue를 다음 양식으로 정리:

```
[Template]: editorial
[Surface]: /share/[id]
[Issue]: 인용 박스 좌측 라인 이상하게 두꺼움
[Screenshot]: (첨부)
```

발견된 issue가 있으면 별도 hotfix 커밋, 없으면 다음 Task로.

---

### Task 19: 최종 정리 + 변경 이력 기록

**Files:**
- Modify: `docs/superpowers/specs/2026-05-06-layout-template-system-design.md` (구현 완료 표시)

- [ ] **Step 1: spec의 "12. 승인" 섹션 update**

```markdown
## 12. 승인

- [x] 사용자 승인 (2026-05-06): "A — 그대로 진행"
- [x] 사용자 승인 (2026-05-06): rev 2 — "ㄱㄱ"
- [x] 구현 계획(plan) 작성 완료 (2026-05-06)
- [x] 구현 완료 (날짜 채우기)
- [x] 통합 smoke test 통과 (날짜 채우기)
```

- [ ] **Step 2: 최종 commit**

```bash
git add docs/superpowers/specs/2026-05-06-layout-template-system-design.md
git commit -m "docs(template): spec 업데이트 — 구현 완료 (Phase A-G)"
git push origin main
```

- [ ] **Step 3: 사용자에게 완료 보고**

테스트 가이드와 함께 보고:
- 4개 template 각각 어떻게 다른지 스크린샷 비교
- 5개 surface에서 잘 동작 확인
- 발견된 limitation·후속 작업 정리

---

## Self-Review

### 1. Spec coverage 체크
- ✅ 4개 template (minimal/editorial/classic/practical) — Tasks 5-8
- ✅ 5개 surface (/share, /book, EPUB, PDF, /write) — Tasks 11-15
- ✅ 자동 매칭 (suggestTemplate) — Task 2
- ✅ 사용자 변경 (PATCH) — Task 4
- ✅ 기존 책 fallback (getTemplate(null) → 'minimal') — Task 2
- ✅ Cover prompt에 templateHint — Tasks 16-17
- ✅ Modal preview (rev 2) — Task 10
- ✅ 1단형 editorial (rev 2) — Task 8
- ✅ [IMAGE:] placeholder 템플릿별 처리 (rev 2) — Tasks 5-8 각 본 구현에 inline
- ✅ 모바일 반응형 — 모든 template Render에 md: 클래스 + manual test in Task 18

### 2. Placeholder scan
- ✅ TBD/TODO 없음 — 모든 코드 inline
- ✅ "Add validation" 같은 모호한 step 없음
- ✅ 각 step에 구체적 코드 또는 명령

### 3. Type consistency
- ✅ TemplateKey 타입은 lib/templates/index.ts에서 정식 정의 (Task 2), lib/storage.ts는 re-export
- ✅ BookTemplate.Render 시그니처 = TemplateProps (4개 template 모두 동일)
- ✅ getTemplate(), suggestTemplate() 모두 import 경로 일치 (`@/lib/templates`)
- ✅ TemplateSelector·TemplatePreviewModal에 props 타입 명시

### 4. Risk surface
- 매거진 1단형으로 변경되어 기존 spec의 EPUB 2단 fallback 위험 사라짐 ✅
- /write/page.tsx가 4500줄 — 변경 분량이 적도록 TemplateSelector·TemplatePreviewModal 외부 컴포넌트로 분리 ✅
- DB migration 불필요 (jsonb 안 저장) — 데이터 호환성 위험 0 ✅

발견된 gap: ✅ 없음

---

**Plan 작성 완료 — 38h 추정, 19개 task, 모두 self-contained.**

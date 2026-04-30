# Sub-project 2 — 책별 색상 테마

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 작가가 책마다 색상 테마를 선택할 수 있게. 6개 preset (orange / blue / green / purple / red / gray). 공유 페이지·읽기 페이지·표지 prompt에 테마 색상 반영.

**디자인 doc 참조:** 회의4 항목 "테마 색상 다양화" — 빠른 win.

**핵심**
- 모든 책이 똑같은 오렌지면 단조로움. 색상으로 차별화 → 작가의 정체성 + 독자가 책 구분 쉬워짐.
- 1-2일 분량. 6개 preset만 — 무한 자유도 X.
- 기존 `tiger-orange` 클래스는 유지 (사이트 default 톤). themeColor는 책 콘텐츠 영역에만 적용.

---

## File Structure

| 파일 | 역할 | 수정 |
|---|---|---|
| `lib/storage.ts` | `ThemeColorKey` 타입 + `BookProject.themeColor?` | 수정 |
| `lib/theme-colors.ts` | 6개 preset 매핑 helper (Tailwind class strings) | 새로 |
| `app/new/page.tsx` | 6 색상 picker (책 생성 폼) | 수정 |
| `app/write/setup/page.tsx` | 색상 변경 picker (작가 setup 후에도 변경 가능) | 수정 |
| `app/share/[id]/page.tsx` | themeColor 적용 (헤더 accent, 챕터 카드 border) | 수정 |
| `app/api/projects/[id]/route.ts` (또는 만들기) | PATCH로 themeColor 업데이트 | 수정/신규 |

---

## Tasks

### Task 1: 타입 + helper

**Files:**
- Modify: `lib/storage.ts`
- Create: `lib/theme-colors.ts`

**`lib/storage.ts`** 수정:

```typescript
export type ThemeColorKey = "orange" | "blue" | "green" | "purple" | "red" | "gray";

export interface BookProject {
  // ... 기존 필드들
  themeColor?: ThemeColorKey;  // default "orange"
}
```

**`lib/theme-colors.ts`** 새로 생성:

```typescript
import type { ThemeColorKey } from "./storage";

// 책별 테마 색상 — 6 presets
// 각 entry는 Tailwind class strings (실제 hex 변경하려면 tailwind.config.ts에서 함)

export interface ThemeClasses {
  // 미리보기용 single hex (UI swatch)
  hex: string;
  // 책 콘텐츠 영역 클래스
  accent: string;          // 강조 텍스트/border (예: "text-orange-600", "border-orange-500")
  accentBorder: string;    // border-l accent
  bg: string;              // 옅은 배경 (헤더, 챕터 카드)
  bgBold: string;          // 진한 배경 (CTA 버튼)
  bgBoldHover: string;     // hover
  textOnBold: string;      // 진한 배경 위 텍스트 (대부분 white)
  ring: string;            // focus ring
  label: string;           // UI 표시용 한국어 이름
}

export const THEME_COLOR_PRESETS: Record<ThemeColorKey, ThemeClasses> = {
  orange: {
    hex: "#f97316",
    accent: "text-orange-600 border-orange-500",
    accentBorder: "border-l-orange-500",
    bg: "bg-orange-50",
    bgBold: "bg-orange-500",
    bgBoldHover: "hover:bg-orange-600",
    textOnBold: "text-white",
    ring: "ring-orange-500/30",
    label: "🟠 오렌지 (기본)",
  },
  blue: {
    hex: "#3b82f6",
    accent: "text-blue-600 border-blue-500",
    accentBorder: "border-l-blue-500",
    bg: "bg-blue-50",
    bgBold: "bg-blue-500",
    bgBoldHover: "hover:bg-blue-600",
    textOnBold: "text-white",
    ring: "ring-blue-500/30",
    label: "🔵 블루",
  },
  green: {
    hex: "#10b981",
    accent: "text-emerald-600 border-emerald-500",
    accentBorder: "border-l-emerald-500",
    bg: "bg-emerald-50",
    bgBold: "bg-emerald-500",
    bgBoldHover: "hover:bg-emerald-600",
    textOnBold: "text-white",
    ring: "ring-emerald-500/30",
    label: "🟢 그린",
  },
  purple: {
    hex: "#8b5cf6",
    accent: "text-violet-600 border-violet-500",
    accentBorder: "border-l-violet-500",
    bg: "bg-violet-50",
    bgBold: "bg-violet-500",
    bgBoldHover: "hover:bg-violet-600",
    textOnBold: "text-white",
    ring: "ring-violet-500/30",
    label: "🟣 퍼플",
  },
  red: {
    hex: "#ef4444",
    accent: "text-red-600 border-red-500",
    accentBorder: "border-l-red-500",
    bg: "bg-red-50",
    bgBold: "bg-red-500",
    bgBoldHover: "hover:bg-red-600",
    textOnBold: "text-white",
    ring: "ring-red-500/30",
    label: "🔴 레드",
  },
  gray: {
    hex: "#6b7280",
    accent: "text-gray-700 border-gray-500",
    accentBorder: "border-l-gray-500",
    bg: "bg-gray-100",
    bgBold: "bg-gray-700",
    bgBoldHover: "hover:bg-gray-800",
    textOnBold: "text-white",
    ring: "ring-gray-500/30",
    label: "⚪ 그레이 (모노)",
  },
};

export function getTheme(key?: ThemeColorKey): ThemeClasses {
  return THEME_COLOR_PRESETS[key ?? "orange"];
}
```

**Tailwind safelist 필요** — `tailwind.config.ts`의 `content` 배열로는 동적 class 안 잡히므로 `safelist` 추가:

```typescript
const config: Config = {
  content: [...],
  safelist: [
    // 책 테마 색상 — 동적 사용 (lib/theme-colors.ts)
    { pattern: /(text|border|bg|ring|hover:bg)-(orange|blue|emerald|violet|red|gray)-(50|100|500|600|700|800)/ },
    { pattern: /border-l-(orange|blue|emerald|violet|red|gray)-500/ },
    { pattern: /ring-(orange|blue|emerald|violet|red|gray)-500\/30/ },
  ],
  // ... 기존 theme
};
```

Commit: `feat(themes): 6개 색상 preset + ThemeColorKey 타입 + safelist`

---

### Task 2: /new — 책 생성 시 색상 선택

**Files:**
- Modify: `app/new/page.tsx`

`useState` 추가:
```typescript
import { THEME_COLOR_PRESETS, type ThemeClasses } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

const [themeColor, setThemeColor] = useState<ThemeColorKey>("orange");
```

`create()` body의 fetch payload에 `themeColor` 추가:
```typescript
body: JSON.stringify({ topic, audience, type, targetPages, tier, noImages, themeColor }),
```

UI: 기존 form 안에 (예: tier 선택 위 또는 아래) 6 swatch picker 추가:

```tsx
<div className="mb-6">
  <label className="block text-xs font-mono uppercase tracking-wider text-gray-600 mb-2">테마 색상</label>
  <div className="grid grid-cols-6 gap-2">
    {(Object.keys(THEME_COLOR_PRESETS) as ThemeColorKey[]).map(key => {
      const t = THEME_COLOR_PRESETS[key];
      const selected = themeColor === key;
      return (
        <button
          key={key}
          type="button"
          onClick={() => setThemeColor(key)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition ${selected ? `border-ink-900 ring-2 ${t.ring}` : 'border-gray-200 hover:border-gray-400'}`}
          title={t.label}
        >
          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: t.hex }}></div>
          <span className="text-[10px] text-gray-700">{t.label.replace(/^[^\s]+\s/, '')}</span>
        </button>
      );
    })}
  </div>
</div>
```

Commit: `feat(ui): /new 책 생성 시 6 색상 테마 선택`

---

### Task 3: /api/projects POST — themeColor 저장

**Files:**
- Modify: `app/api/projects/route.ts` (POST handler)

기존 POST 핸들러에서 body에서 `themeColor` 추출하고 새 BookProject에 포함:

```typescript
const { topic, audience, type, targetPages, tier, noImages, themeColor } = body;
// ...
const newProject = {
  topic, audience, type, targetPages, tier, noImages,
  themeColor: themeColor ?? "orange",
  // ... 기존 필드들
};
```

또 PATCH 또는 PUT 핸들러로 themeColor 변경 endpoint도 필요. 기존 project update 핸들러가 있으면 거기에 themeColor 필드 허용 추가. 없으면 새 PATCH 만들기 (`/api/projects/[id]/route.ts`).

Commit: `feat(api): POST /api/projects themeColor 저장 + 변경 가능`

---

### Task 4: /write/setup — 색상 변경 picker

**Files:**
- Modify: `app/write/setup/page.tsx`

이미 setup 페이지에 references / summary / tone 박스가 있음. 그 위 또는 아래에 작은 색상 picker 추가:

```tsx
<div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-bold text-ink-900">🎨 색상</h3>
    <span className="text-[10px] text-gray-500">언제든 변경 가능</span>
  </div>
  <div className="flex gap-2">
    {(Object.keys(THEME_COLOR_PRESETS) as ThemeColorKey[]).map(key => {
      const t = THEME_COLOR_PRESETS[key];
      const selected = (project?.themeColor ?? "orange") === key;
      return (
        <button
          key={key}
          onClick={() => updateThemeColor(key)}
          className={`w-8 h-8 rounded-full border-2 transition ${selected ? 'border-ink-900 ring-2 ring-offset-1' : 'border-gray-300 hover:border-gray-500'}`}
          style={{ backgroundColor: t.hex }}
          title={t.label}
        />
      );
    })}
  </div>
</div>
```

`updateThemeColor` 함수:

```typescript
const updateThemeColor = async (themeColor: ThemeColorKey) => {
  if (!projectId) return;
  try {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeColor }),
    });
    if (!res.ok) throw new Error("색상 변경 실패");
    setProject((prev: any) => prev ? { ...prev, themeColor } : prev);
  } catch (e: any) {
    setError(e.message);
  }
};
```

Commit: `feat(ui): /write/setup 색상 변경 picker`

---

### Task 5: /share/[id] — themeColor 적용

**Files:**
- Modify: `app/share/[id]/page.tsx`

상단 import:
```typescript
import { getTheme } from "@/lib/theme-colors";
```

ShareData interface에 `themeColor?: string` 추가 (or `ThemeColorKey`).

Render 함수에서 `const theme = getTheme(data.themeColor as any);`

기존 `tiger-orange` 등 책 콘텐츠 영역의 강조 색상을 theme의 클래스로 교체:
- 책 제목 강조: `theme.accent` 활용
- 챕터 카드 border: `theme.accentBorder`
- CTA 버튼: `${theme.bgBold} ${theme.bgBoldHover} ${theme.textOnBold}`
- 헤더 배경: `theme.bg`

전부 다 바꾸지 말고, **가장 눈에 띄는 3-4 군데만** (책 제목 라인 + 챕터 카드 + 메인 CTA + 작가 정보 박스).

Site-wide 헤더(`Header.tsx`)나 nav는 건드리지 말 것 — 사이트 정체성은 오렌지 유지.

또 `/api/share/[id]` (또는 share data fetch route)에서 응답에 `themeColor` 포함되어야 함. 확인 + 필요 시 수정.

Commit: `feat(ui): /share/[id] themeColor 적용 (제목/챕터/CTA)`

---

### Task 6: 빌드 + merge + push

- `npm run build`
- `git checkout main && git merge --ff-only feature/sub2-color-themes && git push origin main`

---

*— end of Sub-project 2 plan*

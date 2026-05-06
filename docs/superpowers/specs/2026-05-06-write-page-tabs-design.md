# /write 페이지 4-탭 재구성 — 설계안

**작성일**: 2026-05-06
**상태**: 사용자 승인 — 구현 계획 단계로 진입 예정
**예상 작업량**: ~38시간 (5일)

---

## 1. 배경 · 목적

`/write/page.tsx`는 현재 **4500+줄, 15개 메인 섹션 + 7개 모달**이 한 화면에 쌓여 있다. 사용자가 "압도적이고 보기 어렵다"고 호소. 사이드바에 본문 작성 도구·마케팅·재가공·번역·매출 입력 등 모든 게 섞여 있어 "지금 뭐 할지" 멘탈 모델이 깨짐.

이 spec은 **4-탭 구조 + 3-column 데스크톱 레이아웃 + 하단 네비 모바일 레이아웃**으로 /write를 재구성한다. 책 만드는 자연스러운 흐름(본문 → 출간 준비 → 확장 → 운영)을 탭으로 매핑해 사용자가 "지금 뭐 할 차례"를 한눈에 알 수 있게 한다.

---

## 2. 범위

### 2.1 포함 (v1)

**4 탭 구성:**
- 📝 **본문** (default 탭)
- 🚀 **출간 준비**
- 🎁 **콘텐츠 확장**
- 📊 **운영**

**적용 범위:**
- `/write/page.tsx` 전체 재구성 (4500줄 → 탭별 컴포넌트로 분리)
- 데스크톱 3-column 레이아웃
- 모바일 하단 5-아이콘 네비 (📚 챕터 / 📝 본문 / 🚀 출간 / 🎁 확장 / 📊 운영)
- URL hash로 탭 persistence (`?tab=writing|publish|extras|ops`)
- 출간 준비 탭에 visual hint (본문 80%+ 완성됐는데 마케팅 카피 없으면 작은 점)

### 2.2 미포함 (Out of scope)

- **/write/setup 페이지** — 자료 업로드·인터뷰 페이지는 별도, 이번 재구성 X
- **새 기능 추가** — 모든 기존 기능 위치만 옮김. 동작·로직 변경 X
- **/share, /book 페이지** — 영향 X
- **API 변경** — 영향 X
- **DB 스키마** — 영향 X
- **챕터 list 디자인 변경** — 컬럼으로 빠지지만 내부 디자인 X
- **분석 대시보드** — 후속 sub-project

---

## 3. 4탭 콘텐츠 분배

### 3.1 📝 본문 탭
| 섹션 | 기존 위치 (line) |
|---|---|
| 액션 버튼 그룹 (전체 일괄 집필) | 1871 |
| 챕터 추가 inline form | 2894 |
| 목차 재생성 버튼 | 1876 |
| 본문 이미지 일괄 (7개) | 1884 (기존 button) |
| 표지 다양화 5종 | 3820 |
| 레이아웃 템플릿 (4 thumbnail) | 1932 |

### 3.2 🚀 출간 준비 탭
| 섹션 | 기존 위치 (line) |
|---|---|
| 마케팅 페이지 (AI 카피·편집·URL 복사) | 1942 |
| 크몽 등록 가이드 (KmongGuideBox) | 1988 |
| Meta 광고 패키지 (1-click) | 2054 |
| Meta 광고 카피만 생성 | 2080 |
| Meta 광고 이미지 3비율 | 2150 |
| 패키지 추천 (Funnel + 1-click bundle) | 3151 |
| 카드뉴스 인포그래픽 5장 | 3281 |
| 미리보기 영상 frames 5장 | 3466 |

### 3.3 🎁 콘텐츠 확장 탭
| 섹션 | 기존 위치 (line) |
|---|---|
| 오디오북 (12챕터 TTS) | 3534 |
| 강의 슬라이드 (10~20장) | 3591 |
| 책 번역 (영/일) | 2611 |
| 콘텐츠 재가공 5채널 | 2276 |

### 3.4 📊 운영 탭
| 섹션 | 기존 위치 (line) |
|---|---|
| 공유 링크 토글 | 1915 |
| A/B 테스트 (Wave B5) | 3372 |
| 매출 입력 | 2701 |
| 크몽 패키지 생성 (sidebar 액션 버튼 중) | 1884 |

### 3.5 탭 무관 (항상 보임)

- **상단 헤더**: 책 제목·"내 책으로" 링크·잔액·"내보내기" 버튼
- **챕터 목록**: 데스크톱 왼쪽 column / 모바일 5번째 📚 챕터 탭
- **본문 영역 (선택된 챕터 + 컨트롤 버튼)**: 데스크톱 가운데 column / 모바일 📝 본문 탭
- **모달들**: AI 수정 요청 · 챕터 이어쓰기 · 레이아웃 미리보기 · 표지 다양화 · 표지 5장 비교 · 챕터 제목 편집 · ConfirmModal — 어디서든 호출 가능

---

## 4. 데스크톱 레이아웃

### 4.1 구조

```
┌──────────────────────────────────────────────────────────┐
│  Top Header (sticky)                                      │
│  ← 내 책 │ 책 제목                  잔액 ₩X · [내보내기] │
├──────────────────────────────────────────────────────────┤
│             │                              │              │
│  📚 챕터    │   📝 본문 영역                │  탭 바      │
│  목록       │                              │  ━━━━━━━━━ │
│  300px      │   1장 · CHAPTER 1            │  📝 본문    │
│             │                              │  (활성)     │
│  1. 왜 당신 │   왜 당신의 전자책 쓰기는    │             │
│  2. 시작과  │   작심삼일로 끝납니까        │  [도구들]   │
│  3. AI 도커 │                              │             │
│  ...        │   [👁 미리보기] [💬 수정]    │  · 전체일괄 │
│  12. 어떤   │   [✏️ 직접 수정] [🔄 다시]   │  · 목차재생 │
│             │                              │  · 본문이미 │
│             │   본문 텍스트 ...            │  · 표지다양 │
│  + 챕터 추가│                              │  · 레이아웃 │
│             │                              │             │
│             │                              │  380px      │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Grid 정의

```css
/* /write 컨테이너 */
.write-page {
  display: grid;
  grid-template-columns: 300px 1fr 380px;
  height: calc(100vh - 64px); /* header 제외 */
  gap: 0;
}
@media (max-width: 1023px) {
  .write-page {
    grid-template-columns: 1fr; /* 모바일은 single column */
  }
}
```

### 4.3 각 column 동작

- **왼쪽 (챕터 목록)**: `border-right`, `overflow-y: auto`. 챕터 클릭 시 본문 영역에 해당 챕터 표시
- **가운데 (본문)**: `overflow-y: auto`. 챕터 컨트롤 버튼은 본문 위에 sticky
- **오른쪽 (탭 영역)**: `border-left`. 탭 바 sticky top, 탭 콘텐츠 scroll

---

## 5. 모바일 레이아웃

### 5.1 구조

```
┌─────────────────────┐
│ Top Header (sticky) │
├─────────────────────┤
│                     │
│   현재 활성 탭의    │
│   콘텐츠 (전체 폭)  │
│                     │
│                     │
│                     │
├─────────────────────┤
│ Bottom Nav (sticky) │
│ 📚 📝* 🚀 🎁 📊    │
└─────────────────────┘
```

### 5.2 5개 탭 (📚 챕터 추가)

| 아이콘 | 라벨 | 내용 |
|---|---|---|
| 📚 | 챕터 | 챕터 목록 (왼쪽 column에 해당) |
| 📝 | 본문 | 선택된 챕터 본문 + 컨트롤 + 본문 만들기 도구 (default) |
| 🚀 | 출간 | 출간 준비 도구들 |
| 🎁 | 확장 | 콘텐츠 확장 도구들 |
| 📊 | 운영 | 운영 도구들 |

### 5.3 Bottom nav 스펙

```css
.mobile-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 64px;
  display: flex;
  background: white;
  border-top: 1px solid #e5e7eb;
  z-index: 50;
}
.mobile-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 0;
  font-size: 10px;
  min-height: 44px; /* WCAG tap target */
}
.mobile-nav-item.active { color: #f97316; font-weight: bold; }
@media (min-width: 1024px) { .mobile-nav { display: none; } }
```

키보드 input focus 시 bottom nav hide:
```typescript
// 폼 입력 시 viewport 가려지지 않게
useEffect(() => {
  const handleFocus = () => document.body.classList.add('input-focused');
  const handleBlur = () => document.body.classList.remove('input-focused');
  document.addEventListener('focusin', handleFocus);
  document.addEventListener('focusout', handleBlur);
  return () => { /* cleanup */ };
}, []);
// CSS: .input-focused .mobile-nav { display: none; }
```

---

## 6. 탭 전환 동작

### 6.1 URL hash 동기화

탭 상태는 URL search param으로 저장:
```
/write?id=abc123              # default 본문 탭
/write?id=abc123&tab=writing  # 본문 (명시)
/write?id=abc123&tab=publish  # 출간 준비
/write?id=abc123&tab=extras   # 콘텐츠 확장
/write?id=abc123&tab=ops      # 운영
/write?id=abc123&tab=chapters # 모바일 전용 (📚 챕터)
```

타입 정의:
```typescript
type TabKey = "writing" | "publish" | "extras" | "ops" | "chapters";
const VALID_TABS: TabKey[] = ["writing", "publish", "extras", "ops", "chapters"];
```

탭 변경 시 `router.replace`로 URL 업데이트(history 안 쌓이게):
```typescript
const setTab = (tab: TabKey) => {
  const params = new URLSearchParams(searchParams);
  params.set("tab", tab);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
};
```

### 6.2 Default 탭

- `?tab=` 없거나 invalid 값이면 → `writing` (본문)
- 모바일에서도 default `writing` (5번째 챕터 탭은 명시적 선택만)

### 6.3 전환 애니메이션

탭 콘텐츠 전환 시 200ms fade:
```css
.tab-content {
  animation: fade-in 200ms ease-out;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 6.4 Visual hint (점 표시)

탭 라벨 옆에 작은 주황 점 표시 (사용자 주의 끌기):
- 🚀 출간 준비 탭에 점 → 본문 80%+ 완성됐는데 마케팅 카피(`marketingMeta.tagline`) 없을 때

운영 탭 hint는 v1에서 제외 (출간일 필드가 BookProject에 없어 정의 모호 — 후속 sub-project로 검토).

```typescript
function shouldHintPublish(project: BookProject): boolean {
  if (!project.chapters?.length) return false;
  const completedChapters = project.chapters.filter(c => (c.content?.length ?? 0) > 100).length;
  const ratio = completedChapters / project.chapters.length;
  const hasMarketing = !!project.marketingMeta?.tagline;
  return ratio >= 0.8 && !hasMarketing;
}
```

---

## 7. 기술 아키텍처

### 7.1 파일 구조

신규 파일:
```
app/write/
├── page.tsx                       # entry, 4-탭 라우팅 + 데이터 로드
├── _components/
│   ├── WritePageLayout.tsx        # 3-column / 모바일 단일 column 분기
│   ├── TabBar.tsx                 # 데스크톱 4탭 + 모바일 5탭 통합
│   ├── MobileBottomNav.tsx        # 모바일 하단 5-아이콘
│   ├── TopHeader.tsx              # 책 제목·잔액·내보내기 (sticky top)
│   ├── ChapterList.tsx            # 좌측 column / 모바일 챕터 탭
│   ├── ChapterContent.tsx         # 가운데 column / 모바일 본문 탭
│   └── tabs/
│       ├── WritingTab.tsx         # 본문 도구 (전체일괄·목차·이미지·표지·템플릿)
│       ├── PublishTab.tsx         # 출간 준비
│       ├── ExtrasTab.tsx          # 콘텐츠 확장
│       └── OpsTab.tsx             # 운영
└── _hooks/
    ├── useTabState.ts             # URL hash 동기화 + active tab
    └── usePublishHint.ts          # 출간 준비 탭 점 표시 로직
```

수정 파일:
- 모달들은 `app/write/_modals/`로 분리 (선택, v2)

### 7.2 컴포넌트 트리

```
<WritePage>                       // page.tsx
  ├── <TopHeader />
  └── <WritePageLayout>
       ├── 데스크톱: <ChapterList /> + <ChapterContent /> + <TabContent />
       └── 모바일: 활성 탭 1개만 + <MobileBottomNav />
       
  <TabContent>
    ├── tab="writing": <WritingTab />
    ├── tab="publish": <PublishTab />
    ├── tab="extras": <ExtrasTab />
    └── tab="ops":     <OpsTab />
  
  <ChapterContent>
    └── (기존 챕터 본문 + 컨트롤 버튼)
  
  // 모달들 (탭과 독립, 어디서든 호출)
  // v1에서는 모달들을 별도 컴포넌트로 추출 X — page.tsx 안에 inline JSX 그대로 유지.
  // 추출은 후속 sub-project (12. 후속 작업 참조).
  // editChat 모달, continueModal, previewModal, 표지 다양화 모달, 챕터 제목 편집 모달, ConfirmModal 모두
  // page.tsx 최상위 JSX에 conditional render — 어떤 탭에서도 state 접근 가능.
```

### 7.3 State 흐름

기존 useState들은 page.tsx에 유지하고, props로 탭별 컴포넌트에 내려줌. v1에서는 Context API 도입 X (YAGNI).

```typescript
export default function WritePage() {
  const [project, setProject] = useState<BookProject | null>(null);
  // ... 기존 state 그대로 유지
  
  const tab = useTabState();
  const showHint = usePublishHint(project);
  
  return (
    <>
      <TopHeader project={project} ... />
      <WritePageLayout tab={tab} setTab={setTab}>
        <ChapterList chapters={project?.chapters ?? []} ... />
        <ChapterContent chapter={...} onEdit={...} ... />
        <TabContent tab={tab}>
          {tab === "writing" && <WritingTab projectId={projectId} ... />}
          {tab === "publish" && <PublishTab projectId={projectId} ... />}
          {tab === "extras" && <ExtrasTab projectId={projectId} ... />}
          {tab === "ops" && <OpsTab projectId={projectId} ... />}
        </TabContent>
        <MobileBottomNav active={tab} setTab={setTab} hints={{ publish: showHint }} />
      </WritePageLayout>
      
      {/* 모달들 — 탭 무관 */}
      {previewModal && <TemplatePreviewModal ... />}
      {editChat && <AIEditModal ... />}
      ...
    </>
  );
}
```

---

## 8. 마이그레이션 전략

### 8.1 점진적 분리

4500줄 한 번에 분리하면 회귀 위험 큼. 단계적:

1. **Phase 1**: `useTabState` 훅 + URL hash 동기화 + 더미 4-탭 라우팅 — 기존 사이드바는 그대로 (탭 동작만 검증)
2. **Phase 2**: 새 layout 컴포넌트 (`WritePageLayout`, `TopHeader`, `MobileBottomNav`)
3. **Phase 3**: 챕터 목록·본문 영역 분리 (`ChapterList`, `ChapterContent`)
4. **Phase 4**: 4개 탭 컴포넌트 분리 (한 탭씩) — 한 탭 분리 후 검증, 다음 탭
5. **Phase 5**: 시각 마무리 (애니메이션·hint·polish) + 모달 정리

각 Phase 끝마다 commit + Vercel preview 검증.

### 8.2 Backwards compat

- 기존 URL `https://...vercel.app/write?id=abc123` 그대로 동작 (default 본문 탭)
- 새 URL `?tab=publish` 등은 추가 옵션
- 사용자 muscle memory: 모든 기능이 4개 탭 중 하나로 이동했지만 동작·호출 방식 동일

### 8.3 Feature flag X

이 변경은 UI 재구성이라 partial rollout 의미 없음. main에 merge하면 모든 사용자에게 적용.

---

## 9. 모바일 키보드 처리

`<input>`/`<textarea>`에 focus 시 모바일 가상 키보드가 화면 하단을 가린다. 이때 bottom nav가 키보드와 겹치면 사용자 혼란.

해결: focus 시 `body.input-focused` 클래스 추가, CSS로 bottom nav hide.

```typescript
// _components/MobileBottomNav.tsx
useEffect(() => {
  let timeout: NodeJS.Timeout;
  const handleFocusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") {
      document.body.classList.add("input-focused");
    }
  };
  const handleFocusOut = () => {
    timeout = setTimeout(() => {
      if (!document.querySelector("input:focus, textarea:focus")) {
        document.body.classList.remove("input-focused");
      }
    }, 100);
  };
  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("focusout", handleFocusOut);
  return () => {
    clearTimeout(timeout);
    document.removeEventListener("focusin", handleFocusIn);
    document.removeEventListener("focusout", handleFocusOut);
  };
}, []);
```

```css
@media (max-width: 1023px) {
  body.input-focused .mobile-nav { display: none; }
}
```

---

## 10. 작업 분해

| # | 작업 | 시간 |
|---|---|---|
| 1 | `useTabState` 훅 + URL hash 동기화 + TabKey type | 2h |
| 2 | 데스크톱 3-column 레이아웃 (`WritePageLayout`) | 4h |
| 3 | `TopHeader` 컴포넌트 분리 | 2h |
| 4 | `ChapterList` 컴포넌트 분리 (왼쪽 column) | 4h |
| 5 | `ChapterContent` 컴포넌트 분리 (가운데 column) | 4h |
| 6 | `MobileBottomNav` + 키보드 hide 처리 | 4h |
| 7 | `WritingTab` 분리 (기존 사이드바 본문 관련 섹션 이전) | 4h |
| 8 | `PublishTab` 분리 (마케팅·Meta·인포그래픽·미리보기 영상·패키지) | 4h |
| 9 | `ExtrasTab` 분리 (오디오·슬라이드·번역·재가공) | 4h |
| 10 | `OpsTab` 분리 (공유·A/B·매출·크몽 패키지) | 2h |
| 11 | `usePublishHint` 훅 + 점 표시 UI | 2h |
| 12 | 통합 테스트 + 모바일 검증 + 폴리시 | 6h |
| | **합계** | **~38h ≈ 5일** |

---

## 11. 위험·완화

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| 4500줄 분리 시 state 동기화 깨짐 | 높음 | 높음 | 점진적 분리 (탭별 단계) + commit별 검증 |
| 기존 사용자 muscle memory 깨짐 | 중 | 중 | 모든 기능 위치만 옮김, 동작 동일 |
| 모바일 bottom nav가 input과 겹침 | 중 | 중 | input focus 시 hide |
| 챕터 목록·본문·도구 state 동기화 (3 components) | 중 | 중 | URL param이 단일 source (chapter id, tab) |
| Tab 전환 애니메이션이 무거움 | 낮 | 낮 | 200ms fade만 (transform·opacity 위주) |
| 모달들이 어느 탭에서든 호출 안 될 수 있음 | 중 | 중 | 모달은 page.tsx 최상위에 mount, 어떤 탭에서든 동일 state 접근 |

---

## 12. 후속 sub-project (out of scope)

이 spec 끝나면 다음 가능:
- **Visual hint 확장** — 본문 탭에도 "다음 할 일" 가이드 (예: "1장 본문 만들기" → 2장 → ...)
- **모달 분리** — 7개 모달을 `_modals/` 디렉토리로 정리 (코드 위생)
- **사이드바 폴딩** — 사용자가 도구 탭 폴딩 가능 (책상 폼 모드)
- **분석 대시보드** — 운영 탭 안에 책별 매출·전환율 차트

---

## 13. 승인

- [x] 사용자 승인 (2026-05-06): 단계별 분류 ① 선택
- [x] 사용자 승인 (2026-05-06): 4탭 콘텐츠 분배 OK
- [x] 사용자 승인 (2026-05-06): 데스크톱 3-column OK
- [x] 사용자 승인 (2026-05-06): 모바일 하단 네비 ① 선택
- [x] 사용자 승인 (2026-05-06): 최종 설계안 A 그대로 진행
- [ ] 구현 계획(plan) 작성 완료
- [ ] 구현 시작

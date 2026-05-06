# 레이아웃 템플릿 시스템 — 설계안

**작성일**: 2026-05-06 (rev 2)
**상태**: 사용자 승인 — 구현 계획 단계로 진입 예정
**예상 작업량**: ~38시간 (4~5일)

**rev 2 변경 (2026-05-06)**:
- 편집 화면 미리보기 split panel → 모달 변경 (-5h, UX 거의 동일, 모바일 단순화)
- Editorial Magazine 2단 → 1단형 (큰 이미지 + 인라인 인용 박스) — EPUB·모바일까지 일관 (-1h)
- `[IMAGE:]` placeholder 처리 명시 (template별 다른 렌더링) — section 4.5.7 추가 (작업 시간은 각 template 작업에 흡수)
- 총 작업량 40h → 38h (약 2h 절감)

---

## 1. 배경 · 목적

Tigerbookmaker는 현재 **단일 레이아웃**으로 모든 책을 렌더링한다. FlipHTML5 같은 글로벌 경쟁사가 28가지 책 유형 + 다양한 시각 템플릿을 제공하는 것에 비해 시각 자유도가 명확한 약점이다.

이 spec은 **4가지 레이아웃 템플릿 시스템**을 도입해, 같은 본문도 책 장르·목적에 맞춰 다른 시각 정체성으로 보이게 한다. 한국 전자책 시장의 주요 장르(자기계발·실용·에세이·매뉴얼)를 모두 커버하는 것이 목표다.

---

## 2. 범위

### 2.1 포함 (v1)

4가지 레이아웃 템플릿:

| Key | 이름 | 어울리는 장르 | 핵심 시각 |
|---|---|---|---|
| `minimal` | 모던 미니멀 | 자기계발·실용서·재테크 | 1단, sans-serif (Pretendard), 큰 여백 |
| `editorial` | 에디토리얼 매거진 | 비즈니스·전문서·트렌드·인터뷰 | 1단 (큰 이미지 풀폭 + 본문) + 인라인 인용 박스 (강조 컬러 좌측 라인) |
| `classic` | 클래식 도서 | 에세이·웹소설·인문·자서전 | 1단, serif (Noto Serif KR), 챕터 시작 큰 첫글자 |
| `practical` | 실용 가이드 | 매뉴얼·요리·여행·튜토리얼 | 1단 + 박스, sans-serif, 체크리스트·인용 박스 강조 |

적용 surface 5곳:
1. `/share/[id]` — 본문 읽기 페이지
2. `/book/[id]` — 마케팅 랜딩 페이지의 책 미리보기 영역
3. EPUB 다운로드 파일 (`/api/export/epub`)
4. PDF 다운로드 파일 (`lib/export-pdf.ts`)
5. `/write` 편집 화면 — 사이드바 [👁 미리보기] 버튼 → 모달로 현재 챕터 렌더링

### 2.2 미포함 (Out of scope)

- **챕터별 다른 템플릿** — 한 책은 한 템플릿만 사용 (YAGNI)
- **사용자 정의 CSS** — preset 4개만 제공
- **추가 템플릿** — 5번째 이후는 후속 spec
- **flipbook 인터랙티브 뷰어** — 별도 sub-project
- **멀티미디어 임베드** — 별도 sub-project
- **새 책 유형** — 7개 그대로 유지 (확장은 별도 sub-project)

---

## 3. 사용자 흐름

### 3.1 신규 프로젝트
1. `/projects` → 새 프로젝트 생성
2. 책 유형 선택 (예: 자기계발서)
3. 시스템이 `template` 컬럼에 자동으로 추천값 저장 (자기계발서 → `minimal`)
4. 사용자가 명시적 선택 안 해도 OK

### 3.2 편집 중 템플릿 변경
1. `/write` 진입
2. 우측 사이드바 `📐 템플릿` 섹션에 4개 thumbnail 표시
3. 현재 선택된 템플릿 강조
4. 다른 thumbnail 클릭 → 즉시 변경 + DB 업데이트
5. `[👁 결과 미리보기]` 버튼 → 모달에 현재 챕터를 선택된 template으로 풀 렌더링 표시. 닫으면 편집 화면 복귀.

### 3.3 기존 책 (마이그레이션)
1. DB 컬럼 추가 시 기존 row의 `template` 컬럼은 NULL
2. 코드에서 NULL인 경우 자동으로 `minimal`로 fallback (현재 모습과 가장 유사)
3. 사용자가 원하면 변경 가능

### 3.4 자동 매칭 규칙

| project.type | 자동 추천 template |
|---|---|
| 자기계발서 / 실용서 / 재테크 | `minimal` |
| 전문서 | `editorial` |
| 에세이 / 웹소설 | `classic` |
| 매뉴얼 | `practical` |

(사용자가 종류를 변경해도 자동 재매칭은 X — 한 번 선택된 template은 사용자가 명시 변경할 때만 바뀜)

---

## 4. 기술 아키텍처

### 4.1 새 파일

```
lib/templates/
├── index.ts          # registry, types, 자동 매칭 함수, getTemplate()
├── minimal.tsx       # Modern Minimal renderer + epubCss + pdfWrapper
├── editorial.tsx     # Editorial Magazine
├── classic.tsx       # Classic Book
├── practical.tsx     # Practical Guide
└── shared.css        # 공통 reset + 변수
```

### 4.2 인터페이스

```typescript
// lib/templates/index.ts

export type TemplateKey = 'minimal' | 'editorial' | 'classic' | 'practical';

export interface TemplateProps {
  chapter: { title: string; subtitle?: string; content: string; images?: ChapterImage[] };
  theme: ThemeClasses;          // 기존 lib/theme-colors.ts 재사용
  coverImage?: { base64: string };
}

export interface BookTemplate {
  key: TemplateKey;
  label: string;                            // "모던 미니멀"
  description: string;                      // 사이드바 표시
  thumbnailSvg: string;                     // 사이드바 미리보기 (인라인 SVG 문자열)
  suggestedFor: BookType[];                 // 자동 매칭
  Render: React.FC<TemplateProps>;          // 웹용 React 렌더
  epubCss: string;                          // EPUB <style> 임베드
  pdfHtmlWrapper: (innerHtml: string, theme: ThemeClasses) => string;  // PDF용 HTML 생성
  coverStyleHint: string;                   // cover 생성 prompt에 추가될 영문 힌트
}

export const TEMPLATES: Record<TemplateKey, BookTemplate>;

export function getTemplate(key: TemplateKey | null | undefined): BookTemplate;
// key가 null/undefined면 'minimal' 반환

export function suggestTemplate(bookType: BookType): TemplateKey;
// project.type → 자동 매칭 키
```

### 4.3 DB 스키마

```sql
-- migration: add template column
ALTER TABLE book_projects
  ADD COLUMN template TEXT DEFAULT 'minimal';

-- 기존 row는 default 'minimal'로 채워짐
-- 새로 추가되는 row는 신규 프로젝트 생성 API에서 suggestTemplate() 결과로 채움
```

Drizzle ORM 정의도 `db/schema.ts`에 동일 추가.

### 4.4 API 변경

| 라우트 | 변경 |
|---|---|
| `POST /api/projects` (신규 생성) | 응답 + DB INSERT 시 `template = suggestTemplate(type)` |
| `GET /api/projects/[id]` | 응답에 `template` 포함 |
| `PATCH /api/projects/[id]` | body에 `template` 받으면 whitelist 검증 후 업데이트 |
| 기타 generate 라우트 | 변경 없음 (template은 렌더링 단계에서만 사용) |

### 4.5 Surface별 변경

#### 4.5.1 `/write/page.tsx`
- 사이드바에 `<TemplateSelector />` 컴포넌트 추가 (썸네일 4개, 현재 선택 강조, 클릭 시 PATCH)
- `[👁 결과 미리보기]` 버튼 → `<TemplatePreviewModal />` 컴포넌트 띄움
- 모달 안에서 선택된 template의 `Render`로 현재 챕터 풀 렌더링 (반응형 + 모바일 viewport 토글 옵션)
- 모달 닫으면 편집 화면 그대로 복귀
- split panel 안 사용 — `/write/page.tsx` 4500줄 + 모바일 대응 복잡도 회피

#### 4.5.2 `/share/[id]/page.tsx`
- 책 본문 영역을 `getTemplate(book.template).Render` 로 동적 분기
- 챕터 navigation은 그대로 유지 (template과 독립)

#### 4.5.3 `/book/[id]/page.tsx`
template은 마케팅 페이지의 일부 시각 요소에도 영향을 준다(전체 레이아웃 X, 톤 일관성 위해):
- **목차 영역**: template 따라 스타일 변화
  - `minimal`: 단순 번호 리스트
  - `editorial`: 챕터 카드 + 큰 챕터 이미지 thumbnail
  - `classic`: 세리프 폰트 + 점선 leader
  - `practical`: 체크박스 형태
- **챕터 시작 prefix 텍스트**: template.label 노출 (예: "📐 매거진 스타일로 작성됨")
- 표지·tagline·작가소개 영역은 template 영향 X (기존 그대로)
- 책 본문 샘플 미리보기는 v2에서 추가 예정 (이때 template.Render 재사용)

#### 4.5.4 EPUB export (`/api/export/epub/route.ts`)
- 챕터 HTML 생성 시 `getTemplate(book.template).epubCss`를 `<style>` 태그에 임베드
- 4개 template 모두 1단 (editorial 1단형으로 변경됨) — EPUB 뷰어 호환 OK
- editorial 인용 박스·classic 첫글자·practical 체크리스트 박스 모두 EPUB CSS 보수적 범위 내에서 동작

#### 4.5.5 PDF export (`lib/export-pdf.ts`)
- HTML 래퍼 생성 시 `getTemplate(book.template).pdfHtmlWrapper(content, theme)` 사용
- Chrome headless로 print → 풀 레이아웃 가능 (2단 정상)

#### 4.5.6 Cover 생성 prompt
- `lib/server/image-prompt-ai.ts`의 `generateImagePromptAI()` 함수에 새 옵션 `templateHint?: string` 추가
- `app/api/generate/cover-variations/route.ts`, `app/api/generate/meta-images/route.ts`,
  `app/api/generate/image-refine/route.ts`, `app/api/generate/kmong-package/route.ts`에서
  호출 시 `templateHint: getTemplate(project.template).coverStyleHint` 전달
- `generateImagePromptAI` 내부에서 system/user prompt에 `templateHint` 문장 1줄 합성
  - 예: `coverStyleHint: "Editorial magazine style, bold serif title, asymmetric composition, large abstract photo background."`
- 챕터 본문 삽화(`app/api/generate/chapter-image/route.ts`)는 template 영향 X (본문 안 일러스트는 책 전체 톤보다 챕터 내용에 더 의존)

#### 4.5.7 본문 안 `[IMAGE: ...]` placeholder 렌더링 (template별 다름)

각 template Render 컴포넌트가 본문 파싱할 때 `[IMAGE: 캡션]` 발견 시 해당 chapter.images에서 매칭된 이미지를 template-specific 스타일로 렌더링한다.

| Template | 이미지 렌더링 |
|---|---|
| `minimal` | 가운데 정렬, max-width 70%, 캡션 작게 회색 가운데 |
| `editorial` | 풀폭 (가로 100%), aspect-ratio 16:9 권장, 캡션 좌측 강조 컬러 라인 + 굵은 폰트 |
| `classic` | 본문 흐름 안 작게 (max-width 50%), 캡션 이탤릭 세리프 가운데 |
| `practical` | 강조 컬러 프레임 박스 + "그림 N." prefix 캡션 + 본문 위·아래 명확한 구분선 |

이미지가 없으면 placeholder 자체는 표시 안 함 (현재 동작 유지). EPUB·PDF 모두 동일 처리 (CSS 클래스로 구분).

### 4.6 타입 안전성

- `BookProject` 타입 (lib/storage.ts)에 `template: TemplateKey` 필드 추가
- TypeScript strict — 모든 surface에서 컴파일 시 검증

---

## 5. 데이터 흐름

```
신규 프로젝트 생성:
  사용자 → POST /api/projects {type: "자기계발서"}
       → suggestTemplate("자기계발서") = "minimal"
       → INSERT book_projects (..., template = "minimal")
       → 응답 {id, ..., template: "minimal"}

편집 중 템플릿 변경:
  사용자 → 사이드바에서 "Editorial Magazine" 클릭
       → PATCH /api/projects/[id] {template: "editorial"}
       → UPDATE book_projects SET template = 'editorial'
       → frontend state 업데이트 → 미리보기 패널 즉시 재렌더

읽기:
  /share/[id] → fetch /api/projects/[id]
            → getTemplate(book.template).Render({chapter, theme})
            → React 컴포넌트 트리에서 template-specific 렌더

EPUB 다운로드:
  사용자 → GET /api/export/epub?id=...
       → fetch project, get template
       → epub-gen-memory에 chapters HTML + getTemplate().epubCss 임베드
       → 다운로드
```

---

## 6. 마이그레이션 전략

### 6.1 DB 마이그레이션
1. 새 migration 파일 작성: `db/migrations/0011_add_template.sql`
   ```sql
   ALTER TABLE book_projects ADD COLUMN template TEXT DEFAULT 'minimal';
   ```
2. Drizzle schema 갱신
3. Vercel 배포 시 자동 적용 (또는 수동 SQL)

### 6.2 코드 마이그레이션
- `getTemplate()` 호출 시 NULL/undefined → 'minimal' fallback (이중 안전망)
- 기존 책의 시각이 갑자기 바뀌지 않음 (minimal이 현재 모습과 가장 유사)
- 사용자가 변경하면 즉시 새 template 적용

### 6.3 무중단 배포 가능 여부
- DB ADD COLUMN with DEFAULT는 무중단 가능
- 코드 배포 후 즉시 동작 (NULL fallback이 있으니 마이그레이션 순서 무관)

---

## 7. 모바일 반응형

| 템플릿 | 모바일 처리 |
|---|---|
| minimal | 그대로 (이미 1단) |
| editorial | 그대로 (1단형으로 변경됨, 큰 이미지는 가로 100% 자동 축소) |
| classic | 그대로 (이미 1단) |
| practical | 그대로 (이미 1단, 박스 padding만 줄임) |

CSS 미디어 쿼리(`@media (max-width: 768px)`) 또는 Tailwind 반응형 클래스로 처리. 4개 template 모두 1단 기반이라 반응형 단순.

EPUB은 뷰어 width가 제각각이라 모든 이미지·박스가 자연스럽게 흐르도록 max-width 100% 기본 설정.

---

## 8. 테스트 전략

### 8.1 컴포넌트 단위
- 4개 template Render 컴포넌트 각각 → 샘플 chapter props로 렌더 → snapshot
- 모바일 뷰포트(390px)·태블릿(768px)·데스크톱(1280px) 3종 viewport snapshot

### 8.2 통합
- 신규 프로젝트 생성 → DB에 template 자동 저장 검증
- PATCH로 template 변경 → DB 업데이트 + 응답 검증
- /share/[id] → 4개 template 각각 렌더 정상

### 8.3 EPUB/PDF
- 각 template으로 EPUB·PDF 1번씩 생성 → 파일 정상 열리는지 + 한글 폰트 깨짐 X 수동 검증

### 8.4 마이그레이션
- 기존 책 (template NULL) → /share에서 'minimal'로 정상 fallback
- 사용자가 변경 → 정상 반영

---

## 9. 작업 분해

| # | 작업 | 시간 |
|---|---|---|
| 1 | DB migration + schema + API 라우트 변경 (POST·GET·PATCH) | 3h |
| 2 | `lib/templates/index.ts` registry + types + 매칭 함수 | 1h |
| 3 | `lib/templates/minimal.tsx` (가장 단순, 기준점) + `[IMAGE:]` 처리 | 2h |
| 4 | `lib/templates/classic.tsx` + `[IMAGE:]` 처리 | 2h |
| 5 | `lib/templates/practical.tsx` + `[IMAGE:]` 처리 | 2h |
| 6 | `lib/templates/editorial.tsx` (1단형) + 큰 이미지·인용 박스 + `[IMAGE:]` | 2h |
| 7 | 사이드바 `<TemplateSelector />` UI + 자동 매칭 호출 | 4h |
| 8 | `<TemplatePreviewModal />` (모달, 모바일 viewport 토글 옵션) | 3h |
| 9 | `/share/[id]` template 분기 적용 | 2h |
| 10 | `/book/[id]` template 목차 스타일·label 적용 | 2h |
| 11 | EPUB export — epubCss 통합 | 4h |
| 12 | PDF export — pdfHtmlWrapper 통합 | 4h |
| 13 | Cover prompt에 templateHint 추가 (4개 라우트) + 검증 | 2h |
| 14 | 통합 테스트 + 모바일 검증 + 폴리시 | 5h |
| | **합계** | **38h ≈ 4~5일** |

---

## 10. 위험 · 완화

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| EPUB 뷰어별 CSS 호환 차이 | 높음 | 중 | 1단 fallback + 보수적 CSS만 사용 |
| 미리보기 모달이 큰 챕터에서 느림 | 낮 | 낮 | 모달 lazy mount, 한 챕터만 렌더 (전체 책 X) |
| ~~매거진 2단 한국어 줄바꿈 어색~~ | — | — | (1단형으로 변경되어 위험 해소) |
| 기존 책의 시각이 갑자기 바뀜 | 낮 | 높 | 'minimal'이 현재 모습과 거의 동일하게 설계 |
| 템플릿마다 cover prompt 일관성 X | 중 | 중 | coverStyleHint를 통합된 공통 prompt builder에 넣음 |

---

## 11. 후속 sub-project (out of scope)

이 spec 끝나면 다음 순서로 가능:
- **컬러 시스템 강화** (1일) — 6 preset → 12+, hex picker, 장르별 자동
- **책 유형 확장** (1~2일) — 7 → 18 (요리·여행·매거진·룩북 등 추가)
- **flipbook 인터랙티브 뷰어** (4~5일)
- **멀티미디어 임베드** (2~3일)

---

## 12. 승인

- [x] 사용자 승인 (2026-05-06): "A — 그대로 진행"
- [ ] 구현 계획(plan) 작성 완료
- [ ] 구현 시작

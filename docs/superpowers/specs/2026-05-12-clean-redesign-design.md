# Tigerbookmaker 깔끔하게 정리 — 설계안 v2

**작성일**: 2026-05-12 (v1) → **2026-05-12 v2 갱신** (12 포인트 founder feedback 반영)
**상태**: 사용자 검토 대기
**예상 작업량**: ~10일 (7개 PR로 분할)

---

## 1. 배경 · 목적

베타 운영 결과 책 1권을 끝까지 완성한 사용자가 아직 없음 (CEO 본인 외 0건). 그럼에도 사이트는 라우트 87개, UI 페이지 30+개, 기능 60+를 가지고 있어 **첫 책 완성 흐름이 사이드 기능에 가려져 있음**.

**v2 갱신 핵심 통찰**:
> "tigerbookmaker는 AI 책 작성 도구가 아니라, **책 팔고 싶은/파는 사람들을 위한 부수익 시스템**이다. 글만 만들어주면 부족하다."

이 spec은 사이트를 다음 5가지 방향으로 동시 재정리한다.

1. **기능 cut + 부가기능 강화**: 87 라우트 → 16개, 60+ 기능 → 27개. 책 완성 + 판매 부가기능에 집중.
2. **디자인 일관성**: 9 컬러 토큰 (주황 단독 → 액센트 3색 추가) / 5 타이포 / 3 컴포넌트.
3. **모바일 우선**: 핵심 5 페이지 phone-first.
4. **이미지 군더더기 제거**: 표지 SVG 7→3, mock 박스 제거.
5. **책 팔기 부가기능**: 메타 광고 이미지, 상세페이지, ROI 피드백, 다중 플랫폼.

타겟 페르소나는 **직장인 부수익러** (크몽·부크크·유페이퍼에서 책 판매하려는 30대 직장인). 별도 타겟 깊이 파기 brainstorm은 다음 세션.

---

## 2. 범위

### 2.1 포함 (v2)

**기능 정리**:
- 60+ 기능 → 27개로 cut/defer
- 30+ UI 페이지 → 16개
- DB 스키마는 그대로 유지 (defer = 코드/라우트 살려두고 메뉴 노출만 제거)

**디자인 시스템**:
- 9 컬러 토큰 (주황 + 3 액센트) + `tailwind.config.ts` 정리
- 3 공통 컴포넌트 (`<Button>`, `<Card>`, `<Section>`)
- 16 페이지를 동일 패턴(`Eyebrow + H2 + 설명문`)으로 재정렬
- **페이지별 액센트 컬러 매핑** (주황 사용 빈도 50% 이하로 줄임)

**모바일**:
- 햄버거 메뉴 + 스크롤 시 헤더 숨김 (`components/Header.tsx`)
- 핵심 5 페이지 phone-first 검토 + 타이포 스케일 조정

**이미지**:
- 샘플 표지 SVG 7→3 템플릿
- 기능 박스 미니 mock 제거 → 실제 결과 1장 또는 텍스트만
- 페이지별 의미 있는 스켈레톤
- 이모지 페이지당 최대 2개

**책 잘 만들기 (v2 신규)**:
- 레퍼런스 요약 + "이거 맞나요?" 사용자 확인 UI
- 목차 수정 가능 (TOC 편집)
- 벤치마킹 톤 매칭 (좋아하는 책 발췌 → AI 학습)

**책 팔기 부가기능 (v2 신규)**:
- Meta 광고 이미지 자동 생성
- 책 상세페이지 직접 편집 UI (`/book/[id]` 강화)
- 작가 link-in-bio + 리틀리 가이드 (`/external-linkbio` 복귀)
- ROI 피드백 ("들인 돈 vs 번 돈")
- 단계별 next-step UI (책 → 표지 → 광고 → 등록 꼬리물기)
- 3 플랫폼 통합 등록 (크몽 + 부크크 + 유페이퍼)

**Retention 시드**:
- 이메일 리커버리 시퀀스 (3 트리거)

### 2.2 미포함 (Out of scope — 다음 세션 또는 별도 트랙)

- **타겟 깊이 파기**: 직장인 부수익러 안에서 더 세분화 (다음 brainstorm)
- **사용자 acquisition**: SEO/광고/콘텐츠 마케팅 (별도 트랙)
- **모델 업그레이드 평가**: Opus 4.7 / GPT-5 / Gemini 2.5 비교 (별도)
- **Amazon KDP**: 영문 번역·표지 규격 별도. 한국 3 플랫폼 안정 후
- **DB 스키마 변경**: defer 페이지 다 유지
- **결제 플로우 재설계**: P0 #4 (무료 미리보기 게이트)는 별도 spec
- **AI 모델·프롬프트 튜닝**: 책 품질 자체는 손대지 않음
- **A/B 테스트 / Analytics**: 인프라 그대로

---

## 3. 주요 설계 결정 + 이유

### 3.1 기능 평가 결과 (Keep 27 / Defer / Cut)

#### ✅ KEEP — 27 기능 (책 완성 + 판매 부가기능)

**책 만들기 (8)**
| 기능 | 페이지/API |
|------|-----------|
| 주제 + 자료 입력 | `/new` |
| RAG 자료 업로드 (PDF/URL/text) | `/api/reference/*` |
| **레퍼런스 요약 + 사용자 확인** | `/api/generate/reference-summary` |
| AI 인터뷰 질문 | `/api/generate/interview-question` |
| 목차 자동 생성 + **목차 수정 UI** | `/api/generate/toc` |
| 챕터 본문 + 이어쓰기 + 편집 | `/api/generate/chapter*` |
| **벤치마킹 톤 매칭** (좋아하는 책 발췌) | `/api/generate/tone-recommend` (확장) |
| 작성 워크스페이스 | `/write`, `/write/setup` 통합 |

**표지 + 이미지 (3)**
| 기능 | API |
|------|-----|
| 표지 베리에이션 (3장) | `/api/generate/cover-variations` |
| **표지 텍스트 합성** (Sharp + Pretendard, 한글 깨짐 방지) | `/api/generate/cover-overlay` |
| **책 제목 AI 생성** (5개 후보) | `/api/generate/cover-headlines` (재활용) |

**책 팔기 부가기능 (6) — v2 신규/복귀**
| 기능 | API/페이지 |
|------|-----------|
| **Meta 광고 이미지 자동 생성** | `/api/generate/meta-images` |
| **3 플랫폼 통합 등록 패키지** (크몽 + 부크크 + 유페이퍼) | `/api/generate/publishing-package` |
| **가격 책정 AI** (플랫폼별 시세 추천) | `/api/generate/pricing-recommend` (신규) |
| **책 상세페이지 + 직접 편집 UI** | `/book/[id]` 강화 |
| **작가 link-in-bio + 리틀리 가이드** | `/external-linkbio` 복귀 |
| **ROI 피드백** ("들인 돈 ₩X / 번 돈 ₩Y") | `/projects` + `/book/[id]` UI 추가 |

**책 1권 마무리 (4)**
| 기능 | 페이지/API |
|------|-----------|
| 미리보기 | `/preview` |
| PDF 내보내기 | `/export`, `lib/export-pdf.ts` |
| 내 책 목록 | `/projects` |
| **단계별 next-step UI** (꼬리물기 가이드) | `/write` UI |

**Retention (1)**
| 이메일 리커버리 시퀀스 | `/api/cron/email-sequence` 확장 |

**운영 (5)**
| 기능 | 페이지/API |
|------|-----------|
| 회원가입 / 로그인 / 비번 재설정 | `/login`, `/reset-password`, `/api/auth/*` |
| 충전 (Toss) | `/billing`, `/api/payment/*` |
| 사용량 / 잔액 | `/usage`, `/api/usage` |
| 프로필 (최소) | `/profile` |

**마케팅 + 법적 (4 페이지)**
| `/` 랜딩 | `/pricing` | `/legal/terms`, `/privacy`, `/refund` (3개) | `/publish` 출판 가이드 |

#### 🟡 DEFER (메뉴 노출 제거, 라우트는 유지)

| 기능 | 켜는 트리거 |
|------|----------|
| topic-suggestions (주제 추천) | 사용자 "뭐 쓸지 모름" 5명+ 호소 |
| 시리즈 (`/series`) | 첫 권 완성 사용자 5명+ |
| 챌린지 (`/challenges`) | 활성 사용자 50명+ |
| 트렌드 (`/trends`) | 누적 책 100권+ |
| 추천 보상 (`/r/[code]`, referral) | NPS > 50 |
| 책 채팅 (`/book/[id]/chat`) | 첫 책 완성 후 별도 평가 |
| 작가 구독 / 알림 | 작가 5명+ 활성 |
| 책 리뷰 / 책 구독 | 독자 트래픽 발생 후 |
| 인포그래픽 / 슬라이드 / 오디오북 / 미리보기 영상 / 번역 | 책 본체 완성 사용자 누적 후 |
| Repurpose 5종 (블로그/이메일/인스타/카카오/유튜브) | 첫 책 완성 후 |
| A/B 테스트 | 트래픽 발생 후 |
| 작가 뱃지 / 작가 스탯 | 활성 작가 5명+ |
| chapter-image (챕터 안 삽화) | 사용자가 삽화 원함 명시 |
| image-refine (이미지 재생성) | refine 자체 사용자 요청 |
| EPUB / DOCX export | EPUB/DOCX 요청 사용자 등장 |
| cover-concepts (5 컨셉 가이드) | cover-variations 만족도 < 60% |
| Amazon KDP / 리디 / 교보 / 알라딘 | 한국 3 플랫폼 PMF 후 |

#### ❌ CUT (메뉴/홈/네비에서 완전 제거)

| 기능 | 왜 cut |
|------|-------|
| `/import-blog` | `/new`와 진입 혼선 |
| `/share/[id]` 별도 페이지 | `/book/[id]`와 중복 |
| `/u/[handle]` 작가 프로필 | 작가 본인 1명 |
| `/kmong-listing-helper` 별도 페이지 | `/publish` 안에 통합 |

---

### 3.2 디자인 토큰 (v2 — 9 컬러)

```
브랜드 + 중성 (6)
  tiger-orange   #f97316   CTA, 핵심 강조 (사용 빈도 50% 이하로 줄임)
  ink-900        #171717   본문, 헤딩
  gray-600       #525252   서브 텍스트
  gray-200       #e5e5e5   디바이더
  bg-base        #fafafa   페이지 배경
  bg-elevated    #ffffff   카드 배경

액센트 (3 신규)
  deep-navy      #1e3a8a   "책·신뢰" — 전문서·매뉴얼·결제 보안
  soft-sand      #fef3c7   "따뜻함·환영" — 랜딩 hero 배경, 환영 모달
  emerald-600    #059669   "성공·돈" — ROI 피드백, 완료, 수익 알림
```

**왜 6 → 9**: 주황 단일 강조가 페이지마다 똑같이 보이는 문제. 컨텍스트에 맞는 액센트 (책 = 신뢰, 환영 = 따뜻함, 수익 = 성공) 추가하면 시각 변화 + 의미 강화. 단 3색으로 제한해 결정 부담 최소.

**페이지별 액센트 매핑**:
- `/` 랜딩: tiger-orange (브랜드)
- `/new`, `/write`: deep-navy (집중)
- `/book/[id]`, `/projects`: emerald-600 (수익 컨텍스트)
- `/billing`, `/legal/*`: deep-navy (신뢰)
- `/publish`: emerald-600 (성공/등록 완료 톤)
- `/pricing`: tiger-orange (CTA 중심)

**CTA 버튼만 주황 통일** — 다른 강조는 페이지 컨텍스트 컬러.

**타이포 스케일**:
```
hero         text-6xl md:text-7xl    font-black tracking-tight
h2 섹션      text-4xl md:text-5xl    font-black tracking-tight
h3 본문 헤딩 text-2xl                  font-bold
body         text-base md:text-lg    text-gray-600
caption      text-xs font-mono uppercase tracking-[0.2em] text-{accent}
```

**섹션 패턴**: 모든 페이지 헤더는 `Eyebrow(액센트 caption) + H2(검정 헤딩) + 짧은 설명문` 3단 구조.

---

### 3.3 공통 컴포넌트 3개

| 컴포넌트 | 변형 | 위치 |
|---------|-----|------|
| `<Button>` | `primary` (주황) / `secondary` (테두리만) / `ghost` (텍스트만) | `components/ui/Button.tsx` (신규) |
| `<Card>` | 단일: `border border-gray-200 rounded-2xl p-6`, 페이지별 액센트 보더 옵션 | `components/ui/Card.tsx` (신규) |
| `<Section>` | `max-w-6xl mx-auto px-6 py-24 md:py-32` + `border-t` divider | `components/ui/Section.tsx` (신규) |

**CTA 텍스트 통일**:
```
무료로 시작 — ₩5,000 크레딧 받기 →
```
파생(충전 등)에서만 텍스트 교체.

---

### 3.4 모바일 — 햄버거 + 스크롤 시 헤더 숨김

| 패턴 | 선택 | 이유 |
|------|------|------|
| 네비게이션 | 햄버거 → 풀스크린 메뉴 | 핵심 페이지 9개라 하단 탭바 못 씀 |
| 헤더 동작 | 스크롤 다운 시 숨김, 업 시 등장 | 콘텐츠 페이지에서 헤더가 화면 14% 차지 |
| 터치 타겟 | 최소 높이 44px | iOS HIG 표준 |
| 폼 입력 | 한 화면 한 단계 | `/new` 스크롤 부담 ↓ |

핵심 5 페이지 모바일 우선순위: `/` > `/new` > `/write` > `/preview` > `/export`.

---

### 3.5 이미지 정리

| 변경 | 결과 | 이유 |
|------|------|------|
| 샘플 표지 7→3 템플릿 | 단색 미니멀(Penguin) / 잡지(Monocle) / 그라데이션 | 시각 잡음 ↓, 카테고리 매핑 일관성 |
| 기능 박스 미니 mock 제거 | 텍스트 + 실제 결과 스크린샷 1장 | mock = 정보 0. 실제 스크린샷이 신뢰감 ↑ |
| 이모지 페이지당 ≤2 | 헤더·CTA 액센트만 | 가독성 ↑ |
| 의미 있는 스켈레톤 | 페이지별 (책 카드, 챕터 배치) | SEO·공유 시 빈 페이지 안 보임 |
| 장식 blob/glow 정리 | 히어로 1개 + 다크 CTA 1개만 | 빈 공간 + 디바이더로 절제 |

**3 표지 템플릿 카테고리 매핑**:
- **단색 미니멀** (Penguin Classics): 실용서, 매뉴얼, 전문서
- **잡지** (Monocle): 자기계발서, 에세이
- **그라데이션 + 큰 타이포**: 재테크, 웹소설

---

### 3.6 책 잘 만들기 흐름 (v2 신규)

**3가지 강화 포인트** — 사용자가 AI를 "내 의도를 안다"고 느끼게:

1. **레퍼런스 요약 + 사용자 확인** (`/api/generate/reference-summary`)
   - 자료 업로드 직후 AI가 "이 자료의 핵심 5개" 요약 표시
   - 사용자: "맞아요" / "이건 잘못 이해함, X로 고쳐주세요" 버튼
   - 책 본문이 자료에서 멀어지지 않도록 사전 검증

2. **목차 수정 가능** (`/write` UI 추가)
   - AI 목차 생성 후 사용자가 직접 챕터 제목/순서/삭제·추가
   - 챕터 본문 생성 전 단계에서만 가능 (생성 후 변경은 chapter-edit)

3. **벤치마킹 톤 매칭** (`/api/generate/tone-recommend` 확장)
   - 사용자가 좋아하는 책 한 단락 (또는 블로그 글) 붙여넣기
   - AI가 그 톤 분석 → 본문 생성 시 같은 톤으로
   - 6 preset 톤 외 옵션

---

### 3.7 책 팔기 부가기능 (v2 신규)

**"글로만 적으면 부족하다"** — 책 만든 후 팔리게 만드는 도구:

1. **Meta 광고 이미지** (`/api/generate/meta-images`)
   - 책 1권당 3가지 광고 이미지 자동 (Feed 1:1, Story 9:16, Link 1.91:1)
   - 헤드라인 + CTA 합성된 채로 다운로드 가능

2. **책 상세페이지 직접 편집** (`/book/[id]` 강화)
   - AI 자동 생성된 상세페이지 위에 사용자 직접 카피·이미지 교체 가능
   - 크몽/부크크 등록 시 그대로 복붙

3. **작가 link-in-bio + 리틀리 가이드** (`/external-linkbio`)
   - tigerbookmaker 내 작가 페이지 (`/u/[handle]`)는 DEFER했지만, 리틀리 등록 가이드는 살림
   - "내 책 → 리틀리 어떻게 등록" 5분 가이드

4. **ROI 피드백** (`/projects` + `/book/[id]` UI)
   - 책별 "들인 돈 ₩4,000 / 번 돈 ₩XX,XXX" 표시
   - 현재 `/api/projects/[id]/revenue` 활용 (사용자가 수동 입력)
   - 사용자가 크몽에서 책 팔리면 "₩30,000 들어옴" 입력 → 누적 ROI

5. **단계별 next-step UI** (`/write` 내)
   - 책 본문 80% 완성 → "표지 만드시겠어요?"
   - 표지 완성 → "Meta 광고 이미지 만드시겠어요?"
   - 광고 이미지 완성 → "크몽 등록 패키지 받으시겠어요?"
   - 꼬리물기 흐름으로 사용자가 다음 행동 자연스럽게

6. **3 플랫폼 통합 등록 패키지** (`/api/generate/publishing-package`)
   - `body: { projectId, platform: "kmong" | "bookk" | "upaper" }`
   - 플랫폼별 다른 prompts (제목 길이 제한, 카테고리, 키워드 정책)
   - 가격 책정 AI가 플랫폼별 시세 추천

---

### 3.8 이메일 리커버리 시퀀스

기존 `/api/cron/email-sequence` 인프라 활용. 3 트리거:

| 트리거 | 발송 시점 | 메일 내용 |
|--------|---------|----------|
| 가입 후 책 안 만듦 | 24시간 후 | "₩5,000 크레딧 그대로 있어요. 막막하면 자료 1개만 올려보세요" |
| `/new` Step 1 완료, 자료 업로드 안 함 | 48시간 후 | "자료 없어도 시작 가능. 인터뷰만으로도 됨" |
| 챕터 5개 이상 만들고 멈춤 | 7일 후 | "${title} 거의 다 됐어요. 나머지 자동 생성?" |
| 책 완성 (export) | 즉시 | 축하 + 후기 부탁 + 추천 보상 안내 |

옵트아웃 링크 모든 메일에. DB 추가 X — `users` + `book_projects` + `balance_transactions` 시간 비교로 충분.

---

## 4. 영향 받는 파일

### 4.1 신규
- `components/ui/Button.tsx`
- `components/ui/Card.tsx`
- `components/ui/Section.tsx`
- `components/ui/MobileNav.tsx`
- `components/ui/Skeleton.tsx`
- `components/ui/ROIBadge.tsx` (들인 돈 / 번 돈)
- `components/write/TocEditor.tsx` (목차 수정)
- `components/write/ReferenceConfirm.tsx` (레퍼런스 요약 확인)
- `components/write/BenchmarkTone.tsx` (벤치마킹 톤 입력)
- `components/write/NextStepHint.tsx` (꼬리물기 가이드)
- `components/book/BookEditor.tsx` (상세페이지 편집)
- `app/publish/page.tsx` (3 플랫폼 출판 가이드)
- `app/external-linkbio/page.tsx` (복귀, 리틀리 가이드 강화)
- `lib/email-recovery.ts`
- `app/api/generate/publishing-package/route.ts` (kmong-package 확장 통합)
- `app/api/generate/pricing-recommend/route.ts` (신규)

### 4.2 수정
- `components/Header.tsx` — 햄버거 + 스크롤 숨김 + 메뉴 다이어트
- `app/page.tsx` — 디자인 시스템, 이모지/mock 정리, soft-sand hero
- `app/new/page.tsx` — Step 한 화면 한 단계, deep-navy 액센트
- `app/write/page.tsx` — TocEditor / ReferenceConfirm / BenchmarkTone / NextStepHint 통합
- `app/preview/page.tsx`, `app/export/page.tsx` — unauth fallback + 스켈레톤
- `app/projects/page.tsx` — emerald-600 액센트, ROIBadge 통합
- `app/billing/page.tsx`, `app/usage/page.tsx` — deep-navy
- `app/pricing/page.tsx` — 직장인 요약 카드
- `app/book/[id]/page.tsx` — BookEditor 통합, emerald-600
- `app/api/generate/meta-images/route.ts` — KEEP 복귀, UI 노출
- `app/api/generate/tone-recommend/route.ts` — 벤치마킹 모드 확장
- `app/api/generate/reference-summary/route.ts` — 사용자 확인 응답 추가
- `app/api/cron/email-sequence/route.ts` — 3 트리거
- `app/api/projects/[id]/revenue/route.ts` — KEEP 복귀, UI 노출
- `tailwind.config.ts` — 토큰 9개
- `lib/landing-data.ts` — 샘플 책 카테고리 3 템플릿 매핑

### 4.3 코드 유지, 노출만 제거 (defer)
- `app/challenges/`, `app/series/`, `app/trends/`, `app/import-blog/`, `app/kmong-listing-helper/`, `app/u/[handle]/`, `app/share/[id]/`, `app/r/[code]/`, `app/book/[id]/chat/`
- Repurpose 5종 API, audiobook, course-slides, infographic, preview-video, translate, image-refine, chapter-image, cover-concepts

---

## 5. 단계별 PR 분할 (7 PR, ~10일)

| PR | 제목 | 범위 | 시간 |
|----|------|------|-----|
| 1 | feat(nav+tokens): 메뉴 다이어트 + 햄버거 + 9 컬러 토큰 | `Header.tsx`, `tailwind.config.ts`, defer 링크 제거 | 1일 |
| 2 | feat(ui): 공통 컴포넌트 3종 + 페이지별 액센트 시스템 | `components/ui/*` 신규 | 0.5일 |
| 3 | refactor(pages): 16 페이지에 디자인 시스템 적용 | 페이지별 컴포넌트 교체, unauth fallback, 스켈레톤 | 2일 |
| 4 | feat(book-make): 레퍼런스 요약 + 목차 수정 + 벤치마킹 톤 | `/write` 안 3 컴포넌트 신규 | 2일 |
| 5 | feat(book-sell): meta-images + 상세페이지 편집 + ROI + next-step | `/book/[id]`, `/projects`, `/write` UI 강화 | 2일 |
| 6 | feat(publish): publishing-package 3 플랫폼 + 가격 책정 AI + `/publish` + `/external-linkbio` | API + 페이지 신규 | 1일 |
| 7 | feat(polish): 표지 7→3 + mock 제거 + 이모지 다이어트 + 이메일 리커버리 | 랜딩 정리 + cron 확장 | 1.5일 |

각 PR 끝나면 `npm run build` 통과 + Vercel 프리뷰 확인 + 텔레그램 보고.

PR 4·5·6은 PR 3 완료 후 병렬 가능 (충돌 없음).

---

## 6. 리스크 & 미확정

### 6.1 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 페이지 cut 했더니 SEO 떨어짐 | 작음 — 트래픽 0에 가까움 | sitemap.xml에서 defer 페이지 제외 |
| Defer 페이지가 dead-end로 누가 발견하면 혼란 | 작음 | `noindex` 메타 추가, 직접 접근 시 핵심 페이지로 리디렉트 |
| 이메일 리커버리 스팸 인식 | 중간 | 모든 메일에 옵트아웃, 3 트리거 이상 안 보냄 |
| 표지 템플릿 7→3 줄였는데 다양성 원함 | 작음 | template ID enum 유지, 나중에 추가 case |
| 3 플랫폼 (크몽+부크크+유페이퍼) 각 정책 다름 → 패키지 품질 차이 | 중간 | 크몽 우선 정확도, 부크크/유페이퍼는 v1 = 기본 가이드 + v2에서 정교화 |
| 벤치마킹 톤 매칭 = 사용자가 잘못된 책 발췌하면 톤 잘못 매칭 | 작음 | "AI가 이렇게 이해함" 확인 단계 추가 |
| ROI 입력 수동 — 사용자가 안 입력하면 가치 없음 | 중간 | 책 완성 후 이메일 1주일 후 "얼마 팔렸어요?" 알림 |

### 6.2 미확정

- **모델 업그레이드**: Claude Opus 4.7 / GPT-5 / Gemini 2.5 — 별도 평가 후 결정. 현재 사용 중인 모델 그대로 진행.
- **이메일 발송 도구**: Resend 그대로 가정.
- **부크크 / 유페이퍼 정확한 정책**: 크몽 승인 완료 후 본인이 부크크·유페이퍼 셀러 등록하고 정책 확인. 그 동안 publishing-package v1은 일반 가이드.
- **타겟 깊이 파기**: 다음 세션 brainstorm. 직장인 부수익러 안에서 어떤 세분화 (1인 사업가 vs 회사원, 첫 책 vs 시리즈 등).

---

## 7. 운영 트랙 (사이트 외 — qmin 본인 작업)

| 순 | 작업 | 우선순위 |
|---|------|--------|
| 1 | **크몽 사업자 등록 + 셀러 승인** | 🔴 1순위 (다른 거 다 보류 가능) |
| 2 | 모델 평가 — Opus 4.7 / GPT-5 / Gemini 2.5 비용·품질 비교 | 🟡 2순위 |
| 3 | 부크크 / 유페이퍼 셀러 가이드 직접 확인 | 🟡 3순위 |
| 4 | 가격 책정 — 현재 ₩4k~₩21k 유지 vs 조정 | 🟢 4순위 |

---

## 8. 다음 세션 brainstorm 큐

| 주제 | 왜 별도 |
|------|--------|
| **타겟 깊이 파기** — 직장인 부수익러 안에서 더 세분화 (크몽 vs 부크크 우선, 1인 사업가 vs 회사원, 첫 책 vs 시리즈러) | 큰 주제, 별도 호흡 |
| **사용자 acquisition** — SEO/광고/콘텐츠 마케팅 트랙 | 사이트 외부 |
| **모델 업그레이드 평가** | 비용·품질 데이터 필요 |

---

## 9. 의사결정 요약

| 결정 | 선택 | 핵심 근거 |
|------|-----|----------|
| 제품 정체성 재정의 | "AI 책 작성 도구" → **"책 팔고 싶은 사람의 부수익 시스템"** | 글만으론 부족. 부가기능이 본체의 일부 |
| 기능 cut 범위 | 60+ → 27 | 핵심 흐름 + 판매 부가기능 |
| 페이지 cut 범위 | 30+ → 16 | 핵심 + 법적 + 출판 가이드 |
| 컬러 토큰 수 | 6 → **9** | 주황 단독 → 액센트 3색 추가. 페이지별 컨텍스트 컬러 |
| 컴포넌트 변형 수 | Button 3 / Card 1 / Section 1 | 결정 부담 최소 |
| 모바일 네비 | 햄버거 + 스크롤 숨김 | 페이지 9개라 탭바 못 씀 |
| 표지 템플릿 | 7 → 3 | 시각 잡음 ↓ |
| 표지 한글 텍스트 | AI 이미지 + Sharp 합성 | AI가 한글 못 그림 |
| 책 잘 만들기 강화 | 레퍼런스 요약·목차 수정·벤치마킹 톤 | "AI가 내 의도를 안다" 느낌 |
| 책 팔기 부가기능 | Meta 이미지·상세 편집·ROI·next-step·3 플랫폼 | 부수익러 핵심 가치 |
| Retention 전략 | 이메일 리커버리 1개 + ROI 알림 | A=0에서 작동 |
| 다중 플랫폼 범위 | 크몽 + 부크크 + 유페이퍼 (한국 3) | 부수익러 현실 |
| Amazon KDP | DEFER | 영문 번역·표지 규격 별도 |
| Cut vs Defer 처리 | 코드 유지, 메뉴만 제거 | 나중에 켤 때 재작성 X |

---

검토 후 바꾸고 싶은 부분 알려주세요. 동의하면 PR #1부터 순차 진행합니다.

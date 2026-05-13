# AI 이미지 시스템 통합 설계 — 표지 · 본문 · 광고 · 인포그래픽

**작성일**: 2026-05-13
**상태**: 사용자 검토 대기
**예상 작업량**: ~5~7일 (5 PR로 분할)

---

## 1. 배경 · 목적

현재 이미지 시스템은 다음 상태:

| 기능 | 상태 |
|------|------|
| `cover-variations` | ✅ 활성. 3장 자동 표지 (OpenAI gpt-image-1) |
| `cover-overlay` | ✅ 활성. Sharp + Pretendard 한글 텍스트 합성 |
| `meta-images` | ✅ 활성. UI 노출됨 (`/publish` 페이지) |
| `cover-concepts` | 🟡 DEFER. 5 컨셉 가이드 |
| `cover-headlines` | 🟡 DEFER. 책 제목 AI |
| `chapter-image` | 🟡 DEFER. 챕터 안 [IMAGE: ...] |
| `infographic` | 🟡 DEFER. 카드뉴스 5장 |
| `image-refine` | 🟡 DEFER. 자연어 피드백 재생성 |

**문제점**:
1. 표지가 "너무 비슷한 톤" — 다양성 부족. 사용자가 자기 책의 톤 표현 못 함
2. 본문은 텍스트만. 읽는 재미 ↓, 크몽 등 플랫폼 매력 ↓
3. 광고 이미지가 표지와 별개로 생성 — 일관성 부족
4. 사용자가 "어떤 표지 톤이 좋을지" 가이드 없음 — 14개 카테고리 중 하나 고르는 게 전부

**목표**:
사용자가 책 만들 때 **자기 책 톤에 정확히 맞는 표지·본문·광고·인포그래픽을 자동으로 추천받고 선택**할 수 있는 통합 이미지 시스템.

---

## 2. 범위

### 2.1 포함 (v1)

**A. 스타일 라이브러리 (40 템플릿)**
- 7 카테고리 × 4~5 변형 = 28~40 표지 레이아웃
- 카테고리: BOLD · EDITORIAL · TECH · CULTURAL · RETRO · SOFT · EXPERIMENTAL
- 각 템플릿 = Sharp 합성용 overlay 설정 + AI 이미지 prompt 패턴

**B. 장르 매칭 시스템**
- 책 카테고리 (자기계발/재테크/에세이/웹소설/실용서/전문서/매뉴얼) → 추천 레이아웃 3개 + 사진 키워드 + 톤
- 매핑 테이블 lib/cover-style-map.ts 신규
- "AI 추천" 자동 + "갤러리 선택" 수동 둘 다

**C. AI 이미지 생성 파이프라인 강화**
- prompt 구조: `[톤] + [사진 키워드] + [구도] + [색감] + [네거티브: 한글 텍스트 X]`
- 한글 텍스트는 AI 이미지에 절대 들어가지 않음 (Sharp가 합성)
- 모델: OpenAI gpt-image-1 유지 (현재 단일 모델 정책)

**D. 표지 변형 베스트셀러 톤 (특히 전문서·매뉴얼·실용서)**
- 단순 텍스트 표지 → 일러스트·사진·인포그래픽 요소 추가
- Atomic Habits·O'Reilly·Marie Kondo 톤 차용

**E. 본문 이미지 (chapter-image 활성화)**
- 현재 DEFER 상태 → KEEP으로 승격
- 챕터 본문 [IMAGE: 캡션] placeholder → 자동 채움
- 톤은 표지 톤 ↔ 일관

**F. 광고 이미지 표지 톤 일관성**
- meta-images가 cover의 톤/사진 키워드 재사용
- 광고와 표지가 같은 시각 언어

**G. 인포그래픽 카드뉴스 (infographic 활성화)**
- 현재 DEFER → KEEP
- 책 핵심 5개 → 5장 카드뉴스 (인스타·트위터 공유용)

### 2.2 미포함 (Out of scope)

- **모델 교체**: 현재 OpenAI gpt-image-1 유지. DALL-E 4, Midjourney, Flux 등 평가는 별도 spec
- **수동 prompt 입력**: 사용자가 직접 prompt 적는 모드. v2에서.
- **표지 안 사진 직접 업로드**: 사용자가 본인 사진 올려서 표지 만들기. v2에서.
- **3D / 애니메이션 표지**: GIF, video 표지. Out.
- **인쇄용 표지** (CMYK, bleed 처리): 부크크 종이책 출판용. 별도 spec.

---

## 3. 핵심 설계 결정 + 이유

### 3.1 스타일 라이브러리 — 7 카테고리 × ~5 변형

**현재**: 단순 SVG 7장르 표지 (Penguin·Monocle·Wuxia 등)
**v1**: 다양한 레이아웃 + 사진/일러스트/추상 패턴 결합한 40개 템플릿

**왜 7 카테고리?**
- 직장인 부수익러가 만드는 책 80% 커버
- 너무 많으면 (예: 50 카테고리) 사용자 결정 부담 ↑
- 카테고리 = 톤. 변형 4~5 = 같은 톤의 다른 구현

**카테고리 + 대표 변형**:

| 카테고리 | 톤 | 대표 변형 |
|---------|-----|---------|
| 🔥 **BOLD** | 멈춰 세움 | Brutalist · Pop Art · Graffiti · Manga · Maximalist |
| 📰 **EDITORIAL** | 권위 · 출판물 | Penguin · Monocle · Vogue · Newspaper · Academic |
| 💻 **TECH** | 미래 · 디지털 | Neon Cyberpunk · Glitch VHS · Minimal Tech · Pixel 8-bit · Terminal CLI |
| 🌏 **CULTURAL** | 한국 · 아시아 | Korean Modern · Wuxia · Japanese Zen · 90s 홍콩 |
| 🌈 **RETRO** | 노스탤지어 | K-pop Y2K · Synthwave · Memphis · Art Deco · Risograph |
| 🌿 **SOFT** | 부드러움 | Botanical · Watercolor · Kawaii · Doodle |
| 🧪 **EXPERIMENTAL** | 기억에 남음 | Holographic · Concrete Poetry · Collage Zine · Movie Poster |

**전문서·매뉴얼·실용서 — 베스트셀러 톤 4 변형씩 추가**:

- **전문서**: 시각적 메타포 / Big Number / Abstract Data Viz / 저자 Portrait
- **매뉴얼**: O'Reilly 동물 / Isometric 3D / Tool Photo / Gradient + Code
- **실용서**: Hands + Result / Before/After / 친근 일러스트 / Step-by-step

**왜 변형 4~5?**
- 같은 책도 어떤 톤(친근/권위/데이터/체계) 강조하느냐에 따라 다름
- 사용자가 자기 메시지에 맞게 선택

### 3.2 장르 매칭 시스템

**매핑 테이블 (`lib/cover-style-map.ts`)**:

```typescript
type BookGenre = "self-dev" | "finance" | "essay" | "novel" | "practical" | "academic" | "manual";

interface GenreMatch {
  layouts: LayoutKey[];     // 추천 레이아웃 3개
  photoKeywords: string[];  // AI 이미지 prompt 키워드
  tone: string;             // 톤 설명 (UI용)
}

const GENRE_MAP: Record<BookGenre, GenreMatch> = {
  "self-dev": {
    layouts: ["full-photo-gradient", "penguin-minimal", "polaroid-zine"],
    photoKeywords: ["sunrise", "morning coffee", "routine", "calm light"],
    tone: "따뜻 / 영감 / 의지",
  },
  "finance": {
    layouts: ["cinematic-overlay", "bw-photo-accent", "korean-modern"],
    photoKeywords: ["city skyline", "finance charts", "night lights", "abstract data"],
    tone: "강렬 / 결단 / 성공",
  },
  "essay": {
    layouts: ["polaroid-zine", "nature-serif", "vintage-photo"],
    photoKeywords: ["solitude", "empty room", "B&W moments", "window light"],
    tone: "부드러움 / 회상 / 감정",
  },
  "novel": {
    layouts: ["movie-poster", "cinematic-overlay", "wuxia-asian"],
    photoKeywords: ["rainy night", "city noir", "silhouette", "dramatic light"],
    tone: "시네마틱 / 어두움 / 긴장",
  },
  "practical": {
    layouts: ["photo-split", "character-illustration", "magazine-circular"],
    photoKeywords: ["workspace", "tools", "clean desk", "hands working"],
    tone: "친근 / 명확 / 신뢰",
  },
  "academic": {
    layouts: ["academic-journal", "academic-metaphor", "academic-bignumber", "brutalist"],
    photoKeywords: ["abstract geometry", "minimal patterns"],
    tone: "권위 / 정밀 / 신뢰",
  },
  "manual": {
    layouts: ["manual-oreilly", "manual-isometric", "neon-cyberpunk", "minimal-tech"],
    photoKeywords: ["code editor", "tools", "isometric architecture"],
    tone: "미래 / 정밀 / 테크",
  },
};
```

**왜 3개 추천?**
- 1개 = 다양성 ↓, 사용자 강제
- 3개 = 선택 부담 적당
- 5+ = 결정 마비

### 3.3 AI 이미지 생성 파이프라인

**현재** (`/api/generate/cover-variations`):
```
prompt = imagePrompt(category, project)  // 단순 카테고리 기반
```

**v1**:
```
const match = GENRE_MAP[project.genre];
const layout = match.layouts[selectedLayoutIdx];
const photoKeywords = match.photoKeywords;

prompt = composePrompt({
  layout,                              // 레이아웃 (full-bleed / split / overlay)
  photoKeywords,                       // 사진 키워드
  bookTopic: project.topic,            // 책 주제 (영문 변환)
  tone: match.tone,                    // 톤
  negative: ["한글 텍스트", "한국어"], // 한글 텍스트 X (Sharp가 합성)
  aspectRatio: "3:4",                  // 표지 비율
});
```

**핵심**:
- AI 이미지에 텍스트 X — Sharp가 한글 합성
- 레이아웃 정보가 prompt에 포함 ("space at bottom for text overlay" 등)
- 톤·사진 키워드 = GENRE_MAP에서 자동 가져옴

### 3.4 사용자 선택 UX (자동 + 수동 + 믹스)

**3 흐름**:

**A. 자동 (default)**
1. 사용자가 책 만들 때 카테고리 선택 (실용서/자기계발/재테크/...)
2. 시스템이 GENRE_MAP에서 레이아웃 3개 + 사진 키워드 자동 적용
3. cover-variations가 3장 생성
4. 사용자가 1장 선택

**B. 수동 (스타일 갤러리)**
1. 사용자가 "스타일 갤러리" 버튼 클릭
2. 40개 템플릿 갤러리에서 직접 선택
3. cover-variations가 해당 템플릿 + 책 정보로 1장 생성

**C. 믹스 (자동 후 수정)**
1. 자동 추천된 3장 마음에 안 듦
2. "다른 스타일 보기" → 갤러리 열림
3. 다른 카테고리/변형 선택 → 재생성

### 3.5 텍스트 오버레이 (Sharp + Pretendard)

**현재**: cover-overlay 활성. 5 템플릿 (minimal, bold, story, quote, cta).

**v1 확장**:
- 템플릿 5 → **20** (각 레이아웃에 맞는 텍스트 배치)
- 헤드라인 / 부제 / 발행자 / 시리즈 번호 / 배지 등 다중 텍스트 슬롯
- 폰트 굵기 / 자간 / 색상 / 위치 (top-left·center·bottom-bleed 등)

**왜 Sharp**: AI 이미지가 한글 못 그림. Sharp는 Pretendard 폰트로 깔끔하게 합성.

### 3.6 본문 이미지 (chapter-image 활성화)

**현재**: chapter-image API 있음, UI 미연결, DEFER.

**v1 활성화**:
1. 챕터 본문에 [IMAGE: 캡션] placeholder 자동 삽입 (AI가 본문 생성 시)
2. 사용자가 "본문 이미지 만들기" 클릭 → 모든 placeholder 자동 채움
3. 각 이미지 = 표지 톤 ↔ 일관 (GENRE_MAP의 photoKeywords 재사용)

**비용**: ~₩300/장. 12 챕터 × 2장 = ~₩7,200/책.
**옵션**: 사용자가 "본문 이미지 생략" 선택 가능 (라이트 시나리오 유지).

### 3.7 광고 이미지 표지 톤 일관성

**현재**: meta-images가 cover와 별개로 생성 → 톤 불일치 가능.

**v1**:
- meta-images 호출 시 자동으로 cover의 photoKeywords + tone 재사용
- prompt에 "consistent with book cover style" 명시
- 결과: 표지 + 광고 + 본문 = 같은 시각 언어

### 3.8 인포그래픽 카드뉴스 (infographic 활성화)

**현재**: infographic API 있음, DEFER.

**v1 활성화**:
- 책 핵심 5개 (referenceSummary.keyPoints) → 5장 인포그래픽
- 인스타·트위터 공유용 (1:1 비율)
- 톤 = GENRE_MAP에 따름

**비용**: ~₩1,000/세트.

---

## 4. 영향 받는 파일

### 4.1 신규
- `lib/cover-style-map.ts` — 장르 ↔ 레이아웃 매핑
- `lib/cover-templates/` — 40개 템플릿 정의 (Sharp 합성 설정)
  - `templates/penguin-minimal.ts`
  - `templates/full-photo-gradient.ts`
  - ... (총 40)
- `components/write/CoverStyleGallery.tsx` — 갤러리 UI (28+ 옵션)
- `components/write/CoverRecommendation.tsx` — 자동 추천 UI (3장 보여줌)
- `app/api/generate/cover-variations/lib/prompt-composer.ts` — prompt 합성 로직

### 4.2 수정
- `app/api/generate/cover-variations/route.ts` — GENRE_MAP + 새 prompt
- `app/api/generate/cover-overlay/route.ts` — 20 템플릿 추가
- `app/api/generate/meta-images/route.ts` — cover 톤 재사용
- `app/api/generate/chapter-image/route.ts` — UI 노출 활성화
- `app/api/generate/infographic/route.ts` — UI 노출 활성화
- `app/write/page.tsx` — CoverStyleGallery + CoverRecommendation 통합
- `app/book/[id]/page.tsx` — 본문 이미지 렌더링 강화

### 4.3 사용자 대상 새 UI
- 책 만들기 흐름에 "표지 톤 선택" 단계 추가 (자동/수동/믹스)
- 본문 이미지 만들기 버튼
- 인포그래픽 카드뉴스 다운로드 버튼

---

## 5. PR 분할 계획 (5 PR, ~5~7일)

| PR | 제목 | 범위 | 시간 |
|----|------|------|-----|
| **1** | feat(image): 장르 매칭 시스템 + GENRE_MAP | `lib/cover-style-map.ts` + prompt-composer | 0.5일 |
| **2** | feat(image): 표지 레이아웃 40 템플릿 + Sharp overlay 20종 | `lib/cover-templates/`, `cover-overlay/route.ts` | 2일 |
| **3** | feat(image): 표지 갤러리 + 자동 추천 UI | `CoverStyleGallery.tsx` + `CoverRecommendation.tsx` + /write 통합 | 1.5일 |
| **4** | feat(image): 본문 이미지 + 광고 일관성 | chapter-image UI + meta-images 톤 재사용 | 1일 |
| **5** | feat(image): 인포그래픽 카드뉴스 활성화 | infographic UI + 5장 SNS 다운로드 | 1일 |

---

## 6. 리스크 & 미확정

### 6.1 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| AI 모델이 prompt 의도와 다른 이미지 생성 | 큼 | cover-variations 3장 = 다양성. 사용자 1장 선택. image-refine은 v2에서 |
| 40 템플릿 = 작업량 큼 | 중간 | 우선순위 12개 먼저 (각 카테고리 2 + 베스트셀러 톤 12) v1 = 24. 나머지 v2 |
| 본문 이미지 ₩7,200/책 = 라이트 ₩4,000 시나리오 깨짐 | 중간 | 본문 이미지는 옵션 (라이트 시나리오는 텍스트만) |
| 갤러리 28+ 옵션 = 사용자 선택 마비 | 중간 | 자동 추천 기본 + 갤러리는 "다른 거 보기" 진입 |
| AI 이미지에 한글 깨짐 | 작음 | prompt에 "no Korean text" 명시 + Sharp 합성 검증 |
| 광고 이미지 일관성 측정 어려움 | 작음 | 톤·키워드 재사용 = 정성 일관성. 정량 측정은 v2 |

### 6.2 미확정

- **본문 이미지 디폴트 활성화 vs 옵트인**: 라이트 시나리오 보호 위해 디폴트 OFF, 사용자가 명시적으로 켜야. (잠정 결정)
- **갤러리 인기순 정렬**: 사용 데이터 누적 후 가능. v1은 카테고리 순서 고정.
- **카테고리별 색상 매핑 자동화**: 예) 재테크 = navy + gold. 디테일 v2에서 fine-tune.
- **사진 키워드 영문 번역**: AI 이미지 prompt는 영어. 현재 코드에 번역 함수 있는지 확인 필요.

---

## 7. 의사결정 요약

| 결정 | 선택 | 핵심 근거 |
|------|-----|----------|
| 카테고리 수 | 7개 | 직장인 부수익러 80% 커버, 결정 부담 ↓ |
| 변형 수 | 카테고리당 4~5 | 같은 톤도 강조점이 다름 (친근/권위/데이터/체계) |
| 매칭 방식 | 자동 + 수동 + 믹스 | 디폴트 자동 (편함), 갤러리는 backup |
| AI 모델 | OpenAI gpt-image-1 유지 | 현재 단일 모델 정책. 평가는 별도 spec |
| 한글 텍스트 | AI 이미지 X, Sharp 합성 O | AI가 한글 못 그림 |
| 본문 이미지 | 옵션 (디폴트 OFF) | 라이트 시나리오 ₩4,000 보호 |
| 광고 이미지 톤 | cover와 자동 일관 | 시각 언어 통일 |
| 인포그래픽 | KEEP 승격 | 인스타·트위터 공유 → 바이럴 시드 |
| 갤러리 옵션 수 | 28+ → 40 | 다양성 충분. 정렬은 카테고리 순서 |
| 베스트셀러 톤 강화 | 전문서·매뉴얼·실용서 4 변형씩 | 단순 텍스트 → 일러스트·사진 추가 |

---

## 8. 다음 단계

스펙 검토 후 동의하면 PR #1 (GENRE_MAP)부터 순차 진행.

검토 포인트:
1. 카테고리 7개 적절한가 (더 추가/제거?)
2. 본문 이미지 디폴트 OFF/ON 어느 게 맞나
3. v1 24 템플릿 (각 카테고리 핵심 + 베스트셀러 12) 우선순위 OK?
4. PR 분할 순서 (1→5)

위 4개 OK면 진행. 다른 의견 있으면 알려주세요.

# Wave 1 — 콘텐츠 재가공 도구 (책 1권 → 마케팅 자산 5종)

> **Goal**: 작가가 책 1권 만들면, AI가 자동으로 인스타·유튜브·블로그·이메일·카톡용 콘텐츠를 생성. 책 1권의 마케팅 가치 10배.

**핵심 컨셉**: 작가는 책에 시간 쓰고, 마케팅은 자동. 5개 채널 모두 클릭 한 번.

**대상 페르소나**: A 부수익러 — "책 만드는 거까진 했는데 어떻게 알리지?" 해결.

---

## 5가지 콘텐츠 도구

| 도구 | 출력 | AI 비용 | 채널 |
|---|---|---|---|
| **C-1 인스타 카드뉴스** | 10장 슬라이드 (텍스트 + 디자인 가이드) | ₩40 | 인스타·스레드 |
| **C-2 유튜브 영상 대본** | 1-3분 대본 + thumbnail 컨셉 | ₩30 | 유튜브 쇼츠·릴스 |
| **C-3 블로그 시리즈** | 5-10편 포스트 (각 1500자) | ₩100 | 네이버블로그·티스토리·미디엄 |
| **C-4 이메일 뉴스레터** | 4편 시리즈 (책 발췌 + 이메일 친화 톤) | ₩60 | 메일침프·스티비·서브스택 |
| **C-5 카카오톡 채널 메시지** | 5편 발행 메시지 (이미지 caption 짧음) | ₩20 | 카카오톡 채널 |

**합계 비용**: 약 ₩250/책 (모두 생성 시). Imagen 이미지는 별도.

---

## 데이터 모델

`lib/storage.ts`:

```typescript
export interface RepurposedContent {
  instagram?: {
    cards: Array<{ slideNum: number; title: string; body: string; designNote: string }>;
    caption: string;
    hashtags: string[];
    generatedAt: number;
  };
  youtube?: {
    title: string;
    script: string;          // 1-3분 분량
    thumbnailConcept: string; // 디자이너용 가이드
    chapterMarkers: Array<{ time: string; label: string }>;
    description: string;
    tags: string[];
    generatedAt: number;
  };
  blog?: {
    posts: Array<{
      order: number;
      title: string;
      body: string;          // 마크다운 1500자
      excerpt: string;
      tags: string[];
    }>;
    seriesTitle: string;
    generatedAt: number;
  };
  email?: {
    series: Array<{
      day: number;           // 1, 4, 8, 14
      subject: string;
      preheader: string;
      body: string;          // HTML-safe text
      cta: string;
    }>;
    generatedAt: number;
  };
  kakao?: {
    messages: Array<{
      order: number;
      hook: string;          // 짧은 후킹 (한 줄)
      body: string;          // 본문 (200자 이내)
      cta: string;
    }>;
    generatedAt: number;
  };
}

export interface BookProject {
  // ... 기존
  repurposedContent?: RepurposedContent;
}
```

---

## Tasks

### Task 1: 타입 + storage

`lib/storage.ts`에 위 타입 추가.

Commit: `feat(types): RepurposedContent 5채널 타입`

### Task 2: 5개 prompt 함수 (lib/prompts.ts)

각 채널마다 prompt 함수:
- `instagramCardsPrompt(project, settings)` — 10장 카드 + caption + hashtags
- `youtubeScriptPrompt(project, durationMinutes?)` — 대본 + 썸네일 + 챕터 마커
- `blogSeriesPrompt(project, postCount?)` — 5-10편 포스트
- `emailSeriesPrompt(project, sequenceLength?)` — 4편 (1일·4일·8일·14일)
- `kakaoChannelPrompt(project, messageCount?)` — 5편 발행 메시지

각 함수 시그니처는 단순. `project.topic`, `audience`, `chapters` (제목만 활용), `marketingMeta`, `toneSetting` 활용.

각 prompt는 한국어 JSON 출력 강제. AI temperature 0.7.

Commit: `feat(prompts): 5채널 콘텐츠 재가공 프롬프트 (인스타/유튜브/블로그/이메일/카톡)`

### Task 3: API endpoints (5개 새 endpoint)

각 채널마다 `/api/generate/repurpose-{channel}/route.ts`:
- `repurpose-instagram`
- `repurpose-youtube`
- `repurpose-blog`
- `repurpose-email`
- `repurpose-kakao`

공통 패턴 (kmong-package 참고):
- 인증 + ownership
- rate limit `repurpose-{channel}:${userId}` 5/min
- 잔액 체크 (각 채널 비용)
- AI fallback chain
- JSON 파싱 + sanitize
- `project.data.repurposedContent.{channel}` 저장
- 응답 `{ ok, content, newBalance, costKRW }`

Commit (5개 commit, 채널별):
- `feat(api): /api/generate/repurpose-instagram`
- `feat(api): /api/generate/repurpose-youtube`
- `feat(api): /api/generate/repurpose-blog`
- `feat(api): /api/generate/repurpose-email`
- `feat(api): /api/generate/repurpose-kakao`

### Task 4: PATCH endpoint에 repurposedContent 허용

`app/api/projects/[id]/route.ts`에 `repurposedContent` 부분 업데이트 허용 (수동 편집용).

Commit: `feat(api): PATCH repurposedContent 허용`

### Task 5: UI — `/write` 페이지에 "콘텐츠 재가공" 박스

기존 Meta 광고 박스 옆 또는 아래에 새 박스 (보라색 또는 핑크 테마):

**콘텐츠 재가공 박스**:
- 5개 탭 (인스타 / 유튜브 / 블로그 / 이메일 / 카톡)
- 각 탭마다:
  - 없으면: "AI 생성 (₩X)" 버튼
  - 있으면: 미리보기 + 복사 버튼 + 다시 생성

탭 UI는 간단 — chip 버튼 또는 ARIA tabs.

각 채널 미리보기:
- **인스타**: 10장 카드 그리드, 각 카드 텍스트 + designNote
- **유튜브**: title + script (스크롤 가능) + thumbnail concept + chapter markers
- **블로그**: posts 리스트 (각 클릭하면 expand)
- **이메일**: 4편 sequence, 각 subject + preheader + body
- **카톡**: 5편 메시지 카드

각 항목 옆에 "📋 복사" 버튼 (clipboard.writeText).

Commit: `feat(ui): /write 콘텐츠 재가공 섹션 (5채널 탭 + 미리보기 + 복사)`

### Task 6: 통합 빌드 + merge + push

- `npm run build`
- main merge + push

---

*— end of Wave 1 plan*

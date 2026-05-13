# /write 흐름 v3 통합 설계 — 직장인이 진짜 책 끝내게

**작성일**: 2026-05-13
**상태**: 사용자 검토 대기
**예상 작업량**: ~14~18일 (4 Phase 분할)

---

## 1. 배경 · 목적

베타 사용자 4명 가입 / **0건 완성**. 1차 가설 → 6 layer 다 영향:

| Layer | 병목 |
|------|------|
| 1. **동기** | "진짜 책 끝낼 동기 있나?" — 호기심 가입 후 진지함 X |
| 2. **시간 단위** | 30분 연속 = 직장인엔 무리. 5분씩 끊어야 |
| 3. **실패 복구** | 네트워크/잔액/AI 실패 시 진행 잃음 → 떠남 |
| 4. **신뢰·품질** | "AI 책 진짜 팔릴까?" 의심 → 완성 직전 떠남 |
| 5. **커뮤니티** | 혼자 만들면 외로움 → 모티베이션 ↓ |
| 6. **온보딩** | 첫 방문자 "뭐부터 해야 하지?" |

**목표**:
1차 책 완성률 = 0% → **목표 30%+**. 직장인이 5분 단위로 끊어 만들어도, 30분에 한 권 완성 가능한 흐름.

---

## 2. 범위

### 2.1 포함 (v1, 4 Phase)

**Phase 1 — 핵심 흐름 (5일)**
- 8단계 흐름 (analyze → interview → style → toc → write → publish)
- 자동 저장 + 이어쓰기 (localStorage + DB)
- 백그라운드 본문 생성 + 이메일 알림
- 진행 시각화 (단계별 % + 챕터별 상태)

**Phase 2 — 품질·신뢰 (4일)**
- 챕터별 한국어 자연성 점수
- 크몽 통과 가능성 % (heuristic)
- 챕터별 자연어 재생성 ("더 짧게", "예시 추가")
- 표절 자동 체크 (간단 휴리스틱)

**Phase 3 — 진입·동기 (4일)**
- 예제 책 5개 갤러리 + fork
- 인터랙티브 튜토리얼 (in-app tooltips, 첫 방문)
- 첫 책 완성 보너스 (₩5,000 추가 크레딧)
- 진행 격려 메시지 ("거의 다 됐어요" 등)

**Phase 4 — 커뮤니티·확장 (5일)**
- 라이브 카운터 ("지금 ___명이 만들기 중")
- 완성 축하 피드 (privacy-aggregated)
- 모바일 마이크로 모드 (5분 단위 작업)
- 카톡 알림 (텔레그램 봇 기반 또는 알림톡)

### 2.2 미포함 (Out of scope)

- ~~3분 온보딩 비디오~~ (제외 — 사용자 결정)
- Discord/카톡 단톡 (별도 운영, 코드 X)
- AI 모델 교체 평가 (별도 spec)
- 인쇄용 책 (CMYK, 부크크 종이책 출판)
- 실시간 협업 (여러 명 동시 편집)
- 다국어 (한국어만)
- 카톡 알림톡 정식 채널 등록 (사업자 인증 후)

### 2.3 기존 spec과 관계

- `2026-05-06-write-page-tabs-design.md` (4탭, 38h) — **흡수**. 본 spec의 Phase 1의 "write 단계 UI" 부분.
- `2026-05-12-clean-redesign-design.md` — **별개**. 사이트 전체 정리는 이미 머지됨.
- `2026-05-13-ai-image-system-design.md` — **별개, 보완**. 표지 만드는 단계에서 AI 이미지 spec 활용.

---

## 3. 핵심 설계 결정 + 이유

### 3.1 8단계 흐름 (Phase 1 핵심)

```
온보딩 (선택)
   ↓
/new (주제·카테고리·대상 — 30초)
   ↓
/write/setup?step=analyze (자료 + AI 핵심 5개 확인 — 2분)
   ↓
/write/setup?step=interview (AI 빈 부분만 5질문 — 3분)
   ↓
/write/setup?step=style (책 톤 + 표지 톤 + 라이브 미리보기 — 1분)
   ↓
/write/setup?step=toc (목차 사용자 수정 — 2분)
   ↓
/write (본문 백그라운드 생성 25분 + 챕터별 검토)
   ↓
/write?step=publish (표지 + 광고 + 상세페이지 — 5분)
   ↓
완성 (PDF + 3 플랫폼 등록 패키지)
```

**총 사용자 입력**: ~13분
**총 시간 (생성 백그라운드 포함)**: ~40분

**왜 단계 분할?**
- 한 화면 한 결정 → A. 초기 설정 혼란 해소
- 진행 시각화 → 어디까지 왔는지 명확
- 각 단계 짧게 → 5분 단위로 끊어 작업 가능 (B. 시간 단위)

### 3.2 자동 저장 + 이어쓰기 (Phase 1, 시간·실패 layer)

**구현**:
- 모든 form 입력 즉시 `localStorage`에 저장 (debounce 500ms)
- 5초마다 DB sync (`/api/projects/[id]` PATCH)
- 페이지 진입 시 마지막 step에서 이어짐 (`/write/setup?id=...` → 자동 redirect to last step)
- 카톡/이메일 알림: 24시간 미접속 사용자에게 "이어서 만들기" CTA

**페일오버**:
- 네트워크 끊김 → localStorage만 유지, online 시 sync
- 충돌 (multi-tab 편집) → 마지막 입력 win + warning

**왜 자동 저장 디폴트?**
- 직장인 = 출퇴근길에 잠깐 → 자리 비움 → 진행 잃으면 안 됨
- 명시적 "저장" 버튼 없음 (UX 단순)

### 3.3 백그라운드 본문 생성 + 알림 (Phase 1, 시간 layer)

**현재**: 본문 12 챕터 = 25분. 사용자 탭 닫으면 진행 멈춤 → 탭 다시 못 열면 영원히 멈춤.

**v3**:
1. 사용자가 "본문 생성 시작" 클릭
2. 서버 큐에 작업 등록 (`book_generation_jobs` 테이블 신규)
3. 백그라운드 워커가 챕터 1개씩 처리 (각 ~2분)
4. 사용자에게:
   - **즉시 알림**: "본문 생성 시작. 약 25분 후 완료. 이메일·카톡으로 알려드립니다"
   - **이메일 진행률**: 25%, 50%, 75%, 100% 시 발송 (또는 완료만)
   - **카톡 알림**: 텔레그램 봇 통해 — 우선 영역 (정식 알림톡은 후속)
5. 사용자가 탭 다시 열면 진행 상태 자동 표시

**책 1권 = 1 작업 큐 항목**. 동시 처리 max 1권 (사용자당) — 잔액 보호.

### 3.4 진행 시각화 (Phase 1, 시간·동기 layer)

**컴포넌트**: `components/write/ProgressBar.tsx` (신규)

표시:
- 전체 8단계 중 어디 (1·2·3·...·8 점)
- 현재 단계 % (예: "본문 작성 8/12 챕터")
- 예상 남은 시간 ("약 12분 남음")
- "백그라운드 진행 중 — 자리 비워도 OK" 안심 메시지

**왜**: 사용자가 "얼마나 남았는지" 모르면 떠남. 명확히 보여줄수록 인내심 ↑.

### 3.5 챕터별 품질 점수 + 자연어 재생성 (Phase 2)

**한국어 자연성 점수** (`/api/chapter/[idx]/score`):
- AI (Claude/Gemini) 호출해서 본문 평가
- 출력: 0~100점 + 개선 제안 ("이 챕터의 '~를 할 수 있다'는 번역투. '~할 수 있어요'로 바꾸세요")
- 비용: ~₩50/챕터

**크몽 통과 가능성** (heuristic, no AI):
- 챕터 수 ≥ 12 → +20점
- 페이지 수 100~200 → +20점
- AI 표현 (예: "한다고 할 수 있습니다") 빈도 < 5% → +20점
- 본문에 [IMAGE: ] placeholder가 채워짐 → +20점
- 표지·상세설명 완성 → +20점
- 합계 = 통과 가능성 %

**챕터별 자연어 재생성**:
- 챕터 카드에 "다시 만들기" 버튼
- 자연어 피드백 입력 ("더 짧게", "예시 3개 추가", "톤 친근하게")
- → AI에 piece-wise prompt
- 비용: ~₩300/챕터 재생성

**왜**:
- "이 책 진짜 팔릴까?" 의심 → 점수로 확인 → 신뢰
- 마음에 안 든 부분만 → 다 다시 안 함 (시간·돈 절약)

### 3.6 동기 layer (Phase 3)

**첫 책 완성 보너스**:
- 책 1권 완성 (export 클릭) 시 → `₩5,000` 추가 크레딧 자동 지급
- DB: `users.first_book_bonus_given` boolean 추가
- 사용자에게 축하 모달 + 다음 책 만들기 권유

**진행 격려 메시지**:
- 진행 단계별 동적 메시지
  - Step 1: "잘 시작했어요!"
  - Step 3: "이제 절반"
  - Step 5: "마지막 단계까지 5분"
  - 완성: "🎉 첫 책 완성! ₩5,000 추가 크레딧 지급됨"

**예제 책 fork** (온보딩 layer로 다음 섹션):

### 3.7 온보딩 layer — 비디오 없이 (Phase 3)

**예제 책 5개 갤러리** (`/examples` 신규):
- 각 책 = title · topic · 첫 챕터 미리보기 · 사용한 톤·표지 스타일
- "이 책으로 시작" 클릭 → 본인 주제로 변경 가능 (fork)
- DB: 시드 데이터 5권 + `is_example: true` 플래그

**인터랙티브 튜토리얼** (`components/onboarding/Tour.tsx` 확장):
- 기존 `OnboardingTour` 있음 (`/projects` 페이지) — 확장
- 첫 방문 시: /new 진입 → tooltip "주제 한 줄만 적으세요"
- 다음 단계마다 tooltip ("이제 자료 올리거나 인터뷰만 답하면 됨")
- "건너뛰기" 항상 가능

**왜 비디오 없이?**
- 사용자 결정: 비디오는 시간 들고 업데이트 어렵고 보지도 않음
- in-app tooltip이 직접 안내 = 즉시 행동 가능

### 3.8 커뮤니티 layer (Phase 4)

**라이브 카운터** (홈 베타 카운터 확장):
- "지금 ___명이 책 만들기 중" — `/write` 페이지 상단 노출
- 5분 간격 polling, 활성 사용자 (지난 5분 내 활동) 집계
- 가입자/완성권수도 같이 표시 (홈 카운터와 동일 데이터)

**완성 축하 피드** (`/write` 사이드바):
- 최근 24시간 내 완성한 책 = "OO○님이 [책 주제] 완성!" (이름 anonymize)
- Privacy: 책 주제는 사용자가 공개 옵션 켤 때만, 기본 비공개
- 모티베이션: "다른 사람도 하고 있어요" 사회적 증거

### 3.9 모바일 마이크로 모드 (Phase 4)

**5분 단위 작업**:
- 모바일 접속 시 "마이크로 모드" 자동 활성화
- 한 화면 한 작업 (예: 인터뷰 1질문, 챕터 1개 검토)
- 작업 끝나면 자동 저장 + "다음 작업 카톡으로 알려드릴게요"

**대상 시나리오**:
- 출퇴근길: 인터뷰 1답변씩 (15분 동안 5답변)
- 점심시간: 챕터 1~2개 검토 (5분 ×2)
- 자기 전: 표지 톤 결정 (1분)

---

## 4. 영향 받는 파일

### 4.1 신규
- `app/examples/page.tsx` — 예제 책 갤러리 (Phase 3)
- `components/onboarding/Tour.tsx` 확장 (Phase 3)
- `components/write/ProgressBar.tsx` (Phase 1)
- `components/write/QualityScore.tsx` (Phase 2)
- `components/write/ChapterCard.tsx` — 챕터별 카드 + 재생성 (Phase 2)
- `components/write/LiveCounter.tsx` (Phase 4)
- `components/write/CompletionFeed.tsx` (Phase 4)
- `components/write/MicroMode.tsx` — 모바일 마이크로 (Phase 4)
- `app/api/chapter/[idx]/score/route.ts` — 한국어 자연성 (Phase 2)
- `app/api/book/[id]/quality/route.ts` — 크몽 통과 가능성 (Phase 2)
- `lib/server/book-generation-queue.ts` — 백그라운드 큐 (Phase 1)
- `lib/server/auto-save.ts` — 자동 저장 인프라 (Phase 1)
- `app/api/cron/book-generation-worker/route.ts` — 큐 워커 (Phase 1)

### 4.2 수정
- `app/write/setup/page.tsx` — 6 substep 분할 (Phase 1)
- `app/write/page.tsx` — 본문 생성 백그라운드 + 챕터 카드 (Phase 1, 2)
- `app/new/page.tsx` — Tour tooltip 진입점 (Phase 3)
- `app/projects/page.tsx` — fork CTA 노출 (Phase 3)
- `app/api/generate/chapter/route.ts` — queue 사용 (Phase 1)
- `app/api/cron/email-recovery/route.ts` — "이어서 만들기" 트리거 추가 (Phase 1)
- `db/schema.ts` — `book_generation_jobs`, `users.first_book_bonus_given` 등 (Phase 1, 3)

### 4.3 DB 마이그레이션
```sql
-- Phase 1
CREATE TABLE book_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued', -- queued / processing / completed / failed
  current_chapter_idx integer NOT NULL DEFAULT 0,
  total_chapters integer NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz
);

-- Phase 3
ALTER TABLE users
  ADD COLUMN first_book_bonus_given boolean NOT NULL DEFAULT false;
```

---

## 5. PR 분할 계획 (4 Phase, 14~18일)

### Phase 1 — 핵심 흐름 (5 PR, ~5일)
1.1. 8단계 substep 분할 (`/write/setup` 6 step)
1.2. 자동 저장 + 이어쓰기 (localStorage + DB sync)
1.3. 백그라운드 큐 + 워커 (book_generation_jobs)
1.4. 이메일 알림 (생성 완료 시)
1.5. 진행 시각화 (ProgressBar)

### Phase 2 — 품질·신뢰 (3 PR, ~4일)
2.1. 한국어 자연성 점수 API + UI (QualityScore)
2.2. 크몽 통과 가능성 % (heuristic)
2.3. 챕터별 자연어 재생성 (ChapterCard 신규)

### Phase 3 — 진입·동기 (3 PR, ~4일)
3.1. 예제 책 5개 갤러리 + fork (`/examples`)
3.2. 인터랙티브 튜토리얼 (Tour 확장)
3.3. 첫 책 완성 보너스 (₩5,000 + 격려 메시지)

### Phase 4 — 커뮤니티·모바일 (4 PR, ~5일)
4.1. 라이브 카운터 (활성 사용자 polling)
4.2. 완성 축하 피드 (privacy-aggregated)
4.3. 모바일 마이크로 모드 (5분 단위)
4.4. 카톡 알림 (텔레그램 봇 기반, 베타)

---

## 6. 리스크 & 미확정

### 6.1 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 백그라운드 워커가 Vercel serverless에서 작동 어려움 | 큼 | Vercel Cron 사용 (1분 간격 polling) 또는 Upstash QStash 검토 |
| 품질 점수 AI 호출 비용 누적 | 중간 | 챕터당 ₩50 = 12 챕터 ₩600/책. 표준 시나리오 ₩7,400에 흡수 가능 |
| 자동 저장 충돌 (multi-tab) | 작음 | 마지막 입력 win + warning |
| 예제 책 fork = 누구 책? | 작음 | 시스템 시드 데이터 (가짜 작가). 사용자 본인 콘텐츠 아님 |
| 라이브 카운터 = 사용자 적으면 "1명" 표시 → 빈약 | 중간 | 비활성 사용자 24시간 내 합산. "지난 24시간 N명 활동" 형태 |
| 카톡 알림 = 정식 알림톡 채널 없음 | 중간 | 베타: 텔레그램 봇만. 정식 알림톡은 사업자 인증 후 |
| 첫 책 보너스 = 어뷰징 위험 | 작음 | DB flag로 1회 제한. 자기 자신 추천 막음 |

### 6.2 미확정

- **챕터 카드 디자인** — 자연어 재생성 UI는 모달? 인라인 폼? 디자인 옵션 fine-tune 필요
- **모바일 마이크로 모드 UX 디테일** — 화면 구체 디자인은 Phase 4에서 추가 mockup
- **품질 점수 모델** — Claude / Gemini / GPT-4o 어느 거 쓸지. 비용·정확도 trade-off
- **백그라운드 워커 인프라** — Vercel Cron vs Upstash QStash vs Inngest. Phase 1 시작 시 결정

---

## 7. 의사결정 요약

| 결정 | 선택 | 핵심 근거 |
|------|-----|----------|
| 흐름 단계 수 | 8단계 (substep 분할) | 한 화면 한 결정, 5분 단위 작업 가능 |
| 자동 저장 | localStorage + 5초 DB sync | 직장인 자리 비움 보호. 명시적 "저장" 버튼 X |
| 백그라운드 생성 | DB 큐 + cron worker | 탭 닫아도 진행. Vercel serverless 친화 |
| 알림 채널 | 이메일 + 텔레그램 봇 (베타) | 정식 알림톡은 사업자 인증 후 |
| 진행 시각화 | 전체 % + 현재 단계 % + 남은 시간 | 인내심 ↑ |
| 한국어 점수 | AI 호출 (Claude/Gemini) | 휴리스틱은 정확도 ↓ |
| 크몽 통과 점수 | 휴리스틱 (no AI) | 자유 비용. 정확도는 명백한 패턴만 잡음 |
| 자연어 재생성 | 챕터 단위 (전체 X) | 시간·돈 절약. 마음에 안 든 부분만 |
| 온보딩 비디오 | **제외 (사용자 결정)** | in-app tooltip이 직접. 비디오 유지보수 부담 |
| 예제 책 | 시스템 시드 5개 + fork | 빈 종이 공포 해소. 진짜 책 만든 사용자 안 필요 |
| 완성 보너스 | ₩5,000 추가 크레딧 (1회) | 동기 ↑. 어뷰징은 1회 제한으로 막음 |
| 라이브 카운터 | 24시간 활성 합산 | 베타 단계 빈약 노출 방지 |
| 모바일 마이크로 | 자동 활성화 | 직장인 출퇴근길 시나리오 |

---

## 8. 다음 단계

스펙 검토 후 동의하면:
- Phase 1 (핵심 흐름) → 5 PR 순차 진행
- Phase 2, 3, 4 → 별도 spec 확인 후 진행 가능
- 각 Phase 끝나면 라이브 사용자 데이터 보고 우선순위 재조정

검토 포인트:
1. 8단계 흐름 적정한가 (더 잘게/합치기?)
2. 백그라운드 워커 = Vercel Cron으로 충분한가 (또는 Upstash QStash?)
3. ₩5,000 보너스 적정 (더 많이/적게?)
4. Phase 1 → 4 순서 OK?
5. 카톡 알림 = 텔레그램 봇 기반 OK (정식 알림톡 대신 베타)?

위 5개 검토 후 진행. 다른 의견 있으면 알려주세요.

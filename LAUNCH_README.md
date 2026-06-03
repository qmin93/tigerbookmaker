# tigerbookmaker 베타 사전예약 — 런칭 키트

> 사용자가 돌아왔을 때 5분 안에 완성하는 가이드.
> 모든 코드/문서/스크립트는 준비됨. 사람만이 할 수 있는 일만 남음.

---

## 🚀 5분 시퀀스

### 1. PR 머지 (2분)

두 PR을 순서대로 머지:

1. **tigerbookmaker PR #47** — https://github.com/qmin93/tigerbookmaker/pull/47
   - 결과: `/preorder` 라이브 + `/admin/preorders` 라이브 + 5일 이메일 시퀀스 활성
2. **managerkim PR #167** — https://github.com/jaychalling/managerkim/pull/167
   - 결과: `/docs/ai-ebook-30min` 라이브 (Naver SEO 자산)

### 2. 환경변수 + DB 마이그레이션 (2분)

Vercel 대시보드 → tigerbookmaker 프로젝트 → Settings → Environment Variables:

| 변수 | 값 | 필수 |
|---|---|---|
| `RESEND_API_KEY` | Resend 가입 후 발급 | ✅ |
| `EMAIL_FROM` | `김과장 <hello@managerkim.com>` (도메인 인증 후) | ✅ |
| `CRON_SECRET` | `openssl rand -base64 32` 로 생성한 문자열 | ✅ |
| `ADMIN_EMAILS` | `qmin93@gmail.com` (또는 본인 이메일, 콤마 구분) | ✅ |
| `POSTGRES_URL` | Vercel Postgres 자동 (이미 있음) | ✅ |

DB 마이그레이션 (로컬에서 1번 실행):
```bash
cd tigerbookmaker
node scripts/launch.mjs
```
이 스크립트가:
- `.env.local` 환경변수 점검
- `0017_preorders.sql` + `0018_preorder_sequence_log.sql` 자동 적용 (이미 있으면 skip)
- Resend / Cron 키 유무 출력
- Threads 발행 캘린더 출력
- 인터뷰 진행 가이드 출력

### 3. 트래픽 시작 (1분)

도메인 확인 + Vercel deploy 완료 확인:
- https://tigerbookmaker.vercel.app/preorder
- https://tigerbookmaker.vercel.app/admin/preorders
- https://managerkim.com/docs/ai-ebook-30min

테스트 신청 1건 본인이 직접:
1. `/preorder` 에서 본인 이메일로 신청
2. Day 0 이메일 받았는지 확인 (Resend dashboard에서 발송 로그)
3. `/admin/preorders` 에서 신청자 1건 표시 확인

---

## 📅 1주 운영 캘린더

`scripts/launch.mjs` 실행 결과에서 자동 생성되는 일정대로 발행:

| 요일 | 시간 | 액션 | 자료 |
|---|---|---|---|
| 월 21:00 | 5분 | Threads 포스트 1 — 실패담 | `docs/marketing/threads-launch-5posts.md` 포스트 1 |
| 화 21:00 | 5분 | Threads 포스트 2 — 잘못된 믿음 | 포스트 2 |
| 수 21:00 | 5분 | Threads 포스트 3 — 결점 인정 | 포스트 3 |
| 목 21:00 | 5분 | Threads 포스트 4 — 양극화 | 포스트 4 |
| 금 21:00 | 5분 | Threads 포스트 5 — **직접 후크 (사전예약 링크)** | 포스트 5 |
| 토 | 30분 | 댓글 응대 + 사전예약 데이터 확인 | `/admin/preorders` |
| 일 | 30분 | 인터뷰 모집 메시지 5명에게 전송 | `research/day4-5-interviews/interview-script.md` |

---

## 🎤 인터뷰 5명 진행

### 모집 (일주일 안에)

채널 우선순위:
1. **Threads 댓글로 모집 (포스트 5번 발행 후)** — "혹시 한 분이라도 30분 인터뷰 가능하시면 사전예약 평생 베타 가격 보장해드려요"
2. **지인 1-2명** — 크몽 셀러 / 부업 작가 / 코치 중
3. **사전예약자 중 얼리버드 (입금 의향) 표시한 분** — 가장 강한 ICP 시그널

### 진행

`research/day4-5-interviews/interview-script.md` 들고 30분씩.
인터뷰 후 즉시 `notes-01.md` ~ `notes-05.md` 에 작성.

---

## 📊 Day 7 결정문 v2 채우기

5명 인터뷰 완료 + 사전예약 7일 데이터 모인 시점:

1. `/admin/preorders` 에서 스냅샷 (총 신청 / ICP 분포 / 평균 입금의향)
2. `research/day7-decision-v2.md` 열어서 `[BRACKET]` 채움
3. 시나리오 A/B/C 박스에 체크
4. 다음 spec 트리거:
   - **GO** → `superpowers:writing-plans` 로 Week 2 풀빌드 plan
   - **PIVOT** → `superpowers:brainstorming` 으로 피벗 방향
   - **NO-GO** → `superpowers:finishing-a-development-branch` 마무리

---

## 🛠 준비된 코드/문서 인벤토리

### tigerbookmaker repo

| 영역 | 파일 | 상태 |
|---|---|---|
| Spec | `docs/superpowers/specs/2026-06-01-tigerbookmaker-direction.md` | ✅ |
| Plan | `docs/superpowers/plans/2026-06-01-tigerbookmaker-week1-diagnostics.md` | ✅ |
| Day 1 | `research/day1-icp-candidates.md`, `day1-value-ladder-v0.md` | ✅ |
| Day 2-3 | `research/day2-3-funnel-hacking/` (9 노트 + 광고 정책) | ✅ |
| Day 4 | `research/day4-5-interviews/interview-script.md` + 빈 노트 5개 | 사용자 대기 |
| Day 5 | `research/day5-hook-story-offer-v1.md` | ✅ |
| Day 6 | `research/day6-attractive-character.md`, `day6-funnel-selection.md` | ✅ |
| Day 7 v1 | `research/day7-decision.md` (가설) | ✅ |
| **Day 7 v2** | `research/day7-decision-v2.md` (실측 템플릿 95% 사전) | 사용자 채움 |
| 랜딩 코드 | `app/preorder/page.tsx`, `app/preorder/layout.tsx`, `app/preorder/opengraph-image.tsx` | ✅ |
| 폼 API | `app/api/preorder/route.ts`, `app/api/preorder/stats/route.ts` | ✅ |
| **관리자 대시보드** | `app/admin/preorders/page.tsx` | ✅ |
| 이메일 시퀀스 | `lib/server/preorder-emails.ts` (6 step) | ✅ |
| Cron 라우트 | `app/api/cron/preorder-sequence/route.ts` | ✅ |
| DB 마이그레이션 | `db/migrations/0017_preorders.sql`, `0018_preorder_sequence_log.sql` | ✅ |
| **런칭 스크립트** | `scripts/launch.mjs` | ✅ |
| Threads 5포스트 | `docs/marketing/threads-launch-5posts.md` | ✅ |

### managerkim repo (autowork)

| 영역 | 파일 | 상태 |
|---|---|---|
| SEO 가이드 | `lib/docs.ts` (15번째 항목 `ai-ebook-30min`) | ✅ |
| PR | https://github.com/jaychalling/managerkim/pull/167 | ✅ |

---

## ❓ 자주 빠지는 함정

1. **EMAIL_FROM 도메인 인증 안 함** — Resend는 인증된 도메인에서만 발송 가능. 일단 `onboarding@resend.dev` 로 시작해도 동작은 함.
2. **Vercel Hobby 플랜 cron 제한** — 매일 1회만 가능. 우리 `preorder-sequence` 는 매일 10시 1회로 설정해서 OK.
3. **ADMIN_EMAILS 빠뜨림** — 본인 이메일을 넣지 않으면 `/admin/preorders` 접근 불가.
4. **사전예약 가입자에게 처음부터 인터뷰 부탁** — 너무 빠르면 신뢰 부족. 5포스트 다 발행 후 + 사전예약 신청 후 모집.
5. **광고에서 "월 ₩X 부수익" 카피** — Meta UBP / Google Unreliable Claims 즉시 차단. 절대 사용 X. 광고는 "AI 자동 집필 도구" 라인만.

---

## 🎯 성공 정의 (Week 2 시작 기준)

- 사전예약 30+명 (전체 100명 목표의 30%)
- 인터뷰 5명 완료 + ICP 확정
- Threads 포스트 5개 발행 + 총 노출 1,000+
- Day 7 결정문 v2 완성 + Week 2 spec 시작

이 상태에서 Week 2 진입 가능.

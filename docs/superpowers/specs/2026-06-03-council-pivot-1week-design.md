# 2026-06-03 Council 만장일치 PIVOT — 1주 핵심 액션 설계

> 기반: `.agents/council/2026-06-03-tigerbookmaker-verdict.md` (5 판정자 PIVOT 6.14/10)
> 프레임: 마케팅 설계자 (러셀 브런슨) 28 secrets
> 사용자 제약: 김과장 페르소나는 managerkim 전용, tigerbookmaker는 단독 브랜드

## 0. 결정 요약

5 판정자 만장일치 PIVOT. 5개 시급 액션 중 김과장 노출(#5)을 제외하고 **4개 액션을 1주 안에 단일 spec으로 처리**. 일별 배치는 effort + 의존성 순.

| # | 액션 | effort | D-day |
|---|---|---|---|
| 1 | 광고정책 risk 제거 (라벨링 + 동의 체크박스) | small | **D+1** |
| 2 | DB 적용 + 미니 이북 PDF + Day 0 발송 활성화 | small | **D+3** |
| 3 | HERO 하단 인라인 PDF 이메일 캡처 | small | **D+5** |
| 4 | HERO 우측 SVG 30초 데모 애니메이션 | medium | **D+7** |
| 보너스 | 브랜드 양극화 풀 쿼우트 박스 | small | D+5 묶음 |

## 1. 배경 — Council 핵심 발견 4개

### 잘 한 것
- **PersonaHero 4 ICP 동적 헤드라인** (Secret 1·18) — 한국 SaaS 상위 5%
- **비교표 8행 + 권당 결제 차별점** (Secret 2·5) — 글로벌 5개 월구독 vs 권당
- **Day 0-5 Resend 백엔드** (Secret 7) — 단, 발송 0건 (DB 대기)

### 치명적 약점
- **가설 후기 라벨 의무 위반** (오늘 발효 공정위 지침) — **risk 높음, 광고 1원 = 도메인 차단 도미노**
- **층 1 리드자석 실물 0** (Secret 3·8·11) — "자기 제품으로 미끼 안 만든 건 자기 입증 포기"
- **Day 0 발송 0건** — Russell 데이터: Day 1-5 오픈율 28% → 9% 추락
- **30분 약속 + 데모 영상 0초** — "진짜 30분?" 의심 해소 못 함

## 2. 섹션 1 — 광고정책 risk 제거 (D+1)

### 1-1. 메인 / 사회적 증거 섹션 — 후기 3장 톤다운

**현재**: 박지수/김민지/이정훈 후기 카드 (white 배경 + 명조체 인용)
**변경**:
- 카드 배경 `white` → `#E7E0D2/40` (회색 톤다운)
- 섹션 헤더 위 작은 명조체 라벨:
  ```
  ※ 베타 예시 사례 · 실제 사용자 후기는 인터뷰 진행 후 교체 예정
  ```
- 각 카드 상단 mono 라벨:
  ```
  EXAMPLE · 베타 시뮬레이션
  ```
- 인용문에서 수익 약속 톤 제거:
  - Before: "라인업 1권 → 4권, 매출 월 ₩50만"
  - After: "주말에 일하지 않아도 라인업이 늘었어요"
  - Before: "한 달 매출 ₩X"
  - After: "외주 견적 ₩300k 받고 포기했던 게 30분으로"

### 1-2. PersonaHero 카피 — 수익 약속 제거

**현재 ICP별 헤드라인**:
- kmong_seller: "크몽 라인업 1권 → 4권"
- side_writer: "Maily 구독자 800명 → 자기 이름의 책 1권"
- coach: "강의 PPT 1개 → 학습서 1권"

**변경 (수익·결과 약속 → 도구·시간 약속)**:
- kmong_seller: "크몽 PDF 자료, 퇴근 후 30분에"
- side_writer: "블로그 글 한 권의 책으로"
- coach: "강의 PPT 한 개로 학습서 한 권"
- general: "주제 한 줄, 책 한 권, 30분." (유지)

PersonaHero `highlight` 인용도 같은 방향으로 톤다운.

### 1-3. /preorder 폼 — 3개 동의 체크박스

**현재**: 이메일 + ICP + intent + 제출 버튼
**추가**:
제출 버튼 위에 체크박스 영역.

```tsx
<div className="space-y-2">
  <label className="flex items-start gap-2 text-xs text-[#7B7468]">
    <input type="checkbox" required name="consent_ai" />
    <span>AI 생성 콘텐츠 도구임을 확인했습니다 (한국 AI 기본법 2026-01)</span>
  </label>
  <label className="flex items-start gap-2 text-xs text-[#7B7468]">
    <input type="checkbox" required name="consent_ads" />
    <span>표시광고법 안내를 확인했습니다 (베타 예시 후기 포함)</span>
  </label>
  <label className="flex items-start gap-2 text-xs text-[#7B7468]">
    <input type="checkbox" required name="consent_privacy" />
    <span>이메일 수집·이용에 동의합니다 (베타 안내·자료 발송 외 미사용)</span>
  </label>
</div>
```

폼 검증: 3개 모두 체크 안 하면 제출 disabled. 서버에서도 검증.

### 1-4. 메인 / FAQ — 1문항 추가

기존 4문항에 1개 추가:
- Q: "후기는 실제 사용자인가요?"
- A: "현재 메인의 박지수·김민지·이정훈 후기는 베타 예시 사례입니다. 실제 베타 사용자 인터뷰가 완료되면 본인 동의 하에 교체합니다. 한국 공정위 표시광고 심사지침 2026-06-01에 따라 예시임을 명시합니다."

---

## 3. 섹션 2 — 미니 이북 PDF + Day 0 발송 (D+3)

### 2-1. 자산 제작 (사용자 task)

**파일**: `public/leadmagnet/tigerbookmaker-mini.pdf`
**내용 가이드**:
- 주제: `크몽 PDF 셀러 첫 ₩100만 가이드` (또는 사용자 결정)
- 분량: 30페이지 (라이트 티어)
- 12챕터 + 표지 자동 생성 → 사용자 10% 마무리
- PDF 마지막 페이지에 작은 박스:
  ```
  이 책은 tigerbookmaker로 30분 안에 만들어졌어요.
  본인이 만든 책의 저작권은 100% 본인 거예요.
  → tigerbookmaker.vercel.app
  ```

**제작 순서**:
1. DB 마이그레이션 완료 (다음 단계)
2. 사이트 가입 + `/new` 에서 30분 직접 제작
3. PDF 다운로드 → repo public 폴더에 배포

### 2-2. DB 마이그레이션 적용

`scripts/launch.mjs` 실행:
- 환경변수 점검
- `0017_preorders.sql` + `0018_preorder_sequence_log.sql` 자동 적용
- preorders 테이블 행 수 0 확인

### 2-3. Day 0 이메일 템플릿 보강

`lib/server/preorder-emails.ts` 의 `buildStep0` 수정:

**추가 요소**:
- PDF 다운로드 버튼 (warm cream 배경, vermilion 테두리)
  ```html
  <a href="https://tigerbookmaker.vercel.app/leadmagnet/tigerbookmaker-mini.pdf"
     style="display:inline-block;padding:14px 24px;background:#D24B2A;color:white;border-radius:10px;text-decoration:none;font-weight:700;">
    📕 미니 이북 PDF 받기 →
  </a>
  ```
- 자기 입증 박스 (PDF 발송 직전):
  ```
  이 PDF는 tigerbookmaker로 30분에 만들어졌어요.
  본인이 만든 책은 100% 본인 거예요.
  ```
- Day 1 예고 hook (마지막 단락):
  ```
  내일 한 통, "진짜 30분에 되나"
  베타 예시 사례 (박지수씨) 보내드릴게요.
  ```

### 2-4. /preorder 폼 success state 교체

**현재**: "창간 첫날, 가장 먼저 연락드릴게요"
**새**:
```
📬 메일함을 확인하세요

미니 이북 PDF + 키워드 30개가 1분 내 도착합니다.
못 받으셨다면 spam 폴더를 확인해주세요.
```

PDF 미리보기 thumbnail 표시 (140x186, 표지 시뮬레이션 컴포넌트 재활용).

---

## 4. 섹션 3 — HERO 하단 인라인 PDF 캡처 (D+5)

### 3-1. 위치 + 레이아웃

`app/_home/PersonaHero.tsx` 컴포넌트 내, CTA 버튼 영역 직하단:

```tsx
<div className="mt-12 p-5 rounded-2xl border border-[#D24B2A]/30 bg-white/70 backdrop-blur">
  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#D24B2A] mb-3">
    ⚡ 지금 즉시 받기
  </div>
  <h3 className="text-lg font-bold text-ink-900 mb-2">
    미니 이북 1권 + 크몽 키워드 30개
  </h3>
  <p className="text-sm text-[#7B7468] mb-4">
    이메일 입력 1분 내 도착. 사전예약과는 별도 — 지금 바로 효용.
  </p>
  <form onSubmit={submitLeadmagnet} className="flex gap-2">
    <input
      type="email"
      placeholder="이메일"
      required
      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:border-[#D24B2A] focus:outline-none"
    />
    <button
      type="submit"
      className="px-5 py-3 bg-[#D24B2A] text-white rounded-lg font-bold hover:bg-[#A93917] transition whitespace-nowrap"
    >
      PDF 받기 →
    </button>
  </form>
</div>
```

### 3-2. DB 스키마 변경 — intent enum 확장

마이그레이션 신규 `db/migrations/0019_preorder_intent_leadmagnet.sql`:
```sql
-- intent enum 확장: 'preorder' | 'paid_intent' | 'leadmagnet'
-- 기존 데이터에 영향 없음 (CHECK constraint 없으면 그대로 OK)
-- preorders 테이블의 intent 컬럼은 TEXT 이므로 별도 ALTER 불필요
-- 코드 레벨에서 'leadmagnet' 추가하면 됨

COMMENT ON COLUMN preorders.intent IS
  'preorder | paid_intent | leadmagnet (즉시 PDF 받기, hero 하단 인라인 폼)';
```

### 3-3. API 라우트 — 동일 /api/preorder 재사용

`app/api/preorder/route.ts` 의 `intent` 유효값에 `'leadmagnet'` 추가.

leadmagnet 신청 시:
- `preorders` 테이블에 intent="leadmagnet"로 insert
- Day 0 이메일 즉시 발송 (`buildStep0` 같은 PDF + 환영)
- 단, 5일 시퀀스는 보내지 않음 (intent !== 'preorder' 일 때 skip)
- cron의 sequence 발송 조건에 `WHERE intent = 'preorder'` 필터 추가

→ 별도 API 라우트 생성 불필요. 같은 폼·로그 사용.

### 3-4. 성공 화면

leadmagnet 신청 후 인라인 폼 자리에 success 메시지 (페이지 전환 X):
```
✓ 메일함을 확인하세요 — 1분 내 도착
사전예약도 별도 신청 가능 ↓
```

---

## 5. 섹션 4 — HERO SVG 30초 데모 애니메이션 (D+7)

### 4-1. 컴포넌트 위치

`app/_home/PersonaHero.tsx` 의 `<HeroBookIllustration />` 교체.
새 컴포넌트: `app/_home/DemoAnimation.tsx`

### 4-2. 4컷 구조

`viewBox="0 0 600 600"` 같은 영역 유지. SVG 안에 4개 그룹을 시간차로 fade/transform.

| Cut | 시간 (s) | 내용 |
|---|---|---|
| 1 | 0–7 | 빈 텍스트 박스에 글자 한 자씩 타이핑 ("퇴근 후 30분 PDF 만들기"). 커서 깜빡임. |
| 2 | 7–14 | 텍스트 박스 사라지고 12개 챕터 목차가 위에서 순차 등장. 진행률 바 0→100%. |
| 3 | 14–21 | 챕터 사라지고 표지 30종 그리드 (6×5) 페이드인. 한 표지에 vermilion 외곽선 하이라이트. |
| 4 | 21–28 | 표지 1개로 줌인. PDF 미리보기 + "DOWNLOAD" 도장 회전 등장. |
| 휴식 | 28–30 | 페이드 → 처음으로 리셋 |

### 4-3. 기술 — CSS 애니메이션 + SVG opacity

각 컷 그룹 (`<g id="cut-1">` ~ `<g id="cut-4">`) 에 keyframe:
```css
@keyframes cut1 {
  0%, 23% { opacity: 1; }
  25%, 100% { opacity: 0; }
}
@keyframes cut2 {
  0%, 23% { opacity: 0; }
  25%, 46% { opacity: 1; }
  48%, 100% { opacity: 0; }
}
/* ...각 컷 23.3% 구간 활성 */
```

30s 무한 루프. `animation-fill-mode: both`.

### 4-4. 모바일·접근성

**모바일 (768px↓)**:
- 자동 재생 정지 (배터리/데이터 절약)
- 첫 컷 정적 표시
- 사용자 탭으로 재생 시작 (Play 아이콘 오버레이)

**`prefers-reduced-motion`**:
- 자동 재생 중단
- 4컷 정적 grid로 표시 (2x2)

### 4-5. 캡션 (SVG 하단)

작은 mono 라벨 (현재 시간 표시):
```
00:00 / 00:30  ●○○○
```
바뀌는 시간에 따라 ● 위치 이동. 데모 진행도 직관적.

---

## 6. 보너스 섹션 — 브랜드 양극화 카피

비교표와 후기 사이에 명조체 풀 쿼우트 박스 1개:

```tsx
<section className="relative z-4 px-6 py-24">
  <div className="max-w-3xl mx-auto text-center">
    <div className="text-[120px] font-serif text-[#D24B2A] leading-none mb-2">"</div>
    <blockquote
      style={{ fontFamily: '"Nanum Myeongjo", serif' }}
      className="text-3xl md:text-4xl font-bold text-ink-900 leading-tight tracking-tight"
    >
      외주 ₩300,000 한 번 vs
      <br />
      권당 <span className="text-[#D24B2A]">₩4,000</span> 무제한.
    </blockquote>
    <div className="mt-6 text-xs font-mono uppercase tracking-[0.18em] text-[#7B7468]">
      어느 쪽이 합리적인가요?
    </div>
  </div>
</section>
```

서명 없이 brand voice. 김과장 노출 0.

---

## 7. 검증 기준 (각 액션 완료 정의)

### 액션 1 (광고정책)
- [ ] 메인 후기 3장 톤다운 + "예시" 라벨 노출 (스크린샷 확인)
- [ ] PersonaHero 4 ICP 카피에 수익 약속 단어 0개 (grep 검증: "₩X만", "월 ₩", "+₩")
- [ ] /preorder 폼 3개 동의 체크박스 미체크 시 제출 disabled
- [ ] FAQ "후기는 실제 사용자인가요?" 노출
- [ ] `npm run build` 통과

### 액션 2 (DB + PDF + Day 0)
- [ ] `node scripts/launch.mjs` 성공 (preorders + preorder_sequence_log 테이블 생성)
- [ ] `public/leadmagnet/tigerbookmaker-mini.pdf` 존재 (30p, 2MB 이하)
- [ ] /preorder 본인 이메일 테스트 신청 → 1분 내 Day 0 이메일 도착
- [ ] Day 0 이메일에 PDF 다운로드 버튼 + 자기 입증 박스 + Day 1 예고
- [ ] /admin/preorders 에서 본인 신청 1건 표시 + sequence_log step=0 sent

### 액션 3 (HERO 인라인 캡처)
- [ ] 메인 / HERO 직하단 인라인 폼 노출
- [ ] 마이그레이션 0019 적용 (intent comment)
- [ ] leadmagnet 신청 → preorders에 intent="leadmagnet"로 insert
- [ ] 같은 이메일이 leadmagnet + preorder 둘 다 신청 가능 (24h dedupe는 intent 별로)
- [ ] 5일 시퀀스는 intent='preorder' 만 발송 (cron WHERE 절 검증)
- [ ] 인라인 폼 success 메시지 페이지 전환 없이 표시

### 액션 4 (SVG 데모)
- [ ] `app/_home/DemoAnimation.tsx` 컴포넌트 신설
- [ ] PersonaHero에서 BookIllustration → DemoAnimation 교체
- [ ] 30초 무한 루프 (Chrome devtools 확인)
- [ ] 모바일 (390px) 정적 표시 + 탭으로 재생
- [ ] `prefers-reduced-motion: reduce` 시 정적 4컷 grid
- [ ] 캡션 진행도 점 4개 이동 확인

### 보너스 섹션
- [ ] 비교표 다음 섹션에 풀 쿼우트 박스 등장
- [ ] 명조체 vermilion `"` 따옴표 + 3-4xl 헤드라인
- [ ] 김과장 서명·인용 없음

---

## 8. 변경 파일 인벤토리

### 신규 생성
- `db/migrations/0019_preorder_intent_leadmagnet.sql`
- `app/_home/DemoAnimation.tsx`
- `public/leadmagnet/tigerbookmaker-mini.pdf` (사용자 task)

### 수정
- `app/page.tsx` — 후기 톤다운 + 풀 쿼우트 + FAQ +1
- `app/_home/PersonaHero.tsx` — 카피 톤다운 + 인라인 캡처 + Demo 교체
- `app/preorder/page.tsx` — 3개 동의 체크박스 + success state
- `app/api/preorder/route.ts` — leadmagnet intent 처리
- `app/api/cron/preorder-sequence/route.ts` — intent='preorder' 필터
- `lib/server/preorder-emails.ts` — Day 0 PDF 발송 보강

### 검증·실행
- `scripts/launch.mjs` 1회 실행 (사용자 task)

---

## 9. 위험 + 보완

### 광고 정책 risk (액션 1로 해결)
오늘 발효된 공정위 지침 위반 risk. 액션 1 완료 후 광고 1원도 안 태우는 self-channel 전략 유지 → 자체 채널 (Threads + Naver SEO + 이메일) 만으로 사전예약 100명 모집.

### PDF 미발송 risk (액션 2로 해결)
DB 미적용 상태에서 사전예약자 받으면 Day 0 이메일 0건 → Day 1-5 오픈율 28%→9% 추락. 사용자 launch.mjs 실행이 절대 first move.

### leadmagnet 폼 spam risk (액션 3)
공개 인라인 폼은 봇 가입 risk. honeypot 필드 + rate limit (IP+UA hash 5/min) 추가.

### SVG 영상 무거움 risk (액션 4)
SVG 4컷 동시 DOM 로드 시 모바일 렌더링 비용 큼. CSS animation으로 GPU 가속 + `will-change: transform, opacity` 명시.

---

## 10. 다음 단계

1. 사용자가 본 spec 검토
2. 합의 후 `writing-plans` skill로 일별 실행 plan 작성
3. 실행 (User + Claude 협업, Threads/PDF/DB 적용은 User task)

## 11. 미결정 / 추후

- 미니 이북 PDF 주제 결정 (사용자 task) — 현재 가이드만 제시
- 실제 베타 사용자 인터뷰 진행 → 후기 교체 (Week 2-3)
- 사전예약 100명 달성 후 Meta 광고 카피 안전 변환 + Business verification (Week 4+)
- 김과장 별도 채널 (managerkim.com docs) 운영 — 본 spec 범위 외

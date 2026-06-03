# 1번 퍼널 선택 (Day 6 v1)

> 책 Secret 27: "한 번에 다 만들지 말 것." 하나만 선택해서 ACV>CPA가 될 때까지 반복.
> v1은 인터뷰 데이터 없는 가설. Day 5 인터뷰 후 v2로 확정.

## ⚠️ Day 3 광고 정책 deep-research 반영 (2026-06-01)

`ad-policy-memo.md` 결론: tigerbookmaker risk 등급 **높음**.
- Meta: 부수익 카피 = UBP 위반 즉시 차단
- Google Ads: AI 콘텐츠 + 재정 약속 = 사전 경고 없이 영구 정지
- 한국 공정위 (오늘 발효): AI 가상인물 광고 라벨링 의무
- 한국 AI 기본법: AI 콘텐츠 표시 의무

→ **유료 광고 의존 1번 퍼널은 risk 너무 큼**. 자체 콘텐츠 + SEO + 이메일 리스트 빌드를 우선.

## 후보 비교 (Day 2–3 분석 종합 + 광고 정책)

| 퍼널 | 책 Secret | ACV 추정 | CPA 추정 | v3 재사용 | 베끼는 경쟁사 | 광고 의존도 | 채택 점수 |
|---|---|---|---|---|---|---|---|
| 리드 스퀴즈 (자체 채널) | 8 | ₩9–19k 30일 LTV | **₩0–3k** (콘텐츠) | 부분 | Inkfluence AI | 낮음 | ⭐⭐⭐⭐⭐ |
| 책 퍼널 (디지털 ₩1,900) | 11 | ₩5–25k + OTO | 중 (₩7–15k) | 강함 | Russell Brunson | 중 | ⭐⭐⭐ |
| 챌린지 (7일 7권) | 13 | ₩20–50k | 중 (₩10–20k) | 강함 | 챌린저스 | 중 | ⭐⭐⭐ |
| VSL | 14 | ₩199k | 높음 | 약함 | ❌ | 높음 | ⭐ |

## 선택: 🥇 리드 스퀴즈 퍼널 (자체 채널 트래픽 우선)

### 사유 (3줄)

1. **광고 정책 risk 회피** = 자체 채널(Threads + Naver 블로그 + 이메일 리스트)로 1차 트래픽. 광고는 Week 2 후반에 카피 안전 변환 후 소액 테스트.
2. **진입 장벽 최저** = 카드 없음, 사전예약만. 데이터 수집 빠름 (책 Secret 28 "첫 퍼널은 매출보다 데이터")
3. **v3 자산 활용** = 베타 ₩5,000 크레딧 + examples + 라이브 카운터 그대로

### 트래픽 채널 우선순위 (광고 정책 반영)

1. ⭐ **Threads 자체 콘텐츠** (김과장 페르소나, managerkim 자산)
2. ⭐ **Naver 블로그 SEO** (managerkim.com에 tigerbookmaker 가이드 추가)
3. ⭐ **이메일 리스트 빌드** (Day 4–5 인터뷰이 → 사전예약 직접 공유)
4. Meta 광고 — 카피 안전 변환 + Business verification 후 Week 2 후반 소액 테스트
5. ❌ Google Ads — 회피 권장 (영구 정지 risk)

### Week 2 작업 범위 (1번 퍼널에만 집중)

- **페이지** (현재 `/preorder`):
  - 위치: ✅ 이미 작성됨 (`app/preorder/page.tsx`)
  - 카피: Day 5 HSO v1으로 교체 (이번 커밋에서 진행)
  - 도메인: `tigerbookmaker.vercel.app/preorder` 또는 별도 캠페인 URL
  
- **스크립트**:
  - 후크: Day 5 v1 4종 (차/따/뜨 + 의문형)
  - 스토리: 박지수 페르소나 4단락 압축
  - 제안: 가치 스택 5개 항목, ₩49,600 정가, ₩0 베타

- **이메일 시퀀스 (5일 소프트오페라)**:
  - Day 1: 무대 설정 + 미니 이북 발송
  - Day 2: 페인포인트 강화
  - Day 3: 깨달음 (영상 또는 데모)
  - Day 4: 박지수 후기 인용
  - Day 5: 행동 유도 ("베타 ₩0, 오늘 시작")
  - 구현: Day 6 자리표시. Week 2에 Resend로 자동화 구현.

- **광고**: Week 2 후반에 ₩10–30만 테스트 (광고 정책 결과 확인 후)
  - 채널 우선순위: Meta > Threads 자체 콘텐츠 > Google
  - 카피 4종 A/B 테스트

- **측정 지표 (책 Secret 28)**:
  - 등록률: 방문자 대비 이메일 입력 = **목표 30%**
  - 결제율: 등록자 대비 5일 시퀀스 후 결제 = **목표 5–10%**
  - ACV: 첫 결제 + 30일 충전 평균
  - CPA: 광고비 / 결제자 수

## Week 2부터 보류·삭제·숨김할 v3 기능 (Secret 27)

선택된 1번 퍼널 (리드 스퀴즈)에 집중하기 위해 **일시 숨김·후순위**:

| 라우트 | 상태 | 사유 |
|---|---|---|
| `app/import-blog` | 숨김 | 퍼널 외부 기능, 1번 퍼널 동선과 무관 |
| `app/external-publishing` | 숨김 | Week 3+에 재평가 |
| `app/external-linkbio` | 숨김 | 1번 퍼널 후속 단계 |
| `app/kmong-listing-helper` | 보류 | 후속 가치 자료로 활용 |
| `app/preview` | 보류 | 퍼널 동선 분기 — 단일 동선 유지 |
| `app/r`, `app/u`, `app/share` | 보류 | 1번 퍼널 outflow 단계 |
| `app/trends` | 보류 | 차후 가치 자료 |
| `app/series`, `app/challenges` | 보류 | Week 4+ 2번 퍼널 후보 |

**삭제 X**. Header/Navigation에서 숨김 처리만. 코드는 유지.

## Day 6 랜딩 카피 교체 작업 (이번 커밋)

| PLACEHOLDER | v1 값 |
|---|---|
| `PLACEHOLDER:HOOK` | "퇴근 후 30분, 첫 PDF 자료가 나옵니다." (이미 일치) |
| `PLACEHOLDER:SUBHEAD` | Day 5 v1으로 교체 |
| `PLACEHOLDER:STORY` | Day 5 v1 박지수 스토리 압축 3단락 |
| `PLACEHOLDER:OFFER_HEADLINE` | "지금 신청하면 — 미니 이북 1편 + 베타 권당 ₩0 시작" |
| `PLACEHOLDER:OFFER_STACK` | 5개 항목 + 정가 ₩49,600 노출 |
| `PLACEHOLDER:CHARACTER` | "만든 사람 — 김과장 (managerkim)" 1줄 + 링크 |

## v1 → v2 보정 (Day 5 인터뷰 + Day 7 데이터 후)

- [ ] ACV/CPA 추정이 실제 인터뷰 지불의사와 맞는지
- [ ] 등록률 30%가 실제 사전예약 랜딩에서 달성되는지 (Day 6 측정)
- [ ] 1번 퍼널이 정말 리드 스퀴즈인지, 책 퍼널/챌린지로 변경할지 (Day 7 결정)

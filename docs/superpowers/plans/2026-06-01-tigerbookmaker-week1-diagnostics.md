# tigerbookmaker Week 1 Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec `2026-06-01-tigerbookmaker-direction.md`의 Week 1 진단을 7일 안에 실행 — ICP 확정, 가치 사다리 v1, 퍼널 해킹 9건, 인터뷰 5건, 후크-스토리-제안 v1, 매력적인 캐릭터, 리드 스퀴즈 랜딩, GO/PIVOT/NO-GO 결정문까지.

**Architecture:** 마케팅 설계자 (러셀 브런슨) 프레임워크 기반. 매일 1개 Day = 1개 Task. 산출물은 `research/` 폴더(신설)에 마크다운으로 누적, 마지막에 결정문으로 종합. Day 6에 실제 코드(랜딩 페이지) 작업 1회.

**Tech Stack:** Next.js 14 (기존), 기존 `app/page.tsx` 패턴, Markdown 산출물, deep-research skill, agent-browser skill.

**작업 폴더:** 본 plan은 `spec/direction-reassessment-week1` 브랜치에서 실행. 산출물은 같은 브랜치에 누적 커밋.

**실행 주체 구분:**
- **🤖 Claude task** — 템플릿 생성, 시장 리서치 (deep-research), 코드 작성
- **👤 User task** — 실제 인터뷰 진행, 경쟁사 제품 결제, ICP 최종 판단

---

## File Structure

```
docs/superpowers/plans/
  2026-06-01-tigerbookmaker-week1-diagnostics.md   # 이 파일
research/                                          # 신설
  day1-icp-candidates.md                           # ICP 후보 3개 가설표
  day1-value-ladder-v0.md                          # 가치 사다리 4단 초안
  day2-3-funnel-hacking/
    README.md                                      # 9건 인덱스
    direct-01-mindbook.md
    direct-02-sudowrite.md
    direct-03-novelai.md
    indirect-01-kmong.md
    indirect-02-notion-templates.md
    indirect-03-gpt-prompts.md
    similar-01-leadsqueeze.md
    similar-02-book-funnel.md
    similar-03-challenge-funnel.md
    ad-policy-memo.md
  day4-5-interviews/
    interview-script.md                            # 4질문 + 후속 질문
    notes-01.md ... notes-05.md
  day5-hook-story-offer-v1.md
  day6-attractive-character.md
  day6-funnel-selection.md
  day7-decision.md                                 # GO/PIVOT/NO-GO + Week 2 spec
app/
  preorder/                                        # Day 6 리드 스퀴즈 랜딩 (신설)
    page.tsx
  api/
    preorder/route.ts                              # 사전예약 폼 처리 (신설)
db/migrations/
  0002_preorders.sql                               # preorders 테이블 추가
```

---

## Task 1 (Day 1): ICP 후보표 + 가치 사다리 v0

**Files:**
- Create: `research/day1-icp-candidates.md`
- Create: `research/day1-value-ladder-v0.md`

- [ ] **Step 1: 🤖 research 폴더 + ICP 후보표 템플릿 생성**

Create `research/day1-icp-candidates.md`:

```markdown
# ICP 후보표 (Day 1 가설)

> 책 Secret 1 + Secret 24 기반. 외부 목표 + 내부 목표를 모두 채울 것.

## ICP-1: 크목 셀러 (전자책·PDF 판매)

| 항목 | 가설 |
|---|---|
| 이름 (상상) | 박지수, 32세 |
| 직업/상황 | 회사 마케터, 사이드로 크몽에서 PDF 자료 판매 중 |
| 어디 모이나 | 크몽 셀러 카페, 페북 "크몽 사이드잡" 그룹, 디스코드 X |
| 외부 목표 | 월 50만원 부수익, 크몽 매출 다변화 |
| 내부 목표 | 자신감, 본업 의존도 줄이기, 자기 콘텐츠 자산 |
| 현재 어떻게 | Notion + ChatGPT 직접 + Canva 표지, 1권 만드는 데 2–3주 |
| 가장 큰 페인 | 시간, 디자인 (표지), 챕터 구조 잡기 |
| 지불 의사 가설 | ₩9k 단권 / ₩39k 월구독 / ₩89k 부트캠프 |
| 유입 채널 가설 | 크몽 베스트셀러 후기, Threads 부업 콘텐츠, 페북 그룹 |

## ICP-2: 부업 작가 (블로그·뉴스레터 운영자)

[ICP-1과 동일 항목 채울 것. 페르소나는 35세 워킹맘, 네이버 블로그 4000명 구독자, 이미 PDF 무료 배포 경험 등 구체적으로]

## ICP-3: 1인 코치/강사 (오프라인 강의 + 온라인 콘텐츠)

[ICP-1과 동일 항목 채울 것. 페르소나는 38세 영어강사 등 구체적으로]

## Day 4–5 인터뷰 모집 우선순위

Day 1 시점에서는 셋 다 가설이므로 모든 ICP에서 1–2명씩 인터뷰. Day 5 종료 시점에 1개로 좁힘.
```

- [ ] **Step 2: 👤 ICP-2, ICP-3 가설 직접 채우기**

User가 직접 본인 네트워크/관찰 기반으로 ICP-2, ICP-3을 ICP-1과 같은 형식으로 채움. Claude는 빈 칸을 보고 합리적 가설을 제안할 수 있음 (요청 시).

- [ ] **Step 3: 🤖 가치 사다리 v0 템플릿 생성**

Create `research/day1-value-ladder-v0.md`:

```markdown
# 가치 사다리 v0 (Day 1)

> 책 Secret 3 기반. 4층. 무료→저가→중가→고가 순.

## 층 1: 무료 (리드 마그넷)

- **상품**: 미니 이북 1편 자동 생성 (10페이지 PDF) + 이메일 받기
- **목적**: 카드정보 없이 진입 장벽 0, 이메일 리스트 확보
- **이미 v3에 있나**: 부분적으로 — `/examples` 페이지 + 첫 책 보너스 (Phase 3)
- **퍼널 유형**: 리드 스퀴즈 (Secret 8)

## 층 2: 저가 진입 (₩9,900–₩29,000)

- **상품 후보 A**: 풀버전 이북 1권 (현재 v3 기본 상품)
- **상품 후보 B**: 첫 책 무료 + 두번째 책 ₩9.9k (책 퍼널, Secret 11)
- **목적**: 카드 정보 받기, 신뢰 구축
- **이미 v3에 있나**: 네 — 충전 ₩1k–₩50k 모델
- **퍼널 유형**: 책 퍼널 또는 장바구니 (Secret 11, 12)

## 층 3: 중가 (₩59,000–₩299,000)

- **상품 후보 A**: 무제한 월구독
- **상품 후보 B**: 14일 챌린지 "30분 이북 14권 챌린지" (Secret 13)
- **상품 후보 C**: 표지·내지·SEO 풀패키지
- **목적**: 핵심 매출원
- **이미 v3에 있나**: 부분적 — 챌린지 기능 코드는 있음 (`app/challenges`)
- **퍼널 유형**: VSL 또는 웨비나 (Secret 14, 15)

## 층 4: 고가 (₩2,000,000+)

- **상품 후보 A**: 1:1 자비출판 컨설팅 (오프라인 인쇄까지)
- **상품 후보 B**: 브랜드북 제작 대행 (B2B)
- **상품 후보 C**: 작가 코호트 6주 프로그램
- **목적**: 가치 사다리 최상단, 고LTV
- **이미 v3에 있나**: ❌
- **퍼널 유형**: 신청서 퍼널 (Secret 17)

## 층간 연결 가설

- 1→2: 무료 미니 이북 다운로드 → 5일 시퀀스 이메일 (Secret 7) → 풀버전 결제
- 2→3: 첫 책 완성 직후 OTO (Secret 21) → 챌린지/구독 제안
- 3→4: 챌린지 졸업자에게 1:1 컨설팅 제안 (Secret 17)

## Day 6 결정 사항

1번 퍼널은 층 1 (리드 스퀴즈) 또는 층 2 (책 퍼널) 중 선택. Day 6에 결정.
```

- [ ] **Step 4: 👤 가치 사다리 v0 검토 + 보정**

User가 본인 직관과 v3 실제 코드 상태 보고 보정. 특히 층 3, 4 후보는 직접 판단.

- [ ] **Step 5: ✅ 커밋**

```bash
cd "/c/Users/yangjong/OneDrive/바탕 화면/tigerbookmaker"
git add research/day1-icp-candidates.md research/day1-value-ladder-v0.md
git commit -m "day1: ICP 후보 3개 + 가치 사다리 v0 — 책 Secret 1/3/24"
```

---

## Task 2 (Day 2): 퍼널 해킹 — 직접 경쟁사 3건

**Files:**
- Create: `research/day2-3-funnel-hacking/README.md`
- Create: `research/day2-3-funnel-hacking/direct-01-mindbook.md`
- Create: `research/day2-3-funnel-hacking/direct-02-sudowrite.md`
- Create: `research/day2-3-funnel-hacking/direct-03-novelai.md`

- [ ] **Step 1: 🤖 퍼널 해킹 템플릿 + README 생성**

Create `research/day2-3-funnel-hacking/README.md`:

```markdown
# Day 2–3 퍼널 해킹 노트

> 책 Secret 5 기반. 직접 경쟁사 3 + 간접 경쟁사 3 + 유사 구조 3 = 9건.
> 핵심: 그냥 보지 말고 직접 가입·결제 체험. 무리하면 결제 직전까지만.

## 표준 템플릿

각 .md 파일은 아래 섹션을 채운다.

### 1. 대상 개요
- 회사/제품:
- URL:
- 카테고리: 직접/간접/유사
- 가격대:
- 캐치프레이즈 (메인 후크):

### 2. 광고 → 랜딩 진입 경로
- 광고 본 채널 (Meta/구글/유튜브/직접 검색):
- 광고 카피 후크:
- 랜딩 1초 인상:

### 3. 후크 (Hook)
- 헤드라인:
- 서브헤드:
- 시각 요소:
- 방문자 온도 가정 (차/따/뜨):

### 4. 스토리 (Story)
- 스타 (주인공) 소개:
- 어떤 문제 → 해결 여정:
- 사회적 증거 (후기·숫자):
- 잘못된 믿음 깨기 시도:

### 5. 제안 (Offer)
- 메인 상품:
- 가치 스택 (포함된 것 나열):
- 가격 앵커:
- 실제 가격:
- 보장 (환불 등):
- 긴급성/희소성:

### 6. 결제 페이지
- 한 페이지 vs 다단계:
- 폼 길이:
- 결제 수단:
- 신뢰 요소 (보안 마크 등):

### 7. 업셀 / OTO (Secret 21)
- 범프 오퍼 (체크박스):
- OTO 1, 2, 3:
- OTO 가격대:

### 8. 감사 페이지
- 단순 "감사합니다" vs 오퍼월:
- 추가 제안:

### 9. 후속 이메일
- 시퀀스 며칠:
- 톤 (소프트오페라 vs 사인필드):
- 다음 제안:

### 10. 학습 포인트
- tigerbookmaker가 베낄 만한 구조:
- tigerbookmaker가 피해야 할 부분:
- ACV/CPA 추정:
```

- [ ] **Step 2: 👤 직접 경쟁사 후보 확정**

User가 다음 후보 중 3개 확정 (또는 직접 발굴):
- Mindbook (한국, AI 이북 생성)
- Sudowrite (글로벌, AI 글쓰기)
- NovelAI (글로벌, AI 소설)
- ProWritingAid (글로벌, AI 글쓰기 보조)
- 한국의 다른 AI 이북/콘텐츠 SaaS

후보가 비어 있으면 Claude에게 "deep-research로 한국 AI 이북 SaaS 5개 찾아줘" 요청.

- [ ] **Step 3: 👤 경쟁사 1 가입 + 가능하면 결제 직전까지 체험**

순서:
1. 광고나 검색으로 진입
2. 랜딩 → 가입 → 결제 페이지까지 진행 (실제 결제는 선택)
3. 스크린샷 5–10장 저장
4. 템플릿 채우기

- [ ] **Step 4: 🤖 경쟁사 1 노트 작성 보조**

User가 스크린샷·스크립트 공유하면 Claude가 템플릿 채우기 보조. `direct-01-<제품명>.md` 생성.

- [ ] **Step 5: 👤+🤖 경쟁사 2, 3 반복**

Step 3–4 반복하여 `direct-02-*.md`, `direct-03-*.md` 작성.

- [ ] **Step 6: ✅ 커밋**

```bash
git add research/day2-3-funnel-hacking/
git commit -m "day2: 퍼널 해킹 직접 경쟁사 3건 — 책 Secret 5"
```

---

## Task 3 (Day 3): 퍼널 해킹 — 간접 + 유사 구조 6건 + 광고 정책

**Files:**
- Create: `research/day2-3-funnel-hacking/indirect-01-kmong.md`
- Create: `research/day2-3-funnel-hacking/indirect-02-notion-templates.md`
- Create: `research/day2-3-funnel-hacking/indirect-03-gpt-prompts.md`
- Create: `research/day2-3-funnel-hacking/similar-01-leadsqueeze.md`
- Create: `research/day2-3-funnel-hacking/similar-02-book-funnel.md`
- Create: `research/day2-3-funnel-hacking/similar-03-challenge-funnel.md`
- Create: `research/day2-3-funnel-hacking/ad-policy-memo.md`

- [ ] **Step 1: 👤+🤖 간접 경쟁사 3건 분석**

간접 경쟁사 후보:
- 크몽 외주 작가 (PDF 자료 판매자) — 카테고리 검색해서 베스트셀러 3개 분석
- 노션 템플릿 판매자 (Gumroad·Notion Marketplace)
- ChatGPT 프롬프트 묶음 판매 (PromptBase 등)

각각 Task 2 템플릿으로 노트 작성.

- [ ] **Step 2: 🤖 유사 구조 퍼널 3건 deep-research**

다른 업종이지만 같은 퍼널 유형을 쓰는 사례 3건.

Run: deep-research with question:
> "한국 또는 글로벌에서 '리드 스퀴즈 퍼널 → 책 퍼널 → 챌린지 퍼널' 3가지 유형 각각의 성공 사례 1개씩 — 실제 ACV/CPA 데이터가 공개된 케이스로. 마케팅 SaaS, 헬스, 부업 카테고리 우선."

결과를 받아 `similar-01-leadsqueeze.md`, `similar-02-book-funnel.md`, `similar-03-challenge-funnel.md`로 저장.

- [ ] **Step 3: 🤖 광고 정책 deep-research**

Run: deep-research with question:
> "2026년 현재 Meta(페이스북/인스타그램), Google Ads, Naver 검색광고에서 AI 생성 콘텐츠/이북 광고에 대한 정책 — 금지 조항, 검수 가이드라인, 최근 정책 변경 (2026년 1–5월). 실제 차단 사례."

결과를 `research/day2-3-funnel-hacking/ad-policy-memo.md`로 저장.

- [ ] **Step 4: ✅ 커밋**

```bash
git add research/day2-3-funnel-hacking/
git commit -m "day3: 퍼널 해킹 간접 3 + 유사 구조 3 + 광고 정책 메모"
```

---

## Task 4 (Day 4): 인터뷰 스크립트 + 인터뷰 3건

**Files:**
- Create: `research/day4-5-interviews/interview-script.md`
- Create: `research/day4-5-interviews/notes-01.md`
- Create: `research/day4-5-interviews/notes-02.md`
- Create: `research/day4-5-interviews/notes-03.md`

- [ ] **Step 1: 🤖 인터뷰 스크립트 생성**

Create `research/day4-5-interviews/interview-script.md`:

```markdown
# 인터뷰 스크립트 (Day 4–5)

> 책 Secret 1 + Secret 24 기반. 30분 통화 또는 텍스트 인터뷰.

## 오프닝 (2분)

"안녕하세요, 김과장입니다. 저희가 AI로 이북 자동 생성 도구를 만들고 있어서, 실제로 이북·PDF 자료를 만들어 보신 분들의 진짜 어려움을 알고 싶어서 30분만 시간 부탁드렸어요. 결제 유도 같은 거 아니고 오늘은 순수하게 듣기만 합니다. 녹음/메모해도 될까요?"

## Secret 1 — 꿈의 고객 4 질문 (15분)

### Q1 (누구) — 직업/상황

- "지금 어떤 일을 하고 계세요? 본업과 사이드 활동 모두."
- 후속: 이북/PDF는 본업인가, 사이드인가?
- 후속: 시작한 지 얼마나 됐나요?

### Q2 (어디 모이나) — 채널

- "비슷한 일 하는 분들 어디서 정보 얻으세요? 카페·디스코드·페북 그룹·뉴스레터 같은 거."
- 후속: 그 중 가장 자주 들어가는 곳?
- 후속: SNS 어디 활동하세요? (Threads·X·인스타·블로그)

### Q3 (어떤 미끼) — 무료로 받으면 가입할 만한 가치

- "최근에 누군가 무료로 제공한 자료 중에 '이건 진짜 가져가야지' 하고 이메일 입력하신 거 있어요?"
- 후속: 그게 왜 좋았나요?
- 후속: 반대로 '이거 별로다' 한 건?

### Q4 (진짜 원하는 결과) — 외부 + 내부 목표

- 외부: "이북/콘텐츠로 이루고 싶은 구체적 결과는요? 매출, 구독자, 권 수 등."
- 내부: "그걸 이루면 뭐가 달라질 것 같으세요?" (자유, 인정, 자신감 등)
- 후속: "3년 뒤 본인을 상상하면 어떤 모습이세요?"

## Secret 24 — 장애물 + 잠재력 (10분)

### Q5 — 장애물

- "지금까지 그 목표를 이루지 못한 이유가 뭐였을까요?"
- **체크**: 외부 탓 (시장·운·주변) vs 내부 인정 (시간·실행력·지식). 내부 인정형이 ICP 적합도 높음.

### Q6 — 현재 어떻게 만드나

- "지금 이북 한 권 만든다면 어떤 순서로 작업하세요?"
- 후속: 어디서 가장 시간이 많이 드나요?
- 후속: 도구는 뭘 쓰세요? ChatGPT? Notion? Canva?

### Q7 — 지불 의사

- "AI가 30분에 이북 1권을 만들어준다면 얼마면 사실래요?"
- (구간 제시 X, 자유 답변 우선)
- 후속: "그 가격이면 한 번 사실래요, 여러 권 만들 거예요?"
- 후속: "구독 (월 ₩X)이면 어때요?"

### Q8 — 무료 미끼 반응

- "미니 이북 1편 무료로 받고 이메일만 주는 거면 어떠세요?"
- 후속: "어떤 주제의 미니 이북이면 즉시 가입할 만 한가요?"

## 클로징 (3분)

"마지막으로, 비슷한 일 하시는 분 1–2명 소개 가능할까요? 그분들께도 같은 30분 부탁드리려고요."

## 인터뷰 노트 템플릿

```markdown
# 인터뷰 노트 NN

- 일시:
- 채널: 통화 / 텍스트 / 대면
- 인터뷰이 (가명):
- ICP 매칭: ICP-1 / ICP-2 / ICP-3 / 신규

## Q1–Q8 요약 (각 2–3줄)

## 시그널
- [ ] 외부 목표 명확 표현
- [ ] 내부 목표 명확 표현
- [ ] 내부 인정형 (외부 탓 X)
- [ ] 지불 의사 표현 (₩X)
- [ ] 무료 미끼에 긍정 반응

5/5 = 강한 시그널 / 3+/5 = 중간 / 2 이하 = 약함

## 인용 보석 (verbatim 1–3개)

> "..."

## 다음 행동
- 사전예약 랜딩 공유 가능 여부:
- 소개 가능 인물:
```
```

- [ ] **Step 2: 👤 인터뷰 5명 모집**

채널 후보 (Day 1 ICP 후보표 참고):
- Threads 본인 계정에서 모집 글
- 크몽 셀러 카페 / 페북 그룹
- 지인 1–2명
- Day 3 deep-research 결과로 추가 채널 발굴

목표: Day 4에 3명 진행, Day 5에 나머지 2명.

- [ ] **Step 3: 👤 인터뷰 3건 진행 (Day 4)**

각 인터뷰 후 즉시 `notes-01.md`, `notes-02.md`, `notes-03.md` 작성.

- [ ] **Step 4: 🤖 인터뷰 노트 정리 보조**

User가 인터뷰 raw 메모를 공유하면 Claude가 시그널 체크·인용 추출 보조.

- [ ] **Step 5: ✅ 커밋**

```bash
git add research/day4-5-interviews/
git commit -m "day4: 인터뷰 스크립트 + 인터뷰 3건 — 책 Secret 1/24"
```

---

## Task 5 (Day 5): 인터뷰 2건 + 후크-스토리-제안 v1

**Files:**
- Create: `research/day4-5-interviews/notes-04.md`
- Create: `research/day4-5-interviews/notes-05.md`
- Create: `research/day5-hook-story-offer-v1.md`

- [ ] **Step 1: 👤 인터뷰 2건 진행**

Task 4 Step 3와 동일 방식으로 `notes-04.md`, `notes-05.md` 작성.

- [ ] **Step 2: 👤+🤖 인터뷰 종합 → ICP 1개 확정**

5건의 시그널 점수를 비교해 가장 강한 ICP 1개로 좁힘. ICP 확정 결과를 `research/day1-icp-candidates.md` 맨 위에 추가:

```markdown
## 🏆 Day 5 종합: 확정 ICP

ICP-N: [선택한 ICP]
사유: 5건 중 [N]명이 외부+내부 목표를 명확히 표현, 지불의사 ₩[X] 표현. 다른 ICP는 [신호 약한 이유].
```

- [ ] **Step 3: 🤖 후크-스토리-제안 v1 작성 (역순 브레인스토밍)**

Create `research/day5-hook-story-offer-v1.md`:

```markdown
# 후크-스토리-제안 v1 (Day 5)

> 책 Secret 2 기반. 만드는 순서는 제안 → 스토리 → 후크 역순.

## 1. 제안 (Offer) — 먼저 설계

확정 ICP에게 가장 매력적인 제안 1개.

### 메인 상품
[1줄]

### 가치 스택 (Secret 20 — 합산해서 총 가치 수치화)
| 포함 | 가치 |
|---|---|
| [항목 1] | ₩XX,000 |
| [항목 2] | ₩XX,000 |
| ... | |
| **합계** | **₩XXX,000** |

### 가격 앵커 + 실제 가격
- 정가 (총 가치): ₩XXX,000
- 오늘 가격: ₩X,X00 (또는 무료 + 배송비)

### 보장
[30일 환불 / 만족 보장 / 결과 보장 등]

### 긴급성 / 희소성
[선착순 / 마감 / 한정 수량]

## 2. 스토리 (Story)

확정 ICP의 인터뷰 인용을 변형해서 스타-스토리-솔루션 구조 (Secret 20).

### 스타 (주인공)
[이름 (가명) — 인터뷰 중 시그널 5/5였던 분의 페르소나, 1단락]

### 스토리 (변화의 여정, 4–6단락)
1. 시작 상황 (페인포인트, 인터뷰 인용)
2. 시도했지만 실패한 것들 (인터뷰 인용)
3. 잘못된 믿음 (예: "이북은 작가가 직접 써야 한다")
4. 깨달음 (AI가 30분에 만들면)
5. 결과 (외부 + 내부 목표 달성)

### 솔루션
[tigerbookmaker가 어떻게 이 변화를 가능하게 하는지, 3가지 핵심 포인트]

## 3. 후크 (Hook)

### 방문자 온도별 헤드라인 3종 (Secret 18)

**차가운 (모르는 사람):**
> [고통/문제 직접 건드림]

**따뜻한 (문제는 알지만 우리는 모름):**
> [결과 중심]

**뜨거운 (이미 우리 아는 사람):**
> [회사명·제품명 직접]

### 의문형 헤드라인 1종
> "[고통] 없이 [바람]을 이루고 싶지 않으신가요?"
```

- [ ] **Step 4: ✅ 커밋**

```bash
git add research/
git commit -m "day5: 인터뷰 5건 완료 + ICP 확정 + 후크-스토리-제안 v1"
```

---

## Task 6 (Day 6): 매력적인 캐릭터 + 1번 퍼널 선택 + 리드 스퀴즈 랜딩 코드

**Files:**
- Create: `research/day6-attractive-character.md`
- Create: `research/day6-funnel-selection.md`
- Create: `app/preorder/page.tsx`
- Create: `app/api/preorder/route.ts`
- Create: `db/migrations/0002_preorders.sql`

### Step 1: 매력적인 캐릭터 정의

- [ ] **🤖 캐릭터 문서 템플릿 생성**

Create `research/day6-attractive-character.md`:

```markdown
# 매력적인 캐릭터 (Day 6)

> 책 Secret 4 기반.

## 결정: tigerbookmaker 캐릭터

### 페르소나 선택
- [ ] 옵션 A: 김과장 (managerkim) 공유 — 자동화 김과장이 이북도 만든다
- [ ] 옵션 B: tigerbookmaker 전용 신설 페르소나 (예: "이북 PD")
- [ ] 옵션 C: 본인 (qmin) 본명 노출

**선택**: [A/B/C]
**사유**: [1단락]

## 4가지 요소 (Secret 4)

### 1. 배경 이야기
[시행착오 → 지금이 된 과정, 1단락 3–5문장]

### 2. 비유
[어려운 개념(AI 이북 생성)을 일상으로 풀어내기, 1–2개]

### 3. 결점
[완벽하지 않은 면, 1개 — 예: "디자인은 진짜 못 해요. 그래서 AI에 맡깁니다"]

### 4. 양극화
[명확한 입장 1개 — 예: "AI 이북은 표절이 아니라 도구입니다. 도구 못 쓰는 게 더 손해."]

## 캐릭터 유형 (Secret 4)
- [ ] 지도자형
- [ ] 모험가형
- [ ] 기자형
- [ ] 영웅형

**선택**: [유형]
**사유**: [1줄]

## 톤 가이드 (모든 채널 공통)
- 어조: [존댓말 / 반말 / 혼용]
- 이모지 사용: [최소 / 적당 / 많이]
- 1인칭: [저 / 우리 / 김과장은]
- 금기 표현: [목록]
```

- [ ] **👤 캐릭터 결정 + 문서 작성**

User가 위 템플릿에서 옵션 A/B/C 선택 + 4가지 요소 + 유형 + 톤 결정.

### Step 2: 1번 퍼널 선택

- [ ] **🤖 퍼널 선택 문서 작성**

Create `research/day6-funnel-selection.md`:

```markdown
# 1번 퍼널 선택 (Day 6)

> 책 Secret 27: "한 번에 다 만들지 말 것." 하나만 선택해서 ACV>CPA가 될 때까지 반복.

## 후보 비교

| 퍼널 | 책 Secret | ACV 추정 | CPA 추정 | v3 코드 재사용 | 채택 신호 (인터뷰) |
|---|---|---|---|---|---|
| 리드 스퀴즈 | 8 | (무료 → 후속 2~3차 결제 평균) | 낮음 | 부분 | [강/중/약] |
| 책 퍼널 | 11 | (₩9.9k 첫 결제 + OTO 평균) | 중 | 강함 (v3 결제 인프라) | [강/중/약] |
| 챌린지 | 13 | (₩59k 챌린지 결제) | 중–높음 | 강함 (`app/challenges`) | [강/중/약] |
| VSL | 14 | (₩199k 패키지) | 높음 | 약함 (영상 필요) | [강/중/약] |

## 선택: [퍼널 이름]

### 사유 (3줄)
- ACV/CPA 추정 기반:
- 인터뷰 신호 기반:
- v3 코드 재사용도:

### Week 2 작업 범위 (선택된 퍼널에만 집중)
- 페이지: [목록]
- 스크립트: [후크/스토리/제안 어디에 어떻게]
- 광고: [채널, 예산, 카피]
- 측정 지표: ACV, CPA, 등록률, 전환율

### Week 2부터 보류·삭제·숨김할 v3 기능
- [목록 — 책 Secret 27 "한 번에 다 만들지 말 것"]
```

- [ ] **👤 퍼널 선택 결정**

User가 인터뷰 + 퍼널 해킹 데이터 보고 1개 확정. 통상 1순위는 리드 스퀴즈 (진입장벽 낮고 v3 자산 활용 가능).

### Step 3: 리드 스퀴즈 랜딩 페이지 코드

> 가정: Step 2에서 리드 스퀴즈가 선택됨. 다른 퍼널이 선택되면 본 Step의 코드 구조는 그대로지만 카피가 달라짐.

- [ ] **🤖 DB 마이그레이션 작성**

Create `db/migrations/0002_preorders.sql`:

```sql
CREATE TABLE IF NOT EXISTS preorders (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  icp_signal TEXT,           -- 어떤 ICP라고 자기응답했는지 (선택)
  intent TEXT NOT NULL,       -- 'preorder' | 'paid_intent'
  amount_won INTEGER,         -- 입금의향 금액 (paid_intent일 때만)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preorders_created ON preorders(created_at DESC);
CREATE INDEX idx_preorders_email ON preorders(email);
```

- [ ] **🤖 API 라우트 작성**

Create `app/api/preorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, icp_signal, intent, amount_won, utm_source, utm_medium, utm_campaign } = body;

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (intent !== "preorder" && intent !== "paid_intent") {
    return NextResponse.json({ error: "invalid_intent" }, { status: 400 });
  }

  await sql`
    INSERT INTO preorders (email, icp_signal, intent, amount_won, utm_source, utm_medium, utm_campaign)
    VALUES (${email}, ${icp_signal ?? null}, ${intent}, ${amount_won ?? null}, ${utm_source ?? null}, ${utm_medium ?? null}, ${utm_campaign ?? null})
  `;

  return NextResponse.json({ ok: true });
}
```

- [ ] **🤖 랜딩 페이지 작성**

Create `app/preorder/page.tsx`:

```tsx
"use client";

import { useState } from "react";

// Day 5에서 작성한 후크-스토리-제안 v1을 이 컴포넌트의 카피로 옮김.
// 아래 PLACEHOLDER 문구를 Day 5 결과로 교체.

export default function PreorderPage() {
  const [email, setEmail] = useState("");
  const [icpSignal, setIcpSignal] = useState("");
  const [intent, setIntent] = useState<"preorder" | "paid_intent">("preorder");
  const [amount, setAmount] = useState<number | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const params = new URLSearchParams(window.location.search);
    const res = await fetch("/api/preorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        icp_signal: icpSignal || undefined,
        intent,
        amount_won: intent === "paid_intent" ? Number(amount) : undefined,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
      }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">신청 완료 🎉</h1>
        <p className="mt-4 text-gray-600">베타 오픈 시 이메일로 우선 안내드립니다.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* HOOK — Day 5의 헤드라인 v1 (차가운 방문자용 기본) */}
      <h1 className="text-4xl font-bold leading-tight">
        {/* PLACEHOLDER: Day 5 후크-스토리-제안 v1의 차가운 헤드라인 */}
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        {/* PLACEHOLDER: 서브헤드 — 핵심 가치 1줄 */}
      </p>

      {/* STORY — 짧은 버전 (랜딩 1페이지) */}
      <section className="mt-12 space-y-4 text-gray-700">
        <p>{/* PLACEHOLDER: 스타-스토리 압축 3–4단락 */}</p>
      </section>

      {/* OFFER */}
      <section className="mt-12 rounded-lg border bg-gray-50 p-6">
        <h2 className="text-2xl font-semibold">{/* PLACEHOLDER: 제안 헤드라인 */}</h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-gray-700">
          {/* PLACEHOLDER: 가치 스택 항목 */}
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          {/* PLACEHOLDER: 가격 앵커 + 보장 */}
        </p>
      </section>

      {/* CTA FORM */}
      <form onSubmit={submit} className="mt-12 space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full rounded-md border px-4 py-3"
        />

        <select
          value={icpSignal}
          onChange={(e) => setIcpSignal(e.target.value)}
          className="w-full rounded-md border px-4 py-3"
        >
          <option value="">현재 어떤 일 하세요? (선택)</option>
          <option value="kmong_seller">크몽/PDF 셀러</option>
          <option value="side_writer">블로그/뉴스레터 운영</option>
          <option value="coach">1인 코치/강사</option>
          <option value="other">기타</option>
        </select>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={intent === "preorder"}
              onChange={() => setIntent("preorder")}
            />
            <span>일단 사전예약 (베타 오픈 시 알림)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={intent === "paid_intent"}
              onChange={() => setIntent("paid_intent")}
            />
            <span>이 가격이면 즉시 결제 의향:</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              placeholder="₩"
              className="w-32 rounded-md border px-3 py-1"
              disabled={intent !== "paid_intent"}
            />
            <span>원</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "loading" ? "신청 중..." : "사전예약 신청"}
        </button>

        {status === "error" && (
          <p className="text-sm text-red-600">오류가 발생했어요. 다시 시도해 주세요.</p>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        {/* PLACEHOLDER: 신뢰 요소 — 캐릭터(Day 6) 한 줄 소개 */}
      </p>
    </main>
  );
}
```

> **PLACEHOLDER 주석은 의도적으로 Day 5/6 결과물에서 채워 넣을 자리표.** 빌드는 통과하지만 카피가 비어 있어 실제 운영 전 반드시 채울 것.

- [ ] **👤 PLACEHOLDER를 Day 5/6 결과로 교체**

Day 5 후크-스토리-제안 v1과 Day 6 캐릭터 문서를 읽고 PLACEHOLDER를 실제 카피로 교체.

- [ ] **🤖+👤 DB 마이그레이션 실행**

Vercel Postgres SQL 콘솔 또는 로컬 psql에서:
```bash
psql $POSTGRES_URL -f db/migrations/0002_preorders.sql
```

- [ ] **🤖+👤 로컬 빌드 확인**

```bash
cd "/c/Users/yangjong/OneDrive/바탕 화면/tigerbookmaker"
npm install
npm run build
```

Expected: 빌드 성공, `app/preorder` 라우트 생성됨.

- [ ] **🤖+👤 Vercel 배포 + 랜딩 공유**

```bash
git add app/preorder app/api/preorder db/migrations/0002_preorders.sql research/day6-attractive-character.md research/day6-funnel-selection.md
git commit -m "day6: 매력적인 캐릭터 + 1번 퍼널 선택 + 리드 스퀴즈 랜딩 — 책 Secret 4/8/27"
git push -u origin spec/direction-reassessment-week1
```

Vercel preview URL을 Threads/지인/Day 4–5 인터뷰이에게 공유. Day 7까지 신청자/입금의향 데이터 수집.

---

## Task 7 (Day 7): GO/PIVOT/NO-GO 결정문 + Week 2 spec

**Files:**
- Create: `research/day7-decision.md`
- Create: `docs/superpowers/specs/2026-06-08-tigerbookmaker-week2.md` (조건부 — GO/PIVOT일 때만)

- [ ] **Step 1: 🤖+👤 데이터 집계**

수집할 지표:
- 인터뷰 5건 시그널 점수 평균
- 퍼널 해킹 9건 ACV/CPA 추정 평균
- 사전예약 랜딩 등록 수, 등록률 (방문자 대비), 입금의향 수
- 광고 정책 risk 등급 (낮/중/높)

Create `research/day7-decision.md`:

```markdown
# Day 7 의사결정

## 데이터 요약

| 지표 | 값 | 기준 (spec) | 결과 |
|---|---|---|---|
| 인터뷰 외부+내부 목표 명확 표현 | N/5 | 3+/5 | ✅/❌ |
| 인터뷰 지불 의사 평균 | ₩X | ICP별 가설 대비 | ✅/❌ |
| 퍼널 해킹 ACV/CPA 추정 | ACV ₩X / CPA ₩Y | ACV > CPA | ✅/❌ |
| 광고 정책 막힘 | 없음/있음 | 없음 | ✅/❌ |
| 랜딩 등록률 | X% | 30% (book 표준) | ✅/❌ |
| 입금의향 수 | N명 | 3+명 | ✅/❌ |

## 결정: [GO / PIVOT / NO-GO]

### 사유 (3–5줄)

## Week 2 방향 (GO 또는 PIVOT일 때)

### GO 시
- 다음 spec: `2026-06-08-tigerbookmaker-week2.md` — 1번 퍼널 풀빌드 + ₩10–30만 광고 테스트
- 책 conclusion 7단계 진입

### PIVOT 시
- 어떤 변수 바뀌나: ICP / 제안 / 가격 / 채널 / 1번 퍼널 유형
- 다음 spec: `2026-06-08-tigerbookmaker-pivot.md` — 피벗 후 재진단 1주

### NO-GO 시
- tigerbookmaker 보류
- 학습한 내용 (퍼널 프레임워크)을 어디에 적용할지 1단락
```

- [ ] **Step 2: 👤 결정 + 사유 작성**

User가 데이터 보고 결정. 애매하면 PIVOT (NO-GO는 명확한 부정 신호만).

- [ ] **Step 3: 🤖 Week 2 spec 작성 (조건부)**

GO 또는 PIVOT일 때 `docs/superpowers/specs/2026-06-08-tigerbookmaker-week2.md` 작성. 결정 사유를 인용하면서 Week 2 범위를 좁힘.

- [ ] **Step 4: ✅ 최종 커밋 + PR**

```bash
git add research/day7-decision.md docs/superpowers/specs/2026-06-08-*.md
git commit -m "day7: Week 1 종합 + GO/PIVOT/NO-GO 결정문"
git push

gh pr create --base main --title "spec+research: tigerbookmaker Week 1 진단" --body "$(cat <<'EOF'
## Summary
- 2026-05-13 작업 중단 후 18일 만에 방향 재검토
- *마케팅 설계자* 프레임워크 기반 7일 진단
- 산출물: ICP·가치 사다리·퍼널 해킹 9건·인터뷰 5건·후크-스토리-제안·매력적인 캐릭터·리드 스퀴즈 랜딩·결정문

## 결정
[Day 7 결정 한 줄]

## 다음 단계
[Week 2 spec 링크 또는 보류 사유]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

본 plan을 spec(`2026-06-01-tigerbookmaker-direction.md`)에 대해 점검:

1. **Spec coverage**:
   - Day 1 (ICP + 사다리) → Task 1 ✓
   - Day 2 (퍼널 해킹 직접) → Task 2 ✓
   - Day 3 (퍼널 해킹 간접/유사 + 광고) → Task 3 ✓
   - Day 4 (인터뷰 3건) → Task 4 ✓
   - Day 5 (인터뷰 2건 + HSO) → Task 5 ✓
   - Day 6 (캐릭터 + 퍼널 선택 + 랜딩) → Task 6 ✓
   - Day 7 (결정 + Week 2 spec) → Task 7 ✓
   - 산출물 9개 (spec §8) 모두 매핑됨 ✓

2. **Placeholder scan**:
   - 랜딩 코드의 `{/* PLACEHOLDER */}` 주석은 의도적 — Day 5/6 결과 채워 넣을 자리표시. Step에서 명시적으로 "교체" 단계 있음 ✓
   - ICP-2, ICP-3 가설은 User가 직접 채우는 단계 명시 ✓
   - Day 7 결정문의 데이터는 실측 수집 후 채움 — 템플릿 형태로 명시 ✓

3. **Type consistency**:
   - `preorders` 테이블 필드명과 API/페이지 사용 일치 ✓
   - `intent` 값 `'preorder' | 'paid_intent'` 일관 ✓

4. **Scope check**: 1주 단일 spec 범위 적절. Week 2는 별도 spec ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-tigerbookmaker-week1-diagnostics.md`.

본 plan은 **하이브리드 실행**이 자연스러움:
- 🤖 Claude task (템플릿·deep-research·코드)는 subagent 또는 inline 실행
- 👤 User task (실제 인터뷰·경쟁사 결제·결정)는 User가 직접

따라서 일반적인 "subagent-driven vs inline" 선택보다 **Day 단위로 진행**하는 게 적합:
- Day별로 User가 본인 task 완료
- Claude는 그 사이/이후에 보조 task (템플릿·정리·코드)
- 매일 끝에 그 Day의 커밋

다음 액션은 User 선택:
- **A**: Day 1 지금 시작 (Task 1) — Claude가 ICP 후보표 + 가치 사다리 v0 템플릿 생성 → User가 ICP-2, ICP-3 채움
- **B**: Plan 검토 후 수정 사항 알려줌
- **C**: 인터뷰 채널·경쟁사 후보를 먼저 같이 정함

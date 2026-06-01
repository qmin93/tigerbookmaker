# 광고 정책 메모 (deep-research 2026-06-01)

> deep-research 워크플로 결과 (106 agents, 8 verified findings, 3-vote adversarial verification).
> 출처: Meta/Google 공식 정책 + 한국 공정위/AI 기본법 + 8+ 한국 언론.

---

## 🚨 tigerbookmaker risk 등급: **높음 (High)**

3중 트리거 동시 충족:
1. **AI 생성 콘텐츠** (Meta UBP, Google Manipulated Media, 한국 AI 기본법)
2. **부수익 약속** (Meta UBP get-rich-quick, Google Unreliable Claims)
3. **한국 타겟** (공정위 심사지침 2026-06-01 발효 — **오늘**)

→ 현재 v3 카피 ("크몽 ₩40,000 판매", "월 ₩50만 부수익") 그대로 광고 돌리면 **모든 플랫폼에서 즉시 차단**.

---

## 1. Meta (페이스북·인스타그램)

### 정책 원문
> "Ads must not promote products, services, schemes or offers using identified deceptive or misleading practices."
> "Use deceptive or exaggerated claims about the success of a product or service to mislead people into purchasing."

### 위반 조항
- **Unacceptable Business Practices (UBP)**
  - 과장된 성공 주장 (exaggerated success claims)
  - Get-rich-quick 스킴
  - **Work-from-home 약속** (가장 빈번한 차단 사유)
- **AI 콘텐츠 자체**: 명시적 금지 X. 일반 deception 조항으로 집행.

### 최근 enforcement
- 2025년 Meta 1.59억건 사기 광고 제거
- 2026년 말까지 매출 90%에 광고주 verification 확대
- **finance·investment education·work-from-home 카테고리 집중 감시**

### tigerbookmaker risk
- "월 ₩50만 부수익" 카피 = 즉시 차단
- "크몽 ₩40,000 판매" = work-from-home 트리거
- 페르소나 후기 ("박지수 월 ₩50만 만들었어요") = 과장된 성공 주장

### 출처
- https://transparency.meta.com/policies/ad-standards/
- https://transparency.meta.com/policies/ad-standards/fraud-scams/unacceptable-business-practices/

---

## 2. Google Ads

### 정책 원문 (Misrepresentation)
> "Making unrealistic promises of large financial return with minimal risk, effort or investment"
> "Manipulating media to deceive, defraud, or mislead others is not allowed"
> "Making inaccurate claims or claims that entice the user with an improbable result"

### 위반 조항
- **Manipulated Media** — AI 합성 콘텐츠로 시청자 속이는 행위 명시적 예시
- **Unreliable Claims** — 비현실적 재정 수익 약속
- **Unacceptable Business Practices** — Get-rich-quick

### Enforcement 강도
- 위반 시 **사전 경고 없이 계정 즉시·영구 정지** ("you will not be allowed to advertise with Google Ads again")
- 2025년 광고 차단 5.1B → 8.3B (62% 증가)
- 광고주 정지 39.2M → 24.9M (감소했으나 **창의소재 단위 차단 강화**)
- Gemini AI가 노출 전 정책 위반 광고 99% 차단

### tigerbookmaker risk
- AI 콘텐츠 + 재정 수익 약속 = **양쪽 조항 동시 직격**
- 한 번 영구 정지되면 복구 거의 불가능

### 출처
- https://support.google.com/adspolicy/answer/6020955
- https://support.google.com/adspolicy/answer/15936857

---

## 3. 한국 공정거래위원회 (오늘 2026-06-01 발효!)

### 정책 — 추천·보증 표시광고 심사지침 개정안
- 블로그·카페 텍스트 매체: **제목 또는 첫 부분에 "AI를 기반으로 생성된 가상인물이 포함된 게시물입니다" 또는 "가상인물 포함" 표기 의무**
- 사진·동영상 광고: 가상인물 등장 동안 **인물 인근에 "가상인물" 라벨 표시**
- 적용 범위: AI 가상인물을 추천·보증 주체로 활용하는 광고

### tigerbookmaker risk
- 박지수 페르소나 후기 광고 = **즉시 위반**
- AI 생성 표지·일러스트 사용 광고 = 라벨링 의무 (없으면 위반)

### 출처
- 공정위 보도자료 — FN News, MBC, Seoul Shinmun, 한국경제 등 8+ 언론 일치 확인
- https://www.fnnews.com/news/202605311349189793

---

## 4. 한국 AI 기본법 (2026-01-22 시행, 계도 1년)

### 정책 — 제31조 2항
- 생성형 AI 제공자는 콘텐츠가 AI에 의해 생성됐음을 표시 의무
- 실제와 구별이 어려운 합성 미디어는 사용자가 명확히 인식할 수 있도록 고지
- 위반 시 시정명령 + **최대 ₩3,000만원 과징금** (계도 1년 후, 2027-01부터)

### tigerbookmaker risk
- AI 생성 책 = "AI 생성" 라벨 의무
- 출력 PDF·EPUB에 워터마크 또는 메타데이터 필요

---

## 5. 징벌적 손해배상 (2025-12-10 발표, 입법 진행 중)

- 악의적 허위·조작 정보 유통: **손해액의 최대 5배**
- AI 가상인물이 의사·전문가로 등장해 식품·의약품 추천 = 불공정 표시광고 + 소비자 기만

### tigerbookmaker risk
- 자기계발·재테크 영역에서 "전문가 페르소나" 광고 위험 ↑

---

## 🎯 우회 전략 (tigerbookmaker가 광고 지속하려면)

### A. 카피 변환 — 수익 약속 완전 제거

**❌ 금지 표현**
- "월 ₩50만 부수익"
- "크몽 ₩40,000 판매"
- "퇴근 후 N만원"
- "직장인이 만든 부수익"
- "박지수: '월 ₩50만 만들었어요'" (페르소나 수익 인용)

**✅ 안전 변환**
- "직무 PDF 자료를 만드는 도구"
- "권당 ₩4,000부터 자동 집필"
- "30분 워크플로우 — 12챕터 + 표지"
- 일반 사용자 후기 (수익 인용 X, 시간 절약·제품 만족만)

### B. 포지셔닝 변경

**❌ "직장인 부수익러"**
→ **✅ "교육 콘텐츠 / 자기계발 도서 자동 집필 도구"**

핵심: 결과는 동일하지만 **광고에서는 도구 자체의 가치만 말함**. 수익 시나리오는 랜딩 본문/이메일 시퀀스 안에만.

### C. AI 라벨링 — 모든 채널에서

- 광고 카피: "AI 기반 자동 생성"
- 랜딩 페이지: 푸터·고지에 "tigerbookmaker는 AI 기반 도구입니다" 명시
- 출력 PDF: 마지막 페이지 또는 메타데이터에 "AI 생성 콘텐츠" 표시
- 페르소나 후기 사용 시: "가상인물 포함" 라벨

### D. Meta 광고주 verification 사전 완료

- Business verification
- ID verification
- Domain verification (tigerbookmaker.com 또는 .vercel.app)
- 결제 수단 verification

### E. 랜딩 페이지 신뢰 요소 강화

- 환불 정책 명시 (7일 100%)
- 실제 사용자 후기 (수익 인용 X)
- AI 콘텐츠 샘플 공개
- 카드 정보 받지 않음 명시 (베타)
- 회사/운영자 정보 (김과장 + managerkim 연결)

### F. 단일 광고 계정 의존 X

- 도메인 분리 (예: tigerbookmaker.com + 별도 SEO 도메인)
- Meta 픽셀 분리
- Google Ads 계정 분리

---

## 💡 핵심 함의 — 1번 퍼널 선택 재평가

### Day 6 funnel-selection.md 기준 → 재평가

| 채널 | risk | 1번 퍼널 적합 |
|---|---|---|
| Meta 광고 | **높음** | 카피 안전 변환 필수, 안 하면 즉시 차단 |
| Google 광고 | **높음** | 사전 경고 없이 영구 정지 — 매우 위험 |
| Naver 검색광고 | 낮음 (정책 검증 미흡, 추가 조사 필요) | 후보 — 키워드 광고는 카피 부담 적음 |
| **Threads 자체 콘텐츠** | **낮음** | ⭐ 권장 — 광고 정책 무관, 콘텐츠 마케팅 |
| **Naver 블로그/SEO** | 낮음 | ⭐ 권장 — 콘텐츠 마케팅, AI 라벨만 명시 |
| **이메일 시퀀스 (자체 리스트)** | 0 | 광고 정책 무관 |

### 1번 퍼널 권장 채널 우선순위 (수정)

1. **Threads 자체 콘텐츠** (김과장 페르소나, managerkim 자산 활용)
2. **Naver 블로그 SEO** (managerkim.com에 tigerbookmaker 가이드 추가)
3. **이메일 리스트 빌드** (사전예약 랜딩으로 직접 트래픽)
4. Meta 광고 — 카피 안전 변환 + Business verification 후 소액 테스트 (Week 2 후반)
5. Google Ads — **회피 권장** (영구 정지 risk 너무 큼)

→ **Day 6 funnel-selection.md를 광고 정책 반영하여 v2로 업데이트 필요.**

---

## 👤 User 추가 검증 (Day 3 보완)

- [ ] 본인 Meta 광고 계정 status 확인 (Business verification 여부)
- [ ] managerkim.com SEO 트래픽 현황 — tigerbookmaker 카니발리제이션 가능성
- [ ] Naver 검색광고 정책 직접 확인 (한국어 키워드 광고 시도해본 적 있는지)
- [ ] 김과장 Threads 계정 follower 수 + 평균 engagement

# Tigerbookmaker — Reference RAG + AI 인터뷰 강화 (Sub-project 1)

**작성**: 2026-04-29
**작성자**: qmin + Claude (brainstorming session)
**상태**: Design — 사용자 review 대기
**큰 건 시퀀스**: brainstorming(이 문서) → writing-plans → TDD → executing → verification → finishing

---

## 1. 배경 — 회의 결과

2026-04-28 회의에서 12 항목 도출. Q1~Q6 후속 답변으로 sub-project 10개 분해.
**Sub-project 1 (이 문서)** = 가장 핵심 MVP — 레퍼런스 + AI 인터뷰 강화.

### 회의에서 강조된 핵심 가치 (Q1~Q3·Q6)

> "사용자가 자기 주제·레퍼런스 가져오면 AI가 정확히 이해하고 깊은 인터뷰 후 책 작성"

ABC 다 만족해야:
- A. AI 인터뷰 질문이 일반적이지 않고 구체적 (레퍼런스 기반)
- B. AI 목차가 레퍼런스 핵심 잘 반영
- C. 챕터 본문에 레퍼런스 인용·예시 자연스럽게 녹아있음

---

## 2. Sub-project 10개 (전체 그림)

| # | Sub-project | 회의 항목 | 규모 | 순서 |
|---|---|---|---|---|
| **1** | **레퍼런스 + AI 인터뷰 강화 (이 문서)** | Q1·Q2·회의6 | ★★★ | **1순위** |
| 2 | 테마 색상 다양화 | 회의4 | ★ | 빠른 win |
| 3 | 책 상세 페이지 (마케팅 page) | Q3·회의8 | ★★ | 2순위 |
| 4 | 작가 link-in-bio (Litt.ly 클론) | Q4·회의9 | ★★★ | 3순위 |
| 5 | 메타 광고 패키지 | Q5·회의11 | ★★ | |
| 6 | 부가 패키지 + 비즈니스 모델 | Q6·회의10,12 | ★★★ | |
| 7 | 모델 업그레이드 / 말투 ref | 회의7 | ★★ | (이 문서 Phase 4와 부분 통합) |
| 8 | 가격 정책 재검토 | 회의2 | ★ (결정만) | |
| 9 | 사용자 모집 (마케팅) | 회의5 | qmin 액션 | |
| 10 | 크몽 승인 + 사업자등록 | 회의1 | qmin 액션 | |

---

## 3. Sub-project 1 — Design

### 3.1 결정 사항 (사용자 confirmed)

| 항목 | 결정 |
|---|---|
| **Vector store** | Neon pgvector (기존 DB 활용, 추가 인프라 X) |
| **Embedding 모델** | Gemini text-embedding-004 (무료 tier, 한국어 OK) |
| **인터뷰 UX** | B — AI가 레퍼런스 요약 → 사용자 확인 → 빈 부분만 질문 |
| **챕터 본문 RAG** | D — 자동 RAG + 사용자 자연어 보강 (기존 AI 챗 활용) |
| **말투 매칭** | D — 자동 추천 + preset 선택 + 좋아하는 책 ref 학습 |
| **레퍼런스 형식** | PDF + URL + 텍스트 (D 답변) |

### 3.2 사용자 입장 4-Phase 진화

**Phase 1 (1주)** — MVP
> 작가가 PDF 올리면 → AI 인터뷰가 그 자료 기반으로 똑똑해진다

**Phase 2 (3-4일)**
> AI가 PDF 다 읽고 "핵심 5가지 정리했어요" 보여줌 → 사용자 확인 → 빈 부분만 짧게 질문 (5-7개)

**Phase 3 (3-4일)**
> 챕터 본문 작성 시 AI가 자동으로 PDF 관련 부분 찾아서 인용·예시 활용 + 자연어 수정 요청

**Phase 4 (3-4일)**
> 자동 톤 추천 + preset 선택 + 좋아하는 책 ref 학습

### 3.3 Phase 1 Architecture

**4 구성요소**

1. **새 라이브러리**
   - `pdfjs-dist` — PDF → text parsing
   - `@mozilla/readability` + `jsdom` — URL → readable HTML

2. **DB 변경 (Neon pgvector extension)**
   - 새 테이블 `book_references`: id, project_id, user_id, filename, source_type, source_url, total_chars, uploaded_at
   - 새 테이블 `reference_chunks`: id, reference_id, chunk_idx, content, embedding vector(768), created_at

3. **새 API endpoints**
   - `POST /api/reference/upload` — PDF/URL/텍스트 업로드 + chunk + embed + store
   - `GET /api/reference/list?projectId=X` — 책별 레퍼런스 목록
   - `DELETE /api/reference/[id]` — 삭제

4. **새 helper**
   - `lib/server/rag.ts` — query → embedding → vector search → relevant chunks (top-N)

**기존 코드 변경**
- `/api/generate/interview-question` — 매 질문 생성 시 RAG 검색해서 context 주입
- `lib/prompts.ts interviewerPrompt` — RAG context block 추가

### 3.4 데이터 흐름 (Phase 1)

```
사용자 → /write/setup → [+ 레퍼런스 추가]
            ↓
   ┌─ PDF 업로드 ─┐
   │  URL 입력    │
   │  텍스트 붙여 │
   └──────────────┘
            ↓
   POST /api/reference/upload
   (FormData with file 또는 JSON with url/text)
            ↓
   Server:
   1. parse (PDF→text, URL→fetch+readability, text→그대로)
   2. chunking (500자 + overlap 50자)
   3. for each chunk: Gemini embedding API
   4. INSERT INTO reference_chunks
   5. response: { id, chunkCount, totalChars }
            ↓
   UI: "PDF 업로드 완료 (N chunks)"
            ↓
   인터뷰 시작 → 매 질문마다 RAG 검색 → context 주입
```

### 3.5 Phase 2~4 추가 변경

**Phase 2 — 새 인터뷰 UX**
- 새 endpoint `POST /api/generate/reference-summary` — 모든 chunks → AI 요약 (5 핵심)
- 새 인터뷰 setup 화면 — 요약 표시 + 사용자 확인 → "빈 부분만 질문 모드"

**Phase 3 — 챕터 본문 RAG**
- 기존 `chapterPrompt`에 RAG context 추가 (자동 — 매 챕터 생성 시 검색)
- 기존 AI 챗 (chapter-edit)은 자연어로 RAG 강제 활용 가능

**Phase 4 — 말투 매칭**
- BookProject에 `toneSetting?: { mode, preset?, referenceBook?, finalTone }` 추가
- 새 endpoint `POST /api/generate/tone-recommend` — 장르 + 레퍼런스 보고 자동 톤
- 인터뷰 후 새 화면 — 톤 추천 + 옵션
- 좋아하는 책 ref → 발췌 분석 → 톤 매칭

---

## 4. 비용 분석

### 4.1 운영 비용 (월, vendor)

| 항목 | 현재 | After Phase 1-4 | 베타 100명 (월 500권) |
|---|---|---|---|
| Vercel | ₩0 | ₩0 | ₩0 (Hobby) |
| Neon (pgvector 포함) | ₩0 | ₩0 | ₩0 (free tier) |
| Embedding (Gemini) | - | ₩0 (무료) | ₩0 |
| 본문 (Gemini Flash Lite) | ₩28/권 | ₩37/권 (RAG +9) | ₩18,500 |
| 표지 (Imagen 4 Fast) | ₩28/권 | ₩28/권 | ₩14,000 |
| 매출 (₩1,000/권 가정) | - | - | ₩500,000 |
| **마진** | - | - | **₩467,500 (94%)** |

### 4.2 한계 + 해결

| # | 한계 | 해결책 | 베타에 필요? |
|---|---|---|---|
| 1 | PDF 표·그림 깨짐 | Gemini Vision (₩50/책) | Phase 5 |
| 2 | 이미지 PDF (스캔) | Cloud Vision OCR (₩2k/책) | X (드물어) |
| 3 | HWP / DOCX | hwp.js + mammoth.js | Phase 5 |
| 4 | JavaScript 사이트 URL | 사용자 복붙 안내 | X |
| 5 | 매우 큰 PDF (1000쪽+) | 백그라운드 job (QStash) | X |

**MVP 안전 범위 (95% 케이스)**: PDF 텍스트 위주 200쪽 이내 + 정적 URL + 텍스트 붙여넣기

---

## 5. Risk + Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gemini embedding API 분당 30 한도 | 동시 업로드 시 | Queue + 사용자에게 "처리 중..." 안내 |
| Vercel function 60s timeout | 큰 PDF 처리 시 | PDF 분할 또는 client-side 사전 parsing |
| pgvector index 검색 속도 | 50k+ chunks 시 | HNSW index, 베타엔 충분 |
| Embedding 한국어 정확도 7/10 | 항상 | 검색 결과 충분, Phase 5에서 Cohere multilingual 검토 |

---

## 6. Testing 전략

- Phase 1: PDF 1개 업로드 + RAG 검색 + 인터뷰 1 질문 시나리오 직접 검증
- Phase 2-4: 각 phase push 후 사용자 피드백 받으며 진행
- 베타 5명 모집 후 사용 패턴 추적 (어떤 형식 자주 올리나, 검색 품질 etc)

---

## 7. 다음 단계

1. **이 문서 spec self-review** — 인라인 fix
2. **사용자 review** — 이 문서 읽고 OK
3. **`writing-plans` skill 호출** — Phase 1 detail implementation plan
4. **TDD → executing → verification → finishing**

---

## 8. 참고 — Sub-project 2~10 (이 문서 범위 X, 후속 별도 spec)

각 sub-project는 별도 brainstorming → spec → plan → 실행 사이클.
순서 (제안):

1. ✅ Sub-project 1 — 이 문서 (3-4주)
2. Sub-project 2 — 색상 다양화 (1-2일, 빠른 win)
3. Sub-project 3 — 책 상세 page (3일)
4. Sub-project 4 — 작가 link-in-bio (1주)
5. Sub-project 5 — 메타 광고 패키지 (1주)
6. Sub-project 6+8 — 부가 패키지 + 가격 정책 (베타 데이터 후 결정)
7. Sub-project 7 — 모델 업그레이드 (Phase 4와 일부 통합)

---

*— end of design doc*

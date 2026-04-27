# Tigerbookmaker

한국어 e-book을 30분에 자동 집필하는 웹 서비스. Next.js 14 + Vercel.

## 아키텍처

- **Frontend**: Next.js 14 App Router + Tailwind
- **Auth**: NextAuth v5 (이메일 매직링크, Resend 발송)
- **DB**: Vercel Postgres + Drizzle ORM
- **결제**: Toss Payments (선결제 충전 모델)
- **AI**: Gemini 2.5 Flash (기본) / Pro / Claude Sonnet 4.6
- **호스팅**: Vercel (`tigerbookmaker.vercel.app`)

## 셋업 (베타 운영자용)

### 1. 환경변수
`.env.example`을 `.env.local`로 복사 후 채우기.

### 2. DB 마이그레이션
```bash
# Vercel Postgres SQL 콘솔에서 실행
psql $POSTGRES_URL -f db/migrations/0001_init.sql
```

### 3. 개발 서버
```bash
npm install
npm run dev
```

### 4. 프로덕션 배포
```bash
vercel deploy --prod
```

## 폴더 구조

```
app/
  page.tsx              # 랜딩
  login/                # 이메일 로그인
  projects/             # 내 책 목록
  new/                  # 새 프로젝트 생성
  write/                # 챕터 작성 (?id=XXX)
  export/               # PDF/DOCX 다운로드 (?id=XXX)
  billing/              # 충전 (success/fail 콜백 포함)
  legal/                # 이용약관·개인정보·환불정책
  api/
    auth/[...nextauth]/ # NextAuth 핸들러
    me/                 # 현재 유저 + 잔액
    projects/           # 프로젝트 CRUD
    generate/           # AI 호출 (toc, chapter)
    payment/            # Toss prepare/confirm

lib/
  prompts.ts            # 시스템 프롬프트 + 챕터 프롬프트
  cost-estimate.ts      # 토큰·잔액 견적 함수
  export-pdf.ts         # PDF 출력 (jsPDF)
  export-docx.ts        # DOCX 출력
  storage.ts            # (legacy) localStorage 타입 정의
  ai.ts                 # (legacy) BYOK 클라이언트 호출
  server/
    ai-server.ts        # 서버사이드 AI 호출 (env에서 키 로드)
    db.ts               # DB 헬퍼 (잔액 차감/충전)

db/
  schema.ts             # Drizzle 스키마
  index.ts              # DB 클라이언트
  migrations/0001_init.sql

auth.ts                 # NextAuth 설정 (Resend 이메일 + 회원가입 보너스)
```

## 비즈니스 모델

선결제 후 사용량 차감. 1회당 비용은 모델에 따라:

| 모델 | 책 1권 (12챕터) |
|---|---|
| Gemini 2.5 Flash | ~₩200 |
| Gemini 2.5 Pro | ~₩500 |
| Claude Sonnet 4.6 | ~₩1,400 |

충전 단위: 1k / 5k / 10k / 30k(+5%) / 50k(+10%) 원
회원가입 시 1,000원 크레딧 자동 지급.

## 베타 운영 체크리스트

- [ ] Vercel Postgres 인스턴스 생성 + 환경변수 연결
- [ ] `0001_init.sql` 적용
- [ ] Resend API 키 발급 + EMAIL_FROM 도메인 인증
- [ ] Toss 테스트 모드 키 발급
- [ ] Gemini API 키 + (선택) Cloud Console 결제 활성화
- [ ] `vercel deploy --prod` 후 회원가입 → 결제 → 책 생성 한 번 끝까지 통과 테스트
- [ ] 베타 테스터 5~10명에게 가입 링크 공유

## 정식 오픈 추가 필요

- [ ] 사업자등록 + 통신판매업 신고
- [ ] Toss 라이브 키 발급 (1~2주 심사)
- [ ] 약관·개인정보·환불정책 법무 검토
- [ ] 도메인 구매 (`tigerbookmaker.com` 권장)
- [ ] CS 이메일 셋업
- [ ] 모니터링 (Sentry, Vercel Analytics)

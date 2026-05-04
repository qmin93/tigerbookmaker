# Wave 5 — UX 폴리시 (long tail)

**Goal**: 작은 임팩트 6가지 한 번에 정리. 각자 1-2 commit씩 짧게.

---

## 6 sub-tasks

### W5-1. 목차 편집 UI
**파일**: `app/write/page.tsx` (chapter list 섹션)

기존: 챕터 추가/삭제/순서 변경 못 함.
추가:
- 챕터 카드 옆 "🗑️ 삭제" 버튼 (confirm 후)
- "↑ ↓" 화살표 버튼 (순서 변경)
- 하단 "+ 챕터 추가" 버튼 (제목·부제 input → 빈 챕터 생성)

저장: `PUT /api/projects/[id]` body `{ data: { ...project, chapters: newChapters } }` (기존 PUT endpoint 재활용).

State 변경 — local에 chapters 복사본 유지하고 변경 시 즉시 PUT.

Commit: `feat(ui): 목차 편집 UI (추가/삭제/순서 변경)`

### W5-2. Analytics — 페이지 방문 추적

**Goal**: 책 마케팅 페이지 / 작가 프로필 방문수 추적. 작가가 "내 페이지 몇 번 봤는지" 확인.

**최소 구현**:
- 새 테이블 `page_views` (page_type, page_id, visited_at, user_agent_hash)
- 새 endpoint `POST /api/analytics/track` — body `{ pageType: "book"|"profile", pageId }`. cookie/IP 기반 dedupe (1일 내 동일 IP 같은 page = 1번)
- `app/book/[id]/page.tsx` + `app/u/[handle]/page.tsx`에 mount 시 fetch (silent, 실패 무시)
- 새 endpoint `GET /api/analytics/stats?pageType=...&pageId=...` — 본인만 조회 가능 (auth + ownership)
- `/profile`에 작가 프로필 방문수 표시

Migration: `db/migrations/0009_analytics.sql`:
```sql
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type TEXT NOT NULL CHECK (page_type IN ('book', 'profile')),
  page_id TEXT NOT NULL,                   -- book id or handle
  visitor_hash TEXT,                       -- IP+UA hash for dedupe
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_views_lookup ON page_views(page_type, page_id);
CREATE INDEX IF NOT EXISTS idx_page_views_dedupe ON page_views(page_type, page_id, visitor_hash);
```

비용 0 (자체 DB). Vercel 함수만 가벼운 INSERT.

Commits:
- `feat(db): page_views 테이블`
- `feat(api): /api/analytics/track + /api/analytics/stats`
- `feat(ui): /book/[id] + /u/[handle]에 visit 추적 + /profile에 방문수 표시`

### W5-3. QR 코드 (작가 프로필)

**파일**: `app/profile/page.tsx`

작가 프로필 URL을 QR 코드로 표시 (오프라인 행사용).

라이브러리: `qrcode` (npm, pure JS).

```typescript
import QRCode from "qrcode";
const dataUrl = await QRCode.toDataURL(profileUrl, { width: 200, margin: 1 });
```

UI: 친구 초대 박스 옆 또는 별도 "QR 코드" 박스. "💾 다운로드" 버튼.

Commit: `feat(ui): /profile에 QR 코드 + 다운로드`

### W5-4. 이메일 구독 (작가 프로필)

**Goal**: 독자가 작가 프로필에 "이메일 구독" → 작가의 새 책 알림 받음.

**최소 구현**:
- 새 테이블 `email_subscriptions` (author_user_id, subscriber_email, subscribed_at, unsubscribed_at)
- 새 endpoint `POST /api/profile/subscribe` body `{ handle, email }` (no auth — public)
- `/u/[handle]` 페이지에 "📧 새 책 나오면 알림" 박스 + email input + 구독 버튼
- 작가는 본인 `/profile`에서 구독자 수 확인
- 실제 알림 발송은 추후 (resend/이메일 발송은 별도 작업)

Migration: `db/migrations/0010_email_subscriptions.sql`

Commits:
- `feat(db): email_subscriptions 테이블`
- `feat(api): /api/profile/subscribe POST`
- `feat(ui): /u/[handle]에 이메일 구독 박스 + /profile에 구독자 수`

### W5-5. 크몽 등록 가이드

**파일**: `app/book/[id]/kmong-guide` 같은 새 페이지 또는 `/write` 안에 박스.

내용:
- 책별 자동 생성 카테고리 추천 (책 type 기반: 자기계발서 → "취업·이직", 재테크 → "재테크·자산관리" 등 — 정적 매핑)
- 제목 추천 (marketingMeta.tagline 활용)
- 가격 추천 (책 분량 기반 — 짧은 책 ₩3,000, 긴 책 ₩10,000)
- 키워드 추천 (kmongCopy 활용)
- 옵션 추천 (PDF / EPUB 동시 제공)
- 상세 설명 자동 생성 (kmongCopy.kmongDescription 활용)
- "크몽에 새 서비스 등록" 외부 링크 (kmong.com 새 등록 페이지)

전부 정적 헬퍼 함수 + 표시. 새 AI 호출 X.

Commit: `feat(ui): 크몽 등록 가이드 (카테고리/가격/키워드 추천)`

### W5-6. SEO sitemap + 개인 ROI 대시보드 통합

**(a) Sitemap.xml 자동 갱신**
- `app/sitemap.ts` (Next.js 표준) — 동적 sitemap
- 모든 공개 책 (/book/[id], shareEnabled=true) + 모든 프로필 (/u/[handle]) + 정적 페이지 (/, /pricing, /login)

```typescript
import type { MetadataRoute } from "next";
import { sql } from "@vercel/postgres";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tigerbookmaker.vercel.app";
  const { rows: books } = await sql<{ id: string; updated_at: string }>`
    SELECT id, updated_at FROM book_projects WHERE data->>'shareEnabled' = 'true'
    ORDER BY updated_at DESC LIMIT 1000
  `;
  const { rows: profiles } = await sql<{ handle: string; updated_at: string }>`
    SELECT handle, updated_at FROM user_profiles ORDER BY updated_at DESC LIMIT 1000
  `;
  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: new Date(), priority: 0.5 },
    ...books.map(b => ({ url: `${baseUrl}/book/${b.id}`, lastModified: new Date(b.updated_at), priority: 0.7 })),
    ...profiles.map(p => ({ url: `${baseUrl}/u/${p.handle}`, lastModified: new Date(p.updated_at), priority: 0.6 })),
  ];
}
```

**(b) 개인 ROI 대시보드** — `/profile` 또는 `/billing` 안에 미니 ROI 박스
- 본인 책 수, 누적 비용 (ai_usage 합계), 잔액, 누적 충전, "예상 매출 입력" textarea
- 사용자가 본인 매출 입력 → 실제 ROI 계산 표시
- 너무 큰 작업이면 placeholder만 (link to /calculator 별도 페이지 or sample 카드)

이 둘 합쳐서 하나의 commit:
- `feat(seo): 동적 sitemap.xml + /profile에 개인 사용 통계 박스`

---

## 통합

- `npm install qrcode @types/qrcode`
- 2개 migration 실행 (0009, 0010)
- `npm run build` 통과
- main merge + push

---

*— end of Wave 5 plan*

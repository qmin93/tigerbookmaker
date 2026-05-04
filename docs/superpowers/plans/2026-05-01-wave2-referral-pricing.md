# Wave 2 — Referral 시스템 + 가격 페이지

## Part A — Referral (추천) 시스템

**Goal**: 친구 초대 → 양쪽 ₩2,000 크레딧 자동 지급. 무료 viral growth.

### 흐름
1. 사용자 A가 본인 추천 코드 (예: `qmin-x4z`) 또는 URL `tigerbookmaker.vercel.app/r/qmin-x4z` 친구한테 공유
2. 친구 B가 그 URL 클릭 → 가입 시 추천 코드 자동 적용 (cookie/localStorage 저장 후 signup 시 attach)
3. B가 가입 + 이메일 인증 완료 → A와 B 양쪽에 ₩2,000 크레딧 지급
4. A는 본인 프로필에서 추천 통계 확인 (몇 명 가입, 누적 크레딧)

### Tasks

#### A1. DB Migration

`db/migrations/0007_referrals.sql`:

```sql
-- 0007_referrals.sql
-- 추천 코드 + 추천 가입 추적

CREATE TABLE IF NOT EXISTS referral_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code          TEXT NOT NULL UNIQUE,                       -- e.g. "qmin-x4z"
  total_referred INTEGER NOT NULL DEFAULT 0,
  total_credits_earned INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

CREATE TABLE IF NOT EXISTS referral_signups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  credit_amount   INTEGER NOT NULL DEFAULT 2000,
  awarded_at      TIMESTAMPTZ,             -- NULL이면 미지급 (이메일 미인증 등)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer ON referral_signups(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referred ON referral_signups(referred_user_id);
```

Commit: `feat(db): referral_codes + referral_signups 테이블`

#### A2. Drizzle schema

`db/schema.ts`에 두 테이블 추가.

Commit: `feat(schema): referralCodes + referralSignups`

#### A3. Helpers `lib/server/referral.ts`

```typescript
import { sql } from "@vercel/postgres";

const CODE_LENGTH = 6;
const REWARD_AMOUNT = 2000;

export function generateCode(seed: string): string {
  // base = email prefix, suffix = random 3 chars
  const base = seed.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const random = Math.random().toString(36).slice(2, 5);
  return `${base || "tiger"}-${random}`;
}

export async function ensureReferralCode(userId: string, email: string): Promise<{ code: string }> {
  const { rows } = await sql<{ code: string }>`
    SELECT code FROM referral_codes WHERE user_id = ${userId}
  `;
  if (rows.length > 0) return rows[0];

  let code = generateCode(email);
  for (let i = 0; i < 5; i++) {
    const exists = await sql`SELECT 1 FROM referral_codes WHERE code = ${code}`;
    if (exists.rows.length === 0) break;
    code = generateCode(email);
  }
  try {
    await sql`INSERT INTO referral_codes (user_id, code) VALUES (${userId}, ${code})`;
  } catch (e: any) {
    if (e.code === "23505") {
      // race
      const r = await sql<{ code: string }>`SELECT code FROM referral_codes WHERE user_id = ${userId}`;
      if (r.rows[0]) return r.rows[0];
    }
    throw e;
  }
  return { code };
}

export async function getReferrerByCode(code: string): Promise<string | null> {
  const { rows } = await sql<{ user_id: string }>`
    SELECT user_id FROM referral_codes WHERE code = ${code.toLowerCase()}
  `;
  return rows[0]?.user_id ?? null;
}

export async function recordReferralSignup(opts: {
  referrerUserId: string;
  referredUserId: string;
  code: string;
}): Promise<void> {
  await sql`
    INSERT INTO referral_signups (referrer_user_id, referred_user_id, code)
    VALUES (${opts.referrerUserId}, ${opts.referredUserId}, ${opts.code})
    ON CONFLICT (referred_user_id) DO NOTHING
  `;
}

export async function awardReferralCredits(referredUserId: string): Promise<{
  awarded: boolean;
  referrerUserId?: string;
  amount?: number;
}> {
  // Get pending signup
  const { rows } = await sql<{ id: string; referrer_user_id: string; credit_amount: number }>`
    SELECT id, referrer_user_id, credit_amount
    FROM referral_signups
    WHERE referred_user_id = ${referredUserId} AND awarded_at IS NULL
  `;
  if (rows.length === 0) return { awarded: false };

  const r = rows[0];
  const amount = r.credit_amount;

  // Atomic award: update users + counters + mark awarded
  await sql`UPDATE users SET balance_krw = balance_krw + ${amount} WHERE id = ${r.referrer_user_id}`;
  await sql`UPDATE users SET balance_krw = balance_krw + ${amount} WHERE id = ${referredUserId}`;
  await sql`
    UPDATE referral_codes
    SET total_referred = total_referred + 1,
        total_credits_earned = total_credits_earned + ${amount}
    WHERE user_id = ${r.referrer_user_id}
  `;
  await sql`
    UPDATE referral_signups
    SET awarded_at = NOW()
    WHERE id = ${r.id}
  `;

  return { awarded: true, referrerUserId: r.referrer_user_id, amount };
}

export async function getReferralStats(userId: string): Promise<{
  code: string | null;
  totalReferred: number;
  totalCreditsEarned: number;
  recentSignups: Array<{ awarded_at: string | null; created_at: string }>;
}> {
  const codeRow = await sql<{ code: string; total_referred: number; total_credits_earned: number }>`
    SELECT code, total_referred, total_credits_earned FROM referral_codes WHERE user_id = ${userId}
  `;
  if (codeRow.rows.length === 0) {
    return { code: null, totalReferred: 0, totalCreditsEarned: 0, recentSignups: [] };
  }
  const recent = await sql<{ awarded_at: string | null; created_at: string }>`
    SELECT awarded_at, created_at FROM referral_signups
    WHERE referrer_user_id = ${userId}
    ORDER BY created_at DESC LIMIT 10
  `;
  return {
    code: codeRow.rows[0].code,
    totalReferred: codeRow.rows[0].total_referred,
    totalCreditsEarned: codeRow.rows[0].total_credits_earned,
    recentSignups: recent.rows,
  };
}
```

Commit: `feat(referral): code generation + signup tracking + auto-award helpers`

#### A4. APIs

**`app/api/referral/route.ts`** — GET (own code + stats)

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureReferralCode, getReferralStats } from "@/lib/server/referral";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await ensureReferralCode(session.user.id, session.user.email);
  const stats = await getReferralStats(session.user.id);
  return NextResponse.json({ stats });
}
```

**`app/api/referral/apply/route.ts`** — POST (record signup, called from app after signup)

```typescript
// POST /api/referral/apply
// body: { code }
// 호출: 가입 직후 client에서 (cookie/localStorage에 저장된 추천 코드로)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReferrerByCode, recordReferralSignup, awardReferralCredits } from "@/lib/server/referral";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const referrerUserId = await getReferrerByCode(code);
  if (!referrerUserId) return NextResponse.json({ error: "CODE_NOT_FOUND" }, { status: 404 });
  if (referrerUserId === session.user.id) {
    return NextResponse.json({ error: "SELF_REFERRAL" }, { status: 400 });
  }

  await recordReferralSignup({
    referrerUserId,
    referredUserId: session.user.id,
    code,
  });

  const result = await awardReferralCredits(session.user.id);
  return NextResponse.json({ ok: true, ...result });
}
```

Commit: `feat(api): /api/referral GET (stats) + /api/referral/apply POST`

#### A5. Public referral landing `/r/[code]`

`app/r/[code]/page.tsx` — code를 cookie/localStorage에 저장하고 `/login?redirect=/projects&ref=true`로 redirect.

```typescript
"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ReferralLanding() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params?.code) {
      try {
        localStorage.setItem("tigerbookmaker_ref_code", params.code);
        document.cookie = `tigerbookmaker_ref_code=${params.code}; path=/; max-age=2592000; SameSite=Lax`;
      } catch {}
    }
    router.replace("/login?ref=" + (params?.code ?? ""));
  }, [params, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="text-center">
        <div className="text-4xl mb-3">🎁</div>
        <div className="text-lg font-bold text-ink-900">추천 코드 적용 중...</div>
        <div className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</div>
      </div>
    </main>
  );
}
```

Commit: `feat(ui): /r/[code] 추천 코드 랜딩 페이지`

#### A6. Auto-apply on signup

`app/login/page.tsx` (또는 sign-in 후 redirect되는 곳) 수정:
- 로그인 성공 후 `localStorage.getItem("tigerbookmaker_ref_code")` 체크
- 있으면 `POST /api/referral/apply` 호출 → 성공/실패 사용자에게 보여줌

또는 더 간단: `/api/me` 호출 시 (로그인된 사용자가 처음 페이지 로드할 때) cookie의 ref code 자동 apply.

가장 안정적: signup 직후 redirect 페이지(`/projects`)에서 `useEffect`로 apply 호출.

Commit: `feat(auth): 로그인 후 추천 코드 자동 apply`

#### A7. UI — Referral 정보 위치

**`/profile` 또는 `/billing` 페이지에 "🎁 친구 초대" 박스 추가**:

- 본인 코드 + URL 표시 (복사 버튼)
- 누적 가입 수 + 누적 크레딧
- 카톡 / 트위터 / URL 복사 공유 버튼

또는 `/billing` 상단에 "친구 초대하면 ₩2,000 크레딧" 배너.

Commit: `feat(ui): /profile에 친구 초대 박스 (코드 + 통계 + 공유)`

---

## Part B — 가격 페이지

**Goal**: 정식 가격 결정 안 됐어도, 사용자한테 "가격이 어떻게 될 예정인지" 보여주는 placeholder 페이지. SEO + 신뢰도 ↑.

### Tasks

#### B1. `app/pricing/page.tsx` — 가격 페이지

레이아웃:
- Hero: "지금은 베타 — 모든 기능 무료" 강조
- 가격 옵션 카드 3개 (placeholder, 실제 가격은 베타 후 결정):
  - **베타 (현재)**: ₩0 — 모든 기능 / ₩3,000 무료 크레딧
  - **개인 (예정)**: ₩5,000/월 또는 ₩50,000/년 — 무제한 책 / 모든 기능 / 우선 지원
  - **팀 (예정)**: ₩30,000/월 — 5명까지 / 팀 워크스페이스 / 가격 협의 (큰 팀)
- FAQ:
  - "정식 가격 언제 결정되나요?" → "베타 데이터 (사용자 패턴) 본 후. 베타 사용자는 정식 출시 시 영구 할인 혜택"
  - "환불 가능?" → "사용 안 한 잔액은 7일 내 100% 환불"
  - "구독 취소?" → "언제든 취소 가능"
- CTA: "지금 무료로 시작" → /login

이게 가격 페이지의 모든 것. ~150줄.

Commit: `feat(ui): /pricing 가격 페이지 (베타 안내 + 예정 플랜)`

#### B2. Header에 "가격" 링크 추가

`components/Header.tsx`의 nav에 `<Link href="/pricing">가격</Link>` 추가 (메뉴 또는 nav).

Commit: `feat(header): 가격 페이지 링크`

---

## Wave 2 통합

Migration 실행 → main merge → push → 배포 검증.

---

*— end of Wave 2 plan*

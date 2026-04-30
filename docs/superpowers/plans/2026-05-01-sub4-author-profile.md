# Sub-project 4 — 작가 Link-in-Bio (Litt.ly 클론)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 작가가 자기 책을 한 곳에 모아 보여주는 공개 프로필. 인스타·트위터 bio에 한 URL만 넣으면 모든 책 + 작가 정보 + 외부 링크를 보여줌.

**디자인 doc 참조:** Q4 + 회의9 항목 "작가 link-in-bio (Litt.ly 클론)".

**핵심 컨셉**
- URL: `/u/[handle]` (예: `/u/qmin`)
- 한 사용자 = 한 프로필 = 한 handle
- 프로필 = avatar + 표시명 + bio + 외부 링크들 (Instagram, Twitter, Kakao Open Chat 등) + 자신의 모든 공개 책 (cover + title + 클릭 시 `/book/[id]`)
- 작가 입장: 인스타 bio에 `tigerbookmaker.vercel.app/u/qmin` 한 줄만 — 새 책 낼 때마다 자동 추가

---

## File Structure

| 파일 | 역할 | 수정 |
|---|---|---|
| `db/migrations/0006_user_profiles.sql` | `user_profiles` 테이블 + handle unique | 새로 |
| `db/schema.ts` | Drizzle schema에 userProfiles 추가 | 수정 |
| `lib/server/profile.ts` | profile 조회·생성 helpers | 새로 |
| `app/api/profile/route.ts` | GET/PUT — 본인 프로필 | 새로 |
| `app/api/profile/handle-check/route.ts` | GET — handle 사용 가능 체크 | 새로 |
| `app/api/u/[handle]/route.ts` | GET — 공개 프로필 + 공개 책 목록 | 새로 |
| `app/u/[handle]/page.tsx` | 공개 프로필 페이지 | 새로 |
| `app/u/[handle]/layout.tsx` | OG metadata | 새로 |
| `app/profile/page.tsx` | 프로필 편집 화면 (auth) | 새로 |
| `components/Header.tsx` | "내 프로필" 메뉴 항목 추가 | 수정 |
| `app/api/projects/route.ts` | 새 프로젝트 생성 시 handle 없으면 자동 생성 | 수정 |

---

## Tasks

### Task 1: DB Migration

**Files:** Create `db/migrations/0006_user_profiles.sql`

```sql
-- 0006_user_profiles.sql
-- 작가 프로필 (link-in-bio)

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handle        TEXT NOT NULL UNIQUE,                       -- URL slug, lowercase, [a-z0-9_-]
  display_name  TEXT,                                        -- 표시명 (default: email prefix)
  avatar_url    TEXT,                                        -- 외부 이미지 URL or data: URL
  bio           TEXT,                                        -- 한두 문단 자기소개
  social_links  JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{ label, url }]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
-- handle은 UNIQUE constraint로 자동 인덱스됨

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

검증 후 commit: `feat(db): user_profiles 테이블 (handle unique slug)`

마이그레이션 실행은 main merge 직전에.

---

### Task 2: Drizzle schema

**Files:** Modify `db/schema.ts`

기존 `users` 테이블 정의 근처에 `userProfiles` 추가:

```typescript
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  socialLinks: jsonb("social_links").$type<Array<{ label: string; url: string }>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`users` 테이블이 어디 정의되어 있는지 확인 후 import 등 정리.

Commit: `feat(schema): userProfiles Drizzle types`

---

### Task 3: Profile helpers

**Files:** Create `lib/server/profile.ts`

```typescript
import { sql } from "@vercel/postgres";

export interface UserProfile {
  id: string;
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: Array<{ label: string; url: string }>;
  createdAt: string;
}

const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;
const RESERVED = new Set([
  "admin", "api", "auth", "billing", "book", "books", "help", "home", "login", "logout",
  "new", "profile", "projects", "settings", "share", "signup", "support", "u", "user",
  "users", "write", "tigerbookmaker", "tiger",
]);

export function isValidHandle(handle: string): boolean {
  if (!handle || !HANDLE_RE.test(handle)) return false;
  if (RESERVED.has(handle)) return false;
  return true;
}

export function suggestHandle(email: string): string {
  // email prefix → lowercase → [a-z0-9_-]만 → 3~30자
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  if (base.length >= 3 && !RESERVED.has(base)) return base;
  // 기본값 + random suffix
  return `tiger_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
  const { rows } = await sql<any>`
    SELECT id, user_id, handle, display_name, avatar_url, bio, social_links, created_at
    FROM user_profiles WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function getProfileByHandle(handle: string): Promise<UserProfile | null> {
  const { rows } = await sql<any>`
    SELECT id, user_id, handle, display_name, avatar_url, bio, social_links, created_at
    FROM user_profiles WHERE handle = ${handle.toLowerCase()}
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function isHandleAvailable(handle: string, excludeUserId?: string): Promise<boolean> {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS(
      SELECT 1 FROM user_profiles
      WHERE handle = ${handle.toLowerCase()}
        AND ${excludeUserId ? sql`user_id <> ${excludeUserId}` : sql`TRUE`}
    ) AS exists
  `;
  return !rows[0].exists;
}

export async function ensureProfileFor(userId: string, email: string): Promise<UserProfile> {
  const existing = await getProfileByUserId(userId);
  if (existing) return existing;

  // 사용 가능한 handle 찾기 (충돌 시 suffix +N)
  let handle = suggestHandle(email);
  for (let i = 0; i < 5; i++) {
    if (await isHandleAvailable(handle)) break;
    handle = `${handle}_${Math.random().toString(36).slice(2, 5)}`;
  }
  const displayName = email.split("@")[0];
  const { rows } = await sql<any>`
    INSERT INTO user_profiles (user_id, handle, display_name)
    VALUES (${userId}, ${handle}, ${displayName})
    RETURNING id, user_id, handle, display_name, avatar_url, bio, social_links, created_at
  `;
  return mapRow(rows[0]);
}

export async function updateProfile(userId: string, updates: {
  handle?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  socialLinks?: Array<{ label: string; url: string }>;
}): Promise<UserProfile> {
  // 동적 SQL 회피 — 단순 UPDATE for each provided field
  const existing = await getProfileByUserId(userId);
  if (!existing) throw new Error("PROFILE_NOT_FOUND");

  const newHandle = updates.handle !== undefined ? updates.handle.toLowerCase() : existing.handle;
  const newDisplayName = updates.displayName !== undefined ? updates.displayName : existing.displayName;
  const newAvatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatarUrl;
  const newBio = updates.bio !== undefined ? updates.bio : existing.bio;
  const newSocialLinks = updates.socialLinks !== undefined ? updates.socialLinks : existing.socialLinks;

  await sql`
    UPDATE user_profiles
    SET handle = ${newHandle},
        display_name = ${newDisplayName},
        avatar_url = ${newAvatarUrl},
        bio = ${newBio},
        social_links = ${JSON.stringify(newSocialLinks)}::jsonb
    WHERE user_id = ${userId}
  `;
  const updated = await getProfileByUserId(userId);
  if (!updated) throw new Error("UPDATE_FAILED");
  return updated;
}

function mapRow(r: any): UserProfile {
  return {
    id: r.id,
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    bio: r.bio,
    socialLinks: Array.isArray(r.social_links) ? r.social_links : [],
    createdAt: r.created_at,
  };
}
```

Commit: `feat(profile): isValidHandle/suggestHandle/get/update helpers`

---

### Task 4: Profile APIs

**Files:**
- Create: `app/api/profile/route.ts` — GET (own) + PUT (update)
- Create: `app/api/profile/handle-check/route.ts` — GET (availability)

**`/api/profile/route.ts`:**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfileFor, updateProfile, isValidHandle, isHandleAvailable } from "@/lib/server/profile";

export const runtime = "nodejs";

const MAX_LINKS = 8;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const profile = await ensureProfileFor(session.user.id, session.user.email);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;
  await ensureProfileFor(userId, session.user.email);
  const body = await req.json().catch(() => ({}));

  const updates: any = {};
  if (typeof body.handle === "string") {
    const h = body.handle.toLowerCase().trim();
    if (!isValidHandle(h)) {
      return NextResponse.json({ error: "INVALID_HANDLE", message: "handle은 3~30자 영문 소문자·숫자·_-만." }, { status: 400 });
    }
    if (!(await isHandleAvailable(h, userId))) {
      return NextResponse.json({ error: "HANDLE_TAKEN", message: "이미 사용 중인 handle." }, { status: 409 });
    }
    updates.handle = h;
  }
  if (typeof body.displayName === "string") updates.displayName = body.displayName.slice(0, 50) || null;
  if (typeof body.avatarUrl === "string") updates.avatarUrl = body.avatarUrl.slice(0, 1000) || null;
  if (typeof body.bio === "string") updates.bio = body.bio.slice(0, 500) || null;
  if (Array.isArray(body.socialLinks)) {
    updates.socialLinks = body.socialLinks
      .slice(0, MAX_LINKS)
      .filter((l: any) => typeof l?.label === "string" && typeof l?.url === "string")
      .map((l: any) => ({ label: l.label.slice(0, 30), url: l.url.slice(0, 500) }));
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
  }
  const profile = await updateProfile(userId, updates);
  return NextResponse.json({ ok: true, profile });
}
```

**`/api/profile/handle-check/route.ts`:**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isValidHandle, isHandleAvailable } from "@/lib/server/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(req.url);
  const handle = (url.searchParams.get("handle") ?? "").toLowerCase().trim();
  if (!isValidHandle(handle)) {
    return NextResponse.json({ ok: false, valid: false, available: false, reason: "INVALID" });
  }
  const available = await isHandleAvailable(handle, session.user.id);
  return NextResponse.json({ ok: true, valid: true, available, reason: available ? "OK" : "TAKEN" });
}
```

Commit: `feat(api): /api/profile (GET/PUT) + handle-check`

---

### Task 5: Public profile API

**Files:** Create `app/api/u/[handle]/route.ts`

```typescript
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getProfileByHandle } from "@/lib/server/profile";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { handle: string } }) {
  const handle = (params.handle ?? "").toLowerCase();
  if (!handle) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const profile = await getProfileByHandle(handle);
  if (!profile) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // 이 사용자의 공개(shareEnabled) 책 목록
  const { rows: books } = await sql<{
    id: string; topic: string; type: string; data: any; created_at: string;
  }>`
    SELECT id, topic, type, data, created_at
    FROM book_projects
    WHERE user_id = ${profile.userId}
      AND data->>'shareEnabled' = 'true'
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    socialLinks: profile.socialLinks,
    books: books.map(b => ({
      id: b.id,
      topic: b.topic,
      type: b.type,
      themeColor: b.data?.themeColor ?? "orange",
      tagline: b.data?.marketingMeta?.tagline ?? null,
      cover: b.data?.kmongPackage?.images?.find((i: any) => i.type === "cover")
        ? { base64: b.data.kmongPackage.images.find((i: any) => i.type === "cover").base64 }
        : null,
      createdAt: b.created_at,
    })),
  });
}
```

Commit: `feat(api): GET /api/u/[handle] — 공개 프로필 + 책 목록`

---

### Task 6: Public profile page + OG

**Files:**
- Create: `app/u/[handle]/layout.tsx` — OG metadata
- Create: `app/u/[handle]/page.tsx` — 공개 프로필 페이지

**Layout** — 기존 share/book layout 패턴:

```typescript
// /u/[handle] 동적 메타데이터
import type { Metadata } from "next";

async function fetchProfileSummary(handle: string, baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/u/${handle}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tigerbookmaker.vercel.app");
  const data = await fetchProfileSummary(params.handle, baseUrl);
  if (!data) return { title: "Tigerbookmaker" };
  const desc = data.bio?.slice(0, 160) || `${data.displayName}의 책 ${data.books?.length ?? 0}권`;
  const ogImage = `${baseUrl}/og-default.png`;
  return {
    title: `${data.displayName} (@${data.handle}) — Tigerbookmaker`,
    description: desc,
    openGraph: {
      title: data.displayName,
      description: desc,
      type: "profile",
      url: `${baseUrl}/u/${data.handle}`,
      siteName: "Tigerbookmaker",
      locale: "ko_KR",
      images: [{ url: ogImage, width: 1024, height: 1024, alt: data.displayName }],
    },
    twitter: { card: "summary_large_image", title: data.displayName, description: desc, images: [ogImage] },
  };
}
export default function UserLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
```

**Page** — 클라이언트 컴포넌트, link-in-bio 스타일:

레이아웃 (Litt.ly 영감):
1. **Top** — avatar (circular, 100x100), displayName, @handle, bio
2. **Social links** — pill buttons (Instagram / Twitter / 카톡 등). Each is a `<a target="_blank">`.
3. **Books grid** — 2-column grid of book cards. Each: cover thumbnail (3:4), title, tagline (if exists), `<Link href={`/book/${id}`}>`.
4. **Footer** — small "Powered by Tigerbookmaker" link.

Tailwind, 모바일 우선, 깔끔한 white background. `Header.tsx` import 안 함 (link-in-bio 페이지는 minimal chrome).

NOT_FOUND 시 클린한 404 카드 + home 링크.

대략 250줄.

Commit: `feat(ui): /u/[handle] 공개 프로필 페이지 + OG metadata`

---

### Task 7: Profile editor page

**Files:** Create `app/profile/page.tsx`

Auth-protected editor. State: handle, displayName, avatarUrl, bio, socialLinks (배열).

UI:
1. Top — 현재 프로필 URL 미리보기: `tigerbookmaker.vercel.app/u/{handle}` + "공개 페이지 보기" link
2. Form — handle (input + 실시간 availability check via `/api/profile/handle-check?handle=...`), displayName, avatarUrl (URL input), bio (textarea)
3. Social links — 동적 추가/삭제 가능한 list ({ label, url } pairs). 최대 8개.
4. Save 버튼 → PUT `/api/profile`

Header import OK (이건 작가의 dashboard).

Save 성공 시 toast/알림 + 새 프로필 로드.

대략 200줄.

Commit: `feat(ui): /profile 편집 페이지`

---

### Task 8: Header에 "내 프로필" 링크

**Files:** Modify `components/Header.tsx`

기존 메뉴(`/projects`, `/billing`, `/usage`, 로그아웃) 사이에 `<Link href="/profile">내 프로필</Link>` 추가. 위치는 "내 책" 다음.

Commit: `feat(header): 메뉴에 "내 프로필" 추가`

---

### Task 9: Migration 실행 + main merge + push

- Migration 실행 (worktree 내에서 또는 main merge 후 main에서 — `node scripts/migrate.mjs`)
- `npm run build` 통과
- `git checkout main && git merge --ff-only feature/sub4-author-profile && git push origin main`
- Vercel 배포 검증

---

*— end of Sub-project 4 plan*

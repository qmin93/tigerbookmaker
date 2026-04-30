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
  // @vercel/postgres는 nested sql 템플릿 fragment를 지원하지 않아서 분기 처리.
  const lower = handle.toLowerCase();
  if (excludeUserId) {
    const { rows } = await sql<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM user_profiles
        WHERE handle = ${lower}
          AND user_id <> ${excludeUserId}
      ) AS exists
    `;
    return !rows[0].exists;
  }
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS(
      SELECT 1 FROM user_profiles
      WHERE handle = ${lower}
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

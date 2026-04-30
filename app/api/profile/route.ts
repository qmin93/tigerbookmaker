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

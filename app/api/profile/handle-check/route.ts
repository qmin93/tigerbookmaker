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

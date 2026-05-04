// PUT /api/projects/[id]/revenue
// body: { channels: Array<{ channel, label?, grossKRW, feeRate? }> }
// → recompute netTotalKRW, save to project.data.revenue
// 응답: { ok, revenue }
//
// 사용자가 책별 실제 매출 (크몽/리디/교보/알라딘/직접/기타) 직접 입력.
// /profile/stats가 모든 책의 netTotalKRW 합산해서 ROI(매출/비용) 계산.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProject, updateProjectData } from "@/lib/server/db";

export const runtime = "nodejs";

const VALID_CHANNELS = ["kmong", "ridi", "kyobo", "aladdin", "direct", "other"] as const;
type ValidChannel = typeof VALID_CHANNELS[number];

const DEFAULT_FEE_RATES: Record<ValidChannel, number> = {
  kmong: 0.20,
  ridi: 0.30,
  kyobo: 0.30,
  aladdin: 0.30,
  direct: 0,
  other: 0,
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  const projectRow = await getProject(params.id, userId);
  if (!projectRow) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body?.channels)) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "channels 배열이 필요합니다." }, { status: 400 });
  }

  const channels = body.channels.slice(0, 10).map((c: any) => {
    const channel: ValidChannel = VALID_CHANNELS.includes(c?.channel) ? c.channel : "other";
    const grossNum = Number(c?.grossKRW) || 0;
    const grossKRW = Math.max(0, Math.min(100_000_000, Math.floor(grossNum)));
    const feeRate =
      typeof c?.feeRate === "number" && c.feeRate >= 0 && c.feeRate <= 1
        ? c.feeRate
        : DEFAULT_FEE_RATES[channel];
    const labelRaw = typeof c?.label === "string" ? c.label.trim().slice(0, 30) : "";
    return {
      channel,
      ...(labelRaw ? { label: labelRaw } : {}),
      grossKRW,
      feeRate,
    };
  });

  const netTotalKRW = channels.reduce(
    (sum: number, c: { grossKRW: number; feeRate: number }) =>
      sum + Math.floor(c.grossKRW * (1 - c.feeRate)),
    0,
  );

  const revenue = { channels, netTotalKRW, updatedAt: Date.now() };

  await updateProjectData(params.id, userId, { ...projectRow.data, revenue });

  return NextResponse.json({ ok: true, revenue });
}

"use client";

// LiveCounter — /write 흐름 v3 Phase 4.1
// spec section 3.8 — 라이브 카운터: "지금 N명이 책 만들기 중" 사회적 증거.
// - mount + 60s 간격 polling /api/analytics/active-users
// - 24시간 활성 / 진행 중 / 7일간 완성 — 베타 빈약 노출 방지 (spec 6.리스크)
// - 전부 0이면 hide (false 사회적 증거 차단)
// - useSession — 미인증 사용자에겐 노출 안 함 (홈 사회적 증거는 별도 컴포넌트)

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface ActiveUsersResponse {
  activeNow: number;
  booksInProgress: number;
  booksCompleted: number;
}

const POLL_INTERVAL_MS = 60_000;

export function LiveCounter() {
  const { status } = useSession();
  const [data, setData] = useState<ActiveUsersResponse | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function fetchOnce() {
      try {
        const r = await fetch("/api/analytics/active-users", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as ActiveUsersResponse;
        if (!cancelled) setData(json);
      } catch {
        // swallow — 다음 polling 시 재시도
      }
    }

    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status]);

  if (status !== "authenticated") return null;
  if (!data) return null;

  const { activeNow, booksInProgress, booksCompleted } = data;
  if (activeNow === 0 && booksInProgress === 0 && booksCompleted === 0) return null;

  return (
    <div
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:px-4 sm:py-2 rounded-full border border-tiger-orange/30 bg-tiger-orange/5 text-[11px] sm:text-xs text-ink-900"
      role="status"
      aria-live="polite"
      aria-label={`실시간 활동: 24시간 내 ${activeNow}명 활동, ${booksInProgress}권 만들기 중, 7일간 ${booksCompleted}권 완성`}
    >
      <span className="relative inline-flex items-center justify-center shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono font-bold text-tiger-orange tabular-nums">{activeNow}</span>
        <span className="text-gray-700">명 활동 중</span>
      </span>
      <span className="text-gray-300" aria-hidden="true">·</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono font-bold text-tiger-orange tabular-nums">{booksInProgress}</span>
        <span className="text-gray-700">권 만들기 중</span>
      </span>
      <span className="text-gray-300" aria-hidden="true">·</span>
      <span className="flex items-center gap-1.5">
        <span className="text-gray-500">7일간</span>
        <span className="font-mono font-bold text-tiger-orange tabular-nums">{booksCompleted}</span>
        <span className="text-gray-700">권 완성</span>
      </span>
    </div>
  );
}

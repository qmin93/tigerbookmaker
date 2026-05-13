"use client";

import { useEffect, useState } from "react";

interface AutoSaveIndicatorProps {
  /** sync 진행 중 */
  isSyncing: boolean;
  /** 마지막 sync 성공 시각 (ms epoch). null = 아직 없음 */
  lastSyncedAt: number | null;
  /** sync 실패 에러 (다음 시도 성공 시 null) */
  error: Error | null;
  /** 컴포넌트가 활성화되어 표시될지 (false면 렌더 X) */
  enabled?: boolean;
  /** 추가 className */
  className?: string;
}

/**
 * /write/setup 자동 저장 상태 작은 pill. (v3 Phase 1.2)
 * 3가지 상태:
 *   - 저장 중...     (오렌지 점 펄스)
 *   - ✓ 저장됨 N초 전 (초록)
 *   - ⚠ 연결 끊김 — 자동 재시도 중 (붉은색)
 */
export function AutoSaveIndicator({
  isSyncing,
  lastSyncedAt,
  error,
  enabled = true,
  className = "",
}: AutoSaveIndicatorProps) {
  // 1초 단위로 "N초 전" 라벨을 갱신해주는 tick
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  let label = "";
  let dotCls = "";
  let containerCls = "";

  if (error) {
    label = "⚠ 연결 끊김 — 자동 재시도 중";
    dotCls = "bg-red-500";
    containerCls = "bg-red-50 border-red-200 text-red-700";
  } else if (isSyncing) {
    label = "저장 중...";
    dotCls = "bg-tiger-orange animate-pulse";
    containerCls = "bg-orange-50 border-orange-200 text-orange-700";
  } else if (lastSyncedAt) {
    const ago = secondsAgo(lastSyncedAt);
    label = ago <= 2 ? "✓ 저장됨" : `✓ 저장됨 ${formatAgo(ago)}`;
    dotCls = "bg-green-500";
    containerCls = "bg-green-50 border-green-200 text-green-700";
  } else {
    // 아직 첫 sync 없음 — 조용히 안 보여줌
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-mono whitespace-nowrap ${containerCls} ${className}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

function secondsAgo(at: number): number {
  return Math.max(0, Math.round((Date.now() - at) / 1000));
}

function formatAgo(secs: number): string {
  if (secs < 60) return `${secs}초 전`;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return `${h}시간 전`;
}

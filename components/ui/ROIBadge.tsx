// ROIBadge — clean-redesign v3 (spec 3.7)
// "들인 돈 ₩X / 번 돈 ₩Y" 배지. /projects · /book/[id]에 표시해서 부수익 진행 상황 가시화.
// 사용자가 크몽 등 외부 플랫폼에서 책 팔리면 수동 입력 → 누적 ROI.

import Link from "next/link";

interface ROIBadgeProps {
  bookId: string;
  spentKRW: number;
  earnedKRW: number;
  compact?: boolean;
}

export function ROIBadge({ bookId, spentKRW, earnedKRW, compact = false }: ROIBadgeProps) {
  const profit = earnedKRW - spentKRW;
  const roi = spentKRW > 0 ? Math.round((profit / spentKRW) * 100) : 0;
  const isWinning = profit > 0;
  const hasEarning = earnedKRW > 0;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-mono">
        <span className="text-gray-500">들인 ₩{spentKRW.toLocaleString()}</span>
        <span className="text-gray-300">/</span>
        <span className={hasEarning ? (isWinning ? "text-emerald-600 font-bold" : "text-gray-700") : "text-gray-400"}>
          번 ₩{earnedKRW.toLocaleString()}
        </span>
        {hasEarning && isWinning && (
          <span className="text-emerald-600 font-bold">+{roi}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-600 mb-3">📊 부수익 현황</div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">들인 돈</div>
          <div className="font-mono text-2xl font-black text-ink-900">₩{spentKRW.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">번 돈</div>
          <div className={`font-mono text-2xl font-black ${hasEarning ? "text-emerald-600" : "text-gray-400"}`}>
            ₩{earnedKRW.toLocaleString()}
          </div>
        </div>
      </div>
      {hasEarning && (
        <div className={`text-sm font-bold ${isWinning ? "text-emerald-600" : "text-gray-700"}`}>
          {isWinning ? "▲" : "▼"} {Math.abs(profit).toLocaleString()}원 ({isWinning ? "+" : ""}{roi}%)
        </div>
      )}
      {!hasEarning && (
        <Link
          href={`/book/${bookId}?edit=revenue`}
          className="inline-block mt-2 text-sm text-emerald-600 font-bold hover:underline"
        >
          + 판매 수익 입력하기 →
        </Link>
      )}
    </div>
  );
}

"use client";

// CompletionFeed — /write 흐름 v3 Phase 4.2
// spec section 3.8 — 완성 축하 피드: "OO○님이 [주제] 완성!" (anonymize 사회적 증거).
// - mount + 5분 간격 polling /api/analytics/recent-completions
// - 1주일 내 완성이 0이면 hide (false 사회적 증거 차단 — LiveCounter 와 동일 정책)
// - 데스크탑: 카드 (최대 5개, 더 있으면 "+N권 더")
// - 모바일 (sm 미만): pill — "🎉 N권 완성" 클릭 → 카드 펼침
// - 토픽이 null = 비공개 책 → "책 완성 (비공개)" 표시

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

interface CompletionItem {
  displayHandle: string;
  topic: string | null;
  type: string | null;
  completedAt: string;
}

interface CompletionsResponse {
  completions: CompletionItem[];
  totalIn7Days: number;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5분
const VISIBLE_LIMIT = 5;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return "지난주";
}

function CompletionLine({ item }: { item: CompletionItem }) {
  const when = relativeTime(item.completedAt);
  // 비공개 책 = topic null. 공개 책 = topic 있음 → '주제' 강조.
  if (!item.topic) {
    return (
      <li className="flex items-start gap-2 text-[12px] leading-snug text-gray-700">
        <span aria-hidden="true">🎊</span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-ink-900">{item.displayHandle}</span>이 책 완성{" "}
          <span className="text-gray-400">(비공개)</span>
        </span>
        {when && <span className="shrink-0 text-[11px] text-gray-400 font-mono">{when}</span>}
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2 text-[12px] leading-snug text-gray-700">
      <span aria-hidden="true">🎊</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink-900">{item.displayHandle}</span>이{" "}
        <span className="text-tiger-orange font-medium">‘{item.topic}’</span> 완성
      </span>
      {when && <span className="shrink-0 text-[11px] text-gray-400 font-mono">{when}</span>}
    </li>
  );
}

export function CompletionFeed() {
  const { status } = useSession();
  const [data, setData] = useState<CompletionsResponse | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function fetchOnce() {
      try {
        const r = await fetch("/api/analytics/recent-completions", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as CompletionsResponse;
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

  const visible = useMemo(() => {
    if (!data) return [];
    return data.completions.slice(0, VISIBLE_LIMIT);
  }, [data]);

  if (status !== "authenticated") return null;
  if (!data) return null;
  if (data.totalIn7Days === 0) return null;

  const overflow = Math.max(0, data.totalIn7Days - visible.length);

  return (
    <div className="w-full">
      {/* 모바일 pill (sm 미만) — 탭하면 펼침 */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-tiger-orange/30 bg-tiger-orange/5 text-[11px] text-ink-900"
          aria-expanded={mobileExpanded}
          aria-controls="completion-feed-mobile-panel"
          aria-label={`최근 7일간 ${data.totalIn7Days}권 완성. 자세히 보려면 탭하세요`}
        >
          <span aria-hidden="true">🎉</span>
          <span className="font-mono font-bold text-tiger-orange tabular-nums">{data.totalIn7Days}</span>
          <span className="text-gray-700">권 완성</span>
          <span className="text-gray-400" aria-hidden="true">{mobileExpanded ? "▲" : "▼"}</span>
        </button>
        {mobileExpanded && visible.length > 0 && (
          <div
            id="completion-feed-mobile-panel"
            className="mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <ul className="space-y-2">
              {visible.map((item, idx) => (
                <CompletionLine key={`${item.completedAt}-${idx}`} item={item} />
              ))}
            </ul>
            {overflow > 0 && (
              <p className="mt-2 text-[11px] text-gray-400 font-mono">+{overflow}권 더</p>
            )}
          </div>
        )}
      </div>

      {/* 데스크탑 카드 (sm 이상) */}
      <div className="hidden sm:block rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[12px] font-bold text-ink-900 flex items-center gap-1.5">
            <span aria-hidden="true">🎉</span>
            <span>최근 7일 완성한 책</span>
            <span className="font-mono text-tiger-orange tabular-nums">{data.totalIn7Days}</span>
            <span className="text-gray-500 font-normal">권</span>
          </h3>
        </div>
        {visible.length > 0 ? (
          <ul className="space-y-2">
            {visible.map((item, idx) => (
              <CompletionLine key={`${item.completedAt}-${idx}`} item={item} />
            ))}
          </ul>
        ) : (
          // 카운트는 있는데 목록이 비는 경우 (캐시/장애) — 최소 정보만
          <p className="text-[12px] text-gray-500">완성 정보를 불러오는 중...</p>
        )}
        {overflow > 0 && (
          <p className="mt-2 text-[11px] text-gray-400 font-mono">+{overflow}권 더</p>
        )}
      </div>
    </div>
  );
}

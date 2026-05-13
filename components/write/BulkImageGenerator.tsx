// 본문 이미지 일괄 생성 UI (spec PR #4 — 본문 이미지 활성화 + 디폴트 ON)
//
// spec 3.6 핵심:
//   - 디폴트 ON. /write 상단 (본문 이미지 섹션) 에 항상 노출.
//   - "12장 추천됨 · 약 ₩3,600 · 한 번에 만들기" 시각화.
//   - 옵션:
//     1) "한 번에 다 만들기"  → /api/book/[id]/generate-chapter-images 반복 호출
//     2) "챕터별 선택"        → ChapterImageManager 펼침
//     3) "본문 이미지 OFF"    → project.data.imagesDisabled = true (라이트 시나리오)
//   - 추천을 한 번도 받지 않은 챕터가 있으면 "전체 추천 받기" 액션 제공.
//
// 비용 계산:
//   - 추천: ₩50/장 (한 챕터당). 모든 챕터 추천 = N × ₩50.
//   - 이미지 생성: ₩300/장 (실제 deductBalance는 vendor 비용 정확 반영, UI 표시는 견적).

"use client";

import { useEffect, useMemo, useState } from "react";
import ChapterImageManager, {
  type ChapterLite,
} from "./ChapterImageManager";

interface Props {
  projectId: string;
  chapters: ChapterLite[];
  /** project.data.imagesDisabled — true면 비활성 안내 */
  imagesDisabled?: boolean;
  /** 부모(write/page)의 fresh project 재패칭 */
  onProjectRefresh?: () => void | Promise<void>;
  /** 잔액 변경 */
  onBalanceChange?: (newBalanceKRW: number) => void;
  /** 잔액 부족 시 */
  onTopUpNeeded?: (shortfallKRW?: number) => void | Promise<void>;
}

const COST_SUGGEST_KRW = 50;
const COST_IMAGE_KRW = 300;

function extractPlaceholders(content: string): string[] {
  const m = content.match(/\[IMAGE:[^\]]+\]/g);
  return m ?? [];
}

export default function BulkImageGenerator({
  projectId,
  chapters,
  imagesDisabled,
  onProjectRefresh,
  onBalanceChange,
  onTopUpNeeded,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"" | "suggest-all" | "generate-all">("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [localDisabled, setLocalDisabled] = useState(!!imagesDisabled);

  useEffect(() => {
    setLocalDisabled(!!imagesDisabled);
  }, [imagesDisabled]);

  // 통계 계산
  const stats = useMemo(() => {
    let chaptersWithSuggestions = 0;
    let chaptersWithoutSuggestions = 0;
    let totalSuggestions = 0;
    let pendingImages = 0;
    let completedImages = 0;
    chapters.forEach((ch) => {
      const sugg = ch.imageSuggestions ?? [];
      const phs = extractPlaceholders(ch.content || "");
      if (sugg.length > 0) {
        chaptersWithSuggestions += 1;
        totalSuggestions += sugg.length;
      } else if ((ch.content || "").length > 50) {
        chaptersWithoutSuggestions += 1;
      }
      phs.forEach((ph) => {
        const has = ch.images?.find((i) => i.placeholder === ph)?.dataUrl;
        if (has) completedImages += 1;
        else pendingImages += 1;
      });
    });
    return {
      chaptersWithSuggestions,
      chaptersWithoutSuggestions,
      totalSuggestions,
      pendingImages,
      completedImages,
      hasContent: chapters.some((ch) => (ch.content || "").length > 50),
    };
  }, [chapters]);

  const estSuggestKRW = stats.chaptersWithoutSuggestions * COST_SUGGEST_KRW;
  const estImagesKRW = stats.pendingImages * COST_IMAGE_KRW;

  /** 추천이 없는 챕터 전부에 대해 /image-suggestions 순차 호출 */
  const requestAllSuggestions = async () => {
    setBusy("suggest-all");
    setError(null);
    setInfo(null);
    const targets = chapters
      .map((ch, idx) => ({ ch, idx }))
      .filter(({ ch }) => (ch.imageSuggestions?.length ?? 0) === 0 && (ch.content || "").length > 50);
    if (targets.length === 0) {
      setInfo("모든 챕터에 이미 추천이 있습니다.");
      setBusy("");
      return;
    }
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const { idx } = targets[i];
      try {
        const res = await fetch(`/api/chapter/${idx}/image-suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const data = await res.json();
        if (res.status === 402) {
          await onTopUpNeeded?.();
          throw new Error("잔액 부족");
        }
        if (!res.ok) {
          console.error("[bulk-suggest]", idx, data.message);
          continue;
        }
        if (data.newBalance != null) onBalanceChange?.(data.newBalance);
      } catch (e: any) {
        if (e?.message === "잔액 부족") break;
        console.error("[bulk-suggest]", idx, e?.message);
      } finally {
        setProgress({ done: i + 1, total: targets.length });
      }
    }
    setProgress(null);
    setBusy("");
    await onProjectRefresh?.();
    setInfo(`추천 완료. 이제 "한 번에 다 만들기"로 이미지를 생성하세요.`);
  };

  /** /api/book/[id]/generate-chapter-images 를 remaining 0 될 때까지 폴링 */
  const generateAll = async () => {
    setBusy("generate-all");
    setError(null);
    setInfo(null);
    const totalAtStart = stats.pendingImages;
    if (totalAtStart === 0) {
      setInfo("생성할 이미지가 없습니다. 먼저 챕터별로 추천을 받아주세요.");
      setBusy("");
      return;
    }
    setProgress({ done: 0, total: totalAtStart });
    let done = 0;
    let safety = 30;       // 최대 폴링 횟수 (안전장치)
    let stopReason: string | null = null;
    while (safety-- > 0) {
      try {
        const res = await fetch(`/api/book/${projectId}/generate-chapter-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const data = await res.json();
        if (res.status === 402) {
          await onTopUpNeeded?.(data.needKRW);
          stopReason = data.message || "잔액 부족";
          break;
        }
        if (!res.ok) {
          stopReason = data.message || `이미지 생성 실패 (${res.status})`;
          break;
        }
        if (data.newBalance != null) onBalanceChange?.(data.newBalance);
        done += data.generated || 0;
        setProgress({ done, total: totalAtStart });
        if (data.disabled) {
          stopReason = "본문 이미지가 OFF 상태입니다.";
          break;
        }
        if ((data.remaining ?? 0) === 0 && (data.failed?.length ?? 0) === 0) {
          break;
        }
        if ((data.generated ?? 0) === 0 && (data.failed?.length ?? 0) > 0) {
          stopReason = `일부 이미지 생성 실패: ${data.failed[0].message}`;
          break;
        }
      } catch (e: any) {
        stopReason = e?.message || String(e);
        break;
      }
    }
    setProgress(null);
    setBusy("");
    await onProjectRefresh?.();
    if (stopReason) setError(stopReason);
    else setInfo("✓ 본문 이미지 생성 완료.");
  };

  const turnOff = async () => {
    if (!confirm("본문 이미지를 비활성화할까요? 라이트 시나리오 (텍스트만)로 돌아갑니다.")) return;
    setBusy("");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagesDisabled: true }),
      });
      if (!res.ok) {
        // PATCH 미지원이면 fallback: 클라이언트 단 비활성만
        setLocalDisabled(true);
      } else {
        setLocalDisabled(true);
        await onProjectRefresh?.();
      }
      setInfo("본문 이미지 OFF — 추천/생성이 더 이상 자동으로 진행되지 않습니다.");
    } catch {
      setLocalDisabled(true);
    }
  };

  const turnOn = async () => {
    setError(null);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagesDisabled: false }),
      });
    } catch {}
    setLocalDisabled(false);
    setInfo(null);
    await onProjectRefresh?.();
  };

  if (!stats.hasContent) {
    return (
      <p className="text-[11px] text-gray-500 px-1">
        본문 이미지는 챕터 본문을 생성한 뒤 추천받을 수 있습니다.
      </p>
    );
  }

  if (localDisabled) {
    return (
      <div className="rounded-lg p-2.5 bg-gray-50 border border-gray-200">
        <p className="text-[11px] text-gray-700">
          본문 이미지 <span className="font-bold">OFF</span> — 라이트 시나리오 (텍스트만).
        </p>
        <button
          onClick={turnOn}
          className="mt-1 text-[10px] text-tiger-orange hover:underline"
        >
          다시 켜기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 핵심 CTA */}
      <div className="rounded-lg p-3 bg-orange-50 border border-tiger-orange/40">
        <div className="text-[11px] text-gray-700 font-medium">
          본문 이미지 자동 추천 <span className="text-[9px] text-gray-500">(디폴트 ON)</span>
        </div>
        <div className="mt-1 text-xs text-gray-800">
          {stats.totalSuggestions > 0 ? (
            <>
              <span className="font-bold">{stats.totalSuggestions}장 추천됨</span> · 약{" "}
              <span className="font-bold">₩{estImagesKRW.toLocaleString()}</span>
            </>
          ) : (
            <>
              <span className="font-bold">{stats.chaptersWithoutSuggestions}챕터</span> 추천 대기 · 추천 비용 약{" "}
              <span className="font-bold">₩{estSuggestKRW.toLocaleString()}</span>
            </>
          )}
        </div>
        {stats.completedImages > 0 && (
          <div className="mt-0.5 text-[10px] text-gray-500">
            이미 완성: {stats.completedImages}장
          </div>
        )}

        {progress && (
          <div className="mt-2">
            <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-tiger-orange transition-all"
                style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-gray-600">
              {progress.done} / {progress.total} 진행 중...
            </div>
          </div>
        )}

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {stats.totalSuggestions === 0 ? (
            <button
              onClick={requestAllSuggestions}
              disabled={!!busy}
              className="px-2 py-1.5 bg-tiger-orange text-white rounded text-xs font-bold hover:bg-tiger-orange/90 disabled:opacity-50"
            >
              {busy === "suggest-all" ? "추천 받는 중..." : "🪄 전체 추천 받기"}
            </button>
          ) : (
            <button
              onClick={generateAll}
              disabled={!!busy || stats.pendingImages === 0}
              className="px-2 py-1.5 bg-tiger-orange text-white rounded text-xs font-bold hover:bg-tiger-orange/90 disabled:opacity-50"
              title={stats.pendingImages === 0 ? "생성할 이미지 없음" : `${stats.pendingImages}장 생성`}
            >
              {busy === "generate-all"
                ? "생성 중..."
                : stats.pendingImages === 0
                ? "✓ 전부 완성"
                : `🖼️ 한 번에 다 만들기 (${stats.pendingImages}장)`}
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            disabled={!!busy}
            className="px-2 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {expanded ? "▲ 챕터별 닫기" : "▼ 챕터별 선택"}
          </button>
          <button
            onClick={turnOff}
            disabled={!!busy}
            className="px-2 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
            title="라이트 시나리오로 회귀"
          >
            본문 이미지 생략
          </button>
        </div>
      </div>

      {info && (
        <div className="px-2 py-1.5 bg-green-50 border border-green-200 rounded text-[11px] text-green-800">
          {info}
        </div>
      )}
      {error && (
        <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
          {error}
        </div>
      )}

      {expanded && (
        <div className="pt-1">
          <ChapterImageManager
            projectId={projectId}
            chapters={chapters}
            onProjectRefresh={onProjectRefresh}
            onBalanceChange={onBalanceChange}
            onTopUpNeeded={onTopUpNeeded}
          />
        </div>
      )}
    </div>
  );
}

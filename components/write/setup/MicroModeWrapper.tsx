"use client";

/**
 * MicroModeWrapper (v3 Phase 4.3 — 모바일 마이크로 모드)
 *
 * 역할:
 *  - /write/setup 의 각 substep (AnalyzeStep / InterviewStep / StyleStep / TocStep) 을 감싼다.
 *  - 마이크로 모드가 비활성이면 그냥 children 을 그대로 렌더 (substep 원래 모습).
 *  - 마이크로 모드가 활성이면:
 *      1. children DOM 에서 `[data-micro-step]` 속성을 가진 요소를 찾는다 (각 = 1 마이크로 작업).
 *      2. 현재 인덱스에 해당하는 것만 보이고 나머지는 display:none.
 *      3. 상단에 진행 도트 + 격려 메시지, 하단에 ← 이전 / 다음 → 버튼.
 *      4. 마지막 마이크로 작업에서는 wrapper "다음 →" 버튼을 숨김 — substep 의 원본 "다음 단계 →" 버튼이
 *         그대로 보이며 다음 substep 으로 진행하도록 한다.
 *      5. `[data-hide-in-micro]` 속성 요소는 마이크로 모드에서 무조건 숨김 (페이지 헤더, 답변 history 등).
 *
 * 작동 모델:
 *  - 자식 substep 컴포넌트가 변경되면 (re-render) DOM 스캔 → step 수와 라벨을 갱신한다.
 *  - 인덱스 범위가 줄어들면 (인터뷰: 1개 답변 후 다음 질문 등장 시 한 step 줄어들 수 있음) 자동 조정.
 *  - 자료 분석 (AnalyzeStep) 처럼 마이크로 분할이 무의미한 substep 은 `microStepCount` 가 1 일 수 있다 —
 *    이 경우 wrapper UI 는 거의 사라지고 그냥 패스스루.
 *
 * 자식 substep 요구사항:
 *  - 마이크로 분할하고 싶은 영역에 `<div data-micro-step="0">`, `<div data-micro-step="1">` ... 부착.
 *  - 라벨도 같이: `data-micro-label="질문 1"` (옵션). 없으면 "1/3" 식.
 *  - data-micro-step 값은 0-base 정수 문자열. 정렬 순으로 렌더된다고 가정.
 *
 * 잠깐 쉬기:
 *  - 모바일에서만 화면 하단에 floating "잠깐 쉬기" 버튼. 클릭 → 토스트 + /projects 이동.
 *  - 자동 저장은 이미 부모(page.tsx)에서 useAutoSave 로 처리되므로 추가 작업 없음.
 */

import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMicroMode } from "@/lib/use-mobile";

interface MicroStep {
  index: number;
  label: string | null;
}

interface MicroModeWrapperProps {
  /** substep 식별자 — analyze / interview / style / toc */
  substep: "analyze" | "interview" | "style" | "toc";
  /** substep 컴포넌트 (data-micro-step 부착된 DOM 포함) */
  children: ReactNode;
}

// 격려 메시지 풀
const ENCOURAGE_FIRST = "5분이면 끝나요";
const ENCOURAGE_MID = (remaining: number) => `이제 ${remaining}개만 더`;
const ENCOURAGE_LAST = "마지막 단계까지 5분";
const ENCOURAGE_LONE = "잠깐만 집중하면 끝나요";

export function MicroModeWrapper({ substep, children }: MicroModeWrapperProps) {
  const router = useRouter();
  const { isMobile, isMicroMode, toggleMicroMode } = useMicroMode();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [steps, setSteps] = useState<MicroStep[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [exitToastVisible, setExitToastVisible] = useState(false);

  // ── DOM 스캔: containerRef 안의 [data-micro-step] 요소 수집 ─────────
  const scan = useCallback(() => {
    if (!containerRef.current) return;
    const nodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-micro-step]"),
    );
    // index 정렬
    const parsed: MicroStep[] = nodes
      .map(n => {
        const raw = n.getAttribute("data-micro-step") ?? "0";
        const idx = parseInt(raw, 10);
        const label = n.getAttribute("data-micro-label");
        return { index: Number.isFinite(idx) ? idx : 0, label };
      })
      .sort((a, b) => a.index - b.index);

    setSteps(prev => {
      // 동일하면 setState 안 함 (불필요한 리렌더 방지)
      if (prev.length === parsed.length && prev.every((p, i) => p.index === parsed[i].index && p.label === parsed[i].label)) {
        return prev;
      }
      return parsed;
    });
  }, []);

  // 마이크로 모드 활성화 시 / children 변경 시 / 라우트 substep 변경 시 재스캔
  useEffect(() => {
    if (!isMicroMode) return;
    if (!containerRef.current) return;
    // 즉시 한 번
    scan();
    // MutationObserver 로 자식 변화 감지 (인터뷰 답변 제출 후 새 질문 등)
    const obs = new MutationObserver(() => scan());
    obs.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-micro-step", "data-micro-label"],
    });
    return () => obs.disconnect();
  }, [isMicroMode, substep, scan]);

  // substep 변경 시 인덱스 0 으로 리셋
  useEffect(() => {
    setActiveIdx(0);
  }, [substep]);

  // steps 수가 줄어들면 activeIdx clamp
  useEffect(() => {
    if (steps.length === 0) return;
    if (activeIdx >= steps.length) setActiveIdx(steps.length - 1);
  }, [steps.length, activeIdx]);

  // ── 실제 표시/숨김 적용 ─────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    if (!isMicroMode) {
      // 마이크로 모드 OFF — 모두 보이게 복원
      container.querySelectorAll<HTMLElement>("[data-micro-step]").forEach(el => {
        el.style.display = "";
      });
      container.querySelectorAll<HTMLElement>("[data-hide-in-micro]").forEach(el => {
        el.style.display = "";
      });
      return;
    }

    // 마이크로 모드 ON — data-hide-in-micro 는 무조건 숨김
    container.querySelectorAll<HTMLElement>("[data-hide-in-micro]").forEach(el => {
      el.style.display = "none";
    });

    // data-micro-step 분할이 있으면 현재만 보이게
    if (steps.length > 0) {
      const nodes = container.querySelectorAll<HTMLElement>("[data-micro-step]");
      nodes.forEach(el => {
        const raw = el.getAttribute("data-micro-step") ?? "0";
        const idx = parseInt(raw, 10);
        const target = steps[activeIdx]?.index ?? 0;
        el.style.display = idx === target ? "" : "none";
      });
    }
  }, [isMicroMode, steps, activeIdx]);

  const totalSteps = steps.length;
  const isFirst = activeIdx === 0;
  const isLast = activeIdx === totalSteps - 1;
  const remaining = Math.max(totalSteps - activeIdx - 1, 0);

  const encourageMsg = useMemo(() => {
    if (totalSteps <= 1) return ENCOURAGE_LONE;
    if (isLast) return ENCOURAGE_LAST;
    if (isFirst) return ENCOURAGE_FIRST;
    return ENCOURAGE_MID(remaining);
  }, [totalSteps, isLast, isFirst, remaining]);

  const goNext = useCallback(() => {
    setActiveIdx(i => Math.min(i + 1, Math.max(totalSteps - 1, 0)));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    setActiveIdx(i => Math.max(i - 1, 0));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // ── 잠깐 쉬기 ─────────
  const handlePause = useCallback(() => {
    setExitToastVisible(true);
    // 1.6초 후 /projects 이동 (자동 저장은 이미 진행 중)
    setTimeout(() => router.push("/projects"), 1600);
  }, [router]);

  // 마이크로 모드 OFF: 패스스루 (단, 데스크탑 토글은 위에 표시)
  if (!isMicroMode) {
    return (
      <div ref={containerRef} data-micro-wrapper={substep}>
        {!isMobile && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={toggleMicroMode}
              className="text-[11px] font-mono text-gray-500 hover:text-tiger-orange border border-gray-300 hover:border-tiger-orange rounded-full px-3 py-1 transition"
              title="모바일처럼 한 작업씩 보기 (테스트용)"
            >
              📱 모바일처럼 보기
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  // 마이크로 모드 ON
  return (
    <div ref={containerRef} data-micro-wrapper={substep} className="relative">
      {/* 상단 마이크로 진행 도트 + 격려 메시지 */}
      {totalSteps > 1 && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-1.5" aria-label={`마이크로 진행 ${activeIdx + 1}/${totalSteps}`}>
              {steps.map((s, i) => (
                <button
                  key={s.index}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-label={`${i + 1}번째 마이크로 작업으로 이동`}
                  aria-current={i === activeIdx ? "step" : undefined}
                  className={`h-2 rounded-full transition-all ${
                    i === activeIdx
                      ? "w-6 bg-tiger-orange"
                      : i < activeIdx
                      ? "w-2 bg-tiger-orange/60"
                      : "w-2 bg-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap">
              {activeIdx + 1} / {totalSteps}
            </span>
          </div>
          <p className="text-[11px] text-tiger-orange font-bold">
            🐯 {encourageMsg}
            {steps[activeIdx]?.label && (
              <span className="ml-2 text-gray-500 font-normal">· {steps[activeIdx].label}</span>
            )}
          </p>
        </div>
      )}

      {/* 데스크탑에서 마이크로 모드 켰을 때 — 끄기 토글 */}
      {!isMobile && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={toggleMicroMode}
            className="text-[11px] font-mono text-gray-500 hover:text-ink-900 border border-gray-300 hover:border-ink-900 rounded-full px-3 py-1 transition"
            title="원래대로 (한 화면 전체 보기)"
          >
            🖥️ 전체 보기
          </button>
        </div>
      )}

      {/* 마이크로 모드 콘텐츠 — 더 큰 폰트/터치 타깃 */}
      <div className="micro-mode-content text-base leading-relaxed">{children}</div>

      {/* 하단 prev/next — 마지막 마이크로 작업이면 next 숨김 (substep 의 "다음 단계 →" 가 인계받음) */}
      {totalSteps > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirst}
            className="px-4 min-h-[56px] text-sm font-bold border border-gray-300 text-ink-900 rounded-xl hover:border-ink-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← 이전
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 min-h-[56px] px-6 text-sm font-bold bg-tiger-orange text-white rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition"
            >
              다음 →
            </button>
          ) : (
            <span className="flex-1 text-[11px] text-gray-500 text-right">↓ 아래 버튼으로 다음 단계</span>
          )}
        </div>
      )}

      {/* 잠깐 쉬기 — 모바일에서만 floating */}
      {isMobile && (
        <button
          type="button"
          onClick={handlePause}
          className="fixed bottom-4 left-4 z-40 px-3 py-2 bg-white border border-gray-300 shadow-lg rounded-full text-xs font-bold text-gray-700 hover:text-ink-900 hover:border-ink-900 transition"
          aria-label="잠깐 쉬기 — 진행 상황 저장 후 내 책으로 이동"
        >
          ☕ 잠깐 쉬기
        </button>
      )}

      {/* 잠깐 쉬기 토스트 */}
      {exitToastVisible && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-ink-900 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-bold max-w-xs text-center animate-fade-in">
          💾 지금까지 저장됐어요
          <p className="text-xs font-normal text-gray-300 mt-1">
            카톡/이메일로 알려드릴게요
          </p>
        </div>
      )}
    </div>
  );
}

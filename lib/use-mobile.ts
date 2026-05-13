"use client";

/**
 * 모바일 마이크로 모드 훅 (v3 Phase 4.3)
 *
 * 작동 방식:
 *  - useIsMobile(): viewport 가 768px 미만이면 true. window 리사이즈에 반응.
 *  - useMicroMode(): { isMobile, isMicroMode, toggleMicroMode }
 *    - isMicroMode 기본값 = isMobile (모바일이면 자동 활성화)
 *    - 사용자가 toggle 하면 localStorage `tbm_micro_mode_pref` 에 명시적 선호도 저장
 *    - 명시적 선호도가 있으면 그 값을 우선 적용 (데스크탑에서도 "모바일처럼 보기" 가능)
 *
 * 사용:
 *   const { isMobile, isMicroMode, toggleMicroMode } = useMicroMode();
 *   if (isMicroMode) { ... 한 화면 한 작업 ... }
 */

import { useEffect, useState, useCallback } from "react";

const MOBILE_BREAKPOINT_PX = 768;
const PREF_STORAGE_KEY = "tbm_micro_mode_pref";

type MicroModePref = "on" | "off" | null;

function readPref(): MicroModePref {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREF_STORAGE_KEY);
    if (raw === "on" || raw === "off") return raw;
    return null;
  } catch {
    return null;
  }
}

function writePref(value: MicroModePref): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(PREF_STORAGE_KEY);
    } else {
      window.localStorage.setItem(PREF_STORAGE_KEY, value);
    }
  } catch {
    // localStorage 사용 불가 — 무시
  }
}

/**
 * 현재 viewport 가 모바일(<768px)인지 반응적으로 반환.
 * SSR-safe: 초기 렌더는 false → 마운트 후 실제 값 반영.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    // 일부 구형 브라우저는 addEventListener 미지원 → addListener fallback
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } else if (typeof (mq as any).addListener === "function") {
      (mq as any).addListener(update);
      return () => (mq as any).removeListener(update);
    }
  }, []);

  return isMobile;
}

export interface UseMicroModeResult {
  /** viewport 가 모바일(<768px)인지 */
  isMobile: boolean;
  /** 현재 마이크로 모드 활성화 여부 */
  isMicroMode: boolean;
  /** 마이크로 모드 토글 (localStorage에 명시적 선호도 저장) */
  toggleMicroMode: () => void;
}

/**
 * 마이크로 모드 활성화 상태 + 토글.
 *
 * 기본값: 모바일이면 ON, 데스크탑이면 OFF.
 * 사용자가 toggle 하면 선호도가 localStorage 에 저장되어 다음 세션에도 유지됨.
 */
export function useMicroMode(): UseMicroModeResult {
  const isMobile = useIsMobile();
  const [pref, setPref] = useState<MicroModePref>(null);
  const [hydrated, setHydrated] = useState(false);

  // 마운트 시 localStorage 에서 명시적 선호도 읽기
  useEffect(() => {
    setPref(readPref());
    setHydrated(true);
  }, []);

  // 명시적 선호도가 있으면 우선, 없으면 isMobile 기반
  // SSR/하이드레이션 일치를 위해 hydrated 전엔 false 반환
  const isMicroMode = hydrated ? (pref === "on" ? true : pref === "off" ? false : isMobile) : false;

  const toggleMicroMode = useCallback(() => {
    const next: MicroModePref = isMicroMode ? "off" : "on";
    writePref(next);
    setPref(next);
  }, [isMicroMode]);

  return { isMobile, isMicroMode, toggleMicroMode };
}

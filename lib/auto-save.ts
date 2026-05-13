"use client";

/**
 * /write/setup 자동 저장 인프라 (v3 Phase 1.2)
 *
 * 작동 방식:
 *  1. data 변경 시 debounce 후 localStorage 즉시 기록 (기본 500ms)
 *  2. syncIntervalMs 마다 localStorage가 마지막 DB sync 시점과 다르면 onSync 호출
 *  3. 성공 시 lastSyncedAt + 마지막 sync된 snapshot 갱신
 *  4. 언마운트 시 마지막 미동기 데이터가 있으면 onSync 1회 추가 호출 (best-effort)
 *  5. 네트워크 실패 → error state 노출. 다음 interval에서 자동 재시도
 *
 * 사용:
 *   const { lastSyncedAt, isSyncing, error } = useAutoSave({
 *     key: `tbm-autosave-project-${projectId}`,
 *     data: { interview: { questions: history } },
 *     onSync: async d => {
 *       await fetch(`/api/projects/${projectId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: d }) });
 *     },
 *   });
 *
 * 주의:
 *  - data는 매 렌더마다 새 reference여도 OK — JSON.stringify 결과로 변경 감지.
 *  - 초기 mount 시에는 sync 트리거하지 않음 (서버에 동일 데이터를 다시 쓰지 않기 위해).
 */

import { useEffect, useRef, useState } from "react";

interface UseAutoSaveOptions<T> {
  /** localStorage 키 (예: `tbm-autosave-project-${id}`) */
  key: string;
  /** 현재 데이터 (변경되면 자동 저장) */
  data: T;
  /** DB sync 콜백 — Promise resolve = 성공 */
  onSync: (data: T) => Promise<void>;
  /** localStorage 쓰기 debounce (기본 500ms) */
  debounceMs?: number;
  /** DB sync 주기 (기본 5000ms) */
  syncIntervalMs?: number;
  /** false면 일시 비활성화 (예: 데이터 미준비 시) */
  enabled?: boolean;
}

export interface UseAutoSaveResult {
  /** 마지막 DB sync 성공 시각 (ms epoch). 한 번도 sync 안 되었으면 null */
  lastSyncedAt: number | null;
  /** 현재 sync 진행 중 여부 */
  isSyncing: boolean;
  /** 가장 최근 sync 실패 에러 (다음 시도 성공 시 null) */
  error: Error | null;
}

/** localStorage payload (DB sync용 메타데이터 포함) */
interface StoredPayload<T> {
  data: T;
  savedAt: number;
}

const isBrowser = typeof window !== "undefined";

function stableStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

export function loadAutoSaved<T>(key: string): T | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload<T>;
    return parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : null;
  } catch {
    return null;
  }
}

/** localStorage 저장 시각(ms) — 없으면 null */
export function loadAutoSavedAt(key: string): number | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload<unknown>;
    return typeof parsed?.savedAt === "number" ? parsed.savedAt : null;
  } catch {
    return null;
  }
}

export function clearAutoSaved(key: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore quota errors */
  }
}

export function useAutoSave<T>(opts: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const { key, data, onSync, debounceMs = 500, syncIntervalMs = 5000, enabled = true } = opts;

  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 최신 콜백·data를 ref로 추적해서 interval이 stale closure를 피하게 함.
  const dataRef = useRef<T>(data);
  const onSyncRef = useRef(onSync);
  // 마지막으로 DB에 성공적으로 보낸 JSON 문자열 (변경 감지용)
  const lastSyncedJsonRef = useRef<string | null>(null);
  // 첫 렌더에서 onSync 트리거 방지. 첫 변경 시점에 false로 바뀜.
  const initialMountRef = useRef(true);
  // localStorage debounce 타이머
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // sync 폴링 인터벌
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 동시 sync 방지 잠금
  const syncingRef = useRef(false);
  // 언마운트 시 final-sync 보낼 마지막 미동기화 데이터
  const pendingSyncRef = useRef<T | null>(null);

  // ref 동기화 (매 렌더)
  dataRef.current = data;
  onSyncRef.current = onSync;

  // localStorage write (debounced)
  useEffect(() => {
    if (!enabled || !isBrowser) return;

    const json = stableStringify(data);

    // 첫 렌더 = 마운트. localStorage에 기록은 하지만 sync 흐름의 시작점으로는 사용 X.
    if (initialMountRef.current) {
      initialMountRef.current = false;
      // 마운트 시점 데이터를 "이미 DB와 같다" 로 가정 — 부모가 DB에서 로드한 직후 mount하므로.
      // (변경 감지를 위해 baseline 으로 세팅)
      lastSyncedJsonRef.current = json;
      // localStorage에 baseline도 기록 (resume용)
      try {
        const payload: StoredPayload<T> = { data, savedAt: Date.now() };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        /* quota */
      }
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      try {
        const payload: StoredPayload<T> = { data: dataRef.current, savedAt: Date.now() };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        /* quota */
      }
    }, debounceMs);

    // 매 변경마다 "아직 동기화 안 된 데이터" 표시
    pendingSyncRef.current = data;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableStringify(data), enabled, key, debounceMs]);

  // 주기적 DB sync
  useEffect(() => {
    if (!enabled || !isBrowser) return;

    async function trySync() {
      if (syncingRef.current) return;
      const current = dataRef.current;
      const currentJson = stableStringify(current);
      if (currentJson === lastSyncedJsonRef.current) return; // 변경 없음

      syncingRef.current = true;
      setIsSyncing(true);
      try {
        await onSyncRef.current(current);
        lastSyncedJsonRef.current = currentJson;
        setLastSyncedAt(Date.now());
        setError(null);
        pendingSyncRef.current = null;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        // 다음 interval에서 자동 재시도 (lastSyncedJsonRef는 업데이트하지 않음)
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    }

    intervalRef.current = setInterval(trySync, syncIntervalMs);

    // 탭 가시성 회복 시 즉시 한 번 더 시도 (오랜만에 돌아왔을 때 빠른 sync)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void trySync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);

      // 언마운트 시 마지막 미동기화 데이터가 있으면 best-effort 한 번 더 시도
      const pending = pendingSyncRef.current;
      if (pending) {
        const pendingJson = stableStringify(pending);
        if (pendingJson !== lastSyncedJsonRef.current && !syncingRef.current) {
          // fire-and-forget — 결과를 기다리지 않음 (이미 언마운트됨)
          onSyncRef.current(pending).catch(() => {});
        }
      }
    };
  }, [enabled, syncIntervalMs]);

  return { lastSyncedAt, isSyncing, error };
}

// lib/ui/notify.tsx
// 글로벌 알림 시스템 — native confirm/alert 대체 + 완료 toast.
// Provider를 root layout에 마운트하고, 어디서든 useNotify() 훅으로 호출.
//
// API:
//   const notify = useNotify();
//   await notify.confirm({ title, message, variant, confirmLabel, cancelLabel })  // → boolean
//   notify.success({ title, message, nextStepLabel?, onNextStep?, durationMs? })
//   notify.error({ title, message, durationMs? })
//   notify.info({ title, message, durationMs? })

"use client";
import { createContext, useCallback, useContext, useState, useRef, type ReactNode } from "react";

// ─── 타입 ────────────────────────────────────────────

export type ConfirmVariant = "default" | "danger" | "warn" | "primary";

export interface ConfirmOptions {
  title: string;
  message?: string;
  details?: string[];          // 빠진 항목 같은 리스트 표시
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  emoji?: string;
}

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  title: string;
  message?: string;
  durationMs?: number;
  nextStepLabel?: string;      // "다음: 표지 만들러 가기" 같은 CTA
  onNextStep?: () => void;
}

interface Toast {
  id: number;
  variant: ToastVariant;
  opts: ToastOptions;
}

interface ConfirmState {
  id: number;
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

// ─── Context ────────────────────────────────────────

interface NotifyApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  success: (opts: ToastOptions) => void;
  error: (opts: ToastOptions) => void;
  info: (opts: ToastOptions) => void;
}

const NotifyContext = createContext<NotifyApi | null>(null);

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    // SSR 또는 Provider 미마운트 fallback — native confirm 으로
    return {
      confirm: async (opts) => typeof window !== "undefined" ? window.confirm(`${opts.title}${opts.message ? "\n\n" + opts.message : ""}`) : false,
      success: (opts) => typeof window !== "undefined" && console.log("[notify.success fallback]", opts.title),
      error: (opts) => typeof window !== "undefined" && alert(`${opts.title}${opts.message ? "\n\n" + opts.message : ""}`),
      info: (opts) => typeof window !== "undefined" && console.log("[notify.info fallback]", opts.title),
    };
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [confirms, setConfirms] = useState<ConfirmState[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(1);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const id = idCounter.current++;
      setConfirms(list => [...list, { id, opts, resolve }]);
    });
  }, []);

  const showToast = useCallback((variant: ToastVariant, opts: ToastOptions) => {
    const id = idCounter.current++;
    const dur = opts.durationMs ?? (variant === "error" ? 6000 : 4000);
    setToasts(list => [...list, { id, variant, opts }]);
    if (dur > 0) {
      setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), dur);
    }
  }, []);

  const api: NotifyApi = {
    confirm,
    success: (opts) => showToast("success", opts),
    error: (opts) => showToast("error", opts),
    info: (opts) => showToast("info", opts),
  };

  const closeConfirm = (id: number, value: boolean) => {
    setConfirms(list => {
      const target = list.find(c => c.id === id);
      target?.resolve(value);
      return list.filter(c => c.id !== id);
    });
  };

  const dismissToast = (id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
  };

  return (
    <NotifyContext.Provider value={api}>
      {children}

      {/* Confirm 모달들 (스택 가능) */}
      {confirms.map(c => (
        <ConfirmModalView
          key={c.id}
          opts={c.opts}
          onConfirm={() => closeConfirm(c.id, true)}
          onCancel={() => closeConfirm(c.id, false)}
        />
      ))}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-4 z-[210] space-y-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto pointer-events-none">
          {toasts.map(t => (
            <ToastView key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
          ))}
        </div>
      )}
    </NotifyContext.Provider>
  );
}

// ─── Confirm Modal 뷰 ────────────────────────────────

function ConfirmModalView({ opts, onConfirm, onCancel }: { opts: ConfirmOptions; onConfirm: () => void; onCancel: () => void }) {
  const variant = opts.variant ?? "primary";
  const variantColor =
    variant === "danger" ? "bg-red-600 hover:bg-red-700"
    : variant === "warn" ? "bg-amber-500 hover:bg-amber-600"
    : variant === "default" ? "bg-gray-800 hover:bg-gray-900"
    : "bg-tiger-orange hover:bg-orange-600";

  const headerBg =
    variant === "danger" ? "bg-gradient-to-r from-red-500 to-rose-500"
    : variant === "warn" ? "bg-gradient-to-r from-yellow-400 to-orange-400"
    : variant === "default" ? "bg-gradient-to-r from-gray-700 to-gray-800"
    : "bg-gradient-to-r from-tiger-orange to-orange-600";

  const headerText = variant === "warn" ? "text-yellow-900" : "text-white";

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white text-ink-900 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className={`${headerBg} p-5 ${headerText}`}>
          <div className="flex items-center gap-3">
            {opts.emoji && <span className="text-3xl">{opts.emoji}</span>}
            <h3 className="text-lg font-black tracking-tight flex-1">{opts.title}</h3>
          </div>
        </div>
        <div className="p-5">
          {opts.message && (
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed mb-4">{opts.message}</p>
          )}
          {opts.details && opts.details.length > 0 && (
            <ul className="space-y-1.5 mb-4">
              {opts.details.map((d, i) => (
                <li key={i} className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-100">
                  {d}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              {opts.cancelLabel ?? "취소"}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition ${variantColor}`}
            >
              {opts.confirmLabel ?? "확인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toast 뷰 ────────────────────────────────────────

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const v = toast.variant;
  const bg =
    v === "success" ? "bg-white border-green-200"
    : v === "error" ? "bg-white border-red-200"
    : "bg-white border-blue-200";
  const accent =
    v === "success" ? "bg-green-500"
    : v === "error" ? "bg-red-500"
    : "bg-blue-500";
  const emoji =
    v === "success" ? "✓"
    : v === "error" ? "⚠"
    : "ℹ";

  return (
    <div className={`pointer-events-auto rounded-xl border ${bg} shadow-xl animate-in slide-in-from-right-5 fade-in overflow-hidden`}>
      <div className="flex items-stretch">
        <div className={`w-10 ${accent} flex items-center justify-center text-white font-black text-lg`}>{emoji}</div>
        <div className="flex-1 p-3 min-w-0">
          <div className="font-bold text-sm text-ink-900 mb-0.5">{toast.opts.title}</div>
          {toast.opts.message && (
            <div className="text-xs text-gray-600 leading-snug">{toast.opts.message}</div>
          )}
          {toast.opts.nextStepLabel && toast.opts.onNextStep && (
            <button
              onClick={() => { toast.opts.onNextStep!(); onClose(); }}
              className="mt-2 text-xs font-bold text-tiger-orange hover:text-orange-700"
            >
              {toast.opts.nextStepLabel} →
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-2 text-gray-400 hover:text-ink-900 text-sm flex-shrink-0"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

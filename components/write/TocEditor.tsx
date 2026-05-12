// TocEditor — clean-redesign v3 (spec 3.6)
// AI 목차 생성 후 사용자가 챕터 제목·순서·추가·삭제 직접 편집.
// 챕터 본문 생성 전 단계에서만 사용.
//
// 사용처: /write/page.tsx 목차 단계.

"use client";
import { useState } from "react";

export interface TocChapter {
  id: string;
  title: string;
  subtitle?: string;
}

interface TocEditorProps {
  chapters: TocChapter[];
  onChange: (next: TocChapter[]) => void;
  onConfirm: () => void;
  busy?: boolean;
}

export function TocEditor({ chapters, onChange, onConfirm, busy }: TocEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const move = (id: string, dir: -1 | 1) => {
    const idx = chapters.findIndex(c => c.id === id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= chapters.length) return;
    const next = [...chapters];
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
    onChange(next);
  };

  const remove = (id: string) => {
    if (!confirm("이 챕터를 삭제할까요?")) return;
    onChange(chapters.filter(c => c.id !== id));
  };

  const update = (id: string, patch: Partial<TocChapter>) => {
    onChange(chapters.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const add = () => {
    const id = `ch-${Date.now()}`;
    onChange([...chapters, { id, title: "새 챕터" }]);
    setEditingId(id);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-deep-navy mb-2">
          ② 목차를 직접 손볼 수 있어요
        </div>
        <h3 className="text-2xl font-black tracking-tight text-ink-900">챕터 제목 · 순서 · 추가 · 삭제</h3>
        <p className="mt-2 text-sm text-gray-600">본문 생성 전에 한 번만 정리하면 끝까지 일관됩니다.</p>
      </div>

      <ol className="space-y-2">
        {chapters.map((c, i) => {
          const isEditing = editingId === c.id;
          return (
            <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-3 flex items-start gap-3">
              <span className="mt-1 font-mono text-xs text-gray-400 w-6 shrink-0 text-right">{String(i + 1).padStart(2, "0")}</span>
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <input
                    autoFocus
                    defaultValue={c.title}
                    onBlur={e => update(c.id, { title: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") setEditingId(null); }}
                    className="w-full rounded-md border border-deep-navy/40 px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-deep-navy/40"
                  />
                  <input
                    defaultValue={c.subtitle ?? ""}
                    placeholder="부제 (선택)"
                    onBlur={e => update(c.id, { subtitle: e.target.value || undefined })}
                    className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-deep-navy/40"
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setEditingId(c.id)}
                    className="block text-left w-full"
                  >
                    <div className="text-sm font-bold text-ink-900 truncate">{c.title}</div>
                    {c.subtitle && <div className="text-xs text-gray-500 truncate mt-0.5">{c.subtitle}</div>}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1 shrink-0 text-gray-400">
                <button onClick={() => move(c.id, -1)} disabled={i === 0} className="w-7 h-7 rounded hover:bg-gray-100 disabled:opacity-30">↑</button>
                <button onClick={() => move(c.id, +1)} disabled={i === chapters.length - 1} className="w-7 h-7 rounded hover:bg-gray-100 disabled:opacity-30">↓</button>
                <button onClick={() => remove(c.id)} className="w-7 h-7 rounded hover:bg-red-50 hover:text-red-600">×</button>
              </div>
            </li>
          );
        })}
      </ol>

      <button onClick={add} className="w-full py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-deep-navy hover:text-deep-navy text-sm">
        + 챕터 추가
      </button>

      <div className="pt-2">
        <button
          onClick={onConfirm}
          disabled={busy || chapters.length === 0}
          className="px-5 py-2.5 rounded-xl bg-deep-navy text-white font-bold min-h-[44px] disabled:opacity-50"
        >
          {busy ? "처리 중..." : "이 목차로 본문 생성 →"}
        </button>
      </div>
    </div>
  );
}

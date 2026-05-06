// app/write/_components/ChapterList.tsx
// 책의 12 챕터 목록. 클릭하면 본문 영역에 해당 챕터 표시.
// + 챕터 추가 inline form 포함.

"use client";
import { useState } from "react";

interface ChapterMini {
  id?: string;
  title: string;
  subtitle?: string;
  hasContent?: boolean;
  charCount?: number;
}

interface Props {
  chapters: ChapterMini[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onAdd?: (title: string) => void | Promise<void>;
  onEditTitle?: (idx: number) => void;
  disabled?: boolean;
}

export function ChapterList({ chapters, activeIdx, onSelect, onAdd, onEditTitle, disabled }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submitAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !onAdd) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setNewTitle("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">
        챕터 ({chapters.length})
      </div>
      <ul className="flex flex-col gap-1">
        {chapters.map((c, i) => {
          const isActive = i === activeIdx;
          return (
            <li key={c.id ?? i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={disabled}
                className={`w-full text-left px-2.5 py-2 rounded-md transition disabled:opacity-50 ${
                  isActive
                    ? "bg-tiger-orange text-white font-bold"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : c.hasContent ? "bg-tiger-orange/15 text-tiger-orange" : "bg-gray-200 text-gray-500"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{c.title}</div>
                    {c.subtitle && (
                      <div className={`text-[10px] truncate mt-0.5 ${isActive ? "text-white/80" : "text-gray-500"}`}>
                        {c.subtitle}
                      </div>
                    )}
                  </div>
                  {onEditTitle && (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); onEditTitle(i); }}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? "hover:bg-white/20" : "hover:bg-gray-200"}`}
                      title="제목 편집"
                    >
                      ✏
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {onAdd && (
        <div className="mt-3">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={disabled}
              className="w-full py-2 border border-dashed border-gray-300 rounded-md text-xs text-gray-500 hover:border-tiger-orange hover:text-tiger-orange transition disabled:opacity-50"
            >
              + 챕터 추가
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="새 챕터 제목"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-tiger-orange focus:outline-none"
                disabled={busy}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewTitle(""); }}
                  disabled={busy}
                  className="flex-1 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={busy || newTitle.trim().length === 0}
                  className="flex-1 py-1.5 bg-tiger-orange text-white rounded text-xs font-bold hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

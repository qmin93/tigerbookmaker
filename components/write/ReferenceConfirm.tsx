// ReferenceConfirm — clean-redesign v3 (spec 3.6)
// 자료 업로드 직후 AI가 "이 자료의 핵심 5개" 요약 표시.
// 사용자 "맞아요" / "X 잘못 이해함, Y로 고침" 입력 → 책 본문이 자료에서 벗어나지 않도록 사전 보정.
//
// 사용처: /write/page.tsx 자료 업로드 단계 직후.
// API: POST /api/generate/reference-summary (응답에 사용자 확인 필드 추가 필요)

"use client";
import { useState } from "react";

export interface ReferenceConfirmPoint {
  id: string;
  text: string;       // AI가 추출한 핵심 1개
  userOverride?: string; // 사용자가 수정한 내용 (있으면 우선 적용)
}

interface ReferenceConfirmProps {
  points: ReferenceConfirmPoint[];
  onConfirm: (corrections: { id: string; correction: string | null }[]) => void;
  busy?: boolean;
}

export function ReferenceConfirm({ points, onConfirm, busy }: ReferenceConfirmProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const submit = () => {
    const corrections = points
      .map(p => ({ id: p.id, correction: drafts[p.id] ?? null }))
      .filter(c => c.correction !== null);
    onConfirm(corrections);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-deep-navy mb-2">
          ① AI가 자료를 이렇게 이해했어요
        </div>
        <h3 className="text-2xl font-black tracking-tight text-ink-900">맞으면 그대로, 아니면 고쳐주세요</h3>
        <p className="mt-2 text-sm text-gray-600">잘못된 이해는 본문에 그대로 들어갑니다. 한 번만 확인하면 책 끝까지 정확해집니다.</p>
      </div>

      <ul className="space-y-3">
        {points.map((p, i) => {
          const draft = drafts[p.id];
          const isEditing = editing === p.id;
          return (
            <li key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-deep-navy/10 text-deep-navy text-xs font-bold font-mono">
                  {i + 1}
                </span>
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    <textarea
                      defaultValue={draft ?? p.text}
                      onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-deep-navy/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-navy/40"
                    />
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md bg-deep-navy text-white font-bold">저장</button>
                      <button
                        onClick={() => {
                          setDrafts(d => { const n = { ...d }; delete n[p.id]; return n; });
                          setEditing(null);
                        }}
                        className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-600"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className={`text-sm ${draft ? "text-gray-400 line-through" : "text-ink-900"}`}>{p.text}</p>
                    {draft && <p className="mt-1 text-sm text-deep-navy font-medium">{draft}</p>}
                    <button onClick={() => setEditing(p.id)} className="mt-2 text-xs text-deep-navy hover:underline">
                      {draft ? "다시 수정" : "✏️ 고치기"}
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={submit}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-deep-navy text-white font-bold min-h-[44px] disabled:opacity-50"
        >
          {busy ? "확인 중..." : "확인하고 다음 단계로 →"}
        </button>
        <span className="text-xs text-gray-500">
          {Object.keys(drafts).length > 0
            ? `${Object.keys(drafts).length}개 수정함`
            : "수정 없이 그대로 진행"}
        </span>
      </div>
    </div>
  );
}

// BookEditor — clean-redesign v3 (spec 3.7)
// 책 상세페이지(/book/[id])의 AI 자동 생성 카피·이미지를 사용자가 직접 교체.
// 크몽·부크크 등록 시 그대로 복붙 가능한 결과물.

"use client";
import { useState } from "react";

export interface BookEditorFields {
  title: string;        // 책 제목 (변경 가능)
  hook: string;         // 한 줄 후킹 (크몽 제목 후보)
  description: string;  // 5~10줄 상세 설명
  targetAudience: string;
  tags: string;         // 쉼표 구분 키워드 8~12개
}

interface BookEditorProps {
  initial: BookEditorFields;
  onSave: (next: BookEditorFields) => Promise<void>;
}

export function BookEditor({ initial, onSave }: BookEditorProps) {
  const [fields, setFields] = useState<BookEditorFields>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const set = <K extends keyof BookEditorFields>(key: K, value: BookEditorFields[K]) => {
    setFields(f => ({ ...f, [key]: value }));
    setSavedAt(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(fields);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-600 mb-2">상세페이지 편집</div>
        <h3 className="text-2xl font-black tracking-tight text-ink-900">크몽 그대로 복붙용</h3>
        <p className="mt-2 text-sm text-gray-600">AI 자동 생성된 결과 위에 본인 톤으로 다듬으세요.</p>
      </div>

      <Field label="책 제목">
        <input
          value={fields.title}
          onChange={e => set("title", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
        />
      </Field>

      <Field label="한 줄 후킹 (크몽 제목 후보 · 30자 이내)">
        <input
          value={fields.hook}
          onChange={e => set("hook", e.target.value)}
          maxLength={30}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
        />
        <div className="text-xs font-mono text-gray-400 mt-1">{fields.hook.length}/30</div>
      </Field>

      <Field label="상세 설명 (크몽 본문)">
        <textarea
          value={fields.description}
          onChange={e => set("description", e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/40 leading-relaxed"
        />
      </Field>

      <Field label="타겟 독자">
        <input
          value={fields.targetAudience}
          onChange={e => set("targetAudience", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
        />
      </Field>

      <Field label="키워드 (쉼표 구분 · 8~12개 권장)">
        <input
          value={fields.tags}
          onChange={e => set("tags", e.target.value)}
          placeholder="예: 직장인, 부수익, 30대, 자기계발, 새벽기상, ..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
        />
        <div className="text-xs text-gray-400 mt-1">{fields.tags.split(",").map(s => s.trim()).filter(Boolean).length}개</div>
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold min-h-[44px] disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-600 font-mono">
            ✓ 저장됨
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

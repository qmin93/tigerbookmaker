// components/TemplateSelector.tsx
// /write 사이드바에 들어가는 4개 thumbnail 그리드. 클릭 시 PATCH /api/projects/[id] 호출.

"use client";
import { TEMPLATES, type TemplateKey } from "@/lib/templates";
import { useState } from "react";

interface Props {
  projectId: string;
  current: TemplateKey | null | undefined;
  onChange: (key: TemplateKey) => void;
  disabled?: boolean;
}

export function TemplateSelector({ projectId, current, onChange, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = current ?? "minimal";

  const handleSelect = async (key: TemplateKey) => {
    if (busy || disabled || key === active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `템플릿 변경 실패 (${res.status})`);
      }
      onChange(key);
    } catch (e: any) {
      setError(e?.message || "변경 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-2 pb-1">
      <div className="text-xs font-bold text-ink-900 mb-1.5">📐 레이아웃 템플릿</div>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(TEMPLATES) as TemplateKey[]).map(key => {
          const tpl = TEMPLATES[key];
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              disabled={busy || disabled}
              className={`relative text-left rounded-md border-2 p-1.5 transition disabled:opacity-50 ${selected ? "border-tiger-orange bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
              title={tpl.description}
            >
              <div
                className="aspect-[4/5] mb-1 rounded overflow-hidden"
                dangerouslySetInnerHTML={{ __html: tpl.thumbnailSvg }}
              />
              <div className="text-[10px] font-bold text-ink-900 leading-tight">{tpl.label}</div>
              {selected && <div className="absolute top-1 right-1 text-tiger-orange text-xs">✓</div>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

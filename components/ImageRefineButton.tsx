"use client";
import { useState } from "react";

interface Props {
  projectId: string;
  imageType: "cover" | "meta-feed" | "meta-story" | "meta-link" | "infographic" | "video-frame";
  currentPrompt?: string;
  onRefined: (newImageBase64: string, newPrompt: string) => void;
  onBalanceChange?: (newBalance: number) => void;
  aspectRatio?: string;
}

const SUGGESTIONS = ["더 어둡게", "사람 빼고", "책상 더 강조", "글자 공간 더", "색 더 따뜻하게"];

export function ImageRefineButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refine = async () => {
    if (feedback.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/image-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: props.projectId,
          imageType: props.imageType,
          currentPrompt: props.currentPrompt,
          feedback: feedback.trim(),
          aspectRatio: props.aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `재생성 실패 (${res.status})`);
      props.onRefined(data.newImageBase64, data.newPrompt);
      if (props.onBalanceChange && typeof data.newBalance === "number") {
        props.onBalanceChange(data.newBalance);
      }
      setFeedback("");
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "재생성 실패");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] text-purple-600 hover:underline whitespace-nowrap"
        title="자연어 피드백으로 이미지 재생성 (~₩40)"
      >
        ✏️ 다시
      </button>
    );
  }

  return (
    <div className="absolute inset-0 bg-white/95 p-3 rounded-lg z-10 flex flex-col gap-2 shadow-lg border border-purple-300">
      <div className="text-[11px] font-bold text-purple-700">✏️ 이미지 재생성 (~₩40)</div>
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="예: 더 어둡게 / 사람 빼고 / 책상 더 강조"
        className="text-xs p-2 border border-gray-300 rounded resize-none w-full"
        rows={2}
        maxLength={500}
        autoFocus
      />
      <div className="flex flex-wrap gap-1">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFeedback(s)}
            className="text-[10px] px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
            type="button"
          >
            {s}
          </button>
        ))}
      </div>
      {error && <div className="text-[10px] text-red-600 leading-snug">{error}</div>}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={refine}
          disabled={busy || feedback.trim().length < 3}
          className="flex-1 px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold disabled:opacity-50 hover:bg-purple-600"
        >
          {busy ? "⏳ 재생성중..." : "🔄 재생성"}
        </button>
        <button
          onClick={() => { setOpen(false); setFeedback(""); setError(null); }}
          disabled={busy}
          className="px-2 py-1.5 text-gray-500 text-xs hover:text-gray-700"
        >
          취소
        </button>
      </div>
    </div>
  );
}

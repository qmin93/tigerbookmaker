"use client";

interface TocStepProps {
  projectId: string;
  onAdvance: () => void;
}

/**
 * v3 Phase 1.1 placeholder.
 * 실제 목차 편집은 /write 페이지(TocEditor)에서 진행. 여기는 사용자가 다음 단계로 넘어가게만 한다.
 * (Phase 1.2~ 에서 실제 목차 편집 UI를 이 substep으로 옮길 예정)
 */
export function TocStep({ projectId, onAdvance }: TocStepProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">4단계 · 목차</h2>
        <p className="text-xs text-gray-500 mt-1">
          목차 편집은 다음 화면(/write)에서 본문 생성 전 진행됩니다. 여기서 바로 이동하세요.
        </p>
      </div>

      <div className="p-6 bg-orange-50/30 border border-tiger-orange/30 rounded-xl text-center space-y-3">
        <div className="text-3xl">📑</div>
        <p className="text-sm text-ink-900 font-bold">목차 편집 준비 완료</p>
        <p className="text-xs text-gray-500">
          TOC editing in /write — 다음 화면에서 AI가 만든 목차를 직접 수정·확인할 수 있습니다.
        </p>
        <p className="text-[10px] text-gray-400">project: {projectId}</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onAdvance}
          className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition"
        >
          TOC editing in /write — Continue →
        </button>
      </div>
    </section>
  );
}

// BenchmarkTone — clean-redesign v3 (spec 3.6)
// 사용자가 좋아하는 책 한 단락(또는 블로그 글)을 붙여넣음 → AI가 톤 분석 → 본문 생성 시 같은 톤.
// 6 preset 톤 외 옵션.
//
// 사용처: /write/page.tsx 톤 선택 단계.
// API: POST /api/generate/tone-recommend (벤치마킹 모드 확장)

"use client";
import { useState } from "react";

interface BenchmarkToneProps {
  onAnalyze: (sample: string) => Promise<{ toneSummary: string; styleNotes: string[] }>;
  onApply: (toneSummary: string) => void;
}

export function BenchmarkTone({ onAnalyze, onApply }: BenchmarkToneProps) {
  const [sample, setSample] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<{ toneSummary: string; styleNotes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await onAnalyze(sample);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setBusy(false);
    }
  };

  const sampleTooShort = sample.trim().length < 50;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-deep-navy mb-2">
          ③ 좋아하는 책의 톤으로 쓰기
        </div>
        <h3 className="text-2xl font-black tracking-tight text-ink-900">한 단락만 붙여넣으세요</h3>
        <p className="mt-2 text-sm text-gray-600">AI가 그 톤·말투를 분석해서 본문 전체에 적용합니다. 책 한 권이 똑같은 느낌으로 나옵니다.</p>
      </div>

      <textarea
        value={sample}
        onChange={e => setSample(e.target.value)}
        placeholder="예: 무라카미 하루키 책 한 단락 / 블로그 글 한 문단 / 직접 쓴 글 한 단락..."
        rows={6}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-deep-navy/40"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-gray-500">{sample.length}자 · 최소 50자</span>
        {sampleTooShort && sample.length > 0 && <span className="text-orange-600">조금 더 붙여넣어주세요</span>}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>}

      {!analysis ? (
        <button
          onClick={analyze}
          disabled={busy || sampleTooShort}
          className="px-5 py-2.5 rounded-xl bg-deep-navy text-white font-bold min-h-[44px] disabled:opacity-50"
        >
          {busy ? "분석 중..." : "이 톤 분석하기"}
        </button>
      ) : (
        <div className="rounded-2xl border border-deep-navy/30 bg-deep-navy/5 p-4 space-y-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-deep-navy mb-1">분석 결과</div>
            <p className="text-sm text-ink-900 font-medium">{analysis.toneSummary}</p>
          </div>
          {analysis.styleNotes.length > 0 && (
            <ul className="space-y-1 text-xs text-gray-600">
              {analysis.styleNotes.map((note, i) => (
                <li key={i} className="flex gap-2"><span className="text-deep-navy">•</span><span>{note}</span></li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onApply(analysis.toneSummary)}
              className="px-4 py-2 rounded-lg bg-deep-navy text-white text-sm font-bold"
            >
              이 톤으로 본문 쓰기
            </button>
            <button
              onClick={() => { setAnalysis(null); }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600"
            >
              다시 분석
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

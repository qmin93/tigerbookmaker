"use client";

import { useState } from "react";
import { THEME_COLOR_PRESETS } from "@/lib/theme-colors";
import type { ThemeColorKey, ToneSetting } from "@/lib/storage";

interface StyleStepProps {
  projectId: string;
  themeColor: ThemeColorKey;
  toneSetting: ToneSetting | null;
  onThemeColorChange: (k: ThemeColorKey) => void;
  onToneSettingChange: (t: ToneSetting | null) => void;
  onBalanceChange: (b: number) => void;
  onError: (msg: string | null) => void;
  onAdvance: () => void;
}

export function StyleStep({
  projectId,
  themeColor,
  toneSetting,
  onThemeColorChange,
  onToneSettingChange,
  onBalanceChange,
  onError,
  onAdvance,
}: StyleStepProps) {
  const [toneMode, setToneMode] = useState<"auto" | "preset" | "reference-book">("auto");
  const [toneExcerpt, setToneExcerpt] = useState("");
  const [toneBusy, setToneBusy] = useState(false);

  const updateThemeColor = async (next: ThemeColorKey) => {
    onThemeColorChange(next);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeColor: next }),
      });
      if (!res.ok) throw new Error("색상 변경 실패");
    } catch (e: any) {
      onError(e.message);
    }
  };

  const requestTone = async (opts: { mode: string; preset?: string; excerpt?: string }) => {
    if (!projectId) return;
    setToneBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/generate/tone-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...opts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `톤 분석 실패 (${res.status})`);
      onToneSettingChange(data.toneSetting);
      if (typeof data.newBalance === "number") onBalanceChange(data.newBalance);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setToneBusy(false);
    }
  };

  const canAdvance = !!toneSetting;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">3단계 · 톤·색상</h2>
        <p className="text-xs text-gray-500 mt-1">
          책의 말투와 색상 테마를 선택하세요. 두 가지 모두 본문 생성·표지·상세 페이지에 반영됩니다.
        </p>
      </div>

      {/* 색상 테마 */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-ink-900">🎨 색상</h3>
          <span className="text-[10px] text-gray-500">언제든 변경 가능</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(THEME_COLOR_PRESETS) as ThemeColorKey[]).map(key => {
            const t = THEME_COLOR_PRESETS[key];
            const selected = themeColor === key;
            return (
              <button
                key={key}
                onClick={() => updateThemeColor(key)}
                className={`w-8 h-8 rounded-full border-2 transition ${
                  selected ? "border-ink-900 ring-2 ring-offset-1" : "border-gray-300 hover:border-gray-500"
                }`}
                style={{ backgroundColor: t.hex }}
                title={t.label}
                aria-label={t.label}
              />
            );
          })}
        </div>
      </div>

      {/* 톤·말투 설정 */}
      <div className="p-5 bg-purple-50/50 border border-purple-300 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-ink-900">🎙️ 톤·말투 설정</h3>
          {toneSetting && (
            <button onClick={() => onToneSettingChange(null)} className="text-[10px] text-gray-400 hover:text-red-600">
              다시 설정
            </button>
          )}
        </div>

        {!toneSetting && (
          <>
            <p className="text-xs text-gray-600 mb-3">선택한 톤이 모든 챕터 본문에 일관되게 적용됩니다.</p>
            <div className="flex gap-2 mb-3">
              {(["auto", "preset", "reference-book"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setToneMode(m)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded font-bold ${
                    toneMode === m ? "bg-purple-500 text-white" : "bg-white border border-purple-300 text-purple-700"
                  }`}
                >
                  {m === "auto" ? "🪄 자동 추천 (₩200)" : m === "preset" ? "📋 6개 중 선택 (무료)" : "📖 좋아하는 책 (₩200)"}
                </button>
              ))}
            </div>

            {toneMode === "auto" && (
              <button
                onClick={() => requestTone({ mode: "auto" })}
                disabled={toneBusy}
                className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50 text-sm"
              >
                {toneBusy ? "⏳ 분석 중..." : "🪄 AI 자동 추천"}
              </button>
            )}

            {toneMode === "preset" && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["friendly", "💬 친근체"],
                  ["professional", "🎓 전문체"],
                  ["storytelling", "📚 스토리텔링"],
                  ["lecture", "🎤 강의체"],
                  ["essay", "✍️ 에세이체"],
                  ["self-help", "🚀 자기계발체"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => requestTone({ mode: "preset", preset: key })}
                    disabled={toneBusy}
                    className="text-left p-2 bg-white border border-purple-200 rounded-lg hover:border-purple-500 disabled:opacity-50"
                  >
                    <div className="text-xs font-bold text-purple-900">{label}</div>
                  </button>
                ))}
              </div>
            )}

            {toneMode === "reference-book" && (
              <div>
                <textarea
                  value={toneExcerpt}
                  onChange={e => setToneExcerpt(e.target.value)}
                  placeholder="좋아하는 책 발췌 1~3문단 (100자 이상)"
                  rows={5}
                  className="w-full text-xs px-3 py-2 border border-purple-300 rounded mb-2 focus:border-purple-500 focus:outline-none resize-y"
                />
                <button
                  onClick={() => requestTone({ mode: "reference-book", excerpt: toneExcerpt })}
                  disabled={toneBusy || toneExcerpt.trim().length < 100}
                  className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50 text-sm"
                >
                  {toneBusy ? "⏳ 분석 중..." : `📖 분석 (${toneExcerpt.trim().length}자)`}
                </button>
              </div>
            )}
          </>
        )}

        {toneSetting && (
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs font-bold text-ink-900 mb-2">현재 톤 ({toneSetting.mode})</div>
            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{toneSetting.finalTone}</div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onAdvance}
          disabled={!canAdvance}
          className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50"
          title={!canAdvance ? "톤을 먼저 결정하세요" : undefined}
        >
          다음 단계 →
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { THEME_COLOR_PRESETS } from "@/lib/theme-colors";
import type { ThemeColorKey, ToneSetting } from "@/lib/storage";
import type { LayoutKey } from "@/lib/cover-style-map";
import { genreFromBookType } from "@/lib/genre-from-book-type";
import { getTemplate } from "@/lib/cover-templates";
import { CoverRecommendation } from "@/components/write/CoverRecommendation";
import { CoverStyleGallery } from "@/components/write/CoverStyleGallery";
import { useAutoSave } from "@/lib/auto-save";

interface StyleStepProps {
  projectId: string;
  bookType: string;
  themeColor: ThemeColorKey;
  toneSetting: ToneSetting | null;
  coverLayoutKey: LayoutKey | null;
  onThemeColorChange: (k: ThemeColorKey) => void;
  onToneSettingChange: (t: ToneSetting | null) => void;
  onCoverLayoutChange: (key: LayoutKey | null) => void;
  onBalanceChange: (b: number) => void;
  onError: (msg: string | null) => void;
  onAdvance: () => void;
  /** v3 Phase 1.2: 부모에 자동 저장 상태 보고 (indicator UI용) */
  onAutoSaveState?: (s: { isSyncing: boolean; lastSyncedAt: number | null; error: Error | null }) => void;
  /** 초기 toneExcerpt (localStorage 복원 시 부모가 주입) */
  initialToneExcerpt?: string;
}

export function StyleStep({
  projectId,
  bookType,
  themeColor,
  toneSetting,
  coverLayoutKey,
  onThemeColorChange,
  onToneSettingChange,
  onCoverLayoutChange,
  onBalanceChange,
  onError,
  onAdvance,
  onAutoSaveState,
  initialToneExcerpt,
}: StyleStepProps) {
  const [toneMode, setToneMode] = useState<"auto" | "preset" | "reference-book">("auto");
  const [toneExcerpt, setToneExcerpt] = useState(initialToneExcerpt ?? "");
  const [toneBusy, setToneBusy] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);

  // v3 Phase 1.2 — toneExcerpt draft + style 설정 자동 저장
  // toneSetting/themeColor/coverLayoutKey 자체는 각 API가 즉시 저장하므로 여기는 sanity sync.
  // toneExcerpt 는 draft (DB에 저장 안 함, localStorage 만)
  const autoSaveData = useMemo(
    () => ({
      styleDraft: {
        toneExcerpt,
        toneMode,
      },
      // DB sync 용 (변경되지 않으면 onSync 안 불림)
      themeColor,
      toneSetting,
      coverLayoutKey,
    }),
    [toneExcerpt, toneMode, themeColor, toneSetting, coverLayoutKey],
  );

  const autoSave = useAutoSave({
    key: `tbm-autosave-project-${projectId}-style`,
    data: autoSaveData,
    onSync: async d => {
      // draft 필드는 DB에 안 보냄 — localStorage 전용. DB는 캐노니컬 값만.
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) throw new Error(`프로젝트 로드 실패 (${projRes.status})`);
      const project = await projRes.json();
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...project,
            themeColor: d.themeColor,
            toneSetting: d.toneSetting,
            coverLayoutKey: d.coverLayoutKey,
          },
        }),
      });
      if (!res.ok) throw new Error(`자동 저장 실패 (${res.status})`);
    },
  });

  const lastReportedRef = useRef<string>("");
  useEffect(() => {
    if (!onAutoSaveState) return;
    const sig = `${autoSave.isSyncing}|${autoSave.lastSyncedAt}|${autoSave.error?.message ?? ""}`;
    if (sig === lastReportedRef.current) return;
    lastReportedRef.current = sig;
    onAutoSaveState({ isSyncing: autoSave.isSyncing, lastSyncedAt: autoSave.lastSyncedAt, error: autoSave.error });
  }, [autoSave.isSyncing, autoSave.lastSyncedAt, autoSave.error, onAutoSaveState]);

  const currentGenre = useMemo(() => genreFromBookType(bookType), [bookType]);
  const selectedTemplate = coverLayoutKey ? getTemplate(coverLayoutKey) : undefined;

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

  const updateCoverLayoutKey = async (next: LayoutKey) => {
    // 낙관적 업데이트 — UI 즉시 반영
    onCoverLayoutChange(next);
    setCoverSaving(true);
    onError(null);
    try {
      // 기존 project.data 머지를 위해 GET → PUT (InterviewStep 과 같은 패턴)
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) throw new Error(`프로젝트 로드 실패 (${projRes.status})`);
      const project = await projRes.json();
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...project, coverLayoutKey: next } }),
      });
      if (!res.ok) throw new Error(`표지 톤 저장 실패 (${res.status})`);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setCoverSaving(false);
    }
  };

  const canAdvance = !!toneSetting && !!coverLayoutKey;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">3단계 · 톤·색상</h2>
        <p className="text-xs text-gray-500 mt-1">
          책의 말투와 색상 테마를 선택하세요. 두 가지 모두 본문 생성·표지·상세 페이지에 반영됩니다.
        </p>
      </div>

      {/* 색상 테마 */}
      <div data-micro-step="0" data-micro-label="색상 선택" className="p-4 bg-white border border-gray-200 rounded-xl">
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
      <div data-micro-step="1" data-micro-label="톤·말투" className="p-5 bg-purple-50/50 border border-purple-300 rounded-xl">
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

      {/* 표지 톤 선택 (Spec PR #3) */}
      <div data-micro-step="2" data-micro-label="표지 레이아웃" className="p-5 bg-orange-50/40 border border-tiger-orange/30 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-ink-900">🖼️ 표지 톤 선택</h3>
          {coverLayoutKey && (
            <button
              onClick={() => onCoverLayoutChange(null)}
              className="text-[10px] text-gray-400 hover:text-red-600"
            >
              다시 선택
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600 mb-3">
          표지 레이아웃을 선택하세요. 책 장르에 맞는 3가지 톤을 자동 추천합니다.
        </p>

        {!coverLayoutKey && (
          <CoverRecommendation
            genre={currentGenre}
            selectedKey={coverLayoutKey}
            onSelect={k => updateCoverLayoutKey(k)}
            onOpenGallery={() => setGalleryOpen(true)}
          />
        )}

        {coverLayoutKey && (
          <div className="bg-white rounded-lg p-3 border border-tiger-orange/20">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-bold text-ink-900">
                현재 표지 톤: {selectedTemplate?.label ?? coverLayoutKey}
                {coverSaving && <span className="ml-2 text-[10px] text-gray-400">저장 중…</span>}
              </div>
              <button
                onClick={() => setGalleryOpen(true)}
                className="text-[11px] font-bold text-tiger-orange hover:text-orange-700 underline underline-offset-2 whitespace-nowrap"
              >
                다른 스타일 보기 →
              </button>
            </div>
            {selectedTemplate ? (
              <p className="text-[11px] text-gray-600 leading-snug">
                {selectedTemplate.description}
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 italic">
                이 LayoutKey 는 v1.5 에서 추가될 예정입니다 — 다른 스타일을 골라 주세요.
              </p>
            )}
          </div>
        )}
      </div>

      <CoverStyleGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={k => updateCoverLayoutKey(k)}
        selectedKey={coverLayoutKey}
        currentGenre={currentGenre}
      />

      <div className="flex justify-end">
        <button
          onClick={onAdvance}
          disabled={!canAdvance}
          className="px-6 py-2.5 bg-tiger-orange text-white rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-50"
          title={
            !canAdvance
              ? !toneSetting
                ? "톤을 먼저 결정하세요"
                : "표지 톤을 선택하세요"
              : undefined
          }
        >
          다음 단계 →
        </button>
      </div>
    </section>
  );
}

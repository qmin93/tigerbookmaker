"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { THEME_COLOR_PRESETS } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

interface TierInfo {
  id: "basic" | "pro" | "premium";
  emoji: string;
  name: string;
  price: number;
  blurb: string;
  audience: string;
  available: boolean;
  reason?: string;
}

export default function NewProjectPage() {
  const r = useRouter();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [type, setType] = useState<"자기계발서" | "실용서" | "에세이" | "매뉴얼" | "재테크" | "웹소설" | "전문서">("실용서");
  const [targetPages, setTargetPages] = useState(120);
  const [tier, setTier] = useState<"basic" | "pro" | "premium">("pro");
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<{ topic: string; audience: string; type: string }[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [noImages, setNoImages] = useState(false);
  const [themeColor, setThemeColor] = useState<ThemeColorKey>("orange");

  const fetchSuggestions = async () => {
    if (!keyword.trim()) return;
    setSuggestBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/topic-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `추천 실패 (${res.status})`);
      setSuggestions(data.suggestions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSuggestBusy(false);
    }
  };

  useEffect(() => {
    fetch("/api/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.availableTiers) setTiers(d.availableTiers);
    });
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, type, targetPages, tier, noImages, themeColor }),
      });
      if (res.status === 401) { r.push("/login?redirect=/new"); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || `생성 실패 (${res.status})`);
      }
      const { id } = await res.json();
      r.push(`/write/setup?id=${id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa]">
    <Header />
    <div className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/projects" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 책 목록</Link>
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">새 프로젝트</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">새 책 시작.</h1>
      <p className="text-gray-600 mb-10">기본 정보를 입력하면 AI가 목차를 제안합니다.</p>

      {/* AI 주제 추천 — 키워드 → 5개 구체적 주제 카드 */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-tiger-orange/30 p-5 md:p-6 rounded-2xl mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange font-bold">✨ AI 주제 추천</p>
            <p className="text-xs text-gray-600 mt-0.5">막막하면 키워드만 입력 → 구체적 주제 5개 즉시 받기</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !suggestBusy) fetchSuggestions(); }}
            placeholder="예: 재테크, 다이어트, 부업, 글쓰기..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none bg-white"
          />
          <button
            onClick={fetchSuggestions}
            disabled={!keyword.trim() || suggestBusy}
            className="px-4 py-2 bg-tiger-orange text-white rounded-lg font-bold text-sm hover:bg-orange-600 transition disabled:opacity-50 whitespace-nowrap"
          >
            {suggestBusy ? "추천 중..." : "추천받기"}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setTopic(s.topic);
                  setAudience(s.audience);
                  if (["자기계발서", "실용서", "에세이", "매뉴얼", "재테크", "웹소설", "전문서"].includes(s.type)) {
                    setType(s.type as any);
                  }
                  setSuggestions([]);
                }}
                className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-tiger-orange hover:shadow-sm transition group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mt-0.5">{s.type}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink-900 group-hover:text-tiger-orange transition leading-snug">{s.topic}</div>
                    <div className="text-xs text-gray-500 mt-1">독자: {s.audience}</div>
                  </div>
                  <span className="text-tiger-orange text-xs font-bold opacity-0 group-hover:opacity-100 transition">→ 적용</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5 bg-white p-6 md:p-8 rounded-2xl border border-gray-200">
        {/* 티어 선택 UI는 베타 기간 중 숨김. default "pro"로 자동 — 필요해지면 부활.
            tiers fetch 코드는 살려뒀음 (TIER_AVAILABILITY 데이터 기록용). */}
        <Field label="주제 (한 줄)">
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            rows={2}
            placeholder="예: 직장인을 위한 Claude Code 입문 — 첫 자동화 봇 30분에 만들기"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none"
          />
        </Field>
        <Field label="대상 독자">
          <input
            value={audience}
            onChange={e => setAudience(e.target.value)}
            placeholder="예: 개발 경험이 없는 직장인"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none"
          />
        </Field>
        <Field label="책 유형">
          <div className="flex gap-2 flex-wrap">
            {(["자기계발서", "실용서", "에세이", "매뉴얼", "재테크", "웹소설", "전문서"] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                  type === t ? "bg-ink-900 text-white border-ink-900" : "bg-white border-gray-300 text-ink-900 hover:border-ink-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`목표 분량: ${targetPages}쪽`}>
          <input
            type="range"
            min={20}
            max={200}
            step={10}
            value={targetPages}
            onChange={e => setTargetPages(Number(e.target.value))}
            className="w-full accent-tiger-orange"
          />
          <p className="text-xs text-gray-500 mt-1">크몽 규격: 최소 20쪽 / 권장 100~200쪽</p>
        </Field>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-600 mb-2">테마 색상</label>
          <div className="grid grid-cols-6 gap-2">
            {(Object.keys(THEME_COLOR_PRESETS) as ThemeColorKey[]).map(key => {
              const t = THEME_COLOR_PRESETS[key];
              const selected = themeColor === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemeColor(key)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition ${selected ? `border-ink-900 ring-2 ${t.ring}` : 'border-gray-200 hover:border-gray-400'}`}
                  title={t.label}
                >
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: t.hex }}></div>
                  <span className="text-[10px] text-gray-700">{t.label.replace(/^[^\s]+\s/, '')}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition">
          <input
            type="checkbox"
            checked={noImages}
            onChange={e => setNoImages(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-tiger-orange"
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-ink-900">📝 텍스트만 (이미지 없는 책)</div>
            <div className="text-xs text-gray-500 mt-0.5">본문에 [IMAGE: ...] 안 만들고 텍스트만 깔끔하게. 에세이·소설·전문서 추천. 표지는 별도로 만들 수 있음.</div>
          </div>
        </label>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={create}
          disabled={!topic || !audience || busy}
          className="w-full bg-tiger-orange text-white py-3.5 rounded-xl font-bold shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? "생성 중..." : "프로젝트 생성 → 집필 시작 →"}
        </button>
      </div>
    </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">{label}</label>
      {children}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";

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
  const [type, setType] = useState<"자기계발서" | "실용서" | "에세이" | "매뉴얼">("실용서");
  const [targetPages, setTargetPages] = useState(120);
  const [tier, setTier] = useState<"basic" | "pro" | "premium">("pro");
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ topic, audience, type, targetPages, tier }),
      });
      if (res.status === 401) { r.push("/login?redirect=/new"); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || `생성 실패 (${res.status})`);
      }
      const { id } = await res.json();
      r.push(`/write?id=${id}`);
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

      <div className="space-y-5 bg-white p-6 md:p-8 rounded-2xl border border-gray-200">
        <Field label="티어 선택">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tiers.length === 0 && <div className="text-xs text-gray-400 col-span-3">티어 정보 로딩 중...</div>}
            {tiers.map(t => (
              <button
                key={t.id}
                type="button"
                disabled={!t.available}
                onClick={() => setTier(t.id)}
                className={`p-4 rounded-xl border-2 text-left transition ${
                  tier === t.id && t.available
                    ? "border-tiger-orange bg-orange-50"
                    : t.available
                    ? "border-gray-200 bg-white hover:border-gray-400"
                    : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="text-base font-bold">{t.emoji} {t.name}</div>
                <div className="font-mono text-tiger-orange font-bold mt-1 text-sm">₩{t.price.toLocaleString()}/권</div>
                <div className="text-xs text-gray-600 mt-2 leading-snug">{t.blurb}</div>
                <div className="text-[10px] text-gray-500 mt-1 leading-tight">{t.audience}</div>
                {!t.available && (
                  <div className="text-[10px] font-mono text-gray-400 mt-2 uppercase tracking-wider">{t.reason}</div>
                )}
              </button>
            ))}
          </div>
        </Field>
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
            {(["자기계발서", "실용서", "에세이", "매뉴얼"] as const).map(t => (
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

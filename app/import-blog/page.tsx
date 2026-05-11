// /import-blog — 블로그 글 묶음을 책으로 변환
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/Header";

interface SourceRow {
  id: number;
  type: "url" | "text";
  value: string;
}

let _id = 0;
function makeRow(type: "url" | "text" = "url"): SourceRow {
  return { id: ++_id, type, value: "" };
}

export default function ImportBlogPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [type, setType] = useState("실용서");
  const [targetPages, setTargetPages] = useState(120);
  const [sources, setSources] = useState<SourceRow[]>([makeRow(), makeRow(), makeRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validSources = sources.filter(s => s.value.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, audience, type, targetPages,
          sources: validSources.map(s => ({ type: s.type, value: s.value.trim() })),
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족 (₩${data.shortfall ?? 500} 더 필요). 충전 페이지로?`)) router.push("/billing");
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `import 실패 (${res.status})`);
      router.push(`/write?id=${data.projectId}`);
    } catch (e: any) {
      if (e.message !== "잔액 부족") setError(e.message);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link href="/projects" className="inline-block py-2 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">
          ← 내 책 목록
        </Link>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">블로그 → 책</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">글 모음 → 1권.</h1>
        <p className="text-gray-600 mb-10">본인 블로그 글 3~50개를 12챕터로 자동 그룹핑. AI가 학습 흐름에 맞게 재구성합니다. ~₩500</p>

        {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-5 mb-6">
          <Field label="주제 (한 줄)">
            <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={2}
              placeholder="예: 30대 직장인의 30분 운동 습관"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none" />
          </Field>
          <Field label="대상 독자">
            <input value={audience} onChange={e => setAudience(e.target.value)}
              placeholder="예: 운동 안 해본 30대 직장인"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none" />
          </Field>
          <Field label="책 유형">
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white">
              {["자기계발서","실용서","에세이","매뉴얼","재테크","웹소설","전문서","요리책","여행기","매거진","인터뷰집","포트폴리오","강의노트","동화"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label={`목표 분량: ${targetPages}쪽`}>
            <input type="range" min={20} max={200} step={10} value={targetPages}
              onChange={e => setTargetPages(Number(e.target.value))}
              className="w-full accent-tiger-orange" />
          </Field>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-ink-900">📝 블로그 글 (3~50개)</h2>
            <span className="text-xs font-mono text-gray-500">{validSources.length}개 입력됨</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">각 글의 URL 또는 본문 텍스트를 붙여넣으세요. URL이면 자동으로 본문 추출.</p>

          <div className="space-y-2">
            {sources.map((s, i) => (
              <div key={s.id} className="flex gap-2">
                <select value={s.type}
                  onChange={e => setSources(rows => rows.map(r => r.id === s.id ? { ...r, type: e.target.value as any } : r))}
                  className="px-2 py-2 border border-gray-300 rounded text-xs bg-white">
                  <option value="url">URL</option>
                  <option value="text">텍스트</option>
                </select>
                {s.type === "url" ? (
                  <input value={s.value}
                    onChange={e => setSources(rows => rows.map(r => r.id === s.id ? { ...r, value: e.target.value } : r))}
                    placeholder={`글 ${i + 1} URL (예: https://yourblog.com/post-1)`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:border-tiger-orange focus:outline-none" />
                ) : (
                  <textarea value={s.value}
                    onChange={e => setSources(rows => rows.map(r => r.id === s.id ? { ...r, value: e.target.value } : r))}
                    rows={3}
                    placeholder={`글 ${i + 1} 본문 (100자 이상)`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm resize-none focus:border-tiger-orange focus:outline-none" />
                )}
                <button onClick={() => setSources(rows => rows.filter(r => r.id !== s.id))}
                  className="px-2 py-2 text-xs text-gray-400 hover:text-red-600" title="삭제">✕</button>
              </div>
            ))}
          </div>

          <button onClick={() => setSources(rows => [...rows, makeRow()])}
            disabled={sources.length >= 50}
            className="mt-3 text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-tiger-orange hover:text-tiger-orange transition disabled:opacity-50">
            + 글 추가
          </button>
        </div>

        <button onClick={submit}
          disabled={busy || !topic || !audience || validSources.length < 3}
          className="mt-6 w-full py-4 bg-tiger-orange text-white font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 disabled:opacity-50 transition text-base">
          {busy ? "변환 중... (1~2분)" : `📦 책으로 변환 (~₩500)`}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-gray-600 mb-2">{label}</label>
      {children}
    </div>
  );
}

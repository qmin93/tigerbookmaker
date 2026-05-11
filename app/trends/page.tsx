// /trends — Tigerbookmaker 내부 트렌드 (다음 책 주제 결정용)
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";

interface TrendsData {
  totalBooks: number;
  topKeywords: { word: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
  colorDistribution: { color: string; count: number }[];
  generatedAt: string;
}

const COLOR_HEX: Record<string, string> = {
  orange: "#f97316", blue: "#3b82f6", green: "#10b981",
  purple: "#a855f7", red: "#ef4444", gray: "#6b7280",
};

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trends")
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d);
        else setError(d.message || "트렌드 로드 실패");
      })
      .catch(e => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <Link href="/projects" className="inline-block py-2 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">
          ← 내 책
        </Link>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">트렌드 인사이트</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">지금 잘 되는 주제.</h1>
        <p className="text-gray-600 mb-10">최근 30일 Tigerbookmaker로 만들어진 책들의 키워드·유형 분포. 다음 책 주제 결정에 참고하세요.</p>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-6">{error}</div>}
        {!data && !error && <p className="text-gray-400">로딩 중...</p>}

        {data && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <div className="text-xs text-gray-500 mb-2">최근 30일</div>
              <div className="text-3xl font-black text-ink-900">{data.totalBooks.toLocaleString()}권</div>
              <div className="text-sm text-gray-600 mt-1">출간된 (공개) 책 합계</div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* 인기 키워드 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-bold text-lg text-ink-900 mb-4">🔥 인기 키워드 TOP 20</h2>
                {data.topKeywords.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">아직 데이터가 충분하지 않아요.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.topKeywords.map((k, i) => {
                      const max = data.topKeywords[0].count;
                      const intensity = Math.max(0.4, k.count / max);
                      return (
                        <span
                          key={k.word}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border"
                          style={{
                            background: `rgba(249,115,22,${intensity * 0.15})`,
                            borderColor: `rgba(249,115,22,${intensity * 0.4})`,
                            color: i < 5 ? "#9a3412" : "#525252",
                            fontSize: i < 5 ? "16px" : "14px",
                          }}
                        >
                          {k.word}
                          <span className="text-xs opacity-60 font-mono">{k.count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 책 유형 분포 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-bold text-lg text-ink-900 mb-4">📚 책 유형 분포</h2>
                {data.typeDistribution.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">데이터 없음</p>
                ) : (
                  <div className="space-y-2">
                    {data.typeDistribution.slice(0, 10).map(t => {
                      const max = data.typeDistribution[0].count;
                      const pct = (t.count / max) * 100;
                      return (
                        <div key={t.type}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="font-medium">{t.type}</span>
                            <span className="font-mono text-gray-500">{t.count}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-tiger-orange transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 컬러 트렌드 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <h2 className="font-bold text-lg text-ink-900 mb-4">🎨 인기 테마 컬러</h2>
              <div className="flex gap-3 flex-wrap">
                {data.colorDistribution.map(c => (
                  <div key={c.color} className="text-center">
                    <div
                      className="w-14 h-14 rounded-xl shadow-sm mb-1"
                      style={{ background: COLOR_HEX[c.color] ?? "#ccc" }}
                    />
                    <div className="text-[11px] text-gray-600">{c.color}</div>
                    <div className="text-[10px] font-mono text-gray-400">{c.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-8">
              데이터 갱신: {new Date(data.generatedAt).toLocaleString("ko-KR")} · Tigerbookmaker 내부 데이터 (외부 마켓 X)
            </p>
          </>
        )}
      </div>
    </main>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";

interface AIUsage {
  id: string; task: string; model: string;
  input_tokens: number; output_tokens: number; thoughts_tokens: number;
  cost_krw: number; duration_ms: number | null;
  project_id: string | null; chapter_idx: number | null;
  status: string; created_at: string;
}
interface Tx {
  id: string; type: string; amount_krw: number; balance_after: number;
  reason: string | null; created_at: string;
}
interface Stat { model: string; task: string; calls: number; sumKrw: number; avgKrw: number; }

const TASK_LABEL: Record<string, string> = { toc: "목차", chapter: "챕터", edit: "수정", batch: "일괄", summary: "요약" };
const TX_LABEL: Record<string, string> = { charge: "충전", spend: "사용", refund: "환불", bonus: "보너스", manual_adjust: "수동조정" };

export default function UsagePage() {
  const [data, setData] = useState<{
    user?: { balance_krw: number; total_charged: number; total_spent: number };
    aiUsage?: AIUsage[];
    transactions?: Tx[];
    stats?: Stat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then(async r => {
        if (r.status === 401) { setUnauthorized(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (unauthorized) return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-600 mb-4">로그인이 필요합니다.</p>
        <Link href="/login" className="px-6 py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange transition">로그인</Link>
      </div>
    </main>
  );

  if (loading || !data) return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-gray-500">로딩 중...</div>
    </main>
  );

  const u = data.user!;
  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <Link href="/projects" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 책</Link>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">사용 내역</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-10">소비 데이터.</h1>

        {/* 잔액 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Card label="현재 잔액" value={`₩${u.balance_krw.toLocaleString()}`} accent />
          <Card label="누적 충전" value={`₩${u.total_charged.toLocaleString()}`} />
          <Card label="누적 사용" value={`₩${u.total_spent.toLocaleString()}`} />
        </div>

        {/* 모델·작업별 통계 */}
        {data.stats && data.stats.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold tracking-tight text-ink-900 mb-3">모델별 사용 통계</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">모델</th>
                    <th className="text-left px-4 py-2">작업</th>
                    <th className="text-right px-4 py-2">호출 수</th>
                    <th className="text-right px-4 py-2">평균</th>
                    <th className="text-right px-4 py-2">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.map((s, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-4 py-2 font-mono text-xs">{s.model}</td>
                      <td className="px-4 py-2">{TASK_LABEL[s.task] ?? s.task}</td>
                      <td className="text-right px-4 py-2">{s.calls}</td>
                      <td className="text-right px-4 py-2 text-gray-500">₩{s.avgKrw.toLocaleString()}</td>
                      <td className="text-right px-4 py-2 font-bold">₩{s.sumKrw.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* AI 호출 로그 */}
        <section className="mb-10">
          <h2 className="text-lg font-bold tracking-tight text-ink-900 mb-3">최근 AI 호출 ({data.aiUsage?.length ?? 0})</h2>
          {!data.aiUsage || data.aiUsage.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              아직 AI 호출 내역이 없습니다. <Link href="/new" className="text-tiger-orange font-bold">첫 책 시작</Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">시각</th>
                    <th className="text-left px-4 py-2">작업</th>
                    <th className="text-left px-4 py-2">모델</th>
                    <th className="text-right px-4 py-2">입력 / 출력</th>
                    <th className="text-right px-4 py-2">시간</th>
                    <th className="text-right px-4 py-2">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aiUsage.map(a => (
                    <tr key={a.id} className={`border-t border-gray-200 ${a.status === "failed" ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-2 text-xs text-gray-500">{new Date(a.created_at).toLocaleString("ko-KR")}</td>
                      <td className="px-4 py-2">
                        {TASK_LABEL[a.task] ?? a.task}
                        {a.chapter_idx !== null && <span className="text-xs text-gray-400 ml-1">{a.chapter_idx + 1}장</span>}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{a.model.replace(/^claude-|^gemini-/, "")}</td>
                      <td className="text-right px-4 py-2 text-xs text-gray-600">
                        {a.input_tokens.toLocaleString()} / {(a.output_tokens + a.thoughts_tokens).toLocaleString()}
                      </td>
                      <td className="text-right px-4 py-2 text-xs text-gray-500">
                        {a.duration_ms ? `${(a.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="text-right px-4 py-2 font-bold text-tiger-orange">₩{a.cost_krw.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 잔액 변동 로그 */}
        <section>
          <h2 className="text-lg font-bold tracking-tight text-ink-900 mb-3">잔액 변동 ({data.transactions?.length ?? 0})</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">시각</th>
                  <th className="text-left px-4 py-2">유형</th>
                  <th className="text-left px-4 py-2">사유</th>
                  <th className="text-right px-4 py-2">변동</th>
                  <th className="text-right px-4 py-2">잔액</th>
                </tr>
              </thead>
              <tbody>
                {(data.transactions ?? []).map(t => (
                  <tr key={t.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(t.created_at).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-2">{TX_LABEL[t.type] ?? t.type}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{t.reason}</td>
                    <td className={`text-right px-4 py-2 font-bold ${t.amount_krw >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount_krw >= 0 ? "+" : ""}{t.amount_krw.toLocaleString()}원
                    </td>
                    <td className="text-right px-4 py-2 text-gray-500">₩{t.balance_after.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">{label}</div>
      <div className={`font-mono text-2xl md:text-3xl font-bold tracking-tight ${accent ? "text-tiger-orange" : "text-ink-900"}`}>{value}</div>
    </div>
  );
}

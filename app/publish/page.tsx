// /publish — 다중 플랫폼 등록 패키지 생성 (clean-redesign v3 spec 3.7)
// publishing-package API의 user-facing 진입점.
// 사용자가 본인 책 선택 → 플랫폼 선택(크몽/부크크/유페이퍼) → 패키지 생성.

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/Header";
import { UnauthFallback } from "@/components/ui/UnauthFallback";

type Platform = "kmong" | "bookk" | "upaper";

interface Project {
  id: string;
  topic: string;
  type: string;
  writtenCount: number;
  chapterCount: number;
}

interface PlatformMeta {
  name: string;
  format: string;
  titleMaxChars: number;
  recommendedPriceRangeKRW: [number, number];
  notes: string[];
}

const PLATFORMS: { key: Platform; emoji: string; tagline: string }[] = [
  { key: "kmong", emoji: "🐯", tagline: "직장인 1순위 — 가장 빠른 등록" },
  { key: "bookk", emoji: "📕", tagline: "종이책 + 이북 동시 출판" },
  { key: "upaper", emoji: "📘", tagline: "이북 전용, 카테고리 26개" },
];

export default function PublishPage() {
  const { status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [meta, setMeta] = useState<Record<Platform, PlatformMeta | null>>({ kmong: null, bookk: null, upaper: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ platform: Platform; message: string; delegate?: string; guide?: any } | null>(null);

  // 페이지 진입 시: 플랫폼 메타 + 내 책 목록 동시 fetch
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/generate/publishing-package")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.platforms) setMeta(d.platforms);
      })
      .catch(() => {});

    fetch("/api/projects")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.projects) {
          const list = d.projects.filter((p: Project) => p.writtenCount > 0);
          setProjects(list);
          if (list.length > 0) setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => {});
  }, [status]);

  const generate = async () => {
    if (!selectedProjectId || !selectedPlatform) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate/publishing-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, platform: selectedPlatform }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || `생성 실패 (${res.status})`);
      setResult({ platform: selectedPlatform, ...d });
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  };

  // Unauth fallback
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-base">
        <Header />
        <UnauthFallback
          eyebrow="다중 플랫폼 등록"
          title={<>크몽 + 부크크 + 유페이퍼<br />등록 패키지 자동.</>}
          description="책 1권을 한국 3개 플랫폼에 동시 등록. 플랫폼별 제목·설명·키워드·가격 추천까지 자동 생성."
          bullets={[
            "크몽 — PDF 이메일 발송, 직장인 1순위",
            "부크크 — 종이책 + 이북 동시 출판",
            "유페이퍼 — 이북 전용, 카테고리 26개",
          ]}
          accent="emerald"
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <Link href="/projects" className="inline-block py-2 text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-emerald-600">← 내 책</Link>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-600 mt-6 mb-2">📦 출판 패키지</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">
          크몽 외에도 등록.
        </h1>
        <p className="text-gray-600 mb-10">
          한국 3개 플랫폼에 동시 등록 — 매출 분산 + 등록 거절 대응. 책 선택 → 플랫폼 선택 → 자동 생성.
        </p>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h2 className="text-2xl font-black tracking-tight text-ink-900 mb-2">먼저 책을 만들어주세요</h2>
            <p className="text-gray-600 mb-6">챕터 본문이 1개 이상 작성된 책이 필요합니다.</p>
            <Link href="/new" className="inline-block px-8 py-3 bg-tiger-orange text-white font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600">
              + 새 책 시작
            </Link>
          </div>
        ) : (
          <>
            {/* Step 1 — 책 선택 */}
            <section className="mb-10">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-600 font-bold mb-3">STEP 1 · 책 선택</div>
              <select
                value={selectedProjectId}
                onChange={e => { setSelectedProjectId(e.target.value); setResult(null); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base bg-white focus:outline-none focus:border-emerald-600"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.topic} ({p.writtenCount}/{p.chapterCount} 챕터, {p.type})
                  </option>
                ))}
              </select>
            </section>

            {/* Step 2 — 플랫폼 선택 */}
            <section className="mb-10">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-600 font-bold mb-3">STEP 2 · 플랫폼 선택</div>
              <div className="grid md:grid-cols-3 gap-3">
                {PLATFORMS.map(p => {
                  const m = meta[p.key];
                  const isSelected = selectedPlatform === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => { setSelectedPlatform(p.key); setResult(null); }}
                      className={`text-left p-5 rounded-2xl border-2 transition ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-600/5 shadow-md"
                          : "border-gray-200 bg-white hover:border-emerald-600/40"
                      }`}
                    >
                      <div className="text-2xl mb-2">{p.emoji}</div>
                      <div className="font-black text-ink-900 mb-1">{m?.name ?? p.key}</div>
                      <div className="text-xs text-gray-500 mb-3">{p.tagline}</div>
                      {m && (
                        <div className="text-[11px] font-mono text-gray-600 space-y-0.5">
                          <div>제목 {m.titleMaxChars}자</div>
                          <div>₩{m.recommendedPriceRangeKRW[0].toLocaleString()}~₩{m.recommendedPriceRangeKRW[1].toLocaleString()}</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 3 — 생성 */}
            {selectedPlatform && meta[selectedPlatform] && (
              <section className="mb-10">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-600 font-bold mb-3">STEP 3 · 패키지 생성</div>
                <div className="rounded-2xl border border-emerald-600/30 bg-white p-5 md:p-6">
                  <h3 className="font-black text-ink-900 mb-3">{meta[selectedPlatform]?.name} 등록 가이드</h3>
                  <ul className="space-y-1.5 text-sm text-gray-700 mb-5">
                    {meta[selectedPlatform]?.notes.map((note, i) => (
                      <li key={i} className="flex gap-2"><span className="text-emerald-600">•</span><span>{note}</span></li>
                    ))}
                  </ul>
                  <button
                    onClick={generate}
                    disabled={busy || !selectedProjectId}
                    className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl min-h-[44px] hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "생성 중..." : `${meta[selectedPlatform]?.name} 패키지 만들기`}
                  </button>
                </div>
              </section>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}

            {result && (
              <section className="mb-10">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-600 font-bold mb-3">✓ 결과</div>
                <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-600/5 p-5 md:p-6">
                  <div className="font-bold text-ink-900 mb-2">{result.message}</div>
                  {result.delegate && (
                    <p className="text-sm text-gray-700">
                      크몽 패키지는 기존 흐름 사용:{" "}
                      <Link href={`/kmong-listing-helper`} className="text-emerald-600 font-bold hover:underline">
                        크몽 등록 도우미로 이동 →
                      </Link>
                    </p>
                  )}
                  {result.guide && (
                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <div>📝 {result.guide.title}</div>
                      <div>💰 {result.guide.pricing}</div>
                      <div>📚 {result.guide.format}</div>
                      <p className="mt-3 text-xs text-gray-500">
                        ⚠️ 본격 패키지 생성은 v2에서 추가됩니다 (셀러 정책 확인 후). 지금은 가이드만 제공.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

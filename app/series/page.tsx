// /series — 본인 시리즈 목록 + 다음 책 만들기
// (Wave C1)
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SeriesGroupBook {
  id: string;
  topic: string;
  audience: string;
  type: string;
  orderInSeries: number;
  themeColor?: string;
  coverBase64?: string | null;
  updatedAt: string;
}

interface SeriesGroup {
  seriesId: string;
  seriesTitle: string;
  bookCount: number;
  firstBookId: string;
  firstBookType: string;
  firstBookThemeColor?: string;
  books: SeriesGroupBook[];
}

interface ProjectSummary {
  id: string;
  topic: string;
  type: string;
}

export default function SeriesPage() {
  const router = useRouter();
  const { status } = useSession();
  const [series, setSeries] = useState<SeriesGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "기존 책으로 시리즈 만들기" 모달용
  const [showAttach, setShowAttach] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [attachBookId, setAttachBookId] = useState("");
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login?next=/series");
      return;
    }
    fetch("/api/series")
      .then(async r => {
        if (!r.ok) throw new Error("시리즈 목록을 불러올 수 없습니다.");
        return r.json();
      })
      .then(d => setSeries(d.series ?? []))
      .catch(e => setError(e.message));
  }, [status, router]);

  const openAttachModal = async () => {
    setShowAttach(true);
    if (projects.length === 0) {
      try {
        const r = await fetch("/api/projects");
        if (r.ok) {
          const d = await r.json();
          setProjects((d.projects ?? []).filter((p: any) => !p.archived));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleCreateSeries = async () => {
    if (!attachBookId || !newSeriesTitle.trim()) {
      alert("책과 시리즈 제목을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/series/from-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceBookId: attachBookId, newSeriesTitle: newSeriesTitle.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || d?.error || "실패");
      // refresh
      const r2 = await fetch("/api/series");
      const d2 = await r2.json();
      setSeries(d2.series ?? []);
      setShowAttach(false);
      setAttachBookId("");
      setNewSeriesTitle("");
    } catch (e: any) {
      alert(`시리즈 생성 실패: ${e?.message ?? "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">📚 내 시리즈</h1>
            <p className="text-sm text-gray-500 mt-1">시리즈로 묶인 책들을 한눈에 보고, 다음 권을 같은 톤으로 빠르게 시작하세요.</p>
          </div>
          <button
            onClick={openAttachModal}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition text-sm"
          >
            + 기존 책으로 새 시리즈 시작
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {series === null && !error && (
          <div className="text-gray-400 animate-pulse py-12 text-center">시리즈 불러오는 중…</div>
        )}

        {series !== null && series.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">아직 시리즈가 없습니다</h2>
            <p className="text-sm text-gray-500 mb-6">
              먼저 책을 한 권 만든 후, 위 &quot;+ 기존 책으로 새 시리즈 시작&quot; 버튼으로 묶을 수 있습니다.
            </p>
            <Link
              href="/new"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-lg transition"
            >
              + 새 책 만들기
            </Link>
          </div>
        )}

        {series !== null && series.length > 0 && (
          <div className="space-y-6">
            {series.map(g => (
              <SeriesCard key={g.seriesId} group={g} />
            ))}
          </div>
        )}
      </main>

      {showAttach && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !submitting && setShowAttach(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">새 시리즈 시작</h2>
            <p className="text-sm text-gray-500 mb-4">기존에 만든 책 한 권을 시리즈 1권으로 등록합니다.</p>

            <label className="block text-sm font-semibold text-gray-700 mb-1">시리즈 제목</label>
            <input
              type="text"
              value={newSeriesTitle}
              onChange={e => setNewSeriesTitle(e.target.value)}
              placeholder="예: 30대 재테크 시리즈"
              maxLength={100}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-orange-400"
            />

            <label className="block text-sm font-semibold text-gray-700 mb-1">시리즈 1권으로 쓸 책</label>
            <select
              value={attachBookId}
              onChange={e => setAttachBookId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-6 focus:outline-none focus:border-orange-400"
            >
              <option value="">— 선택 —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.topic} ({p.type})
                </option>
              ))}
            </select>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAttach(false)}
                disabled={submitting}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateSeries}
                disabled={submitting || !attachBookId || !newSeriesTitle.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {submitting ? "생성 중…" : "시리즈 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesCard({ group }: { group: SeriesGroup }) {
  // 다음 책 만들기 — /new로 이동, query에 seriesId + inheritFrom 전달
  const nextBookHref = `/new?series=${encodeURIComponent(group.seriesId)}&inheritFrom=${encodeURIComponent(group.firstBookId)}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-gray-900 truncate">{group.seriesTitle}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {group.bookCount}권 · {group.firstBookType}
          </p>
        </div>
        <Link
          href={nextBookHref}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition text-sm whitespace-nowrap"
        >
          + 다음 책 만들기
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {group.books.map(b => (
          <Link
            key={b.id}
            href={`/book/${b.id}`}
            className="flex-shrink-0 w-28 group"
          >
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 border border-gray-200 group-hover:shadow-md transition">
              {b.coverBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${b.coverBase64}`}
                  alt={b.topic}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2 text-center">
                  {b.topic}
                </div>
              )}
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
                {b.orderInSeries}권
              </div>
            </div>
            <div className="mt-2 text-xs font-medium text-gray-700 line-clamp-2 group-hover:text-orange-600 transition">
              {b.topic}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

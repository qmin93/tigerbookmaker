"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";

interface Project {
  id: string;
  topic: string;
  audience: string;
  type: string;
  chapterCount: number;
  writtenCount: number;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then(async r => {
        if (r.status === 401) { setUnauthorized(true); return; }
        const d = await r.json();
        setProjects(d.projects || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center>로딩 중...</Center>;
  if (unauthorized) {
    return (
      <Center>
        <div className="text-center">
          <p className="text-gray-600 mb-4">로그인이 필요합니다.</p>
          <Link href="/login" className="px-6 py-3 bg-ink-900 text-white font-bold rounded-lg hover:bg-tiger-orange transition">로그인</Link>
        </div>
      </Center>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mb-2">내 책</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
              {projects.length}<span className="text-gray-400">권</span>
            </h1>
          </div>
          <Link href="/new" className="inline-flex items-center gap-2 px-5 py-3 bg-tiger-orange text-white font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition">
            + 새 프로젝트
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-black tracking-tight text-ink-900 mb-2">첫 책을 시작해보세요</h2>
            <p className="text-gray-600 mb-6">주제만 입력하면 30분 안에 책 한 권이 완성됩니다.</p>
            <Link href="/new" className="inline-block px-8 py-3 bg-tiger-orange text-white font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600">
              새 프로젝트 시작
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => {
              const pct = Math.round((p.writtenCount / Math.max(p.chapterCount, 1)) * 100);
              return (
                <article key={p.id} className="group bg-white rounded-2xl p-5 border border-gray-200 hover:border-tiger-orange hover:shadow-md transition">
                  <div className="aspect-[3/4] bg-gradient-to-br from-ink-900 via-ink-800 to-tiger-orange rounded-xl mb-4 flex items-center justify-center text-white p-6 ring-1 ring-ink-700/40 overflow-hidden relative">
                    <div className="absolute inset-0 bg-grid-faint bg-grid-32 opacity-20" />
                    <div className="relative text-center">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-70 mb-2">TIGERBOOKMAKER</div>
                      <div className="text-base font-black leading-tight tracking-tight">{p.topic.slice(0, 60)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange">{p.type}</div>
                  <h3 className="mt-2 font-bold text-ink-900 leading-snug line-clamp-2">{p.topic}</h3>
                  <div className="text-xs text-gray-500 mt-1">대상: {p.audience}</div>

                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] font-mono text-gray-500 mb-1.5">
                      <span>{p.writtenCount}/{p.chapterCount} 챕터</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-tiger-orange transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Link href={`/write?id=${p.id}`} className="flex-1 py-2 text-center text-sm bg-ink-900 text-white rounded-lg hover:bg-tiger-orange transition font-bold">
                      이어 작성
                    </Link>
                    <Link href={`/export?id=${p.id}`} className="flex-1 py-2 text-center text-sm border border-gray-200 rounded-lg hover:border-ink-900 transition font-bold text-ink-900">
                      내보내기
                    </Link>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`"${p.topic}" 책을 정말 삭제할까요? 본문·요약·크몽 패키지 모두 삭제되며 복구 불가.`)) return;
                      const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
                      if (res.ok) {
                        setProjects(ps => ps.filter(x => x.id !== p.id));
                      } else {
                        alert("삭제 실패. 다시 시도해주세요.");
                      }
                    }}
                    className="mt-2 w-full py-1.5 text-xs text-gray-400 hover:text-red-600 transition"
                  >
                    삭제
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center bg-[#fafafa]">{children}</main>;
}

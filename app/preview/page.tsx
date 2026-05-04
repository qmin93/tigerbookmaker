"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getTheme } from "@/lib/theme-colors";
import type { ThemeColorKey } from "@/lib/storage";

// 북 미리보기 — PDF 다운로드 전 책 결과물을 페이지 단위로 보기.
// 챕터 본문을 ~700자 단위로 페이지 분할. 좌우 화살표 / 키보드 navigation.

interface Chapter {
  title: string;
  subtitle?: string;
  content: string;
  images?: { placeholder: string; dataUrl?: string }[];
}

interface Project {
  id: string;
  topic: string;
  audience: string;
  type: string;
  chapters: Chapter[];
  kmongPackage?: { images?: { type: string; base64: string }[] };
  themeColor?: ThemeColorKey;
}

interface Page {
  type: "cover" | "toc" | "chapter-start" | "body";
  chapterIdx?: number;
  text?: string;
}

const CHARS_PER_PAGE = 1300;

// 본문을 페이지 단위로 분할 (문단 단위 보존)
function splitToPages(content: string): string[] {
  const stripped = content.replace(/\[IMAGE:[^\]]+\]/g, "").trim();
  const paragraphs = stripped.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const pages: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > CHARS_PER_PAGE && buf) {
      pages.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) pages.push(buf);
  return pages.length > 0 ? pages : [""];
}

function buildPages(project: Project): Page[] {
  const pages: Page[] = [];
  pages.push({ type: "cover" });
  pages.push({ type: "toc" });
  project.chapters.forEach((c, ci) => {
    if (!c.content) return;
    pages.push({ type: "chapter-start", chapterIdx: ci });
    splitToPages(c.content).forEach(text => pages.push({ type: "body", chapterIdx: ci, text }));
  });
  return pages;
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!projectId) { router.push("/projects"); return; }
    fetch(`/api/projects/${projectId}`)
      .then(async r => {
        if (r.status === 401) { router.push(`/login?redirect=/preview?id=${projectId}`); return; }
        if (!r.ok) throw new Error(`로드 실패 (${r.status})`);
        return r.json();
      })
      .then(d => d && setProject(d))
      .catch(e => setError(e.message));
  }, [projectId, router]);

  const pages = useMemo(() => project ? buildPages(project) : [], [project]);
  const total = pages.length;
  const current = pages[idx];

  // 키보드 navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setIdx(i => Math.min(i + 1, total - 1));
      else if (e.key === "ArrowLeft") setIdx(i => Math.max(i - 1, 0));
      else if (e.key === "Home") setIdx(0);
      else if (e.key === "End") setIdx(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (error) return <Center><p className="text-red-600">{error}</p></Center>;
  if (!project) return <Center>책 불러오는 중...</Center>;
  if (!current) return <Center>페이지가 없습니다.</Center>;

  const cover = project.kmongPackage?.images?.find(i => i.type === "cover");
  const writtenChapters = project.chapters.filter(c => c.content);
  const pct = total > 1 ? Math.round((idx / (total - 1)) * 100) : 100;
  const theme = getTheme(project.themeColor as ThemeColorKey | undefined);

  return (
    <main className="min-h-screen bg-ink-900 flex flex-col">
      {/* 상단 바 */}
      <header className="bg-ink-850 border-b border-ink-700/60 px-4 py-3 flex items-center justify-between text-white text-sm">
        <Link href={`/export?id=${projectId}`} className="text-ink-300 hover:text-white text-xs">← 내보내기로</Link>
        <div className="font-bold tracking-tight truncate max-w-[40%]">{project.topic}</div>
        <div className="text-xs font-mono text-ink-400">
          {idx + 1} / {total}
        </div>
      </header>

      {/* 진행 바 */}
      <div className="h-0.5 bg-ink-800">
        <div className="h-full bg-tiger-orange transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* 페이지 영역 */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
        {/* 좌우 화살표 */}
        <button
          onClick={() => setIdx(i => Math.max(i - 1, 0))}
          disabled={idx === 0}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 disabled:hover:bg-white/10 transition flex items-center justify-center text-2xl z-10"
        >
          ←
        </button>
        <button
          onClick={() => setIdx(i => Math.min(i + 1, total - 1))}
          disabled={idx === total - 1}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 disabled:hover:bg-white/10 transition flex items-center justify-center text-2xl z-10"
        >
          →
        </button>

        {/* 책 페이지 */}
        <div
          className="w-full max-w-2xl bg-stone-50 rounded-sm shadow-2xl aspect-[3/4] overflow-hidden relative cursor-pointer"
          style={{ boxShadow: "0 25px 60px -15px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)" }}
          onClick={() => setIdx(i => Math.min(i + 1, total - 1))}
        >
          <PageContent page={current} project={project} cover={cover} theme={theme} />
        </div>
      </div>

      {/* 하단 thumbnail nav */}
      <div className="bg-ink-850 border-t border-ink-700/60 px-4 py-3 flex items-center justify-center gap-2 overflow-x-auto">
        {writtenChapters.map((c, i) => {
          // 이 챕터의 첫 page idx 찾기
          const startPageIdx = pages.findIndex(p => p.type === "chapter-start" && p.chapterIdx === project.chapters.indexOf(c));
          if (startPageIdx === -1) return null;
          const isActive = idx >= startPageIdx && (i === writtenChapters.length - 1 || idx < (pages.findIndex(p => p.type === "chapter-start" && p.chapterIdx === project.chapters.indexOf(writtenChapters[i + 1]))));
          return (
            <button
              key={i}
              onClick={() => setIdx(startPageIdx)}
              className={`text-[10px] px-2 py-1 rounded transition whitespace-nowrap ${
                isActive ? "bg-tiger-orange text-white font-bold" : "text-ink-400 hover:text-white hover:bg-ink-800"
              }`}
            >
              {i + 1}장
            </button>
          );
        })}
      </div>

      <div className="px-4 py-2 text-center text-[10px] font-mono text-ink-500 uppercase tracking-wider">
        ← → 키보드 / 페이지 클릭 → 다음
      </div>
    </main>
  );
}

function PageContent({ page, project, cover, theme }: { page: Page; project: Project; cover?: { base64: string }; theme: ReturnType<typeof getTheme> }) {
  if (page.type === "cover") {
    return (
      <div className="w-full h-full flex flex-col">
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`data:image/png;base64,${cover.base64}`} alt="표지" className="w-full flex-1 object-cover" />
        ) : (
          <div
            className="flex-1 flex items-center justify-center p-12"
            style={{ background: `linear-gradient(to bottom right, #0a0a0a, #1a1a1a, ${theme.hex})` }}
          >
            <div className="text-center text-white">
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] mb-4" style={{ color: theme.hex }}>TIGERBOOKMAKER</div>
              <div className="text-3xl md:text-4xl font-black leading-tight">{project.topic}</div>
              <div className="mt-4 text-sm text-white/70">대상: {project.audience}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (page.type === "toc") {
    return (
      <div className="w-full h-full p-12 overflow-y-auto bg-stone-50">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-tiger-orange mb-3">목차</div>
        <h2 className="text-3xl font-black tracking-tight text-ink-900 mb-8">CONTENTS</h2>
        <div className="space-y-3">
          {project.chapters.filter(c => c.content).map((c, i) => (
            <div key={i} className="flex items-baseline gap-3 pb-3 border-b border-stone-200">
              <span className="text-tiger-orange font-mono text-xs font-bold">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <div className="font-bold text-ink-900 text-sm">{c.title}</div>
                {c.subtitle && <div className="text-xs text-stone-500 mt-0.5">{c.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (page.type === "chapter-start" && typeof page.chapterIdx === "number") {
    const c = project.chapters[page.chapterIdx];
    return (
      <div className="w-full h-full bg-stone-50 flex flex-col p-12 relative">
        <div className="absolute top-1/2 right-12 -translate-y-1/2 text-[160px] font-black text-tiger-orange/10 leading-none select-none tracking-tighter">
          {String(page.chapterIdx + 1).padStart(2, "0")}
        </div>
        <div className="flex-1 flex flex-col justify-center relative z-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-tiger-orange mb-3">CHAPTER {String(page.chapterIdx + 1).padStart(2, "0")}</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-ink-900 leading-[1.1]">{c.title}</h2>
          {c.subtitle && <p className="mt-4 text-lg text-stone-600 leading-relaxed">{c.subtitle}</p>}
          <div className="mt-6 h-1 w-16 bg-tiger-orange" />
        </div>
      </div>
    );
  }

  if (page.type === "body" && typeof page.chapterIdx === "number") {
    const c = project.chapters[page.chapterIdx];
    return (
      <div className="w-full h-full bg-stone-50 flex flex-col">
        <div className="px-12 pt-8 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 flex justify-between">
          <span>{page.chapterIdx + 1}장 — {c.title}</span>
          <span className="text-tiger-orange">TIGERBOOKMAKER</span>
        </div>
        <div className="flex-1 px-12 py-6 overflow-y-auto">
          <div className="prose prose-stone max-w-none text-[13px] leading-[1.75] text-ink-800 whitespace-pre-wrap break-keep" style={{ fontFamily: "Pretendard, system-ui, sans-serif", wordBreak: "keep-all" }}>
            {(page.text || "").split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold text-ink-900 mt-4 mb-2">{line.slice(3)}</h3>;
              if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold text-ink-900 mt-3 mb-1">{line.slice(4)}</h4>;
              if (!line.trim()) return <div key={i} className="h-2" />;
              return <p key={i} className="mb-2.5">{line}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-8">알 수 없는 페이지</div>;
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<Center>로딩 중...</Center>}>
      <Inner />
    </Suspense>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center bg-ink-900 text-ink-300">{children}</main>;
}

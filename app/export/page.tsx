"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { BookProject } from "@/lib/storage";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");
  const [project, setProject] = useState<BookProject | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      router.push("/projects");
      return;
    }
    fetch(`/api/projects/${projectId}`)
      .then(async r => {
        if (r.status === 401) { router.push(`/login?redirect=/export?id=${projectId}`); return; }
        if (!r.ok) throw new Error(`프로젝트 로드 실패 (${r.status})`);
        const d = await r.json();
        // BookProject 형태로 정규화 (id, topic, audience, type, targetPages, chapters)
        setProject({
          id: d.id,
          topic: d.topic,
          audience: d.audience,
          type: d.type,
          targetPages: d.targetPages,
          chapters: d.chapters || [],
          createdAt: Date.parse(d.createdAt),
          updatedAt: Date.parse(d.updatedAt),
        });
      })
      .catch(e => setError(e.message));
  }, [projectId, router]);

  if (error) return <Center><p className="text-red-600">{error}</p></Center>;
  if (!project) return <Center>로딩 중...</Center>;

  const written = project.chapters.filter(c => c.content).length;
  const totalChars = project.chapters.reduce((a, c) => a + c.content.length, 0);
  const estPages = Math.ceil(totalChars / 800);

  const exportDocx = async () => {
    setBusy("DOCX");
    try {
      const { generateDocx } = await import("@/lib/export-docx");
      await generateDocx(project);
    } catch (e: any) { setError(e.message); }
    setBusy("");
  };
  const exportPdf = async () => {
    setBusy("PDF");
    try {
      const { generatePdf } = await import("@/lib/export-pdf");
      await generatePdf(project);
    } catch (e: any) { setError(e.message); }
    setBusy("");
  };

  return (
    <main className="min-h-screen bg-[#fafafa]">
    <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
      <Link href={`/write?id=${projectId}`} className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 집필로</Link>
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">내보내기</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">파일로 받기.</h1>
      <p className="text-gray-600 mb-10">DOCX / PDF로 다운로드. 크몽 전자책 규격 자동 충족.</p>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-6">
        <h2 className="font-bold text-ink-900 text-lg mb-4 line-clamp-2">{project.topic}</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm border-t border-gray-200 pt-4">
          <div><dt className="text-xs font-mono uppercase tracking-wider text-gray-500">집필 완료</dt><dd className="font-mono font-bold text-ink-900 mt-1">{written} / {project.chapters.length}장</dd></div>
          <div><dt className="text-xs font-mono uppercase tracking-wider text-gray-500">총 글자 수</dt><dd className="font-mono font-bold text-ink-900 mt-1">{totalChars.toLocaleString()}자</dd></div>
          <div><dt className="text-xs font-mono uppercase tracking-wider text-gray-500">예상 쪽수</dt><dd className="font-mono font-bold text-ink-900 mt-1">{estPages}쪽</dd></div>
          <div><dt className="text-xs font-mono uppercase tracking-wider text-gray-500">크몽 규격</dt><dd className={`font-mono font-bold mt-1 ${estPages >= 20 ? "text-tiger-orange" : "text-red-600"}`}>{estPages >= 20 ? "✓ 충족" : "✗ 미달 (20쪽↑)"}</dd></div>
        </dl>
      </div>

      {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <button onClick={exportDocx} disabled={!!busy} className="p-6 bg-white border border-gray-300 rounded-xl hover:border-ink-900 hover:bg-ink-900 hover:text-white text-ink-900 font-bold transition disabled:opacity-50">
          {busy === "DOCX" ? "생성 중..." : "📄 DOCX 다운로드"}
        </button>
        <button onClick={exportPdf} disabled={!!busy} className="p-6 bg-tiger-orange text-white rounded-xl shadow-glow-orange-sm hover:bg-orange-600 font-bold transition disabled:opacity-50 disabled:shadow-none">
          {busy === "PDF" ? "생성 중..." : "📕 PDF 다운로드"}
        </button>
      </div>

      <p className="text-xs font-mono text-gray-400 mt-8 text-center uppercase tracking-wider">Made with Tigerbookmaker · 본문 12pt / 줄간격 1.5 / 여백 2.5cm</p>
    </div>
    </main>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<Center>로딩 중...</Center>}>
      <Inner />
    </Suspense>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center text-gray-500">{children}</main>;
}

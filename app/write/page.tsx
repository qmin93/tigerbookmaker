"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";

interface Chapter {
  id?: string;
  title: string;
  subtitle?: string;
  content: string;
  images: { placeholder: string; dataUrl?: string; alt?: string; caption?: string }[];
}

interface Project {
  id: string;
  topic: string;
  audience: string;
  type: string;
  targetPages: number;
  chapters: Chapter[];
}

interface UsageStat {
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens?: number;
  costUSD: number;
  costKRW: number;
  durationMs: number;
}

const MODELS = [
  { id: "gemini-flash-latest", label: "Flash · 책 1권 ~₩200 (권장, 안정)" },
  { id: "gemini-2.5-flash", label: "Flash 2.5 · 503 빈발 (현재 비추)" },
  { id: "gemini-2.5-pro", label: "Pro · 결제 활성화 필요" },
  { id: "claude-sonnet-4-6", label: "Sonnet · API 키 필요 (현재 비활성)" },
] as const;

// 본문에서 [IMAGE: ...] placeholder 추출
function extractImagePlaceholders(content: string): string[] {
  const m = content.match(/\[IMAGE:[^\]]+\]/g);
  return m ?? [];
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id");

  const [project, setProject] = useState<Project | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<typeof MODELS[number]["id"]>("gemini-flash-latest");
  const [balance, setBalance] = useState<number | null>(null);
  const [lastUsage, setLastUsage] = useState<UsageStat | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState({ title: "", subtitle: "" });

  useEffect(() => {
    if (!projectId) {
      router.push("/projects");
      return;
    }
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(async r => {
        if (r.status === 401) { setUnauthorized(true); throw new Error("UNAUTHORIZED"); }
        if (!r.ok) throw new Error(`프로젝트 로드 실패 (${r.status})`);
        return r.json();
      }),
      fetch("/api/me").then(r => r.ok ? r.json() : null),
    ])
      .then(([p, me]) => {
        setProject(p);
        if (me) setBalance(me.balance_krw);
      })
      .catch(e => setError(e.message));
  }, [projectId, router]);

  if (unauthorized) {
    return (
      <Center>
        <p className="mb-4 text-gray-600">로그인이 필요합니다.</p>
        <Link href={`/login?redirect=/write?id=${projectId}`} className="px-6 py-3 bg-ink-900 text-white font-bold rounded-lg">로그인</Link>
      </Center>
    );
  }
  if (error) return <Center><p className="text-red-600">{error}</p></Center>;
  if (!project) return <Center>로딩 중...</Center>;

  // ─── DB 동기화: project.data 통째로 PUT ───
  const saveProject = async (next: Project) => {
    const data = {
      topic: next.topic, audience: next.audience, type: next.type, targetPages: next.targetPages,
      chapters: next.chapters,
    };
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error("저장 실패");
    setProject(next);
  };

  const callApi = async (path: string, body: any, label: string) => {
    setLoading(label);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, model, ...body }),
      });
      const data = await res.json();
      if (res.status === 402) {
        if (confirm(`잔액 부족: ${data.shortfall.toLocaleString()}원 부족합니다. 충전 페이지로 이동할까요?`)) {
          router.push("/billing");
        }
        throw new Error("잔액 부족");
      }
      if (!res.ok) throw new Error(data.message || `요청 실패 (${res.status})`);
      if (data.newBalance !== undefined) setBalance(data.newBalance);
      if (data.usage) setLastUsage({ ...data.usage });
      return data;
    } finally {
      setLoading("");
    }
  };

  const generateToc = async () => {
    try {
      await callApi("/api/generate/toc", {}, "목차 생성 중...");
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) { if (e.message !== "잔액 부족") setError(e.message); }
  };

  const generateChapter = async (idx: number) => {
    try {
      await callApi("/api/generate/chapter", { chapterIdx: idx }, `${idx + 1}장 집필 중...`);
      const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
      setProject(fresh);
    } catch (e: any) { if (e.message !== "잔액 부족") setError(e.message); }
  };

  const generateAll = async () => {
    if (!confirm(`${project.chapters.length}장 일괄 집필. 시작할까요?`)) return;
    for (let i = 0; i < project.chapters.length; i++) {
      if (project.chapters[i].content) continue;
      setActiveIdx(i);
      try {
        await callApi("/api/generate/chapter", { chapterIdx: i }, `일괄 집필: ${i + 1}/${project.chapters.length}`);
      } catch (e: any) {
        setError(`${i + 1}장에서 중단: ${e.message}`);
        break;
      }
    }
    const fresh = await fetch(`/api/projects/${projectId}`).then(r => r.json());
    setProject(fresh);
  };

  // ─── 목차 편집 ───
  const moveChapter = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= project.chapters.length) return;
    const chapters = [...project.chapters];
    [chapters[from], chapters[to]] = [chapters[to], chapters[from]];
    setActiveIdx(to);
    await saveProject({ ...project, chapters });
  };
  const deleteChapter = async (idx: number) => {
    if (!confirm(`"${project.chapters[idx].title}" 챕터를 삭제할까요? (본문 포함)`)) return;
    const chapters = project.chapters.filter((_, i) => i !== idx);
    setActiveIdx(Math.max(0, Math.min(activeIdx, chapters.length - 1)));
    await saveProject({ ...project, chapters });
  };
  const addChapter = async () => {
    const title = prompt("새 챕터 제목");
    if (!title) return;
    const subtitle = prompt("부제 (선택)") ?? "";
    const chapters = [...project.chapters, { title, subtitle, content: "", images: [] }];
    setActiveIdx(chapters.length - 1);
    await saveProject({ ...project, chapters });
  };
  const startEditTitle = (idx: number) => {
    const c = project.chapters[idx];
    setTitleDraft({ title: c.title, subtitle: c.subtitle ?? "" });
    setEditingTitle(idx);
  };
  const saveTitle = async () => {
    if (editingTitle === null) return;
    const chapters = [...project.chapters];
    chapters[editingTitle] = { ...chapters[editingTitle], title: titleDraft.title, subtitle: titleDraft.subtitle };
    setEditingTitle(null);
    await saveProject({ ...project, chapters });
  };

  // ─── 이미지 업로드 (data URL로 저장) ───
  const uploadImage = async (chapterIdx: number, placeholder: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError("이미지 크기는 2MB 이하만 가능합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const chapters = [...project.chapters];
      const ch = { ...chapters[chapterIdx] };
      const images = [...(ch.images ?? [])];
      const existing = images.findIndex(im => im.placeholder === placeholder);
      const caption = placeholder.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "");
      if (existing >= 0) images[existing] = { placeholder, dataUrl, caption };
      else images.push({ placeholder, dataUrl, caption });
      ch.images = images;
      chapters[chapterIdx] = ch;
      await saveProject({ ...project, chapters });
    };
    reader.readAsDataURL(file);
  };
  const removeImage = async (chapterIdx: number, placeholder: string) => {
    const chapters = [...project.chapters];
    const ch = { ...chapters[chapterIdx] };
    ch.images = (ch.images ?? []).filter(im => im.placeholder !== placeholder);
    chapters[chapterIdx] = ch;
    await saveProject({ ...project, chapters });
  };

  const active = project.chapters[activeIdx];
  const placeholders = active ? extractImagePlaceholders(active.content) : [];

  return (
    <>
    <Header />
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-32">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-tiger-orange">← 내 책</Link>
          <h1 className="text-lg sm:text-xl font-black mt-1 line-clamp-2 break-keep">{project.topic}</h1>
          <p className="text-xs text-gray-500">{project.audience} · {project.type} · {project.targetPages}쪽</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={model} onChange={e => setModel(e.target.value as any)} className="text-sm px-3 py-2 border border-gray-200 rounded-lg">
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <Link href={`/export?id=${projectId}`} className="px-4 py-2 bg-ink-900 text-white rounded-lg font-bold text-sm">내보내기 →</Link>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {project.chapters.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-gray-200 text-center">
          <p className="mb-5 text-gray-600">아직 목차가 없습니다. AI가 12개 챕터를 제안합니다.</p>
          <button onClick={generateToc} disabled={!!loading} className="px-6 py-3 bg-tiger-orange text-white rounded-lg font-bold disabled:opacity-50">
            {loading || "목차 생성"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
          {/* 사이드바 */}
          <aside className="bg-white rounded-xl border border-gray-200 p-3 h-fit">
            <p className="text-xs font-bold text-gray-500 px-2 py-2">목차 ({project.chapters.length})</p>
            {project.chapters.map((c, i) => (
              <div key={i} className={`group rounded-lg mb-1 transition ${i === activeIdx ? "bg-tiger-orange text-white" : "hover:bg-gray-100"}`}>
                <button onClick={() => setActiveIdx(i)} className="w-full text-left px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{i + 1}.</span>
                    <span className="truncate flex-1">{c.title}</span>
                    {c.content && <span className="text-xs">✓</span>}
                  </div>
                </button>
                <div className={`flex gap-1 px-2 pb-2 text-xs ${i === activeIdx ? "text-white/80" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}>
                  <button onClick={() => moveChapter(i, -1)} disabled={i === 0} className="hover:underline disabled:opacity-30">↑</button>
                  <button onClick={() => moveChapter(i, 1)} disabled={i === project.chapters.length - 1} className="hover:underline disabled:opacity-30">↓</button>
                  <button onClick={() => startEditTitle(i)} className="hover:underline">수정</button>
                  <button onClick={() => deleteChapter(i)} className="hover:underline ml-auto">삭제</button>
                </div>
              </div>
            ))}
            <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
              <button onClick={addChapter} disabled={!!loading} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-[#fafafa]">
                + 챕터 추가
              </button>
              <button onClick={generateAll} disabled={!!loading} className="w-full px-3 py-2 bg-tiger-orange text-white rounded-lg text-xs font-bold disabled:opacity-50">
                ⚡ 전체 일괄 집필
              </button>
              <button onClick={generateToc} disabled={!!loading} className="w-full text-xs text-gray-500 hover:text-tiger-orange py-1">목차 다시 생성</button>
            </div>
          </aside>

          {/* 본문 */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 min-h-[500px]">
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{activeIdx + 1}장 · {active.content ? `${active.content.length.toLocaleString()}자` : "미집필"}</p>
                <h2 className="text-lg sm:text-xl font-black break-keep">{active.title}</h2>
                {active.subtitle && <p className="text-sm text-gray-500 mt-1 break-keep">{active.subtitle}</p>}
              </div>
              <button onClick={() => generateChapter(activeIdx)} disabled={!!loading} className="text-xs px-3 py-1 bg-tiger-orange text-white rounded-lg disabled:opacity-50 whitespace-nowrap">
                {loading.startsWith(`${activeIdx + 1}`) || loading.includes(`${activeIdx + 1}/`) ? loading : active.content ? "다시 생성" : "집필"}
              </button>
            </div>

            {active.content ? (
              <>
                <div className="prose max-w-none text-sm whitespace-pre-wrap break-keep">
                  {active.content}
                </div>

                {/* 이미지 placeholder 업로드 */}
                {placeholders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <p className="text-sm font-bold mb-3">📷 이미지 첨부 ({placeholders.length})</p>
                    <div className="space-y-3">
                      {placeholders.map((ph, idx) => {
                        const img = (active.images ?? []).find(im => im.placeholder === ph);
                        const caption = ph.replace(/^\[IMAGE:\s*/, "").replace(/\]$/, "");
                        return (
                          <div key={idx} className="flex gap-3 items-start p-3 bg-[#fafafa] rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-gray-500 mb-1 break-all">{ph}</p>
                              <p className="text-xs text-gray-600 break-keep">{caption}</p>
                            </div>
                            {img?.dataUrl ? (
                              <div className="flex flex-col gap-1 items-end">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.dataUrl} alt={caption} className="w-20 h-20 object-cover rounded" />
                                <button onClick={() => removeImage(activeIdx, ph)} className="text-xs text-red-600 hover:underline">삭제</button>
                              </div>
                            ) : (
                              <label className="text-xs px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-tiger-orange whitespace-nowrap">
                                업로드
                                <input
                                  type="file" accept="image/*" className="hidden"
                                  onChange={e => e.target.files?.[0] && uploadImage(activeIdx, ph, e.target.files[0])}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">2MB 이하 이미지. PDF·DOCX 출력 시 본문에 자동 삽입됩니다.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-20 text-sm">
                {loading || "이 챕터는 아직 집필 전입니다"}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 챕터 제목 편집 모달 */}
      {editingTitle !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setEditingTitle(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-black mb-4">챕터 제목 수정</h3>
            <input
              value={titleDraft.title}
              onChange={e => setTitleDraft({ ...titleDraft, title: e.target.value })}
              placeholder="제목"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-2"
              autoFocus
            />
            <input
              value={titleDraft.subtitle}
              onChange={e => setTitleDraft({ ...titleDraft, subtitle: e.target.value })}
              placeholder="부제 (선택)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingTitle(null)} className="px-4 py-2 text-gray-500">취소</button>
              <button onClick={saveTitle} className="px-4 py-2 bg-tiger-orange text-white rounded-lg font-bold">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 마지막 호출 사용량 */}
      {lastUsage && (
        <div className="fixed bottom-0 left-0 right-0 bg-ink-900 text-white text-xs py-2 px-4">
          <div className="max-w-6xl mx-auto flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="font-bold">방금</span>
            <span>입 {lastUsage.inputTokens?.toLocaleString()}</span>
            <span>출 {lastUsage.outputTokens?.toLocaleString()}</span>
            {lastUsage.thoughtsTokens ? <span>사고 {lastUsage.thoughtsTokens.toLocaleString()}</span> : null}
            <span className="text-tiger-orange font-bold">₩{lastUsage.costKRW?.toLocaleString()}</span>
            <span className="text-gray-400 hidden sm:inline">{(lastUsage.durationMs / 1000).toFixed(1)}s</span>
            <button onClick={() => setLastUsage(null)} className="ml-auto text-gray-400">✕</button>
          </div>
        </div>
      )}
    </main>
    </>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<Center>로딩 중...</Center>}>
      <Inner />
    </Suspense>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center text-gray-500">{children}</main>;
}

// /external-linkbio — 외부 link-in-bio (Litt.ly / Linktree / 인스타 bio) 가이드 페이지
// 사용자가 자체 /u/[handle] 외에 외부 서비스에도 책을 등록할 수 있도록
// 책 1권 선택 → URL/제목/설명/표지 자동 추출 + 복사 버튼 제공.
// auth required: 401 → /login?redirect=/external-linkbio.

"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

interface BookData {
  id: string;
  topic: string;
  audience: string;
  type: string;
  cover: { base64: string } | null;
  marketingMeta: any;
  kmongCopy: any;
}

const SITE_ORIGIN = "https://tigerbookmaker.vercel.app";

type GuideKey = "littly" | "linktree" | "instagram";

export default function ExternalLinkBioPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<GuideKey | null>("littly");

  // 1) 책 목록 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (res.status === 401) {
          router.replace("/login?redirect=/external-linkbio");
          return;
        }
        if (!res.ok) throw new Error(`목록 로드 실패 (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const list: Project[] = Array.isArray(data?.projects) ? data.projects : [];
        setProjects(list);
        if (list.length > 0) setSelectedId(list[0].id);
      } catch (e: any) {
        if (!cancelled) setProjectError(e.message ?? "목록 로드 실패");
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // 2) 선택된 책 상세 로드
  useEffect(() => {
    if (!selectedId) { setBookData(null); return; }
    let cancelled = false;
    setLoadingBook(true);
    setBookError(null);
    (async () => {
      try {
        const res = await fetch(`/api/book/${selectedId}`);
        if (res.status === 403) {
          if (!cancelled) {
            setBookData(null);
            setBookError("이 책은 아직 공개(공유)되지 않았습니다. /projects 에서 공유 설정을 켜 주세요.");
          }
          return;
        }
        if (!res.ok) throw new Error(`책 정보 로드 실패 (${res.status})`);
        const data = await res.json();
        if (!cancelled) setBookData(data);
      } catch (e: any) {
        if (!cancelled) setBookError(e.message ?? "책 정보 로드 실패");
      } finally {
        if (!cancelled) setLoadingBook(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  // 자동 추출값
  const autoUrl = useMemo(() => bookData ? `${SITE_ORIGIN}/book/${bookData.id}` : "", [bookData]);
  const autoTitle = useMemo(() => bookData?.topic ?? "", [bookData]);
  const autoDescription = useMemo(() => {
    const m = bookData?.marketingMeta;
    if (m?.tagline) return String(m.tagline);
    if (m?.summary) return String(m.summary);
    const k = bookData?.kmongCopy;
    if (k?.tagline) return String(k.tagline);
    if (k?.shortDesc) return String(k.shortDesc);
    if (bookData?.audience) return `${bookData.audience}을 위한 책 — ${bookData.topic}`;
    return bookData?.topic ?? "";
  }, [bookData]);
  const coverDataUri = useMemo(() => {
    const b64 = bookData?.cover?.base64;
    return b64 ? `data:image/png;base64,${b64}` : "";
  }, [bookData]);

  const copy = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {}
  };

  const downloadCover = () => {
    if (!coverDataUri || !bookData) return;
    const a = document.createElement("a");
    a.href = coverDataUri;
    a.download = `tigerbookmaker-${bookData.id}-cover.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleGuide = (k: GuideKey) => setOpenGuide((prev) => (prev === k ? null : k));

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link href="/profile" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 프로필</Link>

        {/* Hero */}
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">link-in-bio</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">📱 외부 link-in-bio에 책 올리기</h1>
        <p className="text-gray-600 mb-10 leading-relaxed">
          Litt.ly · Linktree · 인스타그램 bio 등 외부 서비스에 내 책을 등록할 때 필요한 URL/제목/설명/썸네일을 한 번에 복사하세요.
        </p>

        {/* 3-step 가이드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          {[
            { n: 1, t: "책 선택", d: "올릴 책 1권 선택 → 자동 입력값 받기" },
            { n: 2, t: "외부 사이트", d: "Litt.ly / Linktree / 인스타에 붙여넣기" },
            { n: 3, t: "공유", d: "친구·팔로워에게 링크 전달" },
          ].map((s) => (
            <div key={s.n} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-tiger-orange text-white text-xs font-bold flex items-center justify-center">{s.n}</span>
                <span className="text-sm font-bold text-ink-900">{s.t}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>

        {/* 책 선택기 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">1) 책 선택</label>
          {loadingProjects ? (
            <div className="text-sm text-gray-400 py-2">목록 불러오는 중…</div>
          ) : projectError ? (
            <div className="text-sm text-red-600 py-2">{projectError}</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-gray-500 py-3">
              아직 책이 없습니다.{" "}
              <Link href="/new" className="text-tiger-orange hover:underline font-bold">새 책 만들기 →</Link>
            </div>
          ) : (
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none bg-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.topic} ({p.writtenCount}/{p.chapterCount} 챕터)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 자동 정보 박스 */}
        {selectedId && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">2) 자동 정보 — 복사해서 외부 사이트에 붙여넣기</label>

            {loadingBook ? (
              <div className="text-sm text-gray-400 py-3">책 정보 불러오는 중…</div>
            ) : bookError ? (
              <div className="text-sm text-red-600 py-3 leading-relaxed">{bookError}</div>
            ) : bookData ? (
              <div className="space-y-4">
                {/* URL */}
                <FieldRow
                  label="🔗 URL"
                  value={autoUrl}
                  copied={copiedKey === "url"}
                  onCopy={() => copy("url", autoUrl)}
                  mono
                />
                {/* 제목 */}
                <FieldRow
                  label="📝 제목"
                  value={autoTitle}
                  copied={copiedKey === "title"}
                  onCopy={() => copy("title", autoTitle)}
                />
                {/* 설명 */}
                <FieldRow
                  label="💬 설명"
                  value={autoDescription}
                  copied={copiedKey === "desc"}
                  onCopy={() => copy("desc", autoDescription)}
                  multiline
                />
                {/* 썸네일 */}
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">🖼️ 썸네일 이미지</div>
                  <div className="flex items-start gap-4 flex-wrap">
                    {coverDataUri ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverDataUri}
                        alt={`${autoTitle} 표지`}
                        className="w-[140px] h-[140px] rounded-lg border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="w-[140px] h-[140px] bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 text-center px-2">
                        표지 이미지 없음
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 leading-relaxed mb-3">
                        외부 사이트에 표지 이미지를 업로드해야 한다면 다운로드 후 사용하세요. (1080×1080 PNG)
                      </p>
                      <button
                        type="button"
                        onClick={downloadCover}
                        disabled={!coverDataUri}
                        className="px-4 py-2 bg-tiger-orange text-white text-xs font-bold rounded-md hover:bg-orange-600 transition disabled:opacity-40"
                      >
                        💾 다운로드 (PNG)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 사이트별 가이드 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-10">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">3) 사이트별 가이드</label>

          <GuideCard
            title="Litt.ly"
            emoji="🔵"
            isOpen={openGuide === "littly"}
            onToggle={() => toggleGuide("littly")}
            steps={[
              "litt.ly 로그인 → 대시보드 진입",
              "‘+ 새 링크 추가’ (Add new link) 버튼 클릭",
              "Title 칸에 위 ‘제목’, URL 칸에 위 ‘URL’ 붙여넣기",
              "Thumbnail 업로드에 위에서 다운로드한 표지 PNG 사용",
              "저장 → 내 Litt.ly 페이지에서 책 카드 노출 확인",
            ]}
          />

          <GuideCard
            title="Linktree"
            emoji="🟢"
            isOpen={openGuide === "linktree"}
            onToggle={() => toggleGuide("linktree")}
            steps={[
              "linktr.ee/admin 로그인",
              "‘+ Add new Link’ 클릭",
              "Title에 ‘제목’, URL에 위 ‘URL’ 붙여넣기 → Add",
              "썸네일이 필요하면 Thumbnail icon → Custom image에 표지 PNG 업로드",
              "On 토글 확인 — 라이브 반영",
            ]}
          />

          <GuideCard
            title="인스타그램 bio"
            emoji="🟣"
            isOpen={openGuide === "instagram"}
            onToggle={() => toggleGuide("instagram")}
            steps={[
              "인스타 앱 → 내 프로필 → ‘프로필 편집’",
              "‘웹사이트(Website)’ 칸에 위 ‘URL’ 한 줄 붙여넣기",
              "스토리·릴스에서 책을 언급할 땐 ‘프로필 링크 확인’ 자막 추가",
              "여러 책을 동시에 올리려면 Litt.ly/Linktree URL을 bio에, 그 안에 개별 책들을 등록",
            ]}
          />
        </div>

        <div className="text-center text-xs text-gray-400 mb-6">
          💡 외부 link-in-bio 외에, 자체 통합 페이지는{" "}
          <Link href="/profile" className="text-tiger-orange hover:underline">/profile</Link> 에서 만들 수 있습니다.
        </div>
      </div>
    </main>
  );
}

// ───────────────── helpers ─────────────────

function FieldRow({
  label, value, copied, onCopy, mono = false, multiline = false,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-gray-500 mb-2">{label}</div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2 flex-wrap">
        <div
          className={[
            "flex-1 min-w-0 text-ink-900 break-all",
            mono ? "font-mono text-xs md:text-sm" : "text-sm",
            multiline ? "whitespace-pre-wrap" : "",
          ].join(" ")}
        >
          {value || <span className="text-gray-400">—</span>}
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="px-3 py-1.5 bg-tiger-orange text-white text-xs font-bold rounded-md hover:bg-orange-600 transition whitespace-nowrap disabled:opacity-40"
        >
          {copied ? "✓ 복사됨" : "복사"}
        </button>
      </div>
    </div>
  );
}

function GuideCard({
  title, emoji, steps, isOpen, onToggle,
}: {
  title: string;
  emoji: string;
  steps: string[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl mb-2 last:mb-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="text-sm font-bold text-ink-900">{title}</span>
        </span>
        <span className="text-xs font-mono text-gray-500">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <ol className="list-decimal pl-9 pr-5 py-4 space-y-1.5 text-sm text-gray-700 leading-relaxed">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

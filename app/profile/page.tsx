// /profile — 작가 프로필 편집 페이지 (auth 필요).
// handle 실시간 사용가능 체크(debounce 500ms), avatar/bio/social links 편집.
// 401 시 /login?redirect=/profile 으로.

"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

interface SocialLink {
  label: string;
  url: string;
}

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const MAX_LINKS = 8;
const SITE = "tigerbookmaker.vercel.app";

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // 폼 상태
  const [handle, setHandle] = useState("");
  const [originalHandle, setOriginalHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  // handle 사용가능 체크
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.status === 401) {
          router.replace("/login?redirect=/profile");
          return;
        }
        if (!res.ok) throw new Error(`로드 실패 (${res.status})`);
        const { profile } = await res.json();
        if (cancelled) return;
        setHandle(profile.handle ?? "");
        setOriginalHandle(profile.handle ?? "");
        setDisplayName(profile.displayName ?? "");
        setAvatarUrl(profile.avatarUrl ?? "");
        setBio(profile.bio ?? "");
        setSocialLinks(Array.isArray(profile.socialLinks) ? profile.socialLinks : []);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "프로필 로드 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // handle 실시간 체크 (debounce 500ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const h = handle.toLowerCase().trim();
    if (!h || h === originalHandle) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/handle-check?handle=${encodeURIComponent(h)}`);
        if (!res.ok) { setHandleStatus("invalid"); return; }
        const data = await res.json();
        if (!data.valid) setHandleStatus("invalid");
        else if (data.available) setHandleStatus("available");
        else setHandleStatus("taken");
      } catch {
        setHandleStatus("invalid");
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [handle, originalHandle]);

  const updateLink = (i: number, field: "label" | "url", value: string) => {
    setSocialLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };
  const addLink = () => {
    if (socialLinks.length >= MAX_LINKS) return;
    setSocialLinks((prev) => [...prev, { label: "", url: "" }]);
  };
  const removeLink = (i: number) => {
    setSocialLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const cleanedLinks = socialLinks.filter((l) => l.label.trim() && l.url.trim());
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.toLowerCase().trim(),
          displayName,
          avatarUrl,
          bio,
          socialLinks: cleanedLinks,
        }),
      });
      if (res.status === 401) { router.replace("/login?redirect=/profile"); return; }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || `저장 실패 (${res.status})`);
      }
      const { profile } = await res.json();
      setOriginalHandle(profile.handle);
      setHandleStatus("idle");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e: any) {
      setError(e.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCanSave = handleStatus === "idle" || handleStatus === "available";

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <Header />
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <Link href="/projects" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange">← 내 책</Link>

        <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2">내 프로필</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mb-3">내 프로필</h1>
        <p className="text-gray-600 mb-8">한 URL로 모든 책 + 정보 모으기.</p>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">불러오는 중...</div>
        ) : (
          <>
            {/* 공개 URL 미리보기 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
              <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">공개 URL</div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-mono text-sm md:text-base text-ink-900 break-all">
                  {SITE}/u/<strong className="text-tiger-orange">{originalHandle || handle || "—"}</strong>
                </div>
                {originalHandle && (
                  <a
                    href={`/u/${originalHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono uppercase tracking-wider text-tiger-orange hover:underline whitespace-nowrap"
                  >
                    공개 페이지 보기 →
                  </a>
                )}
              </div>
            </div>

            {/* handle */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">handle (URL 식별자)</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="예: tigerwriter"
                maxLength={30}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:border-tiger-orange focus:outline-none"
              />
              <div className="mt-2 text-xs font-mono">
                {handleStatus === "checking" && <span className="text-gray-500">입력 중…</span>}
                {handleStatus === "available" && <span className="text-green-600">✓ 사용 가능</span>}
                {handleStatus === "taken" && <span className="text-red-600">✗ 이미 사용 중</span>}
                {handleStatus === "invalid" && <span className="text-red-600">✗ 형식 오류 (3~30자, 소문자·숫자·_-)</span>}
                {handleStatus === "idle" && handle && <span className="text-gray-400">현재 handle</span>}
              </div>
            </div>

            {/* displayName */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">표시 이름</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="예: 호랑이작가"
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none"
              />
              <div className="mt-1 text-xs font-mono text-gray-400">{displayName.length} / 50</div>
            </div>

            {/* avatarUrl */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">프로필 이미지 URL</label>
              <div className="flex gap-3 items-start">
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt="avatar preview"
                    className="w-14 h-14 rounded-full object-cover border border-gray-200 flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  maxLength={1000}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:border-tiger-orange focus:outline-none"
                />
              </div>
            </div>

            {/* bio */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-2">자기 소개 (bio)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="한 줄 소개를 적어 주세요"
                maxLength={500}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-tiger-orange focus:outline-none resize-none"
              />
              <div className="mt-1 text-xs font-mono text-gray-400">{bio.length} / 500</div>
            </div>

            {/* social links */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-mono uppercase tracking-wider text-gray-500">외부 링크 ({socialLinks.length}/{MAX_LINKS})</label>
                <button
                  type="button"
                  onClick={addLink}
                  disabled={socialLinks.length >= MAX_LINKS}
                  className="text-xs font-mono uppercase tracking-wider text-tiger-orange hover:underline disabled:opacity-30 disabled:no-underline"
                >+ 추가</button>
              </div>
              {socialLinks.length === 0 && (
                <div className="text-xs text-gray-400 py-3 text-center">인스타·유튜브·블로그 등 외부 링크를 추가하세요.</div>
              )}
              <div className="space-y-2">
                {socialLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLink(i, "label", e.target.value)}
                      placeholder="라벨 (예: 인스타)"
                      maxLength={30}
                      className="w-32 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:border-tiger-orange focus:outline-none"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateLink(i, "url", e.target.value)}
                      placeholder="https://..."
                      maxLength={500}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:border-tiger-orange focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(i)}
                      className="px-2 py-2 text-xs text-gray-400 hover:text-red-600"
                      title="삭제"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>
            )}
            {savedFlash && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">✓ 저장 완료</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !handleCanSave}
              className="w-full py-4 bg-tiger-orange text-white text-lg font-bold rounded-xl shadow-glow-orange-sm hover:bg-orange-600 transition disabled:opacity-40 disabled:shadow-none"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

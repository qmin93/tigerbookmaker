// app/write/_components/sections/MarketingPageBox.tsx
// 🔗 마케팅 페이지 — AI 카피 + 편집 + URL 복사 + 크몽 등록 가이드
// page.tsx에서 추출한 순수 JSX 박스. UI-only state(편집 폼 열림/복사 토스트)만 내부 보유.

"use client";
import { useState } from "react";

// ── KmongGuideBox helpers (page.tsx에서 함께 이동) ──
const KMONG_CATEGORIES: Record<string, string> = {
  "자기계발서": "취업·이직 > 자기계발 / 동기부여",
  "재테크": "비즈니스 코칭 > 재테크·자산관리",
  "에세이": "전자책·소책자 > 에세이",
  "실용서": "비즈니스 코칭 > 실용·노하우",
  "매뉴얼": "비즈니스 코칭 > 매뉴얼·가이드",
  "웹소설": "전자책·소책자 > 소설·시",
  "전문서": "비즈니스 코칭 > 전문 분야",
};

function suggestKmongPriceKRW(targetPages: number): number {
  if (!targetPages || targetPages < 50) return 3000;
  if (targetPages < 100) return 5000;
  if (targetPages < 200) return 10000;
  return 15000;
}

function suggestKmongKeywords(project: any): string[] {
  const fromCopy: string[] = Array.isArray(project?.kmongPackage?.copy?.kmongHighlights)
    ? project.kmongPackage.copy.kmongHighlights.slice(0, 5).map((s: string) => String(s).trim()).filter(Boolean)
    : [];
  if (fromCopy.length > 0) return fromCopy;
  // fallback — 챕터 제목 첫 5개에서 추출
  const fromChapters = (project?.chapters ?? [])
    .slice(0, 5)
    .map((c: any) => String(c?.title ?? "").trim())
    .filter(Boolean);
  return fromChapters.length > 0 ? fromChapters : [project?.topic ?? "전자책"];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(text || "").then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      className="text-[10px] px-1.5 py-0.5 border border-gray-200 rounded hover:bg-white transition shrink-0"
      title="복사"
    >
      {copied ? "✓" : "📋 복사"}
    </button>
  );
}

function KmongGuideBox({ project }: { project: any }) {
  const [open, setOpen] = useState(false);

  const type = project?.type ?? "";
  const category = KMONG_CATEGORIES[type] ?? "전자책·소책자 > 기타";
  const targetPages = Number(project?.targetPages ?? 0);
  const price = suggestKmongPriceKRW(targetPages);
  const title =
    project?.marketingMeta?.tagline ||
    project?.kmongPackage?.copy?.kmongTitle ||
    project?.topic ||
    "(제목 미지정)";
  const description =
    project?.kmongPackage?.copy?.kmongDescription ||
    project?.marketingMeta?.description ||
    "(상세 설명 미작성 — '🤖 AI가 마케팅 카피 생성' 또는 '📦 크몽 패키지 생성' 후 자동 채워집니다.)";
  const keywords = suggestKmongKeywords(project);

  return (
    <div className="mt-2 p-2 bg-yellow-50/60 border border-yellow-300/60 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-xs font-bold text-ink-900">📦 크몽 등록 가이드</span>
        <span className="text-[10px] text-gray-500">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">카테고리</div>
            <div className="flex-1 break-keep text-ink-900">{category}</div>
            <CopyButton text={category} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">추천가</div>
            <div className="flex-1 text-ink-900">
              ₩{price.toLocaleString()}
              <span className="ml-1 text-[10px] text-gray-500">({targetPages || "?"}쪽 기준)</span>
            </div>
            <CopyButton text={String(price)} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">제목</div>
            <div className="flex-1 break-keep text-ink-900 line-clamp-3">{title}</div>
            <CopyButton text={title} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">상세</div>
            <div className="flex-1 break-keep text-ink-900 line-clamp-4 whitespace-pre-wrap">{description}</div>
            <CopyButton text={description} />
          </div>
          <div className="flex items-start gap-2">
            <div className="w-16 shrink-0 text-gray-500 font-bold">키워드</div>
            <div className="flex-1 flex flex-wrap gap-1">
              {keywords.map((k, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-ink-900">{k}</span>
              ))}
            </div>
            <CopyButton text={keywords.join(", ")} />
          </div>
          <div className="pt-1">
            <a
              href="https://kmong.com/register/service"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center px-2 py-1.5 bg-yellow-500 text-white rounded text-[11px] font-bold hover:bg-yellow-600 transition"
            >
              🔗 크몽에 새 서비스 등록
            </a>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed pt-1">
            추천값은 정적 매핑입니다. 크몽 화면의 실제 카테고리·정책에 맞춰 수정해 사용하세요.
          </p>
        </div>
      )}
    </div>
  );
}

interface Props {
  projectId: string | null;
  project: any;
  marketingMeta: any;
  marketingBusy: boolean;
  loading: string;
  onGenerate: () => void;
  onSave: (form: any) => Promise<boolean>;  // returns true on success → close form
  onCopyUrl: () => Promise<boolean>;        // returns true on success → trigger toast
}

export function MarketingPageBox({
  projectId,
  project,
  marketingMeta,
  marketingBusy,
  loading,
  onGenerate,
  onSave,
  onCopyUrl,
}: Props) {
  // UI-only state (page.tsx에서 옮겨옴)
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<{
    tagline?: string;
    description?: string;
    authorName?: string;
    authorBio?: string;
  }>({});
  const [copyConfirm, setCopyConfirm] = useState(false);

  const openEditor = () => {
    setForm({ ...(marketingMeta ?? {}) });
    setEditOpen(true);
  };

  const handleSave = async () => {
    const ok = await onSave(form);
    if (ok) setEditOpen(false);
  };

  const handleCopy = async () => {
    const ok = await onCopyUrl();
    if (ok) {
      setCopyConfirm(true);
      setTimeout(() => setCopyConfirm(false), 2000);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 px-2 pb-1">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold text-ink-900">🔗 마케팅 페이지</span>
        <a
          href={`/book/${projectId}`}
          target="_blank"
          rel="noopener"
          className="text-xs text-tiger-orange hover:underline"
        >
          미리보기 →
        </a>
      </div>
      {!marketingMeta ? (
        <button
          onClick={onGenerate}
          disabled={marketingBusy || !!loading}
          className="w-full px-2 py-1.5 border border-tiger-orange/40 text-tiger-orange rounded-lg text-[11px] font-bold hover:bg-orange-50 transition disabled:opacity-50"
        >
          {marketingBusy ? "AI 카피 생성 중..." : "🤖 AI가 마케팅 카피 생성 (~₩500)"}
        </button>
      ) : (
        <>
          {marketingMeta.tagline && (
            <p className="text-[11px] text-gray-700 truncate mb-1.5" title={marketingMeta.tagline}>
              📌 {marketingMeta.tagline}
            </p>
          )}
          <div className="flex gap-1 text-[11px]">
            <button
              onClick={openEditor}
              disabled={marketingBusy}
              className="flex-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition disabled:opacity-50"
            >
              편집
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition"
            >
              {copyConfirm ? "✓ 복사됨" : "URL 복사"}
            </button>
          </div>
        </>
      )}

      {/* 📦 크몽 등록 가이드 (정적, AI 호출 X) */}
      <KmongGuideBox project={project} />
      {editOpen && (
        <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">한 줄 소개 (tagline)</label>
            <input
              type="text"
              maxLength={200}
              value={form.tagline ?? ""}
              onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
              placeholder="이 책을 한 줄로"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">상세 설명 (description)</label>
            <textarea
              maxLength={3000}
              rows={4}
              value={form.description ?? ""}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded resize-y"
              placeholder="책 소개를 자세히"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">저자 이름</label>
            <input
              type="text"
              maxLength={50}
              value={form.authorName ?? ""}
              onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">저자 소개</label>
            <input
              type="text"
              maxLength={300}
              value={form.authorBio ?? ""}
              onChange={e => setForm(f => ({ ...f, authorBio: e.target.value }))}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
            />
          </div>
          <div className="flex gap-1 pt-1">
            <button
              onClick={() => setEditOpen(false)}
              disabled={marketingBusy}
              className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded hover:bg-white transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={marketingBusy}
              className="flex-1 px-2 py-1 text-[11px] bg-tiger-orange text-white font-bold rounded hover:bg-orange-600 transition disabled:opacity-50"
            >
              {marketingBusy ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

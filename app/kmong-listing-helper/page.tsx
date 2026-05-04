// /kmong-listing-helper — 크몽 등록 자동 가이드
// 책 1권 → 크몽 서비스 등록 양식 모든 필드 자동 채우기
// 시나리오 A (전자책 판매) / B (외주 서비스) 토글
// 모든 생성 client-side, 새 API endpoint 없음
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

type Mode = "ebook" | "service";

interface ProjectSummary {
  id: string;
  topic: string;
  audience: string;
  type: string;
  targetPages: number;
  archived?: boolean;
  hasCover?: boolean;
}

interface KmongImage {
  type: "cover" | "thumb" | "toc" | "spec" | "audience" | "preview";
  base64: string;
  vendor?: string;
  generatedAt?: number;
}

interface ProjectFull {
  id: string;
  topic: string;
  audience: string;
  type: string;
  targetPages: number;
  marketingMeta?: {
    description?: string;
    tagline?: string;
    authorName?: string;
    authorBio?: string;
  };
  chapters?: Array<{ title: string; content?: string }>;
  kmongPackage?: {
    images?: KmongImage[];
    copy?: { kmongDescription?: string; kmongHighlights?: string[] };
  };
}

// 책 type → 크몽 카테고리 매핑
const KMONG_CATEGORIES: Record<string, { c1: string; c2: string }> = {
  "자기계발서": { c1: "취업·이직", c2: "자기계발" },
  "재테크":   { c1: "재테크·자산관리", c2: "일반" },
  "에세이":   { c1: "전자책", c2: "에세이" },
  "매뉴얼":   { c1: "IT·프로그래밍", c2: "도구·매뉴얼" },
  "실용서":   { c1: "전자책", c2: "실용" },
  "웹소설":   { c1: "전자책", c2: "소설" },
  "전문서":   { c1: "비즈니스 컨설팅", c2: "전문" },
};

// 한글/영문 라벨 (이미지 type)
const IMAGE_TYPE_LABEL: Record<string, string> = {
  cover: "표지",
  thumb: "썸네일",
  toc: "목차",
  spec: "사양",
  audience: "독자 안내",
  preview: "미리보기",
};

interface GeneratedListing {
  title: string;
  category1: string;
  category2: string;
  description: string;
  keywords: string[];
  prices: { name: string; price: number; included: string[] }[];
  workDuration: string;
  refundPolicy: string;
  imageGuide: string[];
}

// 분량 기반 전자책 가격
function ebookPrice(targetPages: number): number {
  if (targetPages < 50)  return 3000;
  if (targetPages < 100) return 5000;
  if (targetPages < 200) return 10000;
  return 15000;
}

function extractKeywords(book: ProjectFull): string[] {
  const words = new Set<string>();
  if (book.type) words.add(book.type);
  (book.audience || "").split(/[\s,·.]+/).filter((w) => w.length > 1).forEach((w) => words.add(w));
  (book.topic || "").split(/[\s,·.]+/).filter((w) => w.length > 1).forEach((w) => words.add(w));
  (book.chapters || []).slice(0, 5).forEach((c) => {
    (c.title || "").split(/[\s,·.]+/).filter((w: string) => w.length > 1).forEach((w: string) => words.add(w));
  });
  words.add("전자책");
  words.add("PDF");
  if (book.type !== "웹소설") words.add("크몽");
  // 빈 문자열 / 너무 짧은 거 제거
  return Array.from(words).filter((w) => w && w.length > 1).slice(0, 15);
}

function generateKmongListing(book: ProjectFull, mode: Mode): GeneratedListing {
  const cat = KMONG_CATEGORIES[book.type] ?? { c1: "전자책", c2: "기타" };
  const tagline = book.marketingMeta?.tagline ?? "";
  const desc = book.marketingMeta?.description ?? "";
  const authorName = book.marketingMeta?.authorName ?? "작가";
  const authorBio = book.marketingMeta?.authorBio ?? "";
  const chapterCount = book.chapters?.length ?? 0;
  const audienceList = (book.audience || "").split(/[,·]/).map((s) => s.trim()).filter(Boolean);

  if (mode === "ebook") {
    // === A. 전자책 판매 ===
    const titleBase = `[${book.type}] ${book.topic}`;
    const titleSuffix = tagline ? ` — ${tagline}` : " (즉시 다운로드 PDF/EPUB)";
    let title = titleBase + titleSuffix;
    if (title.length > 60) title = title.slice(0, 57) + "...";
    if (title.length < 30) title = title + " | 전자책 즉시 다운로드";
    title = title.slice(0, 60);

    const price = ebookPrice(book.targetPages);

    const lines: string[] = [];
    lines.push(`# ${book.topic}`);
    lines.push("");
    if (tagline) {
      lines.push(`> ${tagline}`);
      lines.push("");
    }
    lines.push("## 이 책은 누구를 위한 책인가요?");
    if (audienceList.length > 0) {
      audienceList.forEach((a) => lines.push(`- ${a}`));
    } else {
      lines.push(`- ${book.audience}`);
    }
    lines.push("");
    lines.push(`## 책 구성 (총 ${chapterCount}챕터, ${book.targetPages}쪽)`);
    (book.chapters ?? []).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.title}`);
    });
    lines.push("");
    if (desc) {
      lines.push("## 책 소개");
      lines.push(desc);
      lines.push("");
    }
    lines.push("## 작가 소개");
    lines.push(`**${authorName}**`);
    if (authorBio) lines.push(authorBio);
    lines.push("");
    lines.push("## 자주 묻는 질문");
    lines.push("**Q. 어떤 형식으로 받나요?**");
    lines.push("A. PDF / EPUB 두 가지 형식 모두 즉시 다운로드 가능합니다.");
    lines.push("");
    lines.push("**Q. 환불 가능한가요?**");
    lines.push("A. 다운로드 전까지 100% 환불 가능합니다. 다운로드 후에는 디지털 상품 특성상 환불이 어렵습니다.");
    lines.push("");
    lines.push("**Q. 모바일에서도 볼 수 있나요?**");
    lines.push("A. 네. PDF는 모든 디바이스에서, EPUB은 리디북스/Apple Books 등에서 열람 가능합니다.");
    lines.push("");
    lines.push("**Q. 종이책으로도 받을 수 있나요?**");
    lines.push("A. 본 상품은 전자책 단독 판매입니다. 종이책 출간은 별도 안내드립니다.");

    const description = lines.join("\n");

    const imageGuide: string[] = [
      "메인 이미지: 책 표지 (1080×1080 PNG, 정사각형 권장)",
      "추가 이미지 1: 표지 + 책 제목 강조 배너",
      "추가 이미지 2: 목차 (toc) — 챕터 리스트 한 장",
      "추가 이미지 3: 미리보기 (preview) — 본문 일부",
      "추가 이미지 4: 독자 안내 (audience) — 누구를 위한 책인가",
      "추가 이미지 5: 작가 소개 + 후기/추천사 (선택)",
    ];

    return {
      title,
      category1: cat.c1,
      category2: cat.c2,
      description,
      keywords: extractKeywords(book),
      prices: [
        { name: "전자책 즉시 다운로드", price, included: ["PDF 파일", "EPUB 파일", "평생 재다운로드"] },
      ],
      workDuration: "즉시 다운로드 (결제 후 자동 발송)",
      refundPolicy: "다운로드 전: 100% 환불 가능 / 다운로드 후: 디지털 상품 특성상 환불 불가 (소비자보호법 17조 2항 5호)",
      imageGuide,
    };
  }

  // === B. AI 책 제작 외주 서비스 ===
  let title = `AI로 1시간 만에 ${book.type} 한국어 전자책 제작해드립니다`;
  if (title.length > 60) title = title.slice(0, 57) + "...";

  const lines: string[] = [];
  lines.push("# AI로 빠르게 한국어 전자책 제작해드립니다");
  lines.push("");
  lines.push("> 주제만 주시면 12챕터 본문 + 표지 + 마케팅 자료까지 한 번에.");
  lines.push("");
  lines.push("## 제공 서비스");
  lines.push("- 12~20챕터 본문 자동 작성 (Claude/GPT-4 기반)");
  lines.push("- 표지 디자인 (한국어 정확, 1600×2560)");
  lines.push("- PDF / EPUB 두 가지 포맷");
  lines.push("- Meta 광고 패키지 (헤드라인 + 본문 + 카피)");
  lines.push("- 인스타·블로그·카카오 리퍼포즈 카피");
  lines.push("");
  lines.push("## 작업 흐름");
  lines.push("1. **1일차**: 주제 + 자료 + 톤 전달 받기");
  lines.push("2. **2일차**: AI 자동 생성 + 1차 검수");
  lines.push("3. **3일차**: 톤 조정 + 최종 PDF/EPUB 전달");
  lines.push("");
  lines.push("## 제작 사례 (참고용)");
  lines.push(`- **${book.topic}** (${book.type}) — ${book.targetPages}쪽 / ${chapterCount}챕터`);
  if (tagline) lines.push(`  > ${tagline}`);
  lines.push("");
  lines.push("## 패키지 비교");
  lines.push("| | STANDARD | DELUXE | PREMIUM |");
  lines.push("|---|---|---|---|");
  lines.push("| 본문 | ✓ | ✓ | ✓ |");
  lines.push("| 표지 | ✓ | ✓ | ✓ |");
  lines.push("| Meta 광고 카피 | - | ✓ | ✓ |");
  lines.push("| SNS 리퍼포즈 | - | ✓ | ✓ |");
  lines.push("| 오디오북 (TTS) | - | - | ✓ |");
  lines.push("| 강의 슬라이드 | - | - | ✓ |");
  lines.push("");
  lines.push("## 작가 소개");
  lines.push(`**${authorName}** — 자체 AI 출판 시스템 운영자`);
  if (authorBio) lines.push(authorBio);
  lines.push("");
  lines.push("## 자주 묻는 질문");
  lines.push("**Q. 저작권은 누구에게 있나요?**");
  lines.push("A. 100% 의뢰자(고객)에게 있습니다. 자유롭게 판매·배포 가능합니다.");
  lines.push("");
  lines.push("**Q. 분량은 얼마나 되나요?**");
  lines.push("A. 기본 100~200쪽. 추가 분량 협의 가능합니다.");
  lines.push("");
  lines.push("**Q. 수정 횟수는?**");
  lines.push("A. STANDARD 1회 / DELUXE 2회 / PREMIUM 무제한.");
  lines.push("");
  lines.push("**Q. AI 생성임을 명시해야 하나요?**");
  lines.push("A. 의뢰자 판단입니다. KDP는 AI 명시 권장, 한국 채널은 의무 X.");

  const description = lines.join("\n");

  const imageGuide: string[] = [
    "메인 이미지: 서비스 배너 (1080×1080) — '1시간 AI 전자책' 카피",
    "추가 이미지 1: 본인이 만든 책 표지 모음 (포트폴리오)",
    "추가 이미지 2: 패키지 비교 표 (STANDARD/DELUXE/PREMIUM)",
    "추가 이미지 3: 작업 흐름 인포그래픽 (3일차 타임라인)",
    "추가 이미지 4: 샘플 본문 / 목차 미리보기",
    "추가 이미지 5: 후기 / Before-After (선택)",
  ];

  return {
    title,
    category1: "전자책",
    category2: "전자책 제작 대행",
    description,
    keywords: extractKeywords(book).concat(["AI", "전자책제작", "외주", "대행", "ChatGPT"]).slice(0, 15),
    prices: [
      { name: "STANDARD", price: 30000, included: ["본문 12챕터", "표지 1종", "PDF + EPUB"] },
      { name: "DELUXE", price: 50000, included: ["STANDARD 전부", "Meta 광고 카피", "SNS 리퍼포즈 카피"] },
      { name: "PREMIUM", price: 100000, included: ["DELUXE 전부", "오디오북 TTS", "강의 슬라이드 20장"] },
    ],
    workDuration: "1~3일 (STANDARD 1일 / DELUXE 2일 / PREMIUM 3일)",
    refundPolicy: "작업 시작 전: 100% 환불 / 작업 시작 후: 진행 단계별 부분 환불 (50% / 30% / 0%)",
    imageGuide,
  };
}

export default function KmongListingHelperPage() {
  const router = useRouter();
  const { status } = useSession();
  const [mode, setMode] = useState<Mode>("ebook");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [bookData, setBookData] = useState<ProjectFull | null>(null);
  const [otherBooks, setOtherBooks] = useState<ProjectSummary[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login?next=/kmong-listing-helper");
      return;
    }
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("프로젝트 로드 실패"))))
      .then((d) => {
        const list = (d.projects ?? []).filter((p: any) => !p.archived);
        setProjects(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }, [status, router]);

  useEffect(() => {
    if (!selectedId) {
      setBookData(null);
      setOtherBooks([]);
      return;
    }
    fetch(`/api/projects/${selectedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) setBookData(p);
      })
      .catch(() => setBookData(null));
    setOtherBooks(projects.filter((p) => p.id !== selectedId).slice(0, 5));
  }, [selectedId, projects]);

  const generated = useMemo<GeneratedListing | null>(() => {
    if (!bookData) return null;
    return generateKmongListing(bookData, mode);
  }, [bookData, mode]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const downloadImage = (base64: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${base64}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const coverImg = bookData?.kmongPackage?.images?.find((i) => i.type === "cover");
  const extraImgs = (bookData?.kmongPackage?.images ?? []).filter((i) => i.type !== "cover");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <section className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">📦 크몽 등록 도우미</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            책 1권 → 크몽 서비스 등록 양식 자동 채우기. 시나리오 선택 후 책을 고르면, 제목 / 카테고리 / 본문 / 키워드 / 가격까지 모두 자동 생성됩니다.
          </p>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">{error}</div>
        )}

        {/* Mode toggle */}
        <section className="bg-white border border-gray-200 rounded-2xl p-2 mb-6 flex gap-2">
          <button
            onClick={() => setMode("ebook")}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition ${
              mode === "ebook"
                ? "bg-tiger-orange text-white shadow-md"
                : "bg-transparent text-gray-600 hover:bg-gray-100"
            }`}
          >
            📕 전자책 판매 (자기 책)
          </button>
          <button
            onClick={() => setMode("service")}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition ${
              mode === "service"
                ? "bg-tiger-orange text-white shadow-md"
                : "bg-transparent text-gray-600 hover:bg-gray-100"
            }`}
          >
            🛠️ AI 책 제작 외주
          </button>
        </section>

        {/* Mode hint */}
        <section className="bg-orange-50/60 border border-orange-200 rounded-xl p-4 mb-6 text-sm text-gray-700">
          {mode === "ebook" ? (
            <p>
              <strong className="text-orange-900">전자책 판매 모드</strong> — 본인이 만든 책 1권을 PDF/EPUB로 즉시 판매. 단일 가격, 즉시 다운로드 형태로 등록합니다.
            </p>
          ) : (
            <p>
              <strong className="text-orange-900">AI 책 제작 외주 모드</strong> — 의뢰자 책을 우리 시스템으로 만들어주는 서비스. 3패키지 (STANDARD/DELUXE/PREMIUM), 1~3일 작업.
            </p>
          )}
        </section>

        {/* Book selector */}
        <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">📖 본인 책 선택</label>
          {projects.length === 0 ? (
            <div className="text-sm text-gray-500">
              아직 책이 없습니다.{" "}
              <Link href="/new" className="text-orange-600 hover:underline font-bold">+ 새 책 만들기</Link>
            </div>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.topic} ({p.type})
                </option>
              ))}
            </select>
          )}

          {bookData && (
            <div className="mt-4 flex items-start gap-4">
              {coverImg ? (
                <img
                  src={`data:image/png;base64,${coverImg.base64}`}
                  alt="표지"
                  className="w-20 h-28 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-20 h-28 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                  표지 없음
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{bookData.topic}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bookData.type} · {bookData.targetPages}쪽 · {bookData.chapters?.length ?? 0}챕터
                </p>
                <p className="text-xs text-gray-600 mt-1 truncate">대상: {bookData.audience}</p>
              </div>
            </div>
          )}
        </section>

        {/* Generated listing */}
        {generated && bookData && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mt-2 mb-3">📝 자동 생성된 등록 정보</h2>

            {/* 1. 서비스 제목 */}
            <FieldCard
              title="서비스 제목"
              hint={`크몽 양식 50~60자 이내 (현재 ${generated.title.length}자)`}
              copyText={generated.title}
              copyKey="title"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{generated.title}</div>
            </FieldCard>

            {/* 2. 카테고리 */}
            <FieldCard
              title="카테고리 추천"
              hint="크몽: 1차 카테고리 → 2차 카테고리 순 선택"
              copyText={`1차: ${generated.category1}\n2차: ${generated.category2}`}
              copyKey="category"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-[10px] text-gray-500 font-bold mb-0.5">1차</div>
                  <div className="font-bold text-gray-900">{generated.category1}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-[10px] text-gray-500 font-bold mb-0.5">2차</div>
                  <div className="font-bold text-gray-900">{generated.category2}</div>
                </div>
              </div>
            </FieldCard>

            {/* 3. 서비스 본문 */}
            <FieldCard
              title="서비스 본문 (마크다운)"
              hint={`크몽 에디터에 그대로 붙여넣기 (${generated.description.length}자)`}
              copyText={generated.description}
              copyKey="description"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <pre className="text-xs text-gray-800 bg-gray-50 p-3 rounded whitespace-pre-wrap max-h-96 overflow-y-auto font-sans">
                {generated.description}
              </pre>
            </FieldCard>

            {/* 4. 키워드 */}
            <FieldCard
              title="키워드"
              hint={`크몽 양식: 8~15개 (현재 ${generated.keywords.length}개) — 콤마로 구분`}
              copyText={generated.keywords.join(", ")}
              copyKey="keywords"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <div className="flex flex-wrap gap-2">
                {generated.keywords.map((k) => (
                  <span
                    key={k}
                    className="text-xs px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-800 rounded-full font-medium"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </FieldCard>

            {/* 5. 가격 정보 */}
            <FieldCard
              title="가격 정보"
              hint={mode === "ebook" ? "단일 가격 (즉시 다운로드)" : "3패키지 비교"}
              copyText={generated.prices
                .map((p) => `[${p.name}] ₩${p.price.toLocaleString()}\n포함: ${p.included.join(", ")}`)
                .join("\n\n")}
              copyKey="prices"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <div className="space-y-2">
                {generated.prices.map((p) => (
                  <div key={p.name} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900">{p.name}</span>
                      <span className="font-extrabold text-tiger-orange">₩{p.price.toLocaleString()}</span>
                    </div>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {p.included.map((i) => (
                        <li key={i}>• {i}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </FieldCard>

            {/* 6. 작업 기간 */}
            <FieldCard
              title="작업 기간"
              hint="크몽 양식: 작업 일수"
              copyText={generated.workDuration}
              copyKey="duration"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{generated.workDuration}</div>
            </FieldCard>

            {/* 7. 환불 정책 */}
            <FieldCard
              title="환불 정책"
              hint="크몽 양식: 환불 규정"
              copyText={generated.refundPolicy}
              copyKey="refund"
              copiedKey={copiedKey}
              onCopy={copy}
            >
              <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                {generated.refundPolicy}
              </div>
            </FieldCard>

            {/* 8. 이미지 가이드 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3">
                <h3 className="font-bold text-gray-900">이미지 가이드</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  크몽 메인 이미지 1장 + 추가 이미지 5~10장 권장
                </p>
              </div>

              <ul className="space-y-1.5 text-sm text-gray-700 mb-4">
                {generated.imageGuide.map((g, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-orange-500 font-bold">{i + 1}.</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>

              {/* 다운로드 가능 이미지 */}
              {(coverImg || extraImgs.length > 0) && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h4 className="text-xs font-bold text-gray-500 mb-2">📥 본 책에서 사용할 수 있는 이미지</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {coverImg && (
                      <ImageDownload
                        label="표지"
                        base64={coverImg.base64}
                        filename={`${bookData.topic}-cover.png`}
                        onDownload={downloadImage}
                      />
                    )}
                    {extraImgs.map((img, i) => (
                      <ImageDownload
                        key={i}
                        label={IMAGE_TYPE_LABEL[img.type] ?? img.type}
                        base64={img.base64}
                        filename={`${bookData.topic}-${img.type}.png`}
                        onDownload={downloadImage}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!coverImg && extraImgs.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                  ⚠️ 이 책에는 아직 생성된 이미지가 없습니다.{" "}
                  <Link href={`/write`} className="underline font-bold">
                    /write에서 표지/패키지 이미지 생성
                  </Link>
                </div>
              )}
            </div>

            {/* 9. 작품 (사례) - 외주 모드에서만 */}
            {mode === "service" && otherBooks.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3">
                  <h3 className="font-bold text-gray-900">작품 (이전 작업 사례)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    크몽 '작품' 섹션에 본인이 만든 다른 책들을 사례로 등록하세요
                  </p>
                </div>
                <div className="space-y-2">
                  {otherBooks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-gray-900 truncate">{b.topic}</div>
                        <div className="text-xs text-gray-500">{b.type} · {b.targetPages}쪽</div>
                      </div>
                      <Link
                        href={`/projects/${b.id}`}
                        className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded font-bold hover:bg-black"
                      >
                        보기
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 외부 링크 */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5 text-sm">
              <h3 className="font-bold text-blue-900 mb-2">🔗 다음 단계</h3>
              <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                <li>위 정보를 모두 복사 / 다운로드</li>
                <li>
                  <a
                    href="https://kmong.com/seller/services/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-bold"
                  >
                    크몽 서비스 등록 페이지 →
                  </a>
                </li>
                <li>각 섹션에 위 자동 생성된 내용을 붙여넣기</li>
                <li>이미지 업로드 (메인 1 + 추가 5~10장)</li>
                <li>등록 → 크몽 검수 (1~3일) → 노출 시작</li>
              </ol>
            </div>
          </section>
        )}

        <section className="mt-8 bg-gray-50 border border-gray-200 rounded-2xl p-5 text-xs text-gray-600">
          <h3 className="font-bold text-gray-900 mb-2 text-sm">⚠️ 주의사항</h3>
          <ul className="space-y-1">
            <li>• 자동 생성된 본문/키워드는 시작점입니다 — 본인 톤으로 다듬어 등록하세요</li>
            <li>• 크몽은 외주 서비스 카테고리 정책이 자주 변경됩니다 — 등록 전 카테고리 재확인</li>
            <li>• AI 생성 책 명시 의무: 한국 채널은 현재 의무 X (의뢰자 판단)</li>
            <li>• 환불 분쟁 예방 — 패키지별 작업 단계 명확히 안내</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function FieldCard({
  title,
  hint,
  copyText,
  copyKey,
  copiedKey,
  onCopy,
  children,
}: {
  title: string;
  hint: string;
  copyText: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>
        <button
          onClick={() => onCopy(copyText, copyKey)}
          className="flex-shrink-0 text-xs px-3 py-1.5 bg-tiger-orange text-white rounded font-bold hover:bg-orange-600 transition"
        >
          {copiedKey === copyKey ? "✓ 복사됨" : "📋 복사"}
        </button>
      </div>
      {children}
    </div>
  );
}

function ImageDownload({
  label,
  base64,
  filename,
  onDownload,
}: {
  label: string;
  base64: string;
  filename: string;
  onDownload: (base64: string, filename: string) => void;
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex flex-col items-center gap-1.5">
      <img
        src={`data:image/png;base64,${base64}`}
        alt={label}
        className="w-full aspect-square object-cover rounded"
      />
      <div className="text-[10px] font-bold text-gray-700">{label}</div>
      <button
        onClick={() => onDownload(base64, filename)}
        className="w-full text-[10px] px-2 py-1 bg-gray-900 text-white rounded font-bold hover:bg-black"
      >
        ↓ 다운로드
      </button>
    </div>
  );
}

// /external-publishing — KDP / 리디 / 교보 / 알라딘 통합 가이드
// 정적 가이드 + 책 정보 자동 fill (AI 호출 X)
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

type ChannelKey = "kdp" | "ridi" | "kyobo" | "aladdin";

interface ProjectSummary {
  id: string;
  topic: string;
  audience: string;
  type: string;
  targetPages: number;
  archived?: boolean;
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
  };
  chapters?: Array<{ title: string }>;
}

// 책 type → 각 채널 추천 카테고리
const TYPE_TO_CATEGORY: Record<string, Record<ChannelKey, string>> = {
  "자기계발서": { kdp: "Self-Help / Personal Development", ridi: "자기계발", kyobo: "자기계발", aladdin: "자기계발" },
  "실용서":   { kdp: "Reference / How-to",                ridi: "실용/취미", kyobo: "실용", aladdin: "실용/생활" },
  "에세이":   { kdp: "Literature & Fiction / Essays",     ridi: "에세이",   kyobo: "에세이", aladdin: "에세이" },
  "매뉴얼":   { kdp: "Reference / Manuals",               ridi: "비즈니스", kyobo: "비즈니스", aladdin: "경영/경제" },
  "재테크":   { kdp: "Business & Money",                  ridi: "경제/경영", kyobo: "경제경영", aladdin: "경제경영" },
  "웹소설":   { kdp: "Literature & Fiction",              ridi: "장르소설", kyobo: "소설",   aladdin: "소설/시" },
  "전문서":   { kdp: "Education / Professional",          ridi: "인문/사회", kyobo: "인문",   aladdin: "인문/사회" },
};

// 분량 기반 가격 추천 (KDP USD / 한국채널 KRW 전자책 기준)
function recommendPrice(targetPages: number): { kdpUSD: string; korEbookKRW: string } {
  if (targetPages <= 80)  return { kdpUSD: "$2.99 ~ $4.99", korEbookKRW: "₩4,500 ~ ₩7,000" };
  if (targetPages <= 150) return { kdpUSD: "$4.99 ~ $7.99", korEbookKRW: "₩7,000 ~ ₩11,000" };
  if (targetPages <= 250) return { kdpUSD: "$6.99 ~ $9.99", korEbookKRW: "₩10,000 ~ ₩14,000" };
  return                   { kdpUSD: "$9.99 ~ $14.99", korEbookKRW: "₩13,000 ~ ₩18,000" };
}

const CHANNELS: Array<{
  key: ChannelKey;
  emoji: string;
  name: string;
  blurb: string;
  url: string;
  steps: string[];
  notes: string[];
}> = [
  {
    key: "kdp",
    emoji: "📕",
    name: "Amazon KDP",
    blurb: "전 세계 1위 전자책·POD 종이책 플랫폼. 영문 출판하면 글로벌 노출.",
    url: "https://kdp.amazon.com",
    steps: [
      "kdp.amazon.com 접속 → 가입 (아마존 계정 사용 가능)",
      "Tax interview 완료 (한국 거주자 W-8BEN, ITIN 없어도 OK)",
      "Bookshelf → '+ Create' → 'Kindle eBook' 또는 'Paperback' 선택",
      "1단계 (Details): 제목, 부제, 저자, 카테고리, 키워드(7개), 설명(4000자) 입력",
      "2단계 (Content): EPUB 또는 PDF 업로드 + 표지 PNG/JPG (1600x2560 권장)",
      "3단계 (Pricing): KDP Select 등록 여부 + 가격 ($2.99~$9.99 70% 로열티 구간)",
      "Publish → 24~72시간 내 출시. ASIN 발급 → amazon.com/dp/[ASIN]",
    ],
    notes: [
      "Tigerbookmaker EPUB/PDF 그대로 업로드 가능",
      "표지는 별도 — Tigerbookmaker 표지(1600x2560 비율) 사용",
      "한국어 책도 가능 (Kindle 일본 스토어 노출)",
      "POD 종이책: ISBN 무료 제공 (KDP free ISBN 옵션)",
    ],
  },
  {
    key: "ridi",
    emoji: "📘",
    name: "리디북스",
    blurb: "한국 1위 전자책 플랫폼. EPUB 표준. 작가 등록 후 셀프 업로드.",
    url: "https://ridibooks.com/partners",
    steps: [
      "ridibooks.com/partners → 작가 신청 (PD ID 신청, 1~3일 심사)",
      "승인 후 RIDI Studio (작가 페이지) 접속 → '+ 새 책 등록'",
      "1단계: 책 정보 입력 (제목, 부제, 저자, 출판사, 분류, 대상독자)",
      "2단계: 본문 EPUB 업로드 + 표지 (600x900 이상)",
      "3단계: 가격 설정 (₩1,000 단위, 리디 수수료 30%)",
      "4단계: 검수 신청 → 1~5일 후 출시",
    ],
    notes: [
      "EPUB 표준 준수 (Tigerbookmaker EPUB 즉시 사용 가능)",
      "전자책만 가능 (종이책 없음)",
      "'리디셀렉트' 정기구독 등록 시 추가 수익",
      "마케팅 페이지 풍부할수록 노출 ↑ (소개글 자세히)",
    ],
  },
  {
    key: "kyobo",
    emoji: "📗",
    name: "교보문고",
    blurb: "한국 종합 서점 1위. POD 종이책 + 전자책 + 오디오북 모두 가능.",
    url: "https://pubple.kyobobook.co.kr",
    steps: [
      "pubple.kyobobook.co.kr (퍼플) → 작가 가입 (사업자 없어도 개인 가능)",
      "본인 인증 + 정산 계좌 등록 (1일 내 활성화)",
      "'책 출간하기' → POD/eBook 선택",
      "원고 업로드 (PDF for POD / EPUB for eBook), 표지 업로드",
      "ISBN 무료 발급 신청 (필수, 1~3일 소요)",
      "가격·분류·소개 입력 → 검수 → 출시 (5~10일)",
    ],
    notes: [
      "POD: 1권 주문 시 인쇄 → 재고 부담 X",
      "교보 단독 + 알라딘/예스24 동시 유통 옵션 (퍼플)",
      "정가 10,000원 책 = 인세 약 25% (₩2,500/권 POD)",
      "오디오북도 같은 작가 계정에서 등록 가능",
    ],
  },
  {
    key: "aladdin",
    emoji: "📙",
    name: "알라딘",
    blurb: "한국 도서 중고시장 + POD 종이책 + 전자책. 인디 작가 친화적.",
    url: "https://author.aladin.co.kr",
    steps: [
      "author.aladin.co.kr → 작가 가입 (개인 가능)",
      "신분증 인증 + 정산 계좌 등록",
      "'책 등록하기' → POD/eBook 선택",
      "원고 PDF/EPUB 업로드 + 표지 업로드",
      "ISBN 발급 (무료 옵션 있음)",
      "가격·소개·키워드 입력 → 검수 → 출시 (3~7일)",
    ],
    notes: [
      "POD 인쇄 품질 우수 (블루보드/POD 라인)",
      "전자책은 알라딘 e북 단말기와 호환",
      "도서 리뷰 커뮤니티 활성 — 초기 마케팅 도움",
      "인디 출판 카테고리 별도 노출",
    ],
  },
];

export default function ExternalPublishingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedFull, setSelectedFull] = useState<ProjectFull | null>(null);
  const [openChannel, setOpenChannel] = useState<ChannelKey | null>("kdp");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login?next=/external-publishing");
      return;
    }
    fetch("/api/projects")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("프로젝트 로드 실패")))
      .then(d => {
        const list = (d.projects ?? []).filter((p: any) => !p.archived);
        setProjects(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(e => setError(e.message));
  }, [status, router]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedFull(null);
      return;
    }
    fetch(`/api/projects/${selectedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => p && setSelectedFull(p))
      .catch(() => setSelectedFull(null));
  }, [selectedId]);

  const priceRec = useMemo(() => {
    return recommendPrice(selectedFull?.targetPages ?? 120);
  }, [selectedFull]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const buildChannelInfo = (ch: ChannelKey): string => {
    if (!selectedFull) return "";
    const cat = TYPE_TO_CATEGORY[selectedFull.type]?.[ch] ?? "—";
    const desc = selectedFull.marketingMeta?.description ?? "";
    const tagline = selectedFull.marketingMeta?.tagline ?? "";
    const price = ch === "kdp" ? priceRec.kdpUSD : priceRec.korEbookKRW;
    return [
      `[제목] ${selectedFull.topic}`,
      tagline ? `[부제/태그라인] ${tagline}` : "",
      `[대상 독자] ${selectedFull.audience}`,
      `[카테고리 추천] ${cat}`,
      `[추천 가격] ${price}`,
      `[분량] ${selectedFull.targetPages} 쪽 / ${selectedFull.chapters?.length ?? 0} 챕터`,
      "",
      `[소개글]`,
      desc || "(아직 마케팅 메타 생성 X — /write 페이지에서 생성하세요)",
    ].filter(Boolean).join("\n");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">📚 외부 채널 출판 가이드</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Tigerbookmaker로 만든 책을 Amazon KDP, 리디북스, 교보문고, 알라딘에 등록하는 단계별 가이드입니다.
            아래에서 책을 선택하면 채널별 추천 카테고리·가격·소개글이 자동으로 채워집니다.
          </p>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">{error}</div>
        )}

        <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">📖 본인 책 선택</label>
          {projects.length === 0 ? (
            <div className="text-sm text-gray-500">
              아직 책이 없습니다. <Link href="/new" className="text-orange-600 hover:underline font-bold">+ 새 책 만들기</Link>
            </div>
          ) : (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.topic} ({p.type})</option>
              ))}
            </select>
          )}

          {selectedFull && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="유형" value={selectedFull.type} />
              <Stat label="대상" value={selectedFull.audience} truncate />
              <Stat label="분량" value={`${selectedFull.targetPages}쪽`} />
              <Stat label="챕터" value={`${selectedFull.chapters?.length ?? 0}장`} />
            </div>
          )}
        </section>

        <section className="space-y-4">
          {CHANNELS.map(ch => {
            const open = openChannel === ch.key;
            const cat = selectedFull ? TYPE_TO_CATEGORY[selectedFull.type]?.[ch.key] ?? "—" : "—";
            const price = ch.key === "kdp" ? priceRec.kdpUSD : priceRec.korEbookKRW;
            const infoKey = `info-${ch.key}`;
            return (
              <article key={ch.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenChannel(open ? null : ch.key)}
                  className="w-full p-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-3xl">{ch.emoji}</span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-gray-900">{ch.name}</h2>
                      <p className="text-xs text-gray-500 truncate">{ch.blurb}</p>
                    </div>
                  </div>
                  <span className={`text-xl text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                </button>

                {open && (
                  <div className="px-5 pb-5 border-t border-gray-100 space-y-4">
                    {selectedFull && (
                      <div className="mt-4 bg-orange-50/60 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <h3 className="font-bold text-sm text-orange-900">📋 자동 채워진 책 정보</h3>
                          <button
                            onClick={() => copy(buildChannelInfo(ch.key), infoKey)}
                            className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-bold"
                          >
                            {copiedKey === infoKey ? "✓ 복사됨" : "📋 정보 복사"}
                          </button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 text-xs">
                          <KV k="제목" v={selectedFull.topic} />
                          <KV k="카테고리 추천" v={cat} />
                          <KV k="대상 독자" v={selectedFull.audience} />
                          <KV k="추천 가격" v={price} />
                        </div>
                        {selectedFull.marketingMeta?.description && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-orange-700 hover:underline font-bold">소개글 미리보기</summary>
                            <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">
                              {selectedFull.marketingMeta.description}
                            </p>
                          </details>
                        )}
                      </div>
                    )}

                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-2">단계별 가이드</h3>
                      <ol className="space-y-2 text-sm text-gray-700">
                        {ch.steps.map((s, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-2">💡 참고 사항</h3>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {ch.notes.map((n, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-orange-500">•</span>
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <a
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-lg transition text-sm"
                    >
                      → {ch.name} 작가 페이지 열기
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-8 bg-blue-50/60 border border-blue-200 rounded-2xl p-5 text-sm">
          <h3 className="font-bold text-blue-900 mb-2">⚠️ 일반 주의사항</h3>
          <ul className="space-y-1 text-gray-700">
            <li>• 같은 책을 여러 채널에 등록할 때 ISBN은 채널별로 다르게 (또는 한 ISBN으로 단일 유통)</li>
            <li>• AI 생성 책 명시 의무 — 일부 플랫폼 (KDP는 명시 권장, 한국 채널은 아직 의무 X)</li>
            <li>• 저작권 — Tigerbookmaker로 만든 책 저작권은 100% 사용자 본인에게 있습니다</li>
            <li>• 정산 주기 — KDP 60일, 리디 35일, 교보·알라딘 30일 (대략)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
      <div className="text-[10px] text-gray-500 font-bold mb-0.5">{label}</div>
      <div className={`text-sm font-bold text-gray-900 ${truncate ? "truncate" : ""}`}>{value}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-gray-500 font-bold">{k}: </span>
      <span className="text-gray-900">{v}</span>
    </div>
  );
}

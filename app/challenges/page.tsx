// /challenges — 작가 등급 + 진행 중 챌린지 (Wave C4)
// 동기부여 + retention. 챌린지는 정보성 — 보너스 지급은 manual.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";

interface Badges {
  bookCount: number;
  seriesCount: number;
  totalRevenueKRW: number;
  level: string;
  levelEmoji: string;
  levelBlurb: string;
  nextLevel: string | null;
  nextLevelEmoji: string | null;
  nextLevelTarget: string;
  progress: number; // 0..1
}

interface Challenge {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  reward: string;
  howTo: string;
  cta?: { label: string; href: string };
}

const CHALLENGES: Challenge[] = [
  {
    id: "30day-1book",
    emoji: "🚀",
    title: "30일 1권 챌린지",
    blurb: "30일 안에 책 1권 완성. 새 작가 추천 챌린지.",
    reward: "₩2,000 보너스",
    howTo: "신규 책 생성 후 30일 안에 모든 챕터 완성 → 카톡으로 신청",
    cta: { label: "+ 새 책 만들기", href: "/new" },
  },
  {
    id: "series-master",
    emoji: "📚",
    title: "시리즈 마스터",
    blurb: "한 시리즈 안에서 책 5권 출간 — 시리즈 작가 인증.",
    reward: "₩10,000 보너스",
    howTo: "같은 시리즈에 책 5권 등록 → 시리즈 페이지에서 신청",
    cta: { label: "내 시리즈", href: "/series" },
  },
  {
    id: "invite-5",
    emoji: "🤝",
    title: "친구 5명 초대",
    blurb: "추천 코드로 친구 5명 가입 시. Referral 시스템 연동.",
    reward: "₩5,000 보너스",
    howTo: "프로필 → 추천 코드 공유 → 5명이 가입 + 첫 충전 완료",
    cta: { label: "내 추천 코드", href: "/profile" },
  },
  {
    id: "first-revenue",
    emoji: "💰",
    title: "첫 매출 인증",
    blurb: "어느 채널이든 첫 ₩50,000 매출 달성 — 작가 데뷔.",
    reward: "₩3,000 보너스",
    howTo: "/write에서 매출 입력 → 합계 ₩50,000+ → 카톡으로 인증샷",
    cta: { label: "내 책", href: "/projects" },
  },
];

export default function ChallengesPage() {
  const router = useRouter();
  const { status } = useSession();
  const [badges, setBadges] = useState<Badges | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login?next=/challenges");
      return;
    }
    fetch("/api/profile/badges")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("등급 정보 로드 실패")))
      .then(d => setBadges(d.badges))
      .catch(e => setError(e.message));
  }, [status, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <section className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">🏆 작가 챌린지</h1>
          <p className="text-gray-600">등급을 올리고 챌린지에 도전해 보너스를 받으세요.</p>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">{error}</div>
        )}

        {badges === null && !error && (
          <div className="text-gray-400 animate-pulse text-center py-12">불러오는 중…</div>
        )}

        {badges && (
          <>
            {/* 현재 등급 카드 */}
            <section className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-6 mb-8 shadow-sm">
              <div className="flex items-start gap-4 mb-4 flex-wrap">
                <div className="text-6xl">{badges.levelEmoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-orange-700 mb-1">현재 등급</div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">{badges.level}</h2>
                  <p className="text-sm text-gray-600 mt-1">{badges.levelBlurb}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="완성한 책" value={`${badges.bookCount}권`} />
                <Stat label="시리즈" value={`${badges.seriesCount}개`} />
                <Stat label="누적 매출" value={`₩${badges.totalRevenueKRW.toLocaleString()}`} />
              </div>

              {badges.nextLevel && (
                <div className="bg-white rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="text-sm">
                      <span className="text-gray-500">다음 등급: </span>
                      <span className="font-bold text-gray-900">
                        {badges.nextLevelEmoji} {badges.nextLevel}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-orange-700">
                      {Math.round(badges.progress * 100)}% 진행
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, badges.progress * 100))}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    승급 조건: <span className="font-bold text-gray-900">{badges.nextLevelTarget}</span>
                  </div>
                </div>
              )}

              {!badges.nextLevel && (
                <div className="bg-white rounded-xl p-4 border border-orange-200 text-center">
                  <div className="text-2xl mb-2">👑</div>
                  <div className="font-bold text-gray-900">최고 등급 달성!</div>
                  <div className="text-xs text-gray-500 mt-1">다음 시즌 마스터 챌린지를 기대해주세요.</div>
                </div>
              )}
            </section>

            {/* 진행 중 챌린지 */}
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">⚡ 진행 중인 챌린지</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {CHALLENGES.map(c => (
                  <article key={c.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-orange-300 hover:shadow-md transition">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-3xl flex-shrink-0">{c.emoji}</div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900">{c.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{c.blurb}</p>
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3">
                      <div className="text-[10px] font-bold text-orange-700">보너스</div>
                      <div className="text-sm font-extrabold text-orange-900">{c.reward}</div>
                    </div>
                    <div className="text-xs text-gray-600 mb-3">
                      <span className="font-bold text-gray-700">방법: </span>
                      {c.howTo}
                    </div>
                    {c.cta && (
                      <Link
                        href={c.cta.href}
                        className="inline-block px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded transition"
                      >
                        {c.cta.label}
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {/* 안내 */}
            <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-gray-700">
              <h3 className="font-bold text-blue-900 mb-2">💡 안내</h3>
              <ul className="space-y-1">
                <li>• 등급은 완성한 책 / 시리즈 / 매출에 따라 자동 산정됩니다.</li>
                <li>• 매출은 <Link href="/projects" className="text-orange-600 hover:underline font-bold">/write 페이지</Link>에서 직접 입력한 값을 합산합니다.</li>
                <li>• 챌린지 보너스는 현재 시점에 운영자 수동 지급입니다 — 카톡 채널로 인증해주세요.</li>
                <li>• 추천 시스템은 <Link href="/profile" className="text-orange-600 hover:underline font-bold">/profile</Link>에서 코드를 받을 수 있습니다.</li>
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-orange-200 rounded-xl px-3 py-2 text-center">
      <div className="text-[10px] font-bold text-orange-700 mb-0.5">{label}</div>
      <div className="text-sm font-extrabold text-gray-900 truncate">{value}</div>
    </div>
  );
}

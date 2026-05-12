// NextStepHint — clean-redesign v3 (spec 3.7)
// 책 작업 진행도에 따라 "다음에 할 것"을 자연스럽게 안내.
// 꼬리물기 흐름: 본문 → 표지 → Meta 광고 → 크몽 등록.

import Link from "next/link";

export type WriteStage =
  | "chapters-incomplete"     // 챕터 본문 80% 이하
  | "ready-for-cover"         // 본문 80%+ but 표지 없음
  | "ready-for-ads"           // 본문·표지 완성, 광고 이미지 없음
  | "ready-for-listing"       // 광고 완성, 크몽 등록 패키지 없음
  | "all-done";               // 모두 완성

interface NextStepHintProps {
  bookId: string;
  stage: WriteStage;
}

const STEPS: Record<WriteStage, {
  title: string;
  desc: string;
  cta: { label: string; href: (bookId: string) => string };
  emoji: string;
} | null> = {
  "chapters-incomplete": null, // 진행 중이라 hint 안 띄움
  "ready-for-cover": {
    emoji: "🎨",
    title: "본문 거의 다 됐어요. 표지 만드시겠어요?",
    desc: "AI가 책 정보로 3개 표지 후보 생성. 한 번 호출 ₩900.",
    cta: { label: "표지 만들기 →", href: id => `/write?id=${id}&step=cover` },
  },
  "ready-for-ads": {
    emoji: "📢",
    title: "표지 완성. Meta 광고 이미지 만드시겠어요?",
    desc: "Feed 1:1 · Story 9:16 · Link 1.91:1 — 3개 광고 이미지 한 번에. 헤드라인·CTA 합성 포함.",
    cta: { label: "광고 이미지 만들기 →", href: id => `/write?id=${id}&step=ads` },
  },
  "ready-for-listing": {
    emoji: "📦",
    title: "광고까지 완성. 크몽 등록 패키지 받으시겠어요?",
    desc: "제목 · 상세설명 · 카테고리 · 키워드 · 가격 추천 한 번에. 크몽 등록 화면에 그대로 복붙.",
    cta: { label: "등록 패키지 받기 →", href: id => `/publish?id=${id}` },
  },
  "all-done": {
    emoji: "🎉",
    title: "다 완성. 이제 팔러 가세요.",
    desc: "크몽 등록 후 판매 수익 입력하면 ROI 추적 시작.",
    cta: { label: "내 책 페이지 보기 →", href: id => `/book/${id}` },
  },
};

export function NextStepHint({ bookId, stage }: NextStepHintProps) {
  const step = STEPS[stage];
  if (!step) return null;

  return (
    <div className="rounded-2xl border border-emerald-600/40 bg-emerald-600/5 p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{step.emoji}</span>
        <div className="flex-1">
          <h4 className="font-bold text-ink-900">{step.title}</h4>
          <p className="mt-1 text-sm text-gray-600">{step.desc}</p>
          <Link
            href={step.cta.href(bookId)}
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm min-h-[44px] hover:bg-emerald-700"
          >
            {step.cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

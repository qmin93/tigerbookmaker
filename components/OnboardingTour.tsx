"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// 두 가지 tour:
//   "projects" (default) — /projects 페이지 환영 모달 (기존)
//   "new" — /new 페이지 in-app 안내 (v3 Phase 3.2)
//
// 각 variant는 별도 localStorage key 사용 → 따로 dismiss 가능.

const STORAGE_KEY_PROJECTS = "tigerbookmaker:onboarding:completed:v1";
const STORAGE_KEY_NEW = "tbm_seen_tour_new";

interface Props {
  /** 사용자가 책 1개 이상 보유 → 이미 익숙. tour 안 띄움 (variant=projects일 때만 적용) */
  hasExistingBooks?: boolean;
  /** 사용자 이메일 (welcome 화면 personalize용, optional) */
  userEmail?: string | null;
  /** "projects" = /projects 환영 모달. "new" = /new 페이지 안내 시퀀스 */
  variant?: "projects" | "new";
  /** 강제로 다시 보기 — "다시 보기" 버튼 클릭 시 */
  forceOpen?: boolean;
  /** forceOpen 해제 시 호출 (parent에서 트리거 reset) */
  onClose?: () => void;
}

export function OnboardingTour({ hasExistingBooks = false, userEmail, variant = "projects", forceOpen, onClose }: Props) {
  if (variant === "new") {
    return <NewPageTour forceOpen={forceOpen} onClose={onClose} />;
  }
  return <ProjectsTour hasExistingBooks={hasExistingBooks} userEmail={userEmail} forceOpen={forceOpen} onClose={onClose} />;
}

// ────────────────────────────────────────────
// /projects 환영 모달 (v1 기존)
// ────────────────────────────────────────────

function ProjectsTour({ hasExistingBooks, userEmail, forceOpen, onClose }: {
  hasExistingBooks: boolean;
  userEmail?: string | null;
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    if (hasExistingBooks) return;
    try {
      const completed = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (completed) return;
    } catch { return; }
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [hasExistingBooks, forceOpen]);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY_PROJECTS, new Date().toISOString()); } catch {}
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;

  const totalSteps = 4;
  const next = () => step < totalSteps - 1 ? setStep(step + 1) : finish();
  const prev = () => step > 0 && setStep(step - 1);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={finish}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-tiger-orange transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6 md:p-8">
          {step === 0 && (
            <>
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-2xl font-black text-ink-900 mb-2">환영합니다!</h2>
              <p className="text-base text-gray-700 leading-relaxed mb-4">
                {userEmail ? `${userEmail.split("@")[0]}님, ` : ""}
                Tigerbookmaker는 <b>한국어 전자책을 1시간 만에</b> AI로 완성하는 도구입니다.
              </p>
              <div className="bg-orange-50 border border-tiger-orange/30 rounded-lg p-4 text-sm text-gray-700">
                🎁 가입 보너스 <b className="text-tiger-orange">₩5,000</b>이 이미 적립됐습니다.<br />
                라이트 티어 책 1권을 무료로 만들 수 있어요.
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="text-5xl mb-3">📚</div>
              <h2 className="text-2xl font-black text-ink-900 mb-2">첫 책 시작</h2>
              <p className="text-base text-gray-700 leading-relaxed mb-4">
                <b>&quot;+ 새 프로젝트&quot;</b> 버튼을 눌러 시작합니다.
              </p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>책 주제 한 줄 입력</li>
                <li>대상 독자 (예: 30대 직장인)</li>
                <li>책 유형 선택 (자기계발 · 실용서 · 에세이 등 14종)</li>
                <li>테마 컬러 선택</li>
              </ol>
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-5xl mb-3">⚡</div>
              <h2 className="text-2xl font-black text-ink-900 mb-2">3단계 워크플로</h2>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-tiger-orange text-white font-bold flex items-center justify-center">1</span>
                  <div>
                    <div className="font-bold text-ink-900">자료 업로드 (5분)</div>
                    <div className="text-gray-600">PDF · URL · YouTube · 텍스트 · 이미지 OCR</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-tiger-orange text-white font-bold flex items-center justify-center">2</span>
                  <div>
                    <div className="font-bold text-ink-900">AI 인터뷰 (10분)</div>
                    <div className="text-gray-600">5~7개 질문 답변 + 좋아하는 책 톤 매칭</div>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-tiger-orange text-white font-bold flex items-center justify-center">3</span>
                  <div>
                    <div className="font-bold text-ink-900">본문 + 표지 + 마케팅 (15분)</div>
                    <div className="text-gray-600">12챕터 본문 + 표지 + 광고 카피·이미지 자동</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="text-5xl mb-3">🚀</div>
              <h2 className="text-2xl font-black text-ink-900 mb-2">시작할 준비 완료</h2>
              <p className="text-base text-gray-700 leading-relaxed mb-4">
                실패해도 잔액 차감은 정확하니 부담 없이 시도해 보세요.
              </p>
              <p className="text-sm text-gray-500 mb-2">막히면 마이페이지의 사용내역·잔액 확인 가능.</p>
              <Link
                href="/pricing"
                className="text-xs text-tiger-orange hover:underline"
                onClick={e => e.stopPropagation()}
              >
                💰 기능별 가격표 보기 →
              </Link>
            </>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
            <button
              onClick={finish}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              건너뛰기
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  이전
                </button>
              )}
              <button
                onClick={next}
                className="px-5 py-2 bg-tiger-orange text-white text-sm font-bold rounded-lg hover:bg-orange-600"
              >
                {step === totalSteps - 1 ? "✨ 시작!" : "다음 →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// /new 페이지 in-app 튜토리얼 (v3 Phase 3.2)
// 4-step tooltip 시퀀스. data-tour 속성으로 타겟 요소 찾음.
// 모바일: bottom sheet. 데스크탑: 하단 floating panel + 화살표.
//
// localStorage key: tbm_seen_tour_new
// "다시 보기" 버튼은 /new 페이지가 forceOpen prop으로 트리거.
// ────────────────────────────────────────────

const NEW_TOUR_STEPS = [
  {
    target: "topic",
    title: "주제 한 줄로 시작",
    body: "주제 한 줄만 적으세요. 예: \"아침 루틴 30일\". 길게 안 적어도 OK — 다음 단계에서 자료·인터뷰로 풍부해집니다.",
  },
  {
    target: "audience",
    title: "누가 읽을까요?",
    body: "대상 독자를 한 줄로. 예: \"번아웃 직전 직장인\". 톤·예시 결정에 큰 영향을 줘요.",
  },
  {
    target: "type",
    title: "장르 선택",
    body: "잘 모르겠으면 \"실용서\"가 무난해요. 나중에 바꿀 수 있고, 장르마다 톤·표지·구조가 달라집니다.",
  },
  {
    target: "submit",
    title: "다음 단계로",
    body: "버튼 누르면 자료 업로드·AI 인터뷰 단계로 진입해요. 거기서 책 정보를 풍부하게 채울 수 있어요.",
  },
] as const;

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function NewPageTour({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 모바일 감지
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 첫 방문 자동 오픈 + forceOpen 처리
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY_NEW)) return;
    } catch { return; }
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [forceOpen]);

  // 현재 step의 target 요소 위치 계산 + scroll into view
  useEffect(() => {
    if (!open || isMobile) {
      setRect(null);
      return;
    }
    const targetKey = NEW_TOUR_STEPS[step].target;
    const findAndMeasure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${targetKey}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      setRect({
        top: r.top + scrollY,
        left: r.left,
        width: r.width,
        height: r.height,
      });
      // scroll target into view (centered-ish)
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    findAndMeasure();
    // recompute on resize
    window.addEventListener("resize", findAndMeasure);
    return () => window.removeEventListener("resize", findAndMeasure);
  }, [open, step, isMobile]);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY_NEW, "1"); } catch {}
    setOpen(false);
    setRect(null);
    onClose?.();
  };

  const next = () => {
    if (step < NEW_TOUR_STEPS.length - 1) setStep(step + 1);
    else finish();
  };
  const prev = () => step > 0 && setStep(step - 1);

  if (!open) return null;

  const current = NEW_TOUR_STEPS[step];
  const isLast = step === NEW_TOUR_STEPS.length - 1;

  // 모바일: bottom sheet (스크린 하단에서 슬라이드업)
  if (isMobile) {
    return (
      <>
        {/* 반투명 dim — tap to dismiss */}
        <div
          className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-[2px]"
          onClick={finish}
          aria-hidden
        />
        <div
          className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-2xl shadow-2xl p-5 pb-7"
          role="dialog"
          aria-label={current.title}
        >
          {/* drag handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          {/* progress */}
          <div className="flex items-center gap-1.5 mb-4">
            {NEW_TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition ${i <= step ? "bg-tiger-orange" : "bg-gray-200"}`}
              />
            ))}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-1.5">
            튜토리얼 · {step + 1}/{NEW_TOUR_STEPS.length}
          </div>
          <h3 className="text-lg font-black tracking-tight text-ink-900 mb-2">{current.title}</h3>
          <p className="text-sm text-gray-700 leading-relaxed mb-5">{current.body}</p>
          <div className="flex items-center justify-between gap-2">
            <button onClick={finish} className="text-xs text-gray-500 hover:text-gray-700">
              건너뛰기
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  이전
                </button>
              )}
              <button
                onClick={next}
                className="px-5 py-2 bg-tiger-orange text-white text-sm font-bold rounded-lg hover:bg-orange-600"
              >
                {isLast ? "✨ 끝!" : "다음 →"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // 데스크탑: spotlight overlay + tooltip popover
  return (
    <>
      {/* spotlight backdrop — 대상 요소 외 darken */}
      {rect && (
        <div
          className="fixed inset-0 z-[150] pointer-events-none"
          aria-hidden
          style={{
            background: `radial-gradient(ellipse ${rect.width + 60}px ${rect.height + 60}px at ${rect.left + rect.width / 2}px ${rect.top - window.scrollY + rect.height / 2}px, transparent 0%, transparent 60%, rgba(0,0,0,0.55) 80%)`,
          }}
        />
      )}
      {/* dismiss click-through layer */}
      <div
        className="fixed inset-0 z-[151]"
        onClick={finish}
        aria-hidden
      />
      {/* highlight ring around target */}
      {rect && (
        <div
          className="absolute z-[180] pointer-events-none rounded-lg ring-2 ring-tiger-orange shadow-glow-orange-sm animate-pulse"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      {/* tooltip — 화면 하단 floating panel (고정 위치) */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-[calc(100vw-2rem)] p-5"
        role="dialog"
        aria-label={current.title}
        onClick={e => e.stopPropagation()}
      >
        {/* progress */}
        <div className="flex items-center gap-1.5 mb-3">
          {NEW_TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition ${i <= step ? "bg-tiger-orange" : "bg-gray-200"}`}
            />
          ))}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-tiger-orange mb-1.5">
          튜토리얼 · {step + 1}/{NEW_TOUR_STEPS.length}
        </div>
        <h3 className="text-lg font-black tracking-tight text-ink-900 mb-2">{current.title}</h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">{current.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button onClick={finish} className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1">
            건너뛰기
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                이전
              </button>
            )}
            <button
              onClick={next}
              className="px-5 py-1.5 bg-tiger-orange text-white text-sm font-bold rounded-lg hover:bg-orange-600"
            >
              {isLast ? "✨ 끝!" : "다음 →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "tigerbookmaker:onboarding:completed:v1";

interface Props {
  /** 사용자가 책 1개 이상 보유 → 이미 익숙. tour 안 띄움 */
  hasExistingBooks: boolean;
  /** 사용자 이메일 (welcome 화면 personalize용, optional) */
  userEmail?: string | null;
}

export function OnboardingTour({ hasExistingBooks, userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (hasExistingBooks) return;
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (completed) return;
    } catch { return; }
    // 약간 지연으로 페이지 로드 후 자연스럽게
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [hasExistingBooks]);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch {}
    setOpen(false);
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
                <b>"+ 새 프로젝트"</b> 버튼을 눌러 시작합니다.
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

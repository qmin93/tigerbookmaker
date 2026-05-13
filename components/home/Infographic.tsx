// 인포그래픽 섹션 — "30분 vs 5시간" 시각화
// ROI 시뮬레이터 직전에 배치 — 수치 임팩트 강화.

export function Infographic() {
  return (
    <section className="py-24 md:py-32 border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange">
          <span className="w-6 h-px bg-tiger-orange" />
          숫자로 보는 차이
        </div>
        <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
          30분 = ChatGPT의<br /><span className="text-tiger-orange">1/10 시간</span>.
        </h2>
        <p className="mt-4 text-gray-600 max-w-xl">
          평균적인 직장인이 ChatGPT로 12챕터 책 한 권을 만들면 약 5~8시간.
          Tigerbookmaker는 자동 인터뷰 + RAG + 본문 일괄 생성으로 30분.
        </p>

        {/* 시간 비교 바 차트 */}
        <div className="mt-12 space-y-6">
          {/* ChatGPT 바 */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">ChatGPT 수동 작업</span>
              <span className="font-mono text-2xl font-black text-ink-900">5시간</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gray-400" style={{ width: "100%" }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              주제 정리 → 12챕터 프롬프트 작성 → 챕터별 본문 생성 → 일관성 수동 검토 → 표지 별도 도구 → 마케팅 카피 별도 작업
            </p>
          </div>

          {/* Tigerbookmaker 바 */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-bold text-tiger-orange">Tigerbookmaker 자동</span>
              <span className="font-mono text-2xl font-black text-tiger-orange">30분</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-tiger-orange" style={{ width: "10%" }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              주제 입력 → 5분 인터뷰 → 자동 생성 (목차·12챕터·표지·크몽 패키지)
            </p>
          </div>
        </div>

        {/* 통계 카드 3개 */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="font-mono text-3xl md:text-4xl font-black text-tiger-orange tracking-tight">10x</div>
            <div className="mt-2 text-xs font-mono uppercase tracking-wider text-gray-500">빠른 작성</div>
            <div className="mt-1 text-xs text-gray-600">시간 5h → 30m</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="font-mono text-3xl md:text-4xl font-black text-ink-900 tracking-tight">12<span className="text-base text-gray-400">챕터</span></div>
            <div className="mt-2 text-xs font-mono uppercase tracking-wider text-gray-500">일관성 자동</div>
            <div className="mt-1 text-xs text-gray-600">앞 챕터 요약 주입</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="font-mono text-3xl md:text-4xl font-black text-ink-900 tracking-tight">₩4k<span className="text-base text-gray-400">~</span></div>
            <div className="mt-2 text-xs font-mono uppercase tracking-wider text-gray-500">권당 비용</div>
            <div className="mt-1 text-xs text-gray-600">충전식 · 사용한 만큼</div>
          </div>
          <div className="rounded-2xl border border-tiger-orange/40 bg-orange-50/60 p-5">
            <div className="font-mono text-3xl md:text-4xl font-black text-tiger-orange tracking-tight">10x</div>
            <div className="mt-2 text-xs font-mono uppercase tracking-wider text-tiger-orange">크몽 ROI</div>
            <div className="mt-1 text-xs text-gray-700">₩4k → ₩40k 판매</div>
          </div>
        </div>
      </div>
    </section>
  );
}

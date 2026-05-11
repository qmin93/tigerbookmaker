// FAQ — 결제 직전 마찰을 줄이는 7문항.
// 직장인 부수익러가 ₩4K~₩21K 결제 전 머릿속에 떠올리는 의심들을 풀어줌.
// 네이티브 <details>를 써서 a11y 무료, JS 없이 동작.

const FAQ_ITEMS = [
  {
    q: "AI로 만든 책, 크몽에서 받아주나요?",
    a: "크몽은 'AI 도구로 보조한 인간 저작물'을 허용합니다. 본인 자료를 업로드해서 책을 만들고 본인 명의로 등록하면 정책상 문제없어요. 다만 인터뷰 답변과 챕터 검토는 직접 하는 게 안전합니다 — 100% 자동 생성물을 그대로 등록하면 거절될 수 있어요.",
  },
  {
    q: "저작권은 누구 것인가요?",
    a: "사용자 본인이 100% 보유합니다. 본문, 표지, 마케팅 자료, 광고 카피 모두 회원님 소유예요. Tigerbookmaker는 책 생성 도구일 뿐, 결과물에 어떠한 권리도 주장하지 않습니다.",
  },
  {
    q: "AI 생성물이라고 표시해야 하나요?",
    a: "2026년 기준 한국에서는 법적 의무 없습니다. 크몽도 별도 표시 의무 없음. 단 윤리적 투명성을 중시하는 일부 출판사나 플랫폼은 'AI 도구로 작업' 표기를 권장하기도 해요. 본인 판단에 맡깁니다.",
  },
  {
    q: "회사에서 알면 문제가 되나요?",
    a: "본인 명의로 부수익을 만드는 건 대부분의 회사 규정에서 허용됩니다(겸업 금지 조항 확인 권장). 단 회사의 영업비밀이나 내부 자료를 RAG로 업로드해서 책을 만드는 건 금지될 수 있으니, 본인 지식·취미·외부 공개 자료만 사용하세요.",
  },
  {
    q: "환불은 어떤 조건인가요?",
    a: "사용하지 않은 잔액은 충전일로부터 7일 내 100% 환불(보너스 크레딧 제외). 이미 책을 만들어 차감된 금액은 환불 대상이 아니에요. AI 호출 실패로 차감된 금액은 자동으로 원복됩니다 — 실패한 사용에 대해서는 결제 안 받아요.",
  },
  {
    q: "30분에 진짜 한 권이 나오나요?",
    a: "평균 12~15챕터 책이 25~35분 내 완성됩니다. 인터뷰 답변 시간(약 5분) + AI 처리 시간(20~30분) 합산. 분량이 많거나 RAG 자료가 두꺼우면 더 걸릴 수 있고, 실패 시 자동 재시도라 대기 시간이 늘 수 있어요.",
  },
  {
    q: "권당 ₩4,000인데 정말 그만큼만 나오나요?",
    a: "라이트 시나리오(본문 + 표지) 기준이에요. 마케팅 자료, Meta 광고 카피, 오디오북, 슬라이드를 추가하면 권당 ₩7,400~₩21,300까지 올라갑니다. 충전식이라 사용한 만큼만 차감 — 한 번에 다 살 필요 없어요.",
  },
];

export function FAQ() {
  return (
    <section className="py-24 md:py-32" id="faq">
      <div className="max-w-6xl mx-auto px-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange">
          <span className="w-6 h-px bg-tiger-orange" />
          자주 묻는 질문
        </div>
        <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
          결제 전에<br />궁금하실 것들.
        </h2>
        <p className="mt-3 text-gray-600 max-w-xl">크몽 등록 가능 여부, 저작권, 환불 — 직장인 사용자가 가장 자주 물어보는 7가지.</p>
      </div>
      <div className="mt-12 max-w-3xl mx-auto px-6 divide-y divide-gray-200 border-t border-b border-gray-200">
        {FAQ_ITEMS.map((item, i) => (
          <details key={i} className="group py-5">
            <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
              <span className="flex gap-4 items-start">
                <span className="font-mono text-xs text-tiger-orange pt-1.5 shrink-0 w-6">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-bold text-ink-900 text-base md:text-lg">{item.q}</span>
              </span>
              <span className="text-tiger-orange text-xl leading-none pt-1 select-none transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <div className="mt-3 ml-10 text-gray-600 text-sm md:text-base leading-relaxed">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

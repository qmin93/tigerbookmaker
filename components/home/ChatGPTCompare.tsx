// ChatGPT vs Tigerbookmaker 비교표
// 현재 텍스트만 있는 차별화를 표로 시각화. 결제 직전 confidence ↑.

const ROWS = [
  { feature: "한국어 문체 (해요체·번역투 차단)", chatgpt: "수동 프롬프트", us: "자동" },
  { feature: "본인 자료 학습 (RAG)", chatgpt: "❌", us: "PDF·URL·텍스트" },
  { feature: "12챕터 일관성 (인물·용어·예시)", chatgpt: "매번 재설명", us: "자동 주입" },
  { feature: "표지 이미지 (한글 깨짐 X)", chatgpt: "Korean 깨짐", us: "Sharp 합성" },
  { feature: "크몽 등록 패키지 (제목·설명·태그)", chatgpt: "❌", us: "자동" },
  { feature: "Meta 광고 이미지 3비율", chatgpt: "❌", us: "자동" },
  { feature: "PDF/EPUB/DOCX 즉시 다운로드", chatgpt: "❌", us: "✓" },
  { feature: "전체 소요 시간 (1권)", chatgpt: "5~8시간", us: "30분" },
  { feature: "비용 (1권)", chatgpt: "Plus $20/월", us: "₩4,000부터" },
];

export function ChatGPTCompare() {
  return (
    <section className="py-24 md:py-32 bg-white border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange">
          <span className="w-6 h-px bg-tiger-orange" />
          비교
        </div>
        <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
          ChatGPT vs<br />Tigerbookmaker.
        </h2>
        <p className="mt-4 text-gray-600 max-w-xl">
          ChatGPT로도 책 본문은 만들 수 있어요. 다만 <strong>판매까지 가는 데 필요한 부분</strong>은 직접 해야 해요.
        </p>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b-2 border-ink-900">
                <th className="text-left py-4 text-sm font-mono uppercase tracking-wider text-gray-500"></th>
                <th className="text-center py-4 text-sm font-bold text-gray-500">
                  ChatGPT
                </th>
                <th className="text-center py-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-black text-tiger-orange">
                    🐯 Tigerbookmaker
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 hover:bg-gray-50/50 transition"
                >
                  <td className="py-4 pr-4 text-sm md:text-base text-ink-900">
                    {row.feature}
                  </td>
                  <td className="py-4 px-4 text-center text-sm text-gray-500">
                    {row.chatgpt}
                  </td>
                  <td className="py-4 px-4 text-center text-sm md:text-base font-bold text-tiger-orange">
                    {row.us}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-sm text-gray-500 max-w-xl">
          ⚠️ 비교 기준: ChatGPT Plus ($20/월) + 단일 사용자 단일 책 만들기 시나리오.
          개인 워크플로에 따라 차이는 있을 수 있음.
        </p>
      </div>
    </section>
  );
}

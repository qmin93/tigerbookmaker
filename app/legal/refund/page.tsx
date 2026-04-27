import Link from "next/link";

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-[#fafafa]">
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-headings:text-ink-900 prose-p:text-gray-700">
      <Link href="/" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange no-underline">← 홈</Link>
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2 not-prose">법적 문서</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mt-0">환불 정책</h1>
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider not-prose">최종 개정일: 2026-04-24</p>

      <h2>환불 가능 조건</h2>
      <ul>
        <li><strong>충전 후 7일 내 미사용 잔액</strong>: 100% 환불 가능 (보너스 제외)</li>
        <li>결제 수단(카드)으로 자동 환불 — 영업일 기준 3~5일 소요</li>
      </ul>

      <h2>환불 불가 조건</h2>
      <ul>
        <li>이미 사용한 잔액 (디지털 콘텐츠 사용 후 환불 불가)</li>
        <li>충전 보너스 (이벤트 적립금)</li>
        <li>충전 후 7일 경과</li>
      </ul>

      <h2>환불 요청 방법</h2>
      <ol>
        <li>이메일로 요청: cs@tigerbookmaker.com</li>
        <li>제목: "환불 요청 - [회원 이메일]"</li>
        <li>내용: 결제 일시, 금액, 환불 사유</li>
      </ol>

      <h2>처리 절차</h2>
      <ol>
        <li>환불 요청 접수 (영업일 기준 1일)</li>
        <li>요건 확인 후 승인/반려 통보</li>
        <li>승인 시 결제 수단으로 환불 (3~5 영업일)</li>
      </ol>

      <h2>분쟁 시</h2>
      <p>분쟁이 발생할 경우 전자상거래법 및 소비자분쟁해결기준에 따라 처리됩니다.</p>

      <p className="text-xs text-gray-500 mt-8 not-prose">본 정책은 베타 기간 임시 안이며, 정식 운영 전 법무 검토 후 확정됩니다.</p>
    </div>
    </main>
  );
}

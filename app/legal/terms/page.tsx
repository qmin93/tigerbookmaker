import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fafafa]">
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-headings:text-ink-900 prose-p:text-gray-700">
      <Link href="/" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange no-underline">← 홈</Link>
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2 not-prose">법적 문서</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mt-0">이용약관</h1>
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider not-prose">최종 개정일: 2026-04-24</p>

      <h2>제1조 (목적)</h2>
      <p>본 약관은 Tigerbookmaker(이하 "서비스")가 제공하는 AI 전자책 작성 서비스의 이용 조건과 절차를 규정합니다.</p>

      <h2>제2조 (서비스 내용)</h2>
      <p>본 서비스는 사용자가 입력한 주제·대상 독자를 바탕으로 AI 모델을 활용해 한국어 전자책 원고를 자동 생성합니다.</p>

      <h2>제3조 (회원가입 및 계정)</h2>
      <p>이메일 인증을 통해 회원가입할 수 있으며, 계정 정보의 관리 책임은 회원에게 있습니다.</p>

      <h2>제4조 (결제 및 차감)</h2>
      <p>본 서비스는 선결제 후 사용량에 따라 잔액이 차감되는 방식으로 운영됩니다. 결제는 Toss Payments를 통해 처리됩니다.</p>

      <h2>제5조 (저작권)</h2>
      <p>본 서비스를 통해 생성된 콘텐츠의 저작권은 사용자에게 귀속됩니다. 단, 본 서비스가 사용한 AI 모델의 약관과 한국 저작권법이 적용됩니다.</p>

      <h2>제6조 (금지 사항)</h2>
      <ul>
        <li>본 서비스를 이용해 타인의 명예를 훼손하거나 권리를 침해하는 행위</li>
        <li>불법·유해 콘텐츠 생성</li>
        <li>서비스의 비정상적 사용 (자동화 도구로 대량 호출 등)</li>
      </ul>

      <h2>제7조 (책임 제한)</h2>
      <p>본 서비스는 AI가 생성한 콘텐츠의 정확성·완결성을 보장하지 않으며, 사용자는 출판 전 직접 검토할 책임이 있습니다.</p>

      <h2>제8조 (약관 변경)</h2>
      <p>본 약관은 서비스 정책에 따라 변경될 수 있으며, 변경 시 홈페이지 공지로 안내합니다.</p>

      <h2>제9조 (환불)</h2>
      <p>환불 정책은 별도의 <Link href="/legal/refund">환불 정책</Link> 문서를 따릅니다.</p>

      <p className="text-xs text-gray-500 mt-8 not-prose">본 약관은 베타 기간 임시 안이며, 정식 운영 전 법무 검토 후 확정됩니다.</p>
    </div>
    </main>
  );
}

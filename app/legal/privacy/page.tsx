import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fafafa]">
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-headings:text-ink-900 prose-p:text-gray-700">
      <Link href="/" className="text-xs font-mono uppercase tracking-wider text-gray-500 hover:text-tiger-orange no-underline">← 홈</Link>
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange mt-6 mb-2 not-prose">법적 문서</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tightest text-ink-900 mt-0">개인정보처리방침</h1>
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider not-prose">최종 개정일: 2026-04-24</p>

      <h2>1. 수집하는 개인정보</h2>
      <ul>
        <li><strong>이메일 주소</strong>: 회원 식별, 로그인 인증, 영수증·공지 발송</li>
        <li><strong>결제 정보</strong>: Toss Payments에서 처리되며, 본 서비스는 카드번호 등 민감 정보를 직접 보관하지 않습니다</li>
        <li><strong>이용 로그</strong>: AI 호출 시각, 사용 토큰, 비용 (서비스 운영·요금 정산용)</li>
        <li><strong>책 프로젝트 데이터</strong>: 사용자가 입력한 주제·목차·본문 (사용자 본인만 접근)</li>
      </ul>

      <h2>2. 수집 목적</h2>
      <ul>
        <li>서비스 제공 및 인증</li>
        <li>결제·환불 처리</li>
        <li>고객 문의 응대</li>
        <li>이용 통계 분석</li>
      </ul>

      <h2>3. 보유 기간</h2>
      <ul>
        <li>회원 탈퇴 시 즉시 파기 (단 결제·세무 기록은 법정 보존 기간 5년)</li>
        <li>책 프로젝트 데이터: 회원 탈퇴 시 함께 삭제</li>
      </ul>

      <h2>4. 제3자 제공</h2>
      <p>아래 외주 처리 외에는 동의 없이 제3자에게 제공하지 않습니다.</p>
      <ul>
        <li>Toss Payments (결제 처리)</li>
        <li>Resend (이메일 발송)</li>
        <li>Vercel (서비스 호스팅)</li>
        <li>Anthropic / Google (AI 모델 호출 — 입력한 책 주제·목차·본문이 모델 호출 시 전송됨)</li>
      </ul>

      <h2>5. 사용자 권리</h2>
      <p>회원은 언제든 본인의 정보 열람·수정·삭제를 요청할 수 있습니다. 요청: cs@tigerbookmaker.com</p>

      <h2>6. 쿠키</h2>
      <p>로그인 세션 유지를 위해 쿠키를 사용합니다.</p>

      <h2>7. 책임자</h2>
      <p>개인정보 보호 책임자: (사업자 등록 후 명시)</p>

      <p className="text-xs text-gray-500 mt-8 not-prose">본 방침은 베타 기간 임시 안이며, 정식 운영 전 법무 검토 후 확정됩니다.</p>
    </div>
    </main>
  );
}

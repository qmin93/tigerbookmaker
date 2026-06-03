// 사전예약 5일 소프트오페라 시퀀스 + 즉시 답장 빌더.
// /preorder 페이지 미감 그대로 (warm cream + vermilion accent).

import "server-only";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Tigerbookmaker <onboarding@resend.dev>";

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  accent: "#D24B2A",
  border: "#E7E0D2",
};

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(opts: {
  title: string;
  preheader: string;
  body: string;
  email: string;
}): string {
  const unsubUrl = `https://tigerbookmaker.vercel.app/api/preorder/unsubscribe?email=${encodeURIComponent(opts.email)}`;
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" /><title>${escape(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif;color:${C.ink};line-height:1.7;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escape(opts.preheader)}</span>
  <div style="padding:40px 20px;">
    <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:36px 32px;border:1px solid ${C.border};">
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;color:${C.accent};text-transform:uppercase;margin-bottom:24px;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${C.accent};margin-right:6px;vertical-align:middle;"></span>
        tigerbookmaker · 베타
      </div>
      ${opts.body}
      <div style="margin-top:36px;padding-top:20px;border-top:1px solid ${C.border};font-size:11px;color:${C.muted};line-height:1.7;">
        tigerbookmaker — 한국어 AI(생성형 인공지능) 기반 자동 집필 도구.<br/>
        본 메일은 ${escape(opts.email)}으로 발송.
        <a href="${unsubUrl}" style="color:${C.muted};text-decoration:underline;">수신거부</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ───────── 시퀀스 정의 ─────────

export interface PreorderEmailContext {
  email: string;
  icpSignal: string | null;
}

export interface BuiltEmail {
  subject: string;
  html: string;
}

export type StepBuilder = (ctx: PreorderEmailContext) => BuiltEmail;

// Day 0 — 즉시 답장. 신청 직후.
// PDF 다운로드 버튼 + 자기 입증 박스 + Day 1 예고 hook
const LEADMAGNET_PDF_URL = "https://tigerbookmaker.vercel.app/leadmagnet/tigerbookmaker-mini.pdf";

export const buildStep0: StepBuilder = ({ email }) => ({
  subject: "[tigerbookmaker] 미니 이북 PDF 도착했어요. 오픈까지 5일 가이드도 시작.",
  html: wrap({
    title: "사전예약 접수 완료 + PDF 도착",
    preheader: "tigerbookmaker로 30분 안에 만들어진 미니 이북 1권이 첨부됐어요.",
    email,
    body: `
      <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:${C.ink};">
        잘 받았어요.
      </h1>
      <p style="font-size:16px;margin:0 0 24px;color:${C.body};">
        한정 100명 사전예약자 명단에 등록됐어요. 베타 오픈 시 가장 먼저 메일 드릴게요.
      </p>

      <!-- PDF 다운로드 버튼 -->
      <div style="margin:28px 0;text-align:center;">
        <a href="${LEADMAGNET_PDF_URL}"
           style="display:inline-block;padding:18px 28px;background:${C.ink};color:white;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:-0.01em;box-shadow:0 12px 28px -12px ${C.ink};">
          📕 미니 이북 PDF 받기 →
        </a>
        <div style="margin-top:10px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.18em;color:${C.muted};text-transform:uppercase;">
          30 페이지 · 한국 직장인 부수익 가이드
        </div>
      </div>

      <!-- 자기 입증 박스 -->
      <div style="margin:28px 0;padding:18px 20px;background:${C.bg};border:1px dashed ${C.accent};border-radius:10px;font-size:14px;color:${C.body};line-height:1.65;">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.22em;color:${C.accent};text-transform:uppercase;margin-bottom:8px;font-weight:600;">
          ⚡ 자기 입증
        </div>
        이 PDF는 <strong style="color:${C.ink};">tigerbookmaker로 30분 안에 만들어졌어요</strong>.
        본인이 만든 책의 저작권은 100% 본인 거예요. 크몽·KDP·블로그·뉴스레터 어디서든 자유롭게 판매할 수 있어요.
      </div>

      <!-- 사전예약 혜택 catalog -->
      <div style="margin:24px 0;padding:18px 20px;background:white;border-left:3px solid ${C.accent};border-radius:6px;font-size:14px;color:${C.body};line-height:1.7;">
        <strong style="color:${C.ink};">사전예약자 한정 혜택 (5종)</strong><br/>
        ✓ 미니 이북 PDF 1권 (위 버튼) — 방금 발송<br/>
        ✓ 크몽 베스트셀러 키워드 체크리스트<br/>
        ✓ 5일 "30분 출판소" 이메일 강좌 — 내일부터 시작<br/>
        ✓ 베타 오픈 시 ₩5,000 크레딧 자동 지급<br/>
        ✓ 표지 30종 갤러리 평생 접근
      </div>

      <!-- Day 1 예고 hook -->
      <div style="margin:32px 0 16px;padding-top:24px;border-top:1px solid ${C.border};">
        <p style="font-size:15px;color:${C.body};margin:0 0 8px;">
          <strong style="color:${C.ink};">내일 한 통.</strong>
        </p>
        <p style="font-size:15px;color:${C.body};margin:0;">
          "진짜 30분에 되나요?" — 베타 예시 사례 (박지수씨) 이야기 보내드릴게요.
        </p>
      </div>

      <p style="font-size:13px;color:${C.muted};margin:24px 0 0;">
        궁금한 점 있으면 이 메일에 그대로 답장 주세요. 제가 직접 봅니다. — tigerbookmaker
      </p>
    `,
  }),
});

// Day 1 — 무대 설정
const buildStep1: StepBuilder = ({ email }) => ({
  subject: "[1/5] AI 이북, 진짜 30분에 되나요?",
  html: wrap({
    title: "1/5 — 진짜 30분에 되나요?",
    preheader: "박지수의 첫 책 만들기, 실제로 어땠는지.",
    email,
    body: `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${C.muted};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px;">
        Day 1 / 5 · 무대 설정
      </div>
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:${C.ink};">
        AI 이북, 진짜 30분에 되나요?
      </h1>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        박지수씨를 처음 만난 건 작년 가을 크몽 셀러 카페였어요. 마케터 4년차에 PDF 자료 판매를 막 시작한 분이었습니다.
      </p>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        그때 박지수씨가 한 말이 기억에 남아요.
      </p>
      <blockquote style="border-left:3px solid ${C.accent};padding-left:18px;margin:20px 0;font-size:17px;color:${C.ink};font-style:italic;">
        "퇴근하고 노트북 켜는 게 매일 약속이지만, 일주일에 두세 번도 어려워요. 챕터 구조 잡으려고 ChatGPT 켜면 30분이 1시간 되고, 표지 만들려고 Canva 켜면 또 2시간."
      </blockquote>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        2주에 PDF 1권. 한 달 매출 ₩20만. 본인이 직접 쓴 시간은 사실상 0원이었어요.
      </p>
      <p style="font-size:16px;color:${C.body};margin:0 0 24px;">
        내일은 박지수씨가 그 동안 시도했던 것들 — ChatGPT 프롬프트 묶음 ₩9,900, 외주 견적 ₩300,000 — 그리고 왜 다 안 됐는지 보내드릴게요.
      </p>
      <p style="font-size:15px;color:${C.muted};">— tigerbookmaker</p>
    `,
  }),
});

// Day 2 — 페인포인트 강화
const buildStep2: StepBuilder = ({ email }) => ({
  subject: "[2/5] ChatGPT로 2주씩 걸리는 3가지 이유",
  html: wrap({
    title: "2/5 — 2주씩 걸리는 이유",
    preheader: "프롬프트 묶음·외주·노션 — 다 안 되는 진짜 이유.",
    email,
    body: `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${C.muted};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px;">
        Day 2 / 5 · 페인포인트
      </div>
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:${C.ink};">
        ChatGPT로 2주씩 걸리는 3가지 이유
      </h1>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        박지수씨가 시도했던 것 정리해 봤어요.
      </p>
      <ol style="font-size:16px;color:${C.body};padding-left:20px;margin:16px 0 24px;">
        <li style="margin-bottom:14px;">
          <strong style="color:${C.ink};">프롬프트 묶음 ₩9,900</strong> — 100개 검증된 프롬프트라고 적혀 있지만, 결국 복붙·정리·편집은 본인 몫. 시간은 그대로.
        </li>
        <li style="margin-bottom:14px;">
          <strong style="color:${C.ink};">외주 견적 ₩300,000</strong> — 한 달 매출보다 비싸요. 2번 외주하면 적자.
        </li>
        <li style="margin-bottom:14px;">
          <strong style="color:${C.ink};">노션에서 직접</strong> — 챕터 구조에서 막힘. 표지는 Canva에서 매번 새로 디자인. 일주일 갈 듯.
        </li>
      </ol>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        잘못된 믿음은 이거였어요.
      </p>
      <blockquote style="border-left:3px solid ${C.accent};padding-left:18px;margin:20px 0;font-size:18px;color:${C.ink};font-weight:700;">
        "AI는 잡 글이고, 사람이 다듬어야 한다."
      </blockquote>
      <p style="font-size:16px;color:${C.body};margin:0 0 24px;">
        실제로는 — <strong style="color:${C.ink};">AI가 부족했던 게 아니라, 본인이 다듬을 시간이 부족했던 것</strong>.
        내일은 어떻게 다른 흐름이 가능한지 보여드릴게요.
      </p>
      <p style="font-size:15px;color:${C.muted};">— tigerbookmaker</p>
    `,
  }),
});

// Day 3 — 깨달음
const buildStep3: StepBuilder = ({ email }) => ({
  subject: "[3/5] AI에 90% 떠넘기는 게 사실 합리적인 이유",
  html: wrap({
    title: "3/5 — 90% 떠넘기기",
    preheader: "사람이 다듬을 곳은 10%면 충분.",
    email,
    body: `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${C.muted};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px;">
        Day 3 / 5 · 깨달음
      </div>
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:${C.ink};">
        AI에 90% 떠넘기는 게 합리적입니다.
      </h1>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        제가 매일 AI 자동화 도구를 만들면서 배운 게 하나 있어요.
      </p>
      <blockquote style="border-left:3px solid ${C.accent};padding-left:18px;margin:20px 0;font-size:17px;color:${C.ink};font-style:italic;">
        "AI는 인턴이에요. 잘 가르치면 12챕터 책 한 권을 30분에 써요. 잘못 가르치면 잡 글만 50페이지."
      </blockquote>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        tigerbookmaker가 하는 일이 정확히 이거예요 — 인턴 매니지먼트.
      </p>
      <ul style="font-size:16px;color:${C.body};padding-left:20px;margin:0 0 24px;">
        <li style="margin-bottom:8px;">주제 한 줄 → 12챕터 자동 구조화</li>
        <li style="margin-bottom:8px;">본인 자료 1개 → 본인 톤 학습</li>
        <li style="margin-bottom:8px;">표지·내지·마케팅 카피 자동</li>
      </ul>
      <p style="font-size:16px;color:${C.body};margin:0 0 24px;">
        본인이 손볼 곳은 마지막 10%만. 일주일에 1권 페이스가 가능해요.
      </p>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        내일은 박지수씨가 이 흐름으로 한 달 동안 어떻게 됐는지 보내드릴게요.
      </p>
      <p style="font-size:15px;color:${C.muted};">— tigerbookmaker</p>
    `,
  }),
});

// Day 4 — 후기
const buildStep4: StepBuilder = ({ email }) => ({
  subject: "[4/5] 박지수씨의 한 달 — 라인업 4권으로",
  html: wrap({
    title: "4/5 — 한 달 결과",
    preheader: "주말에 일하지 않아도 매출이 들어와요.",
    email,
    body: `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${C.muted};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px;">
        Day 4 / 5 · 변화
      </div>
      <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:${C.ink};">
        박지수씨의 한 달.
      </h1>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        베타 사용 한 달 후 박지수씨와 다시 통화했어요.
      </p>
      <ul style="font-size:16px;color:${C.body};padding-left:20px;margin:0 0 20px;">
        <li style="margin-bottom:8px;">크몽 라인업 1권 → 4권</li>
        <li style="margin-bottom:8px;">평일 작업 시간 일 1–2시간 (이전 일 3–4시간)</li>
        <li style="margin-bottom:8px;">주말 작업 0시간</li>
      </ul>
      <blockquote style="border-left:3px solid ${C.accent};padding-left:18px;margin:20px 0;font-size:17px;color:${C.ink};font-style:italic;">
        "매출 숫자가 늘었다는 것보다 — '주말에 일하지 않아도 매출이 들어온다'는 감각이 더 컸어요. 본업 의존도가 줄었어요."
      </blockquote>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;font-size:13px;">
        ※ 결과는 주제·자료 품질·시장 환경에 따라 다를 수 있습니다.
      </p>
      <p style="font-size:16px;color:${C.body};margin:0 0 24px;">
        내일이 마지막 메일입니다. 베타 오픈 안내 + 사전예약자 혜택 5종 정리해서 보내드릴게요.
      </p>
      <p style="font-size:15px;color:${C.muted};">— tigerbookmaker</p>
    `,
  }),
});

// Day 5 — 행동 유도 (오픈 안내)
const buildStep5: StepBuilder = ({ email }) => ({
  subject: "[5/5] 베타 오픈 — 사전예약자 혜택 5종 활성",
  html: wrap({
    title: "5/5 — 오픈 D-Day",
    preheader: "사전예약자 혜택 5종, 오늘 활성됐어요.",
    email,
    body: `
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${C.muted};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px;">
        Day 5 / 5 · 오픈
      </div>
      <h1 style="font-size:30px;font-weight:900;letter-spacing:-0.025em;margin:0 0 16px;color:${C.ink};">
        오늘 베타가 열렸어요.
      </h1>
      <p style="font-size:16px;color:${C.body};margin:0 0 16px;">
        5일 동안 읽어주셔서 고맙습니다. 약속드린 혜택 5종 전부 활성됐어요.
      </p>
      <div style="margin:24px 0;padding:20px 22px;background:${C.bg};border:1px solid ${C.border};border-radius:10px;">
        <strong style="color:${C.ink};">사전예약자 한정 혜택</strong>
        <ol style="font-size:15px;color:${C.body};padding-left:18px;margin:12px 0 0;">
          <li>미니 이북 1편 (10페이지 PDF)</li>
          <li>크몽 베스트셀러 키워드 체크리스트</li>
          <li>5일 "30분 출판소" 가이드 (지금까지 받으신 메일)</li>
          <li><strong style="color:${C.accent};">베타 ₩5,000 크레딧 자동 지급</strong> — 라이트 1권 무료</li>
          <li>표지 30종 갤러리 평생 접근권</li>
        </ol>
      </div>
      <p style="margin:28px 0;text-align:center;">
        <a href="https://tigerbookmaker.vercel.app/login?utm_source=preorder&utm_campaign=day5" style="display:inline-block;background:${C.ink};color:white;text-decoration:none;padding:16px 28px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-0.01em;">
          베타 시작하기 →
        </a>
      </p>
      <p style="font-size:14px;color:${C.muted};text-align:center;margin:0 0 24px;">
        클릭 시 사전예약 이메일로 자동 로그인 + ₩5,000 크레딧 적용.
      </p>
      <p style="font-size:15px;color:${C.muted};margin:24px 0 0;">
        5일 동안 함께 해주셔서 고맙습니다. — tigerbookmaker
      </p>
    `,
  }),
});

export const PREORDER_STEPS: Record<number, StepBuilder> = {
  0: buildStep0,
  1: buildStep1,
  2: buildStep2,
  3: buildStep3,
  4: buildStep4,
  5: buildStep5,
};

export async function sendPreorderEmail(
  step: number,
  ctx: PreorderEmailContext
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const builder = PREORDER_STEPS[step];
  if (!builder) return { ok: false, reason: `UNKNOWN_STEP_${step}` };

  const resend = getResend();
  if (!resend) return { ok: false, reason: "RESEND_NOT_CONFIGURED" };

  const { subject, html } = builder(ctx);
  try {
    await resend.emails.send({ from: FROM, to: ctx.email, subject, html });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message?.slice(0, 300) ?? "SEND_FAILED" };
  }
}

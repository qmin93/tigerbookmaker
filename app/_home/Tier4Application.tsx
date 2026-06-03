"use client";

import { useState } from "react";

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  border: "#E7E0D2",
  accent: "#D24B2A",
  accentDark: "#A93917",
  accentSoft: "#F4DED4",
};

const FONT_SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_SERIF = '"Hahmlet", "Nanum Myeongjo", "Noto Serif KR", serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

// Secret 17 — 신청서 퍼널. 고가 (₩2M+) 컨설팅은 폼이 길수록 자기 검증 ↑.
// 의도적으로 5개 질문. 부적합자 자동 필터링.
export function Tier4Application() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    biz: "", // 사업 종류
    why: "", // 왜 책을 내고 싶은가
    budget: "", // 예산 의향
    when: "", // 1년 뒤 자신
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // 데이터는 preorders 테이블에 intent="tier4_application"으로
    // (지금은 DB 스키마 변경 없이 leadmagnet에 메모로 저장)
    await fetch("/api/preorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        icp_signal: "coach",
        intent: "preorder",
        utm_source: "tier4",
        utm_medium: "application",
        utm_campaign: `${form.biz}-${form.budget}`.slice(0, 100),
      }),
    }).catch(() => {});
    setDone(true);
    setBusy(false);
  }

  return (
    <>
      {/* 트리거 버튼 — 사다리 층 4 옆에서 호출 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          background: "transparent",
          color: C.ink,
          border: `1px solid ${C.ink}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: FONT_SANS,
          letterSpacing: "-0.01em",
        }}
      >
        대기자 명단 신청 →
      </button>

      {/* 모달 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="자비출판 컨설팅 신청서"
          onClick={() => !busy && !done && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(11,11,11,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560,
              width: "100%",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: "32px 30px",
              maxHeight: "92vh",
              overflowY: "auto",
              fontFamily: FONT_SANS,
            }}
          >
            {done ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    color: C.accent,
                    textTransform: "uppercase",
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  · 대기자 명단 등록 완료 ·
                </div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: C.ink,
                    marginBottom: 12,
                    letterSpacing: "-0.025em",
                  }}
                >
                  Month 6+에 연락드릴게요.
                </h2>
                <p style={{ fontSize: 14, color: C.body, lineHeight: 1.65 }}>
                  자비출판 컨설팅은 10명 한정으로 진행하며, 베타 오픈 후 사용자 데이터가 충분히 모인 뒤
                  순차 안내합니다.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(() => setDone(false), 400);
                  }}
                  style={{
                    marginTop: 24,
                    padding: "12px 22px",
                    background: C.ink,
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    color: C.accent,
                    textTransform: "uppercase",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  층 4 · 신청서
                </div>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    color: C.ink,
                    marginBottom: 8,
                    lineHeight: 1.1,
                  }}
                >
                  1:1 자비출판 컨설팅
                </h2>
                <p
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 14,
                    fontStyle: "italic",
                    color: C.muted,
                    marginBottom: 20,
                    lineHeight: 1.55,
                  }}
                >
                  Month 6+에 10명 한정으로 진행. 부적합자를 직접 거르려고 질문이 5개입니다.
                </p>

                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Field label="이메일">
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="founder@example.com"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="이름 또는 호칭">
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="박지수 / 김 코치"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="현재 어떤 일을 하시나요?">
                    <textarea
                      required
                      value={form.biz}
                      onChange={(e) => setForm({ ...form, biz: e.target.value })}
                      placeholder="예: 1인 영어 코치 5년차 / 인스타 팔로워 6,500명 / 오프라인 그룹 코칭 운영"
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                    />
                  </Field>

                  <Field label="왜 책을 내고 싶으세요? (외부 + 내부 목표)">
                    <textarea
                      required
                      value={form.why}
                      onChange={(e) => setForm({ ...form, why: e.target.value })}
                      placeholder="외부: 어떤 결과를 / 내부: 그게 본인에게 어떤 의미인지"
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                    />
                  </Field>

                  <Field label="자비출판 예산 의향가">
                    <select
                      required
                      value={form.budget}
                      onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">선택해주세요</option>
                      <option value="lt_1m">₩1,000,000 미만 — 이 단계 부적합</option>
                      <option value="1_3m">₩1,000,000 — ₩3,000,000</option>
                      <option value="3_5m">₩3,000,000 — ₩5,000,000</option>
                      <option value="gt_5m">₩5,000,000 이상</option>
                    </select>
                  </Field>

                  <Field label="1년 뒤 본인 모습은?">
                    <textarea
                      required
                      value={form.when}
                      onChange={(e) => setForm({ ...form, when: e.target.value })}
                      placeholder="구체적으로 1년 뒤 어떤 상태가 되어 있고 싶으신지"
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={busy}
                    style={{
                      marginTop: 12,
                      padding: "16px 22px",
                      background: C.ink,
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: busy ? "wait" : "pointer",
                      opacity: busy ? 0.6 : 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {busy ? "전송 중…" : "대기자 명단 신청"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.muted,
                      fontSize: 12,
                      fontFamily: FONT_MONO,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      marginTop: 4,
                    }}
                  >
                    취소
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "white",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  fontSize: 15,
  fontFamily: FONT_SANS,
  color: C.ink,
  outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: "0.18em",
          color: C.muted,
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

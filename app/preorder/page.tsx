"use client";

import { useEffect, useRef, useState } from "react";

// /preorder — Bold Korean SaaS with cinematic effects.
// 한국어 sans 중심 + 큰 SVG illustration + animated mesh + marquee + per-letter reveal.

const FONT_SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_SERIF = '"Nanum Myeongjo", "Noto Serif KR", serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

const C = {
  bg: "#F8F5EE",
  ink: "#0B0B0B",
  body: "#36322C",
  muted: "#7B7468",
  border: "#E7E0D2",
  accent: "#D24B2A",
  accentDark: "#A93917",
  accentSoft: "#F4DED4",
  meshA: "#FFB59A",
  meshB: "#E7D6F0",
  meshC: "#FCE89A",
};

const ICP_OPTIONS = [
  { value: "kmong_seller", label: "크몽 / PDF 셀러" },
  { value: "side_writer", label: "블로그 · 뉴스레터" },
  { value: "coach", label: "1인 코치 · 강사" },
  { value: "other", label: "기타" },
];

// 헤드라인을 글자 단위로 쪼개 stagger 애니메이션
function SplitHeading({ text }: { text: string }) {
  const chars = Array.from(text);
  let visibleIdx = 0;
  return (
    <span style={{ display: "inline-block" }}>
      {chars.map((ch, i) => {
        if (ch === " ") return <span key={i}>&nbsp;</span>;
        if (ch === "\n")
          return <br key={i} />;
        const delay = visibleIdx * 38;
        visibleIdx++;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: 0,
              animation: `preorderLetter 700ms ${delay + 280}ms cubic-bezier(0.22,1,0.36,1) forwards`,
              willChange: "transform, opacity",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export default function PreorderPage() {
  const [email, setEmail] = useState("");
  const [icpSignal, setIcpSignal] = useState("");
  const [intent, setIntent] = useState<"preorder" | "paid_intent">("preorder");
  const [amount, setAmount] = useState<number | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Live viewer count — 23~67 사이 랜덤 워크
  const [viewerCount, setViewerCount] = useState(43);
  useEffect(() => {
    const id = setInterval(() => {
      setViewerCount((n) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(23, Math.min(67, n + delta));
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  // Cursor follow dot
  const cursorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let tx = 0, ty = 0, x = 0, y = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll-reveal — IntersectionObserver
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = "1";
            (e.target as HTMLElement).style.transform = "translateY(0)";
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(32px)";
      el.style.transition = "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1)";
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Magnetic button effect
  const btnRef = useRef<HTMLButtonElement>(null);
  function onBtnMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.18;
    const y = (e.clientY - r.top - r.height / 2) * 0.25;
    btnRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }
  function onBtnLeave() {
    if (!btnRef.current) return;
    btnRef.current.style.transform = "translate(0,0)";
    btnRef.current.style.background = C.ink;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const res = await fetch("/api/preorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        icp_signal: icpSignal || undefined,
        intent,
        amount_won: intent === "paid_intent" ? Number(amount) : undefined,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
      }),
    });

    if (res.ok) {
      setStatus("done");
      return;
    }
    const body = await res.json().catch(() => null);
    setErrorMsg(body?.error ?? "PREORDER_FAILED");
    setStatus("error");
  }

  // ─── 완료 상태 ─────────────────────────────────
  if (status === "done") {
    return (
      <main
        style={{
          position: "relative",
          minHeight: "100vh",
          background: C.bg,
          color: C.ink,
          fontFamily: FONT_SANS,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          overflow: "hidden",
        }}
      >
        <MeshBackground />
        <div style={{ position: "relative", maxWidth: 560, textAlign: "center", zIndex: 2 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              border: `1px solid ${C.accent}`,
              borderRadius: 999,
              background: "white",
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.accent,
              textTransform: "uppercase",
              marginBottom: 28,
              boxShadow: `0 8px 24px -8px ${C.accent}55`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: C.accent,
                animation: "preorderPulse 1.6s infinite ease-out",
              }}
            />
            신청 접수 완료
          </div>
          <h1
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 900,
              fontSize: 56,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              marginBottom: 24,
            }}
          >
            창간 첫날, 가장 먼저
            <br />
            <span
              style={{
                background: `linear-gradient(120deg, ${C.accent}, #F0A37A)`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              연락드릴게요.
            </span>
          </h1>
          <p style={{ fontSize: 17, color: C.body, lineHeight: 1.7 }}>
            오픈 전까지 매주 한 통, 김과장이 직접 쓴 <br />
            <strong style={{ color: C.ink }}>"AI로 이북 30분에 만들기"</strong> 가이드가
            도착합니다.
          </p>
        </div>
      </main>
    );
  }

  // ─── 메인 ───────────────────────────────────────
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: C.bg,
        color: C.ink,
        fontFamily: FONT_SANS,
        overflow: "hidden",
      }}
    >
      <MeshBackground />
      <Grain />
      <FloatingDecor />

      {/* 마우스 따라가는 작은 점 */}
      <div
        ref={cursorRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: `${C.accent}26`,
          border: `1px solid ${C.accent}55`,
          pointerEvents: "none",
          zIndex: 100,
          willChange: "transform",
          mixBlendMode: "multiply",
        }}
      />

      {/* NAV */}
      <nav
        style={{
          position: "relative",
          zIndex: 5,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 24px",
          background: "rgba(248,245,238,0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookmarkIcon />
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.05em",
                color: C.ink,
              }}
            >
              tigerbookmaker
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.muted,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: 999,
                background: C.accent,
                animation: "preorderPulse 1.4s infinite ease-out",
              }}
            />
            지금 {viewerCount}명이 보고 있어요
          </span>
        </div>
      </nav>

      {/* HERO */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          padding: "60px 24px 40px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
            gap: 48,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* 왼쪽 — 텍스트 */}
          <div>
            <div
              style={{
                opacity: 0,
                animation: "preorderFadeUp 700ms 100ms cubic-bezier(0.22,1,0.36,1) forwards",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                border: `1px solid ${C.border}`,
                background: "white",
                borderRadius: 999,
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.15em",
                color: C.body,
                textTransform: "uppercase",
                marginBottom: 28,
                boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
              }}
            >
              <span style={{ color: C.accent }}>●</span>
              AI 기반 자동 집필 도구 · 베타
            </div>

            <h1
              style={{
                fontFamily: FONT_SANS,
                fontWeight: 900,
                fontSize: "clamp(48px, 6vw, 92px)",
                lineHeight: 1.0,
                letterSpacing: "-0.04em",
                color: C.ink,
                marginBottom: 28,
              }}
            >
              <span style={{ display: "block" }}>
                <SplitHeading text={"퇴근하고 "} />
                <span style={{ position: "relative", display: "inline-block" }}>
                  <SplitHeading text={"30분,"} />
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      right: "0.4em",
                      bottom: "0.04em",
                      height: "0.14em",
                      background: `linear-gradient(120deg, ${C.accent}, #F0A37A)`,
                      borderRadius: 99,
                      transformOrigin: "left",
                      transform: "scaleX(0)",
                      animation:
                        "preorderUnderline 700ms 1500ms cubic-bezier(0.22,1,0.36,1) forwards",
                      opacity: 0.9,
                      zIndex: 0,
                    }}
                  />
                </span>
              </span>
              <span style={{ display: "block", marginTop: "0.1em" }}>
                <SplitHeading text={"첫 이북이"} />
              </span>
              <span style={{ display: "block", marginTop: "0.05em" }}>
                <SplitHeading text={"완성됩니다."} />
              </span>
            </h1>

            <p
              style={{
                opacity: 0,
                animation: "preorderFadeUp 800ms 1600ms cubic-bezier(0.22,1,0.36,1) forwards",
                fontSize: 19,
                lineHeight: 1.6,
                color: C.body,
                marginBottom: 12,
                maxWidth: 520,
              }}
            >
              주제 한 줄과 본인 자료 한 개만 주세요. AI가{" "}
              <strong style={{ color: C.ink }}>12챕터 + 표지 + 마케팅 카피</strong>까지 자동으로
              만듭니다.
            </p>
            <p
              style={{
                opacity: 0,
                animation: "preorderFadeUp 800ms 1750ms cubic-bezier(0.22,1,0.36,1) forwards",
                fontSize: 15,
                color: C.muted,
                marginBottom: 40,
              }}
            >
              사전예약자에게는 미니 이북과 크몽 키워드 체크리스트를 무료로 보내드립니다.
            </p>

            <div
              style={{
                opacity: 0,
                animation: "preorderFadeUp 800ms 1900ms cubic-bezier(0.22,1,0.36,1) forwards",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <a
                href="#preorder-form"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "16px 24px",
                  background: C.ink,
                  color: "white",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: `0 12px 28px -12px ${C.ink}88`,
                  transition: "transform 200ms ease, background 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.accent;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.ink;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                사전예약 · 무료 신청
                <span style={{ fontSize: 18 }}>→</span>
              </a>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  color: C.muted,
                  textTransform: "uppercase",
                }}
              >
                <span>한정 100명</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>카드 정보 X</span>
              </div>
            </div>
          </div>

          {/* 오른쪽 — 큰 일러스트 */}
          <div
            style={{
              opacity: 0,
              animation: "preorderFadeUp 1000ms 400ms cubic-bezier(0.22,1,0.36,1) forwards",
              position: "relative",
              aspectRatio: "1 / 1.05",
              maxWidth: 480,
              justifySelf: "center",
              width: "100%",
            }}
          >
            <BookIllustration />
          </div>
        </div>
      </section>

      {/* Marquee — 전 폭 데코 */}
      <section
        aria-hidden
        style={{
          position: "relative",
          zIndex: 4,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          background: C.ink,
          color: C.bg,
          overflow: "hidden",
          margin: "20px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            whiteSpace: "nowrap",
            padding: "18px 0",
            animation: "preorderMarquee 38s linear infinite",
            fontFamily: FONT_MONO,
            fontSize: 13,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            willChange: "transform",
          }}
        >
          {[...Array(2)].map((_, k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 36 }}>
              {[
                "AI 기반 자동 집필",
                "★",
                "퇴근 후 30분",
                "★",
                "12 챕터 + 표지 + 카피",
                "★",
                "한국 작가 · 부수익러",
                "★",
                "베타 ₩0",
                "★",
                "카드 정보 받지 않음",
                "★",
                "사전예약 한정 100명",
                "★",
              ].map((t, i) => (
                <span
                  key={i}
                  style={{
                    paddingRight: 36,
                    color: t === "★" ? C.accent : C.bg,
                    opacity: t === "★" ? 1 : 0.92,
                  }}
                >
                  {t}
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* TRUST 3 카드 */}
      <section style={{ position: "relative", zIndex: 4, padding: "40px 24px 80px" }}>
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
          className="trust-grid"
        >
          {[
            { label: "카드 정보", value: "받지 않음", caption: "베타 기간 동안 결제 0원" },
            { label: "베타 크레딧", value: "₩5,000", caption: "라이트 1권 무료 자동 적용" },
            { label: "환불", value: "7일 100%", caption: "마음에 안 들면 전액" },
          ].map((t, i) => (
            <div
              key={t.label}
              style={{
                position: "relative",
                background: "white",
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: "26px 22px",
                transition: "transform 260ms ease, box-shadow 260ms ease",
                cursor: "default",
                opacity: 0,
                animation: `preorderFadeUp 700ms ${200 + i * 90}ms cubic-bezier(0.22,1,0.36,1) forwards`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px) rotate(-0.3deg)";
                e.currentTarget.style.boxShadow = `0 14px 28px -14px ${C.ink}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) rotate(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: "0.2em",
                  color: C.muted,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {String(i + 1).padStart(2, "0")} · {t.label}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: C.ink,
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                {t.value}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{t.caption}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PULL QUOTE — 인터뷰 (명조체 1회) */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          padding: "0 24px 80px",
        }}
      >
        <div
          data-reveal
          style={{
            maxWidth: 880,
            margin: "0 auto",
            position: "relative",
            padding: "48px 56px",
            background: "white",
            border: `1px solid ${C.border}`,
            borderRadius: 24,
            boxShadow: `0 30px 60px -30px ${C.ink}22`,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -28,
              left: 40,
              fontFamily: FONT_SERIF,
              fontSize: 120,
              fontWeight: 700,
              color: C.accent,
              lineHeight: 1,
              opacity: 0.9,
            }}
          >
            “
          </span>
          <blockquote
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 400,
              fontSize: 24,
              lineHeight: 1.55,
              color: C.ink,
              margin: 0,
            }}
          >
            AI가 부족했던 게 아니라, 내가 다듬을 시간이 부족했어요. 30분 워크플로우가 생기고
            나서 일주일에 두 권씩 라인업이 늘었어요.
          </blockquote>
          <figcaption
            style={{
              marginTop: 24,
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.muted,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                width: 28,
                height: 1,
                background: C.accent,
                display: "inline-block",
              }}
            />
            박지수 · 32세, 크몽 셀러
          </figcaption>
        </div>
      </section>

      {/* 혜택 5종 */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          background: "white",
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: "80px 24px",
        }}
      >
        <div data-reveal style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionLabel num="01" title="사전예약 혜택" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 8,
            }}
          >
            지금 신청하면{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "relative", zIndex: 1 }}>5가지</span>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: -4,
                  right: -4,
                  bottom: 4,
                  height: 16,
                  background: C.accentSoft,
                  borderRadius: 4,
                  zIndex: 0,
                }}
              />
            </span>
            를 무료로.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 40 }}>
            정가 합계 ₩49,600 · 베타 사전예약자 한정 ₩0
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              {
                no: "01",
                title: "미니 이북 1편 (10페이지 PDF)",
                desc: "본인 주제로 자동 생성. 신청 직후 발송.",
                price: "₩9,900",
              },
              {
                no: "02",
                title: "크몽 베스트셀러 키워드 체크리스트",
                desc: "부수익 카테고리 상위 50개 키워드 분석.",
                price: "₩4,900",
              },
              {
                no: "03",
                title: "5일 \"30분 출판소\" 이메일 강좌",
                desc: "김과장이 직접 쓴 가이드. 매일 한 통씩.",
                price: "₩19,900",
              },
              {
                no: "04",
                title: "베타 ₩5,000 크레딧 자동 지급",
                desc: "라이트 1권 무료 = 추가 결제 없이 첫 책 완성.",
                price: "₩5,000",
              },
              {
                no: "05",
                title: "표지 30종 갤러리 평생 접근권",
                desc: "Sharp 기반 한국어 표지 템플릿 전체.",
                price: "₩9,900",
              },
            ].map((item) => (
              <li
                key={item.no}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 20,
                  padding: "20px 0",
                  borderBottom: `1px solid ${C.border}`,
                  alignItems: "baseline",
                  cursor: "default",
                  transition: "padding 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.paddingLeft = "8px";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.paddingLeft = "0";
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    fontWeight: 500,
                    color: C.accent,
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.no}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: C.ink,
                      marginBottom: 4,
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 14,
                    color: C.muted,
                    textDecoration: "line-through",
                  }}
                >
                  {item.price}
                </span>
              </li>
            ))}

            <li
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto",
                gap: 20,
                padding: "24px 0 0",
                alignItems: "baseline",
              }}
            >
              <span />
              <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, letterSpacing: "-0.01em" }}>
                총 가치
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 14,
                    color: C.muted,
                    textDecoration: "line-through",
                  }}
                >
                  ₩49,600
                </span>
                <span
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 32,
                    fontWeight: 900,
                    background: `linear-gradient(120deg, ${C.accent}, #F0A37A)`,
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    letterSpacing: "-0.02em",
                  }}
                >
                  ₩0
                </span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* FORM */}
      <section
        id="preorder-form"
        style={{
          position: "relative",
          zIndex: 4,
          padding: "100px 24px",
        }}
      >
        <div data-reveal style={{ maxWidth: 600, margin: "0 auto" }}>
          <SectionLabel num="02" title="신청" />

          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: C.ink,
              marginBottom: 14,
            }}
          >
            이메일만 알려주세요.
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 40 }}>
            카드 정보를 받지 않아요. 베타 안내와 무료 자료 발송 외 용도로 사용하지 않습니다.
          </p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <FieldLabel>이메일 *</FieldLabel>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@example.com"
              autoComplete="email"
              style={{
                width: "100%",
                background: "white",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "18px 20px",
                fontSize: 18,
                fontFamily: FONT_SANS,
                color: C.ink,
                outline: "none",
                transition: "border-color 160ms ease, box-shadow 160ms ease",
                marginTop: -16,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = C.accent;
                e.currentTarget.style.boxShadow = `0 0 0 4px ${C.accentSoft}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            <FieldLabel>어떤 일을 하세요? (선택)</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: -16 }}>
              {ICP_OPTIONS.map((o) => {
                const active = icpSignal === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setIcpSignal(active ? "" : o.value)}
                    style={{
                      padding: "10px 18px",
                      fontSize: 14,
                      fontFamily: FONT_SANS,
                      fontWeight: 500,
                      background: active ? C.ink : "white",
                      color: active ? "white" : C.ink,
                      border: `1px solid ${active ? C.ink : C.border}`,
                      borderRadius: 999,
                      cursor: "pointer",
                      transition: "all 160ms ease",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            <FieldLabel>신청 종류</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
                marginTop: -16,
              }}
            >
              <IntentCard
                active={intent === "preorder"}
                onClick={() => setIntent("preorder")}
                title="사전예약 — 베타 오픈 시 알림"
                desc="혜택 5종 + 5일 시퀀스 이메일 받기"
              />
              <IntentCard
                active={intent === "paid_intent"}
                onClick={() => setIntent("paid_intent")}
                title="얼리버드 — 입금 의향 표시"
                desc="이 가격이면 지금 결제하겠다는 의사"
                isAccent
              />
            </div>

            {intent === "paid_intent" && (
              <div
                style={{
                  marginTop: -12,
                  padding: "16px 18px",
                  borderLeft: `3px solid ${C.accent}`,
                  background: C.accentSoft,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 13, color: C.body }}>입금 의향가</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 22, color: C.ink }}>₩</span>
                  <input
                    type="number"
                    min={0}
                    max={10_000_000}
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="9900"
                    style={{
                      width: 160,
                      background: "white",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 20,
                      fontFamily: FONT_SANS,
                      color: C.ink,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            )}

            <button
              ref={btnRef}
              type="submit"
              disabled={status === "loading"}
              onMouseMove={onBtnMove}
              onMouseLeave={onBtnLeave}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "22px 28px",
                background: C.ink,
                color: "white",
                fontFamily: FONT_SANS,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                border: "none",
                borderRadius: 14,
                cursor: status === "loading" ? "wait" : "pointer",
                opacity: status === "loading" ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: `0 20px 40px -16px ${C.ink}55`,
                transition: "transform 280ms cubic-bezier(0.22,1,0.36,1), background 200ms ease",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                if (status !== "loading") e.currentTarget.style.background = C.accent;
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>
                {status === "loading" ? "신청을 전송 중이에요…" : "사전예약 신청하기"}
              </span>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 20,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 36,
                    height: 1,
                    background: "white",
                    transform: "scaleX(0.6)",
                    transformOrigin: "right",
                    transition: "transform 280ms ease",
                  }}
                  className="btn-line"
                />
                →
              </span>
            </button>

            {status === "error" && (
              <p style={{ fontSize: 13, color: C.accent, textAlign: "center" }}>
                오류가 발생했어요{errorMsg ? ` (${errorMsg})` : ""}. 다시 시도해 주세요.
              </p>
            )}
          </form>
        </div>
      </section>

      {/* MAKER & LEGAL */}
      <footer
        style={{
          position: "relative",
          zIndex: 4,
          borderTop: `1px solid ${C.border}`,
          background: C.bg,
          padding: "56px 24px 80px",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "grid",
            gap: 32,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.2em",
                color: C.muted,
                textTransform: "uppercase",
              }}
            >
              만든 사람
            </span>
            <p
              style={{
                marginTop: 14,
                fontSize: 16,
                color: C.body,
                lineHeight: 1.75,
                maxWidth: 560,
              }}
            >
              <strong style={{ color: C.ink }}>김과장</strong> · 대기업 사무직 11년차. 매주 100시간
              야근에서 살아남으려고 AI 자동화 도구를 매일 만듭니다. tigerbookmaker는 그 중 가장 잘
              통한 도구를 한국 작가·부수익러를 위해 다듬은 결과입니다.{" "}
              <a
                href="https://managerkim.com"
                target="_blank"
                rel="noopener"
                style={{
                  color: C.accent,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  fontWeight: 500,
                }}
              >
                managerkim.com →
              </a>
            </p>
          </div>

          <div
            style={{
              padding: "20px 24px",
              background: "white",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              fontSize: 13,
              color: C.muted,
              lineHeight: 1.7,
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: "0.22em",
                color: C.ink,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              AI 콘텐츠 고지
            </div>
            <p style={{ margin: "0 0 8px" }}>
              tigerbookmaker는{" "}
              <strong style={{ color: C.body }}>
                AI(생성형 인공지능) 기반 자동 집필 도구
              </strong>
              입니다. 책의 본문·표지·메타데이터는 AI에 의해 생성되며 사용자가 검토·편집할 수
              있습니다.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              본 페이지의 인터뷰 인용은 베타 사용 예시이며, 모든 사용자의 결과를 보장하지 않습니다.
            </p>
            <p style={{ margin: 0 }}>
              사전예약 이메일은 베타 안내·자료 발송에만 사용하며, 언제든 수신거부할 수 있습니다.
            </p>
          </div>

          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.15em",
              color: C.muted,
              textTransform: "uppercase",
              textAlign: "center",
              paddingTop: 24,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            tigerbookmaker · 2026
          </div>
        </div>
      </footer>

      {/* 모바일 — hero grid 단일 컬럼 */}
      <style>{`
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .trust-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

// ─── Decorative subcomponents ───────────────────

function MeshBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${C.meshA}88, transparent 70%)`,
          filter: "blur(40px)",
          animation: "preorderMesh 18s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "-15%",
          width: "55%",
          height: "55%",
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${C.meshB}77, transparent 70%)`,
          filter: "blur(40px)",
          animation: "preorderMesh2 22s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "30%",
          width: "55%",
          height: "55%",
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${C.meshC}55, transparent 70%)`,
          filter: "blur(50px)",
          animation: "preorderMesh 26s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

function Grain() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        opacity: 0.22,
        mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        backgroundSize: "200px 200px",
      }}
    />
  );
}

function FloatingDecor() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
      <span
        style={{
          position: "absolute",
          top: "12%",
          left: "5%",
          width: 38,
          height: 50,
          opacity: 0.4,
          ["--rot" as any]: "-8deg",
          animation: "preorderFloat 6s ease-in-out infinite",
        }}
      >
        <MiniBookmark color={C.accent} />
      </span>
      <span
        style={{
          position: "absolute",
          top: "44%",
          right: "6%",
          width: 32,
          height: 42,
          opacity: 0.35,
          ["--rot" as any]: "10deg",
          animation: "preorderFloat 7.5s ease-in-out 1.2s infinite",
        }}
      >
        <MiniBookmark color={C.ink} />
      </span>
      <span
        style={{
          position: "absolute",
          top: "78%",
          left: "8%",
          width: 28,
          height: 36,
          opacity: 0.3,
          ["--rot" as any]: "-4deg",
          animation: "preorderFloat 8.2s ease-in-out 2s infinite",
        }}
      >
        <MiniBookmark color={C.accentDark} />
      </span>
    </div>
  );
}

function MiniBookmark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 32" width="100%" height="100%">
      <path d="M2 0h20v32l-10-7-10 7V0z" fill={color} />
    </svg>
  );
}

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 28,
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: "0.22em",
          color: C.accent,
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {num} · {title}
      </span>
      <span style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: "0.18em",
        color: C.muted,
        textTransform: "uppercase",
      }}
    >
      {children}
    </label>
  );
}

function IntentCard({
  active,
  onClick,
  title,
  desc,
  isAccent = false,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  isAccent?: boolean;
}) {
  const bg = active ? (isAccent ? C.accent : C.ink) : "white";
  const fg = active ? "white" : C.ink;
  const border = active ? bg : C.border;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "18px 20px",
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        cursor: "pointer",
        transition: "all 180ms ease",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: active ? `0 14px 26px -16px ${bg}99` : "none",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: `2px solid ${active ? "white" : C.muted}`,
          background: active ? "transparent" : "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {active && (
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "white" }} />
        )}
      </span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.78 }}>{desc}</div>
      </div>
    </button>
  );
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 4h12v17l-6-4-6 4V4z"
        fill="none"
        stroke="#D24B2A"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 13h4" stroke="#0B0B0B" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// 큰 일러스트 — 책이 열리며 챕터가 펼쳐지는 시각 메타포
// viewBox 600x600, 모든 데코는 60-540 안전 영역 안에.
function BookIllustration() {
  return (
    <svg
      viewBox="0 0 600 600"
      width="100%"
      height="100%"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="bookPage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F2EBDA" />
        </linearGradient>
        <linearGradient id="bookSpine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.accent} />
          <stop offset="1" stopColor="#F0A37A" />
        </linearGradient>
        <linearGradient id="aiTag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.ink} />
          <stop offset="1" stopColor="#2E2A24" />
        </linearGradient>
        <filter id="bookShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="14" />
          <feOffset dx="0" dy="14" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.15" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 그라데이션 깔린 후광 */}
      <circle
        cx="300"
        cy="290"
        r="240"
        fill="url(#bookSpine)"
        opacity="0.06"
        style={{
          transformOrigin: "300px 290px",
          animation: "preorderPulse 6s infinite ease-in-out",
        }}
      />

      {/* 그림자 */}
      <ellipse cx="300" cy="530" rx="220" ry="16" fill={C.ink} opacity="0.1" />

      {/* 책 본체 (viewBox 80~520 / 60~500 안전 영역) */}
      <g filter="url(#bookShadow)">
        {/* 책 페이지 */}
        <rect
          x="80"
          y="80"
          width="440"
          height="400"
          rx="8"
          fill="url(#bookPage)"
          stroke={C.border}
          strokeWidth="1"
        />
        {/* 책등 (가운데 접힘) */}
        <line
          x1="300"
          y1="80"
          x2="300"
          y2="480"
          stroke={C.border}
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {/* CH.01 라벨 */}
        <text
          x="110"
          y="115"
          fontFamily={FONT_MONO}
          fontSize="12"
          fill={C.accent}
          letterSpacing="2"
          fontWeight="500"
        >
          CH. 01
        </text>
        <text
          x="488"
          y="115"
          textAnchor="end"
          fontFamily={FONT_MONO}
          fontSize="12"
          fill={C.muted}
          letterSpacing="2"
        >
          P. 12
        </text>

        {/* 큰 한국어 헤드 */}
        <text
          x="110"
          y="170"
          fontFamily={FONT_SANS}
          fontSize="34"
          fontWeight="900"
          fill={C.ink}
          letterSpacing="-1"
        >
          서문.
        </text>

        {/* 왼쪽 페이지 본문 라인 */}
        {[200, 224, 248, 272, 308, 332, 356, 380].map((y, i) => (
          <rect
            key={"L" + i}
            x="110"
            y={y}
            width={[150, 130, 145, 100, 140, 120, 155, 90][i]}
            height="6"
            rx="3"
            fill={C.muted}
            opacity={i < 4 ? 0.55 : 0.32}
          />
        ))}

        {/* 오른쪽 페이지 본문 라인 */}
        {[140, 164, 188, 212, 236, 260, 284, 308, 332, 356].map((y, i) => (
          <rect
            key={"R" + i}
            x="315"
            y={y}
            width={[170, 150, 165, 120, 155, 140, 175, 110, 150, 90][i]}
            height="6"
            rx="3"
            fill={C.muted}
            opacity={i < 5 ? 0.55 : 0.3}
          />
        ))}

        {/* 본문 스트로크 드로우 라인 */}
        <path
          d="M110 410 Q200 392 300 410 T490 402"
          fill="none"
          stroke={C.accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1500"
          strokeDashoffset="1500"
          style={{ animation: "preorderDraw 2.4s 0.8s ease-out forwards" }}
        />
        <path
          d="M110 432 Q240 418 380 436 T498 424"
          fill="none"
          stroke={C.ink}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
          strokeDasharray="1500"
          strokeDashoffset="1500"
          style={{ animation: "preorderDraw 2.4s 1.2s ease-out forwards" }}
        />

        {/* 빨간 책갈피 (오른쪽 상단, 안전 영역) */}
        <path
          d="M430 80v96l18-12 18 12V80z"
          fill="url(#bookSpine)"
          stroke="white"
          strokeWidth="2"
        />
      </g>

      {/* AI · 30분 떠있는 태그 — 왼쪽 페이지 안쪽에 위치 (안전) */}
      <g
        style={
          {
            ["--rot" as any]: "-4deg",
            animation: "preorderFloat 5s ease-in-out infinite",
          } as React.CSSProperties
        }
      >
        <rect x="120" y="244" width="124" height="40" rx="20" fill="url(#aiTag)" />
        <circle
          cx="140"
          cy="264"
          r="5"
          fill={C.accent}
          style={{ animation: "preorderPulse 1.6s infinite ease-out", transformOrigin: "140px 264px" }}
        />
        <text
          x="156"
          y="269"
          fontFamily={FONT_MONO}
          fontSize="12"
          fill="white"
          letterSpacing="2"
          fontWeight="500"
        >
          AI · 30분
        </text>
      </g>

      {/* DONE 도장 — 오른쪽 페이지 하단 (충분히 안쪽으로) */}
      <g
        transform="translate(420 410) rotate(-10)"
        style={{
          opacity: 0,
          animation: "preorderFadeUp 600ms 2.6s cubic-bezier(0.22,1,0.36,1) forwards",
          transformOrigin: "420px 410px",
        }}
      >
        <rect x="-48" y="-22" width="96" height="44" rx="4" fill="none" stroke={C.accent} strokeWidth="3" />
        <rect x="-42" y="-16" width="84" height="32" rx="2" fill="none" stroke={C.accent} strokeWidth="1" />
        <text
          x="0"
          y="7"
          textAnchor="middle"
          fontFamily={FONT_SANS}
          fontWeight="900"
          fontSize="22"
          fill={C.accent}
          letterSpacing="2"
        >
          DONE
        </text>
      </g>

      {/* 빨간 별 장식 — viewBox 안쪽으로 */}
      {[
        [70, 70, 0],
        [530, 150, 0.6],
        [60, 460, 1.2],
        [540, 510, 1.8],
        [180, 60, 0.3],
      ].map(([x, y, d], i) => (
        <g
          key={i}
          transform={`translate(${x} ${y})`}
          style={{
            transformOrigin: `${x}px ${y}px`,
            animation: `preorderPulse 2.6s ${d}s infinite ease-in-out`,
          }}
        >
          <path d="M0-10 L2.5-2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5-2.5 Z" fill={C.accent} />
        </g>
      ))}
    </svg>
  );
}

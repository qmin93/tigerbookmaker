"use client";

import { useEffect, useRef, useState } from "react";

// /preorder — Bold Korean SaaS with cinematic effects.
// 한국어 sans 중심 + 큰 SVG illustration + animated mesh + marquee + per-letter reveal.

const FONT_SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_SERIF = '"Hahmlet", "Nanum Myeongjo", "Noto Serif KR", serif';
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

// v3 lib/example-forks.ts 기반 — 표지 색은 themeColor 매핑
const SAMPLE_BOOKS = [
  {
    id: "example-1",
    topic: "아침 루틴, 30일이면 인생이 바뀝니다",
    audience: "번아웃 직전의 30대 직장인",
    type: "자기계발서",
    palette: { bg: "#F97316", text: "#FFF8F1", accent: "#7C2D12" },
    days: 30,
  },
  {
    id: "example-2",
    topic: "월급만으로 부족함을 느끼나요",
    audience: "재테크 처음 시작하는 30대",
    type: "재테크",
    palette: { bg: "#1E40AF", text: "#E0E7FF", accent: "#FCD34D" },
    days: 21,
  },
  {
    id: "example-3",
    topic: "나는 그래서 회사를 그만뒀습니다",
    audience: "퇴사를 고민하는 직장인",
    type: "에세이",
    palette: { bg: "#1F2937", text: "#F3F4F6", accent: "#EF4444" },
    days: 14,
  },
  {
    id: "example-4",
    topic: "오늘 저녁 뭐 먹지, 1주일 식단표",
    audience: "1인 가구·맞벌이 부부",
    type: "실용서",
    palette: { bg: "#059669", text: "#ECFDF5", accent: "#FBBF24" },
    days: 7,
  },
];

const FAQS = [
  {
    q: "AI가 만든 책, 진짜 제 것인가요?",
    a: "네, 100% 본인 것입니다. tigerbookmaker는 도구일 뿐이며 생성된 모든 책의 저작권·로열티는 사용자에게 있습니다. 크몽·KDP·블로그·뉴스레터 어디서든 자유롭게 판매하실 수 있어요.",
  },
  {
    q: "AI 표절 아닌가요? 광고 정책에 걸리지 않을까요?",
    a: "본인이 입력한 주제와 자료를 기반으로 새로 생성되므로 표절이 아닙니다. 다만 한국 AI 기본법(2026-01 시행) 및 공정위 표시광고 심사지침(2026-06 시행)에 따라 AI 콘텐츠 임을 책 메타데이터·판매 페이지에 명시하시는 걸 권장합니다. 자동 라벨 옵션을 제공할 예정입니다.",
  },
  {
    q: "정식 오픈 가격은 얼마인가요?",
    a: "권당 결제 모델입니다. 라이트 ₩4,000 / 표준 ₩7,400 / 풀 ₩12,200 / 프리미엄 ₩21,300. 베타 사전예약자에게는 평생 베타 가격(권당 -50%)을 유지해드릴 계획입니다.",
  },
  {
    q: "환불되나요?",
    a: "베타 기간은 결제 자체가 없으니 환불 이슈가 없습니다. 정식 오픈 후에는 첫 책 7일 100% 환불을 제공합니다. 만족 못 하시면 묻지 않고 환불해드려요.",
  },
];

// 헤드라인을 글자 단위로 쪼개 stagger 애니메이션
// 폴백: keyframes 미로딩 시에도 글자가 보이도록 inline opacity 0 제거,
// animation-fill-mode: both 로 keyframe 있을 때만 0% 상태 적용.
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
              animation: `preorderLetter 700ms ${delay + 280}ms cubic-bezier(0.22,1,0.36,1) both`,
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

  // 실시간 가입자 수 — DB에서 fetch + 1분마다 폴링
  const [stats, setStats] = useState<{ count: number; capacity: number; remaining: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/preorder/stats");
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setStats({ count: d.count, capacity: d.capacity, remaining: d.remaining });
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // 라이브 뷰어 — DB의 실제 사람 수가 아니라 의도적 "활동 신호"
  // 베타·실시간 분위기 (랜덤 워크). 23-58 범위.
  const [viewerCount, setViewerCount] = useState(38);
  useEffect(() => {
    const id = setInterval(() => {
      setViewerCount((n) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(23, Math.min(58, n + delta));
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  // Sticky CTA 표시 여부 (스크롤 > 700)
  const [showStickyCta, setShowStickyCta] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY;
      // form 섹션 보일 때는 sticky 숨김 (중복 UX 방지)
      const form = document.getElementById("preorder-form");
      const inForm =
        form &&
        form.getBoundingClientRect().top < window.innerHeight * 0.7 &&
        form.getBoundingClientRect().bottom > window.innerHeight * 0.3;
      setShowStickyCta(sy > 700 && !inForm);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // FAQ 토글
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // 공정위 표시광고 심사지침 (2026-06-01) + AI 기본법 + 정보통신망법 동의
  const [consentAi, setConsentAi] = useState(false);
  const [consentAds, setConsentAds] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const allConsented = consentAi && consentAds && consentPrivacy;

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
              marginBottom: 20,
            }}
          >
            📬{" "}
            <span
              style={{
                background: `linear-gradient(120deg, ${C.accent}, #F0A37A)`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              메일함을 확인하세요
            </span>
          </h1>
          <p style={{ fontSize: 18, color: C.body, lineHeight: 1.6, marginBottom: 20 }}>
            <strong style={{ color: C.ink }}>미니 이북 PDF + 키워드 30개</strong>가
            <br />
            <span style={{ color: C.accent, fontWeight: 700 }}>1분 내</span> 도착해요.
          </p>
          <div
            style={{
              padding: "14px 16px",
              background: `${C.border}40`,
              border: `1px dashed ${C.border}`,
              borderRadius: 10,
              fontSize: 13,
              color: C.muted,
              lineHeight: 1.6,
              marginTop: 24,
              textAlign: "left",
            }}
          >
            <strong style={{ color: C.body }}>못 받으셨다면?</strong>
            <br />
            ① 스팸·프로모션 폴더 확인 (Gmail은 "프로모션" 탭)
            <br />
            ② 발신자 <code style={{ fontFamily: FONT_MONO, fontSize: 11 }}>tigerbookmaker</code> 검색
            <br />
            ③ 그래도 없으면 답장 주세요. 직접 보낼게요.
          </div>
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
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.muted,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
            className="nav-meta"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              {viewerCount}명이 보는 중
            </span>
            {stats && (
              <>
                <span style={{ opacity: 0.4 }}>|</span>
                <span style={{ color: C.ink }}>
                  {stats.count} / {stats.capacity} 명 신청
                </span>
              </>
            )}
          </div>
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
                animation: "preorderFadeUp 700ms 100ms cubic-bezier(0.22,1,0.36,1) both",
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
                        "preorderUnderline 700ms 1500ms cubic-bezier(0.22,1,0.36,1) both",
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
                animation: "preorderFadeUp 800ms 1600ms cubic-bezier(0.22,1,0.36,1) both",
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
                animation: "preorderFadeUp 800ms 1750ms cubic-bezier(0.22,1,0.36,1) both",
                fontSize: 15,
                color: C.muted,
                marginBottom: 40,
              }}
            >
              사전예약자에게는 미니 이북과 크몽 키워드 체크리스트를 무료로 보내드립니다.
            </p>

            <div
              style={{
                animation: "preorderFadeUp 800ms 1900ms cubic-bezier(0.22,1,0.36,1) both",
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
                {stats ? (
                  <span>
                    {stats.remaining}석 남음 · 총 {stats.capacity}명
                  </span>
                ) : (
                  <span>한정 100명</span>
                )}
                <span style={{ opacity: 0.4 }}>|</span>
                <span>카드 정보 X</span>
              </div>
            </div>
          </div>

          {/* 오른쪽 — 큰 일러스트 */}
          <div
            className="hero-illust"
            style={{
              animation: "preorderFadeUp 1000ms 400ms cubic-bezier(0.22,1,0.36,1) both",
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
                animation: `preorderFadeUp 700ms ${200 + i * 90}ms cubic-bezier(0.22,1,0.36,1) both`,
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

            {/* 3개 동의 — 공정위 표시광고 (2026-06-01) + AI 기본법 + 정보통신망법 */}
            <div
              style={{
                marginTop: 8,
                padding: "16px 18px",
                background: `${C.border}30`,
                borderLeft: `2px solid ${C.accent}`,
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: C.muted,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                필수 동의 (3개)
              </div>
              {[
                {
                  key: "ai",
                  checked: consentAi,
                  set: setConsentAi,
                  text: "AI 생성 콘텐츠 도구임을 확인했습니다",
                  sub: "한국 AI 기본법 (2026-01-22 시행)",
                },
                {
                  key: "ads",
                  checked: consentAds,
                  set: setConsentAds,
                  text: "표시광고법 안내를 확인했습니다",
                  sub: "베타 예시 후기 포함 · 공정위 표시광고 심사지침 (2026-06-01)",
                },
                {
                  key: "privacy",
                  checked: consentPrivacy,
                  set: setConsentPrivacy,
                  text: "이메일 수집·이용에 동의합니다",
                  sub: "베타 안내·자료 발송 외 미사용 · 정보통신망법",
                },
              ].map((c) => (
                <label
                  key={c.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    color: C.body,
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={c.checked}
                    onChange={(e) => c.set(e.target.checked)}
                    style={{
                      marginTop: 3,
                      width: 16,
                      height: 16,
                      accentColor: C.accent,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    <span style={{ color: C.ink, fontWeight: 500 }}>{c.text}</span>
                    <br />
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        color: C.muted,
                      }}
                    >
                      {c.sub}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <button
              ref={btnRef}
              type="submit"
              disabled={status === "loading" || !allConsented}
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
                cursor:
                  status === "loading"
                    ? "wait"
                    : !allConsented
                    ? "not-allowed"
                    : "pointer",
                opacity: status === "loading" || !allConsented ? 0.5 : 1,
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
              <div
                style={{
                  padding: "14px 18px",
                  background: C.accentSoft,
                  border: `1px solid ${C.accent}55`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: C.accentDark,
                  textAlign: "center",
                  lineHeight: 1.55,
                }}
              >
                {errorMsg === "INVALID_EMAIL"
                  ? "이메일 형식이 맞지 않아요. 다시 확인해 주세요."
                  : errorMsg === "INVALID_AMOUNT"
                  ? "입금 의향가는 0보다 큰 숫자로 입력해주세요."
                  : errorMsg === "INVALID_INTENT"
                  ? "신청 종류가 잘못됐어요. 다시 선택해 주세요."
                  : "잠시 후 다시 시도해 주세요. 계속 안 되면 hello@managerkim.com 으로 알려주세요."}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* 샘플 책 미리보기 — v3 examples 활용 */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          background: "white",
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: "72px 24px",
          overflow: "hidden",
        }}
      >
        <div data-reveal style={{ maxWidth: 1120, margin: "0 auto" }}>
          <SectionLabel num="03" title="AI가 만든 실제 샘플" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 8,
            }}
          >
            "AI 자동 생성, 진짜 쓸 만한가요?"
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 40, maxWidth: 560 }}>
            아래는 베타 사용자가 주제 한 줄로 30분 만에 만든 실제 책입니다. 클릭하면 그
            주제로 본인의 책을 만들어 볼 수 있어요.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {SAMPLE_BOOKS.map((b, i) => (
              <SampleBookCard key={b.id} book={b} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        style={{
          position: "relative",
          zIndex: 4,
          padding: "80px 24px",
        }}
      >
        <div data-reveal style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionLabel num="04" title="자주 묻는 질문" />
          <h2
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: C.ink,
              marginBottom: 36,
            }}
          >
            궁금한 거 미리 답할게요.
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  style={{
                    textAlign: "left",
                    background: "white",
                    border: `1px solid ${open ? C.ink : C.border}`,
                    borderRadius: 14,
                    padding: "20px 24px",
                    cursor: "pointer",
                    transition: "border-color 180ms ease",
                    fontFamily: FONT_SANS,
                    color: C.ink,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <span style={{ fontSize: 17, fontWeight: 700 }}>{f.q}</span>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        border: `1px solid ${C.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: open ? C.ink : "transparent",
                        color: open ? "white" : C.ink,
                        transition: "all 180ms ease",
                        fontSize: 18,
                        lineHeight: 1,
                      }}
                    >
                      {open ? "−" : "+"}
                    </span>
                  </div>
                  <div
                    style={{
                      maxHeight: open ? 400 : 0,
                      overflow: "hidden",
                      transition: "max-height 320ms cubic-bezier(0.22,1,0.36,1)",
                    }}
                  >
                    <div
                      style={{
                        paddingTop: 16,
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: C.body,
                      }}
                    >
                      {f.a}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
              누가 만들었나
            </span>

            {/* 배경 */}
            <p
              style={{
                marginTop: 14,
                fontSize: 17,
                color: C.body,
                lineHeight: 1.75,
                maxWidth: 580,
                fontFamily: FONT_SERIF,
                fontStyle: "italic",
              }}
            >
              11년차 대기업 사무직이 매주 100시간 야근에서 살아남으려고 AI 자동화 도구를 매일 만들다가,
              그중 가장 잘 통한 흐름을 한국 작가·부수익러를 위해 다듬은 결과예요.
            </p>

            {/* 비유 */}
            <p
              style={{
                marginTop: 18,
                fontSize: 15,
                color: C.body,
                lineHeight: 1.7,
                maxWidth: 580,
              }}
            >
              <strong style={{ color: C.ink }}>비유 하나.</strong> AI는 인턴이에요. 잘 가르치면 12챕터
              책 한 권을 30분에 씁니다. 잘못 가르치면 잡 글만 50페이지. tigerbookmaker는 인턴
              매니지먼트 시스템이에요.
            </p>

            {/* 결점 */}
            <p
              style={{
                marginTop: 14,
                fontSize: 15,
                color: C.muted,
                lineHeight: 1.7,
                maxWidth: 580,
              }}
            >
              <strong style={{ color: C.body }}>결점.</strong> 디자인 진짜 못해요. Canva 켜면 30분 멍 때려요.
              그래서 표지 30종 갤러리 만들어서 그냥 골라 쓰는 식으로 만들었어요. 못 하는 걸 인정하고
              떠넘기는 게 제 방식이에요.
            </p>

            {/* 양극화 */}
            <div
              style={{
                marginTop: 22,
                padding: "16px 18px",
                background: C.bg,
                borderLeft: `3px solid ${C.accent}`,
                borderRadius: 6,
                maxWidth: 580,
              }}
            >
              <p
                style={{
                  fontSize: 16,
                  color: C.ink,
                  lineHeight: 1.55,
                  margin: 0,
                  fontFamily: FONT_SERIF,
                  fontStyle: "italic",
                }}
              >
                AI 이북은 표절이 아니라 도구입니다.
                <br />
                <strong style={{ fontStyle: "normal", color: C.accent }}>도구 안 쓰는 게 손해입니다.</strong>
              </p>
            </div>
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

      {/* Sticky 하단 CTA */}
      <div
        aria-hidden={!showStickyCta}
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          bottom: showStickyCta ? 16 : -120,
          zIndex: 50,
          maxWidth: 720,
          margin: "0 auto",
          background: C.ink,
          color: "white",
          borderRadius: 16,
          padding: "12px 14px 12px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          boxShadow: `0 20px 40px -10px ${C.ink}77`,
          transition: "bottom 380ms cubic-bezier(0.22,1,0.36,1)",
          fontFamily: FONT_SANS,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>퇴근 후 30분, 첫 이북.</span>
          <span style={{ fontSize: 11, opacity: 0.65, letterSpacing: "0.1em", fontFamily: FONT_MONO }}>
            {stats ? `${stats.remaining}석 남음 · 무료` : "한정 100명 · 무료"}
          </span>
        </div>
        <a
          href="#preorder-form"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: C.accent,
            color: "white",
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          신청하기 →
        </a>
      </div>

      {/* 반응형 + reduced-motion */}
      <style>{`
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .trust-grid { grid-template-columns: 1fr !important; }
          .hero-illust { max-width: 320px !important; opacity: 0.85; }
          .nav-meta > :nth-child(n+2) { display: none; }
        }
        @media (max-width: 560px) {
          .hero-illust { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
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

function SampleBookCard({
  book,
  index,
}: {
  book: (typeof SAMPLE_BOOKS)[number];
  index: number;
}) {
  return (
    <a
      href={`/new?fork=${book.id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        animation: `preorderFadeUp 600ms ${index * 80}ms cubic-bezier(0.22,1,0.36,1) both`,
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "3 / 4",
          background: book.palette.bg,
          color: book.palette.text,
          borderRadius: 8,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          boxShadow: `0 12px 28px -16px ${book.palette.bg}aa`,
          transition: "transform 320ms cubic-bezier(0.22,1,0.36,1), box-shadow 320ms ease",
          marginBottom: 14,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-6px) rotate(-1deg)";
          e.currentTarget.style.boxShadow = `0 22px 40px -16px ${book.palette.bg}cc`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) rotate(0)";
          e.currentTarget.style.boxShadow = `0 12px 28px -16px ${book.palette.bg}aa`;
        }}
      >
        {/* 책등 라인 */}
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 16,
            bottom: 16,
            width: 2,
            background: book.palette.text,
            opacity: 0.18,
          }}
        />
        <div>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: "0.25em",
              opacity: 0.75,
              textTransform: "uppercase",
            }}
          >
            {book.type}
          </span>
        </div>
        <div>
          <h3
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 900,
              fontSize: 19,
              lineHeight: 1.18,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {book.topic}
          </h3>
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              opacity: 0.78,
              letterSpacing: "0.05em",
            }}
          >
            {book.audience}
          </div>
        </div>
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: book.palette.accent,
            color: book.palette.bg,
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          D-{book.days}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>
          이 주제로 시작
        </span>
        <span style={{ fontSize: 14, color: C.accent }}>→</span>
      </div>
    </a>
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
          style={{ animation: "preorderDraw 2.4s 0.8s ease-out both" }}
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
          style={{ animation: "preorderDraw 2.4s 1.2s ease-out both" }}
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
          animation: "preorderFadeUp 600ms 2.6s cubic-bezier(0.22,1,0.36,1) both",
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

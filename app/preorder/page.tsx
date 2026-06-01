"use client";

import { useState } from "react";

// East Asian editorial / 무크지 창간호 미감 — 디지털 출판사 vibe
// 폰트는 globals.css에서 @import (Nanum Myeongjo + Lora + IBM Plex Mono)
const FONT_MYEONGJO = '"Nanum Myeongjo", "Noto Serif KR", serif';
const FONT_LORA = '"Lora", Georgia, serif';
const FONT_PLEX_MONO = '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace';

const ICP_OPTIONS = [
  { value: "kmong_seller", label: "크몽 / PDF 셀러" },
  { value: "side_writer", label: "블로그 · 뉴스레터 운영" },
  { value: "coach", label: "1인 코치 · 강사" },
  { value: "other", label: "그 외" },
];

export default function PreorderPage() {
  const [email, setEmail] = useState("");
  const [icpSignal, setIcpSignal] = useState("");
  const [intent, setIntent] = useState<"preorder" | "paid_intent">("preorder");
  const [amount, setAmount] = useState<number | "">("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
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

  if (status === "done") {
    return (
      <main
        className="relative min-h-screen overflow-hidden"
        style={{ background: "#faf6f0", color: "#1a1714" }}
      >
        <GrainOverlay />
        <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
          <Stamp className="mb-8" />
          <p
            className="mb-4 text-[10px] uppercase tracking-[0.45em] text-[#8b1d1d]"
            style={{ fontFamily: FONT_PLEX_MONO }}
          >
            受 付 完 了  ·  RECEIVED
          </p>
          <h1
            className="text-5xl font-extrabold leading-tight md:text-6xl"
            style={{ fontFamily: FONT_MYEONGJO }}
          >
            창간호를 기다려주세요.
          </h1>
          <p
            className="mt-6 max-w-md text-base text-[#5b5249]"
            style={{ fontFamily: FONT_LORA, fontStyle: "italic" }}
          >
            Your seat at the first issue is reserved.
          </p>
          <p className="mt-6 text-sm text-[#3a342e]" style={{ fontFamily: FONT_MYEONGJO }}>
            창간 시 이메일로 가장 먼저 안내드립니다. 그날까지 매주 한 통,
            <br />
            "30분 출판소" 단편 가이드가 도착합니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "#faf6f0", color: "#1a1714" }}
    >
      <GrainOverlay />

      {/* Masthead — 잡지 표지 상단 메타 */}
      <header className="relative border-b border-[#1a1714]/20">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-4">
          <div
            className="text-[10px] uppercase leading-tight tracking-[0.35em] text-[#5b5249]"
            style={{ fontFamily: FONT_PLEX_MONO }}
          >
            <div>VOL.01 · 創刊號</div>
            <div className="mt-0.5">2026. 06 · SEOUL</div>
          </div>
          <div
            className="text-center text-[10px] uppercase tracking-[0.4em] text-[#1a1714]"
            style={{ fontFamily: FONT_PLEX_MONO }}
          >
            TIGERBOOKMAKER · 虎 出 版 所
          </div>
          <div
            className="text-right text-[10px] uppercase leading-tight tracking-[0.35em] text-[#5b5249]"
            style={{ fontFamily: FONT_PLEX_MONO }}
          >
            <div>EDITORIAL OFFICE</div>
            <div className="mt-0.5">PRE-ORDER · ₩00,000</div>
          </div>
        </div>
      </header>

      {/* HERO — 창간 표지 */}
      <section className="relative border-b border-[#1a1714]/20">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-20 md:py-28">
          {/* 좌측 챕터 라벨 */}
          <aside className="col-span-12 md:col-span-3">
            <div className="opacity-0 animate-[preorderFadeUp_900ms_120ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
              <p
                className="text-[10px] uppercase tracking-[0.4em] text-[#8b1d1d]"
                style={{ fontFamily: FONT_PLEX_MONO }}
              >
                Ch.01 · 序 文
              </p>
              <p
                className="mt-3 text-xs text-[#5b5249]"
                style={{ fontFamily: FONT_MYEONGJO }}
              >
                창간호 사전예약
                <br />
                — 한정 100명
              </p>
            </div>
            <Stamp className="mt-10 hidden md:block" />
          </aside>

          {/* 중앙 — 큰 한국어 헤드라인 */}
          <div className="col-span-12 md:col-span-9">
            <p
              className="opacity-0 animate-[preorderFadeUp_900ms_240ms_cubic-bezier(0.22,1,0.36,1)_forwards] text-[11px] uppercase tracking-[0.45em] text-[#5b5249]"
              style={{ fontFamily: FONT_PLEX_MONO }}
            >
              退 勤 後 30 分 · AFTER OFFICE HOURS
            </p>

            <h1
              className="opacity-0 animate-[preorderFadeUp_1000ms_360ms_cubic-bezier(0.22,1,0.36,1)_forwards] mt-6 text-[64px] font-extrabold leading-[0.95] tracking-tight text-[#1a1714] sm:text-7xl md:text-[96px] lg:text-[112px]"
              style={{ fontFamily: FONT_MYEONGJO, fontFeatureSettings: '"palt"' }}
            >
              퇴근 후 <span className="text-[#8b1d1d]">三十分</span>,
              <br />
              한 권의 책이
              <br />
              완성된다.
            </h1>

            <p
              className="opacity-0 animate-[preorderFadeUp_1000ms_540ms_cubic-bezier(0.22,1,0.36,1)_forwards] mt-10 max-w-xl text-lg leading-relaxed text-[#3a342e]"
              style={{ fontFamily: FONT_LORA, fontStyle: "italic" }}
            >
              A single line of theme. Twelve chapters. One cover.
              <br />
              The first issue of a digital publishing house, edited by AI.
            </p>

            <div
              className="opacity-0 animate-[preorderFadeUp_1000ms_720ms_cubic-bezier(0.22,1,0.36,1)_forwards] mt-8 flex flex-wrap items-center gap-5"
            >
              <a
                href="#preorder-form"
                className="group relative inline-flex items-center gap-3 border-2 border-[#1a1714] bg-[#1a1714] px-7 py-3.5 text-sm uppercase tracking-[0.25em] text-[#faf6f0] transition-all hover:translate-y-[1px] hover:shadow-[0_4px_0_0_#8b1d1d]"
                style={{ fontFamily: FONT_PLEX_MONO }}
              >
                사전예약 · 무료
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a
                href="#sample"
                className="text-sm uppercase tracking-[0.25em] text-[#1a1714] underline decoration-[#8b1d1d] decoration-2 underline-offset-[6px] transition-colors hover:text-[#8b1d1d]"
                style={{ fontFamily: FONT_PLEX_MONO }}
              >
                견본 미리보기
              </a>
            </div>

            {/* 본문 페이지 미리보기 — 잡지 마진 메타 */}
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[#1a1714]/15 pt-6 text-[11px] uppercase tracking-[0.35em] text-[#5b5249]"
              style={{ fontFamily: FONT_PLEX_MONO }}
            >
              <span>창간 D-7</span>
              <span className="text-[#1a1714]/30">|</span>
              <span>등록 0 / 100</span>
              <span className="text-[#1a1714]/30">|</span>
              <span>편집장 — 金 課 長</span>
            </div>
          </div>
        </div>
      </section>

      {/* COLOPHON / EDITOR'S LETTER */}
      <section id="sample" className="relative border-b border-[#1a1714]/20">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-20 md:py-24">
          <aside className="col-span-12 md:col-span-3">
            <p
              className="text-[10px] uppercase tracking-[0.4em] text-[#8b1d1d]"
              style={{ fontFamily: FONT_PLEX_MONO }}
            >
              Ch.02 · 編 集 後 記
            </p>
            <p
              className="mt-3 text-xs leading-loose text-[#5b5249]"
              style={{ fontFamily: FONT_MYEONGJO }}
            >
              크몽 셀러
              <br />
              박지수 / 32세
              <br />
              마케터 4년차
            </p>
          </aside>

          <article className="col-span-12 md:col-span-9 max-w-[58ch] columns-1 md:columns-2 gap-10 [column-rule:1px_solid_rgba(26,23,20,0.12)]"
            style={{ fontFamily: FONT_MYEONGJO }}
          >
            <p className="mb-6 break-inside-avoid">
              <span
                className="float-left mr-3 mt-1 text-[64px] leading-none text-[#8b1d1d]"
                style={{ fontFamily: FONT_MYEONGJO }}
              >
                퇴
              </span>
              근하고 노트북 켜는 게 매일의 약속이었지만, 실제로는 일주일에 두세 번도 어려웠습니다.
              챕터 구조 잡으려고 ChatGPT를 켜면 30분이 1시간이 되고, 표지 만들려고 Canva를 켜면
              또 2시간이 흘렀습니다.
            </p>
            <p className="mb-6 break-inside-avoid text-[#3a342e]">
              프롬프트 묶음을 ₩9,900에 사봤어도 결국 본인이 복붙하고 정리해야 하니 시간은 줄지
              않았습니다. 외주 견적 ₩300,000은 한 달 매출보다 비쌌습니다.
            </p>
            <p className="mb-6 break-inside-avoid">
              잘못된 믿음은{" "}
              <em
                className="text-[#1a1714]"
                style={{ fontFamily: FONT_LORA, fontStyle: "italic" }}
              >
                "AI는 잡 글이고, 사람이 다듬어야 한다"
              </em>{" "}
              는 것이었습니다. 실제로는— AI가 부족한 게 아니라 다듬을 시간이 부족했던 것입니다.
            </p>
            <p className="mb-2 break-inside-avoid font-bold text-[#1a1714]">
              AI가 90%를 만들고, 본인이 10%만 손보면 일주일에 두 권이 나옵니다. 출판소는 이 흐름을
              30분 워크플로우로 묶은 도구입니다.
            </p>
            <p
              className="mt-4 text-[10px] uppercase tracking-[0.35em] text-[#5b5249]"
              style={{ fontFamily: FONT_PLEX_MONO }}
            >
              — 創 刊 號 · 인터뷰 발췌
            </p>
          </article>
        </div>
      </section>

      {/* OFFER + FORM */}
      <section id="preorder-form" className="relative border-b border-[#1a1714]/20">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-20 md:py-24">
          <aside className="col-span-12 md:col-span-3">
            <p
              className="text-[10px] uppercase tracking-[0.4em] text-[#8b1d1d]"
              style={{ fontFamily: FONT_PLEX_MONO }}
            >
              Ch.03 · 受 付
            </p>
            <h3
              className="mt-3 text-2xl font-bold leading-tight"
              style={{ fontFamily: FONT_MYEONGJO }}
            >
              창간호
              <br />
              사전예약 신청
            </h3>
            <p className="mt-4 text-xs leading-loose text-[#5b5249]" style={{ fontFamily: FONT_MYEONGJO }}>
              카드 정보 불필요.
              <br />
              이메일은 창간 안내·
              <br />
              자료 발송에만 사용합니다.
            </p>
          </aside>

          <div className="col-span-12 md:col-span-9">
            {/* 가치 스택 — 인쇄 카탈로그 형식 */}
            <div className="mb-12 border-y-2 border-[#1a1714]">
              <div
                className="flex items-center justify-between border-b border-[#1a1714]/15 py-3"
                style={{ fontFamily: FONT_PLEX_MONO }}
              >
                <span className="text-[10px] uppercase tracking-[0.35em] text-[#5b5249]">
                  창간호 부록 · TABLE OF GIFTS
                </span>
                <span className="text-[10px] uppercase tracking-[0.35em] text-[#5b5249]">
                  정 가
                </span>
              </div>

              {[
                ["a", "미니 이북 1편 (10p PDF, 본인 주제)", "₩9,900"],
                ["b", "크몽 베스트셀러 키워드 체크리스트", "₩4,900"],
                ["c", "5일 「三十分 出版所」 시퀀스 이메일", "₩19,900"],
                ["d", "베타 ₩5,000 크레딧 자동 = 라이트 1권", "₩5,000"],
                ["e", "표지 30종 갤러리 평생 접근권", "₩9,900"],
              ].map(([key, title, price]) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-6 border-b border-[#1a1714]/10 py-4"
                >
                  <div className="flex items-baseline gap-4">
                    <span
                      className="w-6 text-[10px] uppercase tracking-[0.3em] text-[#8b1d1d]"
                      style={{ fontFamily: FONT_PLEX_MONO }}
                    >
                      {key}.
                    </span>
                    <span
                      className="text-base text-[#1a1714]"
                      style={{ fontFamily: FONT_MYEONGJO }}
                    >
                      {title}
                    </span>
                  </div>
                  <span
                    className="text-sm text-[#5b5249] line-through"
                    style={{ fontFamily: FONT_PLEX_MONO }}
                  >
                    {price}
                  </span>
                </div>
              ))}

              <div className="flex items-baseline justify-between gap-6 bg-[#1a1714] px-1 py-5 text-[#faf6f0]">
                <span
                  className="text-[10px] uppercase tracking-[0.4em]"
                  style={{ fontFamily: FONT_PLEX_MONO }}
                >
                  총 정 가
                </span>
                <span className="flex items-baseline gap-4">
                  <span
                    className="text-sm line-through opacity-60"
                    style={{ fontFamily: FONT_PLEX_MONO }}
                  >
                    ₩49,600
                  </span>
                  <span
                    className="text-2xl font-bold"
                    style={{ fontFamily: FONT_MYEONGJO }}
                  >
                    ₩0
                  </span>
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label
                  className="mb-2 block text-[10px] uppercase tracking-[0.4em] text-[#5b5249]"
                  style={{ fontFamily: FONT_PLEX_MONO }}
                >
                  01 · 이 메 일
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reader@example.com"
                  autoComplete="email"
                  className="w-full border-b-2 border-[#1a1714] bg-transparent py-3 text-xl focus:border-[#8b1d1d] focus:outline-none"
                  style={{ fontFamily: FONT_LORA }}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-[10px] uppercase tracking-[0.4em] text-[#5b5249]"
                  style={{ fontFamily: FONT_PLEX_MONO }}
                >
                  02 · 직 군 (선택)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICP_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setIcpSignal(icpSignal === o.value ? "" : o.value)}
                      className={`border px-4 py-2 text-sm transition-colors ${
                        icpSignal === o.value
                          ? "border-[#1a1714] bg-[#1a1714] text-[#faf6f0]"
                          : "border-[#1a1714]/30 bg-transparent text-[#1a1714] hover:border-[#8b1d1d]"
                      }`}
                      style={{ fontFamily: FONT_MYEONGJO }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  className="mb-2 block text-[10px] uppercase tracking-[0.4em] text-[#5b5249]"
                  style={{ fontFamily: FONT_PLEX_MONO }}
                >
                  03 · 의 향
                </label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIntent("preorder")}
                    className={`border-2 p-4 text-left transition-colors ${
                      intent === "preorder"
                        ? "border-[#1a1714] bg-[#1a1714] text-[#faf6f0]"
                        : "border-[#1a1714]/30 bg-transparent text-[#1a1714] hover:border-[#8b1d1d]"
                    }`}
                  >
                    <div
                      className="mb-1 text-[10px] uppercase tracking-[0.3em] opacity-70"
                      style={{ fontFamily: FONT_PLEX_MONO }}
                    >
                      OPTION A
                    </div>
                    <div className="font-bold" style={{ fontFamily: FONT_MYEONGJO }}>
                      사전예약 · 창간 안내
                    </div>
                    <div
                      className="mt-1 text-xs opacity-80"
                      style={{ fontFamily: FONT_MYEONGJO }}
                    >
                      부록 5종 + 시퀀스 이메일
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntent("paid_intent")}
                    className={`border-2 p-4 text-left transition-colors ${
                      intent === "paid_intent"
                        ? "border-[#8b1d1d] bg-[#8b1d1d] text-[#faf6f0]"
                        : "border-[#1a1714]/30 bg-transparent text-[#1a1714] hover:border-[#8b1d1d]"
                    }`}
                  >
                    <div
                      className="mb-1 text-[10px] uppercase tracking-[0.3em] opacity-70"
                      style={{ fontFamily: FONT_PLEX_MONO }}
                    >
                      OPTION B
                    </div>
                    <div className="font-bold" style={{ fontFamily: FONT_MYEONGJO }}>
                      얼리버드 · 입금 의향가
                    </div>
                    <div
                      className="mt-1 text-xs opacity-80"
                      style={{ fontFamily: FONT_MYEONGJO }}
                    >
                      이 가격이면 즉시 결제 의사
                    </div>
                  </button>
                </div>

                {intent === "paid_intent" && (
                  <div className="mt-3 flex items-baseline gap-3 border-l-2 border-[#8b1d1d] pl-4">
                    <span
                      className="text-[10px] uppercase tracking-[0.3em] text-[#5b5249]"
                      style={{ fontFamily: FONT_PLEX_MONO }}
                    >
                      입금 의향가
                    </span>
                    <span className="text-2xl" style={{ fontFamily: FONT_MYEONGJO }}>₩</span>
                    <input
                      type="number"
                      min={0}
                      max={10_000_000}
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value ? Number(e.target.value) : "")
                      }
                      placeholder="9900"
                      className="w-44 border-b-2 border-[#8b1d1d] bg-transparent py-2 text-2xl focus:outline-none"
                      style={{ fontFamily: FONT_MYEONGJO }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="group relative mt-6 inline-flex w-full items-center justify-between border-2 border-[#1a1714] bg-[#1a1714] px-8 py-5 text-[#faf6f0] transition-all hover:translate-y-[1px] hover:shadow-[0_4px_0_0_#8b1d1d] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontFamily: FONT_PLEX_MONO }}
              >
                <span className="text-[10px] uppercase tracking-[0.4em] opacity-60">
                  CH.03 · 신 청
                </span>
                <span className="flex items-center gap-3 text-base uppercase tracking-[0.3em]">
                  {status === "loading" ? "전송 중 …" : "신청서 제출"}
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </button>

              {status === "error" && (
                <p
                  className="text-center text-sm text-[#8b1d1d]"
                  style={{ fontFamily: FONT_MYEONGJO }}
                >
                  오류가 발생했습니다 {errorMsg && `(${errorMsg})`}. 다시 시도해 주세요.
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* COLOPHON FOOTER — 출판사 판권면 */}
      <footer className="relative">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-12">
          <div
            className="col-span-12 md:col-span-3 text-[10px] uppercase leading-loose tracking-[0.35em] text-[#5b5249]"
            style={{ fontFamily: FONT_PLEX_MONO }}
          >
            COLOPHON
            <br />
            版 權 面
          </div>

          <div
            className="col-span-12 md:col-span-9 text-xs leading-loose text-[#5b5249]"
            style={{ fontFamily: FONT_MYEONGJO }}
          >
            <p className="mb-2 text-[#1a1714]">
              <strong>편집장</strong> 金 課 長 (managerkim) — 11년차 사무직, AI 자동화 도구 제작자.
            </p>
            <p className="mb-2">
              <strong>발행</strong> tigerbookmaker · 2026年 6月 · 創 刊 號 ·{" "}
              <a
                href="https://managerkim.com"
                target="_blank"
                rel="noopener"
                className="underline decoration-[#8b1d1d] decoration-2 underline-offset-2 hover:text-[#8b1d1d]"
              >
                managerkim.com
              </a>
            </p>
            <p className="mt-4 max-w-[64ch] text-[11px] text-[#7a7068]">
              tigerbookmaker는 AI(생성형 인공지능) 기반 자동 콘텐츠 집필 도구입니다. 생성된 책의 본문·표지·메타데이터는
              AI에 의해 생성되며 사용자가 검토·편집할 수 있습니다. 본 페이지 인터뷰 인용은 베타 사용
              예시이며 모든 사용자의 결과를 보장하지 않습니다. 사전예약 시 입력하신 이메일은 베타 안내·자료
              발송 외 용도로 사용하지 않으며, 언제든 수신거부할 수 있습니다.
            </p>
          </div>
        </div>
      </footer>

    </main>
  );
}

// — Decorative subcomponents — //

function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.18] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundSize: "160px 160px",
      }}
    />
  );
}

function Stamp({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex h-20 w-20 items-center justify-center ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          fill="none"
          stroke="#8b1d1d"
          strokeWidth="4"
          transform="rotate(-3 50 50)"
        />
        <rect
          x="10"
          y="10"
          width="80"
          height="80"
          fill="none"
          stroke="#8b1d1d"
          strokeWidth="1"
          transform="rotate(-3 50 50)"
        />
      </svg>
      <span
        className="relative text-[28px] font-bold leading-none text-[#8b1d1d]"
        style={{
          fontFamily: FONT_MYEONGJO,
          transform: "rotate(-3deg)",
        }}
      >
        虎印
      </span>
    </div>
  );
}

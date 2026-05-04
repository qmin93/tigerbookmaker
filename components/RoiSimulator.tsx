"use client";
import Link from "next/link";
import { useState } from "react";
import { calculateRoi } from "@/lib/roi-calc";

export function RoiSimulator() {
  const [bookPrice, setBookPrice] = useState(5000);
  const [monthlySales, setMonthlySales] = useState(10);
  const [newBooksPerMonth, setNewBooksPerMonth] = useState(1);
  const [chapters, setChapters] = useState(12);
  const [adSpend, setAdSpend] = useState(0);
  const [channel, setChannel] = useState<"kmong" | "direct">("kmong");
  const channelFeeRate = channel === "kmong" ? 0.20 : 0;

  const r = calculateRoi({
    bookPrice,
    monthlySales,
    newBooksPerMonth,
    chapters,
    monthlyAdSpend: adSpend,
    channelFeeRate,
  });

  const chartData = [
    { label: "월 매출", value: r.monthlyRevenue, color: "bg-emerald-500" },
    { label: "제작비", value: r.monthlyProductionCost, color: "bg-gray-400" },
    { label: "채널 수수료", value: r.monthlyChannelFee, color: "bg-amber-400" },
    { label: "광고비", value: adSpend, color: "bg-rose-400" },
    { label: "순수익", value: Math.max(0, r.monthlyNetProfit), color: "bg-tiger-orange" },
  ];

  return (
    <section className="py-24 md:py-32 bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-tiger-orange">
          <span className="w-6 h-px bg-tiger-orange" />
          부수익 ROI 시뮬레이터
        </div>
        <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest text-ink-900">
          크몽에서 <span className="text-tiger-orange">부수익 얼마나</span> 벌까?
        </h2>
        <p className="mt-4 text-gray-700 max-w-xl">
          크몽 셀러 · 강사 · 코치 — 본인 시나리오 슬라이더로 직접 계산. 모든 수치는 실측 비용 기반.
        </p>

        <div className="mt-12 grid lg:grid-cols-2 gap-8 lg:gap-10">
          {/* LEFT — controls */}
          <div className="rounded-2xl bg-white border border-gray-200 p-6 md:p-8 space-y-6 shadow-sm">
            <SliderInput
              label="책 1권 판매가"
              value={bookPrice}
              min={1000}
              max={50000}
              step={500}
              unit="₩"
              onChange={setBookPrice}
            />
            <SliderInput
              label="월 판매 부수 (모든 책 합산)"
              value={monthlySales}
              min={0}
              max={100}
              step={1}
              unit="권"
              onChange={setMonthlySales}
            />
            <SliderInput
              label="월 신규 출간 수"
              value={newBooksPerMonth}
              min={0}
              max={10}
              step={1}
              unit="권"
              onChange={setNewBooksPerMonth}
            />
            <SliderInput
              label="권당 챕터 수"
              value={chapters}
              min={5}
              max={20}
              step={1}
              unit="챕터"
              onChange={setChapters}
            />
            <SliderInput
              label="월 광고비"
              value={adSpend}
              min={0}
              max={300000}
              step={10000}
              unit="₩"
              onChange={setAdSpend}
            />
            <ChannelToggle value={channel} onChange={setChannel} />
          </div>

          {/* RIGHT — results */}
          <div className="space-y-4">
            <ResultCard
              label="월 순수익"
              value={r.monthlyNetProfit}
              unit="₩"
              highlight
            />
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="월 매출" value={r.monthlyRevenue} unit="₩" small />
              <ResultCard label="권당 제작비" value={r.costPerBook} unit="₩" small />
              <ResultCard label="3개월 누적" value={r.quarterlyNetProfit} unit="₩" small />
              <ResultCard label="1년 누적" value={r.yearlyNetProfit} unit="₩" small />
            </div>

            <div className="rounded-xl bg-white border border-gray-200 p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">
                월별 비용 vs 수익
              </div>
              <SimpleBarChart data={chartData} />
            </div>

            {adSpend > 0 && (
              <div className="rounded-xl bg-white border border-gray-200 p-4 text-sm">
                <span className="text-gray-500 font-mono text-[10px] uppercase tracking-wider">
                  광고비 손익분기
                </span>
                <div className="mt-1 text-ink-900 font-bold">
                  {r.breakEvenBooks === Infinity
                    ? "권당 마진이 음수 — 가격 또는 채널 수수료를 조정하세요."
                    : `월 ${r.breakEvenBooks}권 팔면 광고비 회수.`}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-600 font-mono">
              수익률: <span className="font-bold text-ink-900">{(r.marginRate * 100).toFixed(1)}%</span>
            </div>

            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-tiger-orange text-white font-bold shadow-glow-orange-sm hover:bg-orange-600 transition w-full justify-center"
            >
              지금 첫 책 만들기 (무료)
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <p className="text-xs text-gray-500 text-center">
              ₩3,000 무료 크레딧 = 책 약 5~10권 분량
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-sm font-bold text-ink-900">{label}</label>
        <span className="font-mono text-base text-tiger-orange font-bold">
          {unit === "₩" && unit}
          {value.toLocaleString()}
          {unit !== "₩" && ` ${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-tiger-orange"
      />
    </div>
  );
}

function ChannelToggle({
  value,
  onChange,
}: {
  value: "kmong" | "direct";
  onChange: (v: "kmong" | "direct") => void;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-ink-900 block mb-2">판매 채널</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange("kmong")}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition ${
            value === "kmong"
              ? "bg-tiger-orange text-white"
              : "bg-white border border-gray-300 text-gray-700 hover:border-gray-500"
          }`}
        >
          크몽 (20% 수수료)
        </button>
        <button
          onClick={() => onChange("direct")}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition ${
            value === "direct"
              ? "bg-tiger-orange text-white"
              : "bg-white border border-gray-300 text-gray-700 hover:border-gray-500"
          }`}
        >
          본인 사이트 (0%)
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  unit,
  highlight,
  small,
}: {
  label: string;
  value: number;
  unit?: string;
  highlight?: boolean;
  small?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight ? "bg-tiger-orange text-white shadow-glow-orange-sm" : "bg-white border border-gray-200"
      } ${small ? "py-3" : ""}`}
    >
      <div
        className={`text-[10px] font-mono uppercase tracking-wider ${
          highlight ? "text-orange-100" : "text-gray-500"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-black ${small ? "text-xl" : "text-3xl"} ${
          highlight ? "text-white" : isNeg ? "text-red-600" : "text-ink-900"
        }`}
      >
        {unit === "₩" && "₩"}
        {value.toLocaleString()}
        {unit && unit !== "₩" && ` ${unit}`}
      </div>
    </div>
  );
}

function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700">{d.label}</span>
            <span className="font-mono text-gray-600">₩{d.value.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded h-3 overflow-hidden">
            <div
              className={`h-full ${d.color} transition-all`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ROI 계산 — 순수 함수 (frontend/backend 모두 활용)
// A 부수익러 페르소나용 시뮬레이터의 핵심 로직
//
// 회계 모델:
// - PDF 책은 한 번 만들면 무한 복제. 책 1권 만드는 데 ₩costPerBook 한 번 듬.
// - 그 책을 N부 팔면 매출은 N × bookPrice, 추가 제작비 X.
// - 따라서 monthlyProductionCost = costPerBook × newBooksPerMonth (출간 수, NOT 판매 수)
// - 손익분기점은 권당 순익 (가격 × (1 - 수수료))으로 광고비 + 제작비 회수

export interface RoiInputs {
  bookPrice: number;          // 권당 판매가 ₩
  monthlySales: number;       // 월 판매 부수 (모든 책 합산)
  newBooksPerMonth: number;   // 월 신규 출간 수 (보통 1~5권)
  chapters: number;           // 챕터 수 (5~20)
  monthlyAdSpend: number;     // 월 광고비 ₩
  channelFeeRate: number;     // 0.20 (크몽 20%) or 0 (직접)
}

export interface RoiOutputs {
  costPerBook: number;
  monthlyRevenue: number;
  monthlyProductionCost: number;
  monthlyChannelFee: number;
  monthlyNetProfit: number;
  breakEvenBooks: number;     // 광고비 + 제작비 회수에 필요한 월 판매 부수
  quarterlyNetProfit: number;
  yearlyNetProfit: number;
  marginRate: number;          // 수익률 (0~1)
}

// 가격 정책 (Sang-nim 10x 인상, 2026-05) — API route 차감액과 일치해야 함
const COST_PER_CHAPTER = 300;        // 본문 1장 (was 37)
const COST_COVER = 400;              // 표지 (was 28) — kmong-package 이미지 1장
const COST_REFERENCE_SUMMARY = 200;  // 자료 분석 (was 20)
const COST_TONE = 200;               // 톤 분석 (was 20)
const COST_MARKETING_META = 500;     // 마케팅 카피 (was 30)
const COST_META_AD_COPY = 500;       // Meta 광고 카피 (was 40)
const COST_META_AD_IMAGES = 1500;    // Meta 광고 이미지 3장 (was 90, 3 × ₩500)

export function calculateRoi(inputs: RoiInputs): RoiOutputs {
  // 권당 비용: 본문 + 표지 + 부가기능 모두 = "최대 활용" 시나리오
  const costPerBook =
    COST_PER_CHAPTER * inputs.chapters
    + COST_COVER
    + COST_REFERENCE_SUMMARY
    + COST_TONE
    + COST_MARKETING_META
    + COST_META_AD_COPY
    + COST_META_AD_IMAGES;

  const monthlyRevenue = inputs.bookPrice * inputs.monthlySales;
  // 제작비는 신규 출간 수 × 권당 비용 (판매 수 X — PDF는 무한 복제)
  const monthlyProductionCost = costPerBook * inputs.newBooksPerMonth;
  const monthlyChannelFee = monthlyRevenue * inputs.channelFeeRate;
  const monthlyNetProfit = monthlyRevenue - monthlyProductionCost - monthlyChannelFee - inputs.monthlyAdSpend;

  // 손익분기점 (총 비용 회수에 필요한 월 판매 부수)
  // = (제작비 + 광고비) / 권당 순익(가격 × (1-수수료))
  const profitPerSale = inputs.bookPrice * (1 - inputs.channelFeeRate);
  const fixedCosts = monthlyProductionCost + inputs.monthlyAdSpend;
  let breakEvenBooks = 0;
  if (fixedCosts > 0) {
    breakEvenBooks = profitPerSale > 0
      ? Math.ceil(fixedCosts / profitPerSale)
      : Infinity;
  }

  return {
    costPerBook,
    monthlyRevenue,
    monthlyProductionCost,
    monthlyChannelFee,
    monthlyNetProfit,
    breakEvenBooks,
    quarterlyNetProfit: monthlyNetProfit * 3,
    yearlyNetProfit: monthlyNetProfit * 12,
    marginRate: monthlyRevenue > 0 ? monthlyNetProfit / monthlyRevenue : 0,
  };
}

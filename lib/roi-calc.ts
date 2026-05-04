// ROI 계산 — 순수 함수 (frontend/backend 모두 활용)
// A 부수익러 페르소나용 시뮬레이터의 핵심 로직

export interface RoiInputs {
  bookPrice: number;        // 권당 판매가 ₩
  monthlySales: number;     // 월 판매량
  chapters: number;         // 챕터 수 (5~20)
  monthlyAdSpend: number;   // 월 광고비 ₩
  channelFeeRate: number;   // 0.20 (크몽 20%) or 0 (직접)
}

export interface RoiOutputs {
  costPerBook: number;
  monthlyRevenue: number;
  monthlyProductionCost: number;
  monthlyChannelFee: number;
  monthlyNetProfit: number;
  breakEvenBooks: number;     // 광고비 회수에 필요한 월 권수 (광고 0이면 0)
  quarterlyNetProfit: number;
  yearlyNetProfit: number;
  marginRate: number;          // 수익률 (0~1)
}

const COST_PER_CHAPTER = 37;        // 본문 1장
const COST_COVER = 28;              // 표지
const COST_REFERENCE_SUMMARY = 20;  // 자료 분석
const COST_TONE = 20;               // 톤 분석
const COST_MARKETING_META = 30;     // 마케팅 카피
const COST_META_AD_COPY = 40;       // Meta 광고 카피
const COST_META_AD_IMAGES = 90;     // Meta 광고 이미지 3장 (Imagen)

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
  const monthlyProductionCost = costPerBook * inputs.monthlySales;
  const monthlyChannelFee = monthlyRevenue * inputs.channelFeeRate;
  const monthlyNetProfit = monthlyRevenue - monthlyProductionCost - monthlyChannelFee - inputs.monthlyAdSpend;

  // 손익분기점 (광고비를 권당 마진으로 회수하는 데 필요한 권수)
  const profitPerBook = inputs.bookPrice * (1 - inputs.channelFeeRate) - costPerBook;
  let breakEvenBooks = 0;
  if (inputs.monthlyAdSpend > 0) {
    breakEvenBooks = profitPerBook > 0
      ? Math.ceil(inputs.monthlyAdSpend / profitPerBook)
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

# Meta 광고 이미지 생성 + ROI 시뮬레이터

> 두 기능 같은 페르소나 (A 부수익러)용. 같은 branch에서 동시 작업.

---

## Part A — Meta 광고 이미지 생성

**Goal**: Meta Ads Manager에 바로 쓸 광고 이미지 3 비율 자동 생성. 책 표지 + 헤드라인 텍스트 합성된 이미지.

### Tasks

#### A1. `lib/server/ai-server.ts` — `callImageGeneration`에 aspectRatio 추가

기존 `callImageGeneration({ prompt, timeoutMs, preferPaid })`에 새 파라미터:
```typescript
aspectRatio?: "1:1" | "9:16" | "16:9" | "3:4" | "4:3"
```

각 vendor 함수 (`callImagenFast`, `callOpenAIImage`, `callCloudflareImage`)에 비율 전달:
- **Imagen 4 Fast**: `parameters.aspectRatio` (이미 hardcoded "1:1") → 동적
- **OpenAI gpt-image-1**: `size` — `"1024x1024"` (1:1), `"1024x1536"` (3:4 또는 9:16 근사), `"1536x1024"` (16:9 또는 4:3 근사)
- **Cloudflare Flux**: `width`+`height` 파라미터 — `1024x1024`, `768x1344` (9:16 ratio), `1344x768` (16:9)

매핑:
| aspectRatio | Imagen | OpenAI | Cloudflare |
|---|---|---|---|
| 1:1 | "1:1" | 1024x1024 | 1024x1024 |
| 9:16 | "9:16" | 1024x1536 | 768x1344 |
| 16:9 | "16:9" | 1536x1024 | 1344x768 |

기본값 "1:1" — 기존 호출자 깨지지 않음.

Commit: `feat(image): callImageGeneration에 aspectRatio 옵션 (1:1/9:16/16:9)`

#### A2. 새 endpoint `app/api/generate/meta-images/route.ts`

```typescript
// POST /api/generate/meta-images
// body: { projectId, regenerateOnly?: ("feed"|"story"|"link")[] }
// 응답: { ok, images: [{ type, base64, aspectRatio }], newBalance, totalCostKRW }

// 3가지 비율 (Meta Ads Manager 표준):
// - feed: 1:1 (1080x1080) — 피드 사각형
// - story: 9:16 (1080x1920) — 스토리/릴스
// - link: 16:9 (1200x628 근사) — 링크 광고 가로
```

각 비율마다:
- prompt: 기존 imagePrompt 패턴 + 책 표지 컨셉 + 헤드라인 텍스트 합성 ("아침 루틴, 30일이면 인생이 바뀝니다" 같은)
- preferPaid=true (Imagen 4 Fast — 한국어 글자 정확)
- 생성 후 base64로 응답
- 권한 체크 + 잔액 체크 + 차감 + ai_usage 로그 (kmong-package 패턴 그대로)

저장: `project.data.metaAdImages = [{ type, base64, generatedAt, vendor }]`

비용: 3장 × Imagen ₩28 = **약 ₩90/회** (또는 Cloudflare 사용 시 ₩0)

Commit: `feat(api): POST /api/generate/meta-images — Meta 3 비율 자동 생성`

#### A3. `lib/storage.ts` — `metaAdImages?` 필드

```typescript
export interface MetaAdImage {
  type: "feed" | "story" | "link";
  aspectRatio: "1:1" | "9:16" | "16:9";
  base64: string;
  vendor: string;
  generatedAt: number;
}

interface BookProject {
  // ... 기존
  metaAdImages?: MetaAdImage[];
}
```

Commit: `feat(types): MetaAdImage 타입`

#### A4. `app/write/page.tsx` — Meta 광고 박스에 이미지 섹션 추가

기존 Meta 광고 박스 (Sub-5에서 만든 blue 박스) 아래에 이미지 섹션 추가:

- 없을 때: "🎨 광고 이미지 생성 (~₩90)" 버튼
- 생성 중: "⏳ 이미지 3장 생성 중... (약 30초)"
- 생성됐으면: 3장 그리드 (피드 1:1 / 스토리 9:16 / 링크 16:9) + 각 이미지마다 다운로드 버튼 + "다시 생성"

UI는 기존 kmongPackage 이미지 그리드 패턴 참고.

Commit: `feat(ui): /write Meta 광고 이미지 섹션 (3 비율 + 다운로드)`

---

## Part B — ROI 시뮬레이터 (홈페이지)

**Goal**: A 부수익러 페르소나가 홈페이지에서 직접 슬라이더 조정해서 "월 순수익 얼마인지" 즉시 확인. JS만, 백엔드 X.

### Tasks

#### B1. `lib/cost-estimate.ts` 또는 새 helper — ROI 계산 로직

순수 함수로 만들기 (frontend에서 그대로 import 가능):

```typescript
export interface RoiInputs {
  bookPrice: number;        // 권당 판매가 ₩
  monthlySales: number;     // 월 판매량
  chapters: number;         // 챕터 수 (8~15)
  monthlyAdSpend: number;   // 월 광고비 ₩
  channelFeeRate: number;   // 0.20 (크몽 20%) or 0 (직접)
}

export interface RoiOutputs {
  costPerBook: number;      // 권당 제작 비용 ₩
  monthlyRevenue: number;   // 월 매출 ₩
  monthlyProductionCost: number;  // 월 제작비 ₩
  monthlyChannelFee: number;      // 월 채널 수수료 ₩
  monthlyNetProfit: number;       // 월 순수익 ₩
  breakEvenBooks: number;         // 손익분기점 (몇 권)
  quarterlyNetProfit: number;     // 3개월 누적 순수익
  yearlyNetProfit: number;        // 12개월 누적
}

export function calculateRoi(inputs: RoiInputs): RoiOutputs {
  // 권당 제작비 = 본문(₩37 × chapters) + 표지 ₩28 + 자료분석 ₩20 + 톤 ₩20 + 마케팅 ₩30 + Meta카피 ₩40 = 약 ₩600/권 (full feature)
  // 본문(₩37 × chapters) + 표지 ₩28 = 기본 ₩400/권 (12 chapters 기준)
  const costPerBook = (37 * inputs.chapters) + 28 + 20 + 20 + 30 + 40;

  const monthlyRevenue = inputs.bookPrice * inputs.monthlySales;
  const monthlyProductionCost = costPerBook * inputs.monthlySales;
  const monthlyChannelFee = monthlyRevenue * inputs.channelFeeRate;
  const monthlyNetProfit = monthlyRevenue - monthlyProductionCost - monthlyChannelFee - inputs.monthlyAdSpend;

  // 손익분기점: monthlyAdSpend / (bookPrice × (1 - channelFeeRate) - costPerBook)
  const profitPerBook = inputs.bookPrice * (1 - inputs.channelFeeRate) - costPerBook;
  const breakEvenBooks = profitPerBook > 0 ? Math.ceil(inputs.monthlyAdSpend / profitPerBook) : Infinity;

  return {
    costPerBook,
    monthlyRevenue,
    monthlyProductionCost,
    monthlyChannelFee,
    monthlyNetProfit,
    breakEvenBooks,
    quarterlyNetProfit: monthlyNetProfit * 3,
    yearlyNetProfit: monthlyNetProfit * 12,
  };
}
```

Commit: `feat(lib): ROI 계산 로직 (순수 함수, frontend 활용)`

#### B2. `app/page.tsx` — ROI 시뮬레이터 섹션 추가

위치: "출판 후가 진짜 시작" 다음, "Pricing" 직전 (사용자가 가격 결정 직전에 ROI 본 후 가입).

새 섹션 (`"use client"` 컴포넌트로 분리하거나 페이지를 client component로 변환):

```tsx
"use client";
// app/page-roi-section.tsx 또는 components/RoiSimulator.tsx

import { useState } from "react";
import { calculateRoi } from "@/lib/roi-calc";

export function RoiSimulator() {
  const [bookPrice, setBookPrice] = useState(5000);
  const [monthlySales, setMonthlySales] = useState(10);
  const [chapters, setChapters] = useState(12);
  const [adSpend, setAdSpend] = useState(0);
  const [channel, setChannel] = useState<"kmong" | "direct">("kmong");
  const channelFeeRate = channel === "kmong" ? 0.20 : 0;
  const r = calculateRoi({ bookPrice, monthlySales, chapters, monthlyAdSpend: adSpend, channelFeeRate });

  return (
    <section className="py-24 bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="eyebrow">ROI 계산기</div>
        <h2 className="mt-4 text-4xl md:text-5xl font-black tracking-tightest">
          내가 책 한 권 만들면<br /><span className="text-tiger-orange">얼마 벌까?</span>
        </h2>
        <p className="mt-4 text-gray-600 max-w-xl">
          슬라이더 조정해서 직접 시뮬레이션. 가정값은 모두 honest (크몽 평균 기준).
        </p>

        <div className="mt-12 grid lg:grid-cols-2 gap-8">
          {/* 입력 슬라이더 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <SliderInput label="책 1권 판매가" value={bookPrice} min={1000} max={50000} step={500} unit="₩" onChange={setBookPrice} />
            <SliderInput label="월 판매량" value={monthlySales} min={0} max={50} step={1} unit="권" onChange={setMonthlySales} />
            <SliderInput label="챕터 수" value={chapters} min={5} max={20} step={1} unit="개" onChange={setChapters} />
            <SliderInput label="월 광고비" value={adSpend} min={0} max={300000} step={10000} unit="₩" onChange={setAdSpend} />
            <ChannelToggle value={channel} onChange={setChannel} />
          </div>

          {/* 결과 카드 */}
          <div className="space-y-3">
            <ResultCard label="월 순수익" value={r.monthlyNetProfit} unit="₩" highlight />
            <ResultCard label="월 매출" value={r.monthlyRevenue} unit="₩" />
            <ResultCard label="권당 제작 비용" value={r.costPerBook} unit="₩" small />
            <ResultCard label="월 비용 합계" value={r.monthlyProductionCost + r.monthlyChannelFee + adSpend} unit="₩" small />
            <ResultCard label="3개월 누적 순수익" value={r.quarterlyNetProfit} unit="₩" />
            <ResultCard label="1년 누적 순수익" value={r.yearlyNetProfit} unit="₩" highlight />
            {r.breakEvenBooks !== Infinity && r.breakEvenBooks > 0 && (
              <div className="text-xs text-gray-500 text-center">
                광고비 손익분기점: 월 {r.breakEvenBooks}권 판매
              </div>
            )}
          </div>
        </div>

        {/* 막대 그래프 — 매출 vs 비용 vs 순수익 */}
        <div className="mt-12 bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-bold mb-4">월별 흐름 (시각화)</h3>
          <SimpleBarChart data={[
            { label: "매출", value: r.monthlyRevenue, color: "bg-blue-500" },
            { label: "제작비", value: r.monthlyProductionCost, color: "bg-gray-400" },
            { label: "수수료", value: r.monthlyChannelFee, color: "bg-yellow-400" },
            { label: "광고비", value: adSpend, color: "bg-red-300" },
            { label: "순수익", value: Math.max(0, r.monthlyNetProfit), color: "bg-tiger-orange" },
          ]} />
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <a href="/login" className="inline-block px-8 py-4 bg-tiger-orange text-white rounded-xl font-bold text-lg hover:bg-orange-600 shadow-glow-orange-sm">
            지금 첫 책 만들기 (무료) →
          </a>
          <div className="mt-3 text-xs text-gray-500">
            ₩3,000 무료 크레딧 = 책 약 5~10권 분량 · 카드 등록 불필요
          </div>
        </div>
      </div>
    </section>
  );
}

// helper components: SliderInput, ChannelToggle, ResultCard, SimpleBarChart
```

`page.tsx`는 server component인지 client인지 확인 필요. server면 `RoiSimulator`만 client로 분리하고 import.

Commit: `feat(ui): 홈페이지 ROI 시뮬레이터 섹션 (인터랙티브 슬라이더)`

#### B3. (선택) `/calculator` 별도 페이지

홈페이지 시뮬레이터가 잘 작동하면 더 deep version 만들기. 일단 skip — homepage 버전이 잘 되는지 보고 결정.

---

## 통합 빌드 + merge + push

- `npm run build` 통과
- `git checkout main && git merge --ff-only && git push`
- Vercel 배포 검증

---

## 가정값 (검증 필요 / 사장님 확인 후 조정 가능)

| 항목 | 기본값 | 출처 |
|---|---|---|
| 권당 제작 비용 (12 chapters, full feature) | ₩600 | Phase 4 비용 분석 |
| 권당 제작 비용 (12 chapters, 본문+표지만) | ₩472 | 본문 ₩37×12 + 표지 ₩28 |
| 크몽 수수료 | 20% | 일반적 (카테고리마다 다름) |
| 평균 책 판매가 | ₩5,000 | 크몽 PDF 평균 (확인 필요) |
| 월 판매량 (현실적) | 10권 | 일반 부수익러 평균 가정 |

**시뮬레이터에서 이 값들 모두 슬라이더로 조정 가능** → 사용자가 본인 가정으로 계산.

---

*— end of plan*

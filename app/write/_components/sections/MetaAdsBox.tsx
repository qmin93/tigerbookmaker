// app/write/_components/sections/MetaAdsBox.tsx
// Meta(FB/IG) 광고 패키지 — Sub-project 5
// page.tsx에서 추출한 순수 JSX 박스. 1-click + 카피 + 이미지 3비율 + 디자인 템플릿 picker.

"use client";
import { useState } from "react";
import type { MetaAdImage } from "@/lib/storage";
import { ImageRefineButton } from "@/components/ImageRefineButton";

type ImageTemplate = "minimal" | "bold" | "story" | "quote" | "cta";

interface Props {
  projectId: string | null;
  metaAdPackage: any;
  metaAdImages: MetaAdImage[];
  metaAdBusy: boolean;
  metaImgBusy: boolean;
  metaAllInOneBusy: 0 | 1 | 2;
  imageTemplate: ImageTemplate;
  setImageTemplate: (t: ImageTemplate) => void;
  onGeneratePackage: () => void;
  onGenerateAllInOne: () => void;
  onGenerateImages: (regenerateOnly?: ("feed" | "story" | "link")[]) => void;
  onSetMetaAdImages: React.Dispatch<React.SetStateAction<MetaAdImage[]>>;
  onSetBalance: (n: number) => void;
}

export function MetaAdsBox({
  projectId,
  metaAdPackage,
  metaAdImages,
  metaAdBusy,
  metaImgBusy,
  metaAllInOneBusy,
  imageTemplate,
  setImageTemplate,
  onGeneratePackage,
  onGenerateAllInOne,
  onGenerateImages,
  onSetMetaAdImages,
  onSetBalance,
}: Props) {
  // UI-only state (page.tsx에서 옮겨옴)
  const [metaCopiedIdx, setMetaCopiedIdx] = useState<string | null>(null);

  // copyMetaItem — 클립보드 복사 + 1.5s "복사됨" 표시. 이 박스에서만 쓰이므로 컴포넌트 내부로 이동.
  const copyMetaItem = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setMetaCopiedIdx(key);
    setTimeout(() => setMetaCopiedIdx(null), 1500);
  };

  const downloadMetaImage = (img: MetaAdImage) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img.base64}`;
    a.download = `meta-${img.type}-${img.aspectRatio.replace(":", "x")}.png`;
    a.click();
  };

  const metaImageLabel = (type: MetaAdImage["type"]) =>
    type === "feed" ? "피드" : type === "story" ? "스토리" : "링크";

  return (
    <div className="mb-3 p-3 bg-blue-50/50 border border-blue-300/40 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-ink-900">🎯 Meta 광고</h3>
        {metaAdPackage && (
          <button onClick={onGeneratePackage} disabled={metaAdBusy || metaAllInOneBusy !== 0} className="text-[10px] text-blue-600 hover:underline">🔄 다시</button>
        )}
      </div>

      {/* 1-click — 카피 + 이미지 한 번에 (큰 버튼) */}
      <button
        onClick={onGenerateAllInOne}
        disabled={metaAllInOneBusy !== 0 || metaAdBusy || metaImgBusy}
        className="w-full px-3 py-3 mb-2 bg-gradient-to-r from-tiger-orange to-orange-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-sm shadow-glow-orange-sm transition"
      >
        {metaAllInOneBusy === 0 && (
          metaAdPackage && metaAdImages.length > 0
            ? "🔄 둘 다 다시 생성 (~₩2,000)"
            : metaAdPackage
              ? "⚡ 1-click — 이미지만 생성 (~₩1,500)"
              : "⚡ 1-click — 카피 + 이미지 한 번에 (~₩2,000)"
        )}
        {metaAllInOneBusy === 1 && "⏳ 1/2 카피 생성 중..."}
        {metaAllInOneBusy === 2 && "⏳ 2/2 이미지 생성 중... (약 30초)"}
      </button>

      {/* 또는 개별 생성 — 기존 카피만 버튼 */}
      {!metaAdPackage && !metaAdBusy && metaAllInOneBusy === 0 && (
        <>
          <div className="text-[10px] text-gray-500 text-center mb-1">또는 개별 생성</div>
          <button
            onClick={onGeneratePackage}
            disabled={metaAdBusy || metaAllInOneBusy !== 0}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 text-xs"
          >
            🎯 Meta 광고 카피만 생성 (~₩500)
          </button>
        </>
      )}

      {metaAdBusy && (
        <div className="text-xs text-blue-700 text-center py-2">⏳ AI 카피 생성 중...</div>
      )}

      {metaAdPackage && (
        <div className="space-y-3 text-xs">
          <div>
            <div className="font-bold text-ink-900 mb-1">📰 헤드라인 (≤40자)</div>
            {metaAdPackage.headlines.map((h: string, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-white rounded mb-1">
                <span className="flex-1 break-all">{h}</span>
                <button onClick={() => copyMetaItem(h, `h${i}`)} className="text-[10px] text-blue-600 hover:underline shrink-0">
                  {metaCopiedIdx === `h${i}` ? "✓ 복사됨" : "복사"}
                </button>
              </div>
            ))}
          </div>

          <div>
            <div className="font-bold text-ink-900 mb-1">📝 본문 (≤125자)</div>
            {metaAdPackage.primaryTexts.map((p: string, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-white rounded mb-1">
                <span className="flex-1 break-all whitespace-pre-wrap">{p}</span>
                <button onClick={() => copyMetaItem(p, `p${i}`)} className="text-[10px] text-blue-600 hover:underline shrink-0">
                  {metaCopiedIdx === `p${i}` ? "✓ 복사됨" : "복사"}
                </button>
              </div>
            ))}
          </div>

          <div>
            <div className="font-bold text-ink-900 mb-1">🔘 CTA 버튼</div>
            <div className="flex flex-wrap gap-1">
              {metaAdPackage.ctaButtons.map((c: string, i: number) => (
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{c}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="font-bold text-ink-900 mb-1">🎯 타겟팅 추천</div>
            <div className="p-2 bg-white rounded space-y-1">
              <div>나이: {metaAdPackage.audienceSuggestion?.ageMin}~{metaAdPackage.audienceSuggestion?.ageMax}세</div>
              <div>관심사: {metaAdPackage.audienceSuggestion?.interests?.join(", ")}</div>
              <div>지역: {metaAdPackage.audienceSuggestion?.locations?.join(", ")}</div>
              <button
                onClick={() => copyMetaItem(JSON.stringify(metaAdPackage.audienceSuggestion, null, 2), "aud")}
                className="text-[10px] text-blue-600 hover:underline"
              >
                {metaCopiedIdx === "aud" ? "✓ 복사됨" : "JSON 복사"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta 광고 이미지 (Part A) — 3 비율 자동 생성 */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-ink-900">🖼️ 광고 이미지 (3 비율)</div>
          {metaAdImages.length > 0 && !metaImgBusy && (
            <button
              onClick={() => onGenerateImages()}
              className="text-[10px] text-blue-600 hover:underline"
            >
              🔄 전체 다시
            </button>
          )}
        </div>

        {/* Wave 3: 디자인 템플릿 picker */}
        <div className="mb-2">
          <div className="text-[10px] font-bold text-ink-900 mb-1">디자인 템플릿</div>
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "minimal", label: "🤍 미니멀" },
              { key: "bold", label: "🔥 강조" },
              { key: "story", label: "📱 스토리" },
              { key: "quote", label: "💬 인용" },
              { key: "cta", label: "🎯 CTA" },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setImageTemplate(t.key as ImageTemplate)}
                className={`text-[10px] px-2 py-1 rounded font-bold ${imageTemplate === t.key ? "bg-blue-500 text-white" : "bg-white border border-blue-200 text-blue-700 hover:border-blue-400"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {metaAdImages.length === 0 && !metaImgBusy && metaAllInOneBusy === 0 && (
          <>
            <div className="text-[10px] text-gray-500 text-center mb-1">또는 개별 생성</div>
            <button
              onClick={() => onGenerateImages()}
              disabled={metaImgBusy || metaAllInOneBusy !== 0}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 text-xs"
            >
              🎨 광고 이미지 3장만 생성 (~₩1,500)
            </button>
          </>
        )}

        {(metaImgBusy || metaAllInOneBusy === 2) && (
          <div className="text-xs text-blue-700 text-center py-3">
            ⏳ 이미지 생성 중... (약 30초)
            <span className="inline-block ml-1 animate-pulse">···</span>
          </div>
        )}

        {metaAdImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {(["feed", "story", "link"] as const).map((type) => {
              const img = metaAdImages.find((i) => i.type === type);
              const refineImageType = type === "feed" ? "meta-feed" : type === "story" ? "meta-story" : "meta-link";
              const refineAr = type === "feed" ? "1:1" : type === "story" ? "9:16" : "16:9";
              return (
                <div key={type} className="bg-white rounded border border-blue-200 p-1.5 flex flex-col relative">
                  <div className="text-[10px] font-bold text-ink-900 mb-1 text-center">
                    {metaImageLabel(type)}{" "}
                    <span className="font-normal text-gray-500">
                      {type === "feed" ? "1:1" : type === "story" ? "9:16" : "16:9"}
                    </span>
                  </div>
                  {img ? (
                    <>
                      <img
                        src={`data:image/png;base64,${img.base64}`}
                        alt={`Meta ${type}`}
                        className="w-full max-h-[150px] object-contain bg-gray-50 rounded"
                      />
                      <div className="flex gap-1 mt-1 items-center">
                        <button
                          onClick={() => downloadMetaImage(img)}
                          className="flex-1 text-[10px] px-1 py-0.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                        >
                          💾 다운로드
                        </button>
                        <button
                          onClick={() => onGenerateImages([type])}
                          disabled={metaImgBusy}
                          className="flex-1 text-[10px] px-1 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          🔄 다시
                        </button>
                        {projectId && (
                          <ImageRefineButton
                            projectId={projectId}
                            imageType={refineImageType}
                            aspectRatio={refineAr}
                            onRefined={(b64) => {
                              onSetMetaAdImages(prev => prev.map(p =>
                                p.type === type ? { ...p, base64: b64, generatedAt: Date.now() } : p
                              ));
                            }}
                            onBalanceChange={onSetBalance}
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-3 text-[10px] text-gray-400">
                      <span>없음</span>
                      <button
                        onClick={() => onGenerateImages([type])}
                        disabled={metaImgBusy}
                        className="mt-1 text-blue-600 hover:underline"
                      >
                        생성
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * CoverTemplatePreview — Sharp 합성 없이 SVG/CSS 만으로 그리는 표지 템플릿 썸네일.
 *
 * 갤러리/추천 카드에서 카드당 작은 미리보기로 사용. AI 호출 없음. Sharp 호출 없음.
 * template.overlay 의 background / decorations / textBlocks 를 9-grid 좌표계 그대로
 * SVG <rect> + <text> 로 근사 렌더링한다.
 *
 * 정확도보다는 "이 템플릿이 대충 어떤 구도인지" 알 수 있게 하는 목적이며,
 * 실제 Sharp 합성 결과와는 다를 수 있다. 본격 미리보기는 별도 PR 에서
 * /api/generate/cover-overlay 를 호출하는 "내 책으로 미리보기" 버튼을 둔다.
 */

import type {
  CoverTemplate,
  OverlayBackground,
  OverlayDecoration,
  OverlayPosition,
  OverlayTextBlock,
} from "@/lib/cover-templates/types";

const CANVAS_W = 120;
const CANVAS_H = 160; // 3:4 비율

interface Coord {
  x: number;
  y: number;
}

/** 9-grid + bleed 위치 → 캔버스 픽셀 좌표 (anchor). */
function positionToCoord(pos: OverlayPosition): Coord {
  switch (pos) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top-center":
      return { x: CANVAS_W / 2, y: 0 };
    case "top-right":
      return { x: CANVAS_W, y: 0 };
    case "center-left":
      return { x: 0, y: CANVAS_H / 2 };
    case "center":
      return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    case "center-right":
      return { x: CANVAS_W, y: CANVAS_H / 2 };
    case "bottom-left":
      return { x: 0, y: CANVAS_H };
    case "bottom-center":
      return { x: CANVAS_W / 2, y: CANVAS_H };
    case "bottom-right":
      return { x: CANVAS_W, y: CANVAS_H };
    case "top-bleed":
      return { x: 0, y: 0 };
    case "bottom-bleed":
      return { x: 0, y: CANVAS_H };
    default:
      return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  }
}

/** template.background 영역 → SVG rect 좌표. */
function backgroundRect(bg: OverlayBackground): { x: number; y: number; w: number; h: number } {
  switch (bg.area) {
    case "full":
      return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
    case "top-half":
      return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H / 2 };
    case "bottom-half":
      return { x: 0, y: CANVAS_H / 2, w: CANVAS_W, h: CANVAS_H / 2 };
    case "top-third":
      return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H / 3 };
    case "bottom-third":
      return { x: 0, y: (CANVAS_H * 2) / 3, w: CANVAS_W, h: CANVAS_H / 3 };
    default:
      return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
  }
}

/** decoration 의 위치+크기 → SVG rect. width/height 는 캔버스 비율(0~1). */
function decorationRect(d: OverlayDecoration): { x: number; y: number; w: number; h: number } {
  const anchor = positionToCoord(d.position);
  const w = Math.max(2, (d.size?.width ?? 0.2) * CANVAS_W);
  const h = Math.max(2, (d.size?.height ?? 0.05) * CANVAS_H);
  const offX = (d.offsetPx?.[0] ?? 0) * (CANVAS_W / 1200);
  const offY = (d.offsetPx?.[1] ?? 0) * (CANVAS_H / 1600);
  let x = anchor.x + offX;
  let y = anchor.y + offY;
  // 위치별 anchor 보정 (top-bleed 류는 가로 풀폭)
  if (d.position === "top-bleed") {
    x = 0;
    y = 0;
  } else if (d.position === "bottom-bleed") {
    x = 0;
    y = CANVAS_H - h;
  } else if (d.position.endsWith("-center")) {
    x = x - w / 2;
  } else if (d.position.endsWith("-right")) {
    x = x - w;
  }
  if (d.position.startsWith("center-")) {
    y = y - h / 2;
  } else if (d.position.startsWith("bottom-") && d.position !== "bottom-bleed") {
    y = y - h;
  }
  return { x, y, w, h };
}

type SvgTextAnchor = "start" | "middle" | "end";

/** textBlock 의 위치 → 텍스트 표시용 라벨 좌표 + 라벨 길이. */
function textPlaceholder(block: OverlayTextBlock): { x: number; y: number; size: number; anchor: SvgTextAnchor; label: string } {
  const anchor = positionToCoord(block.position);
  const offX = (block.offsetPx?.[0] ?? 0) * (CANVAS_W / 1200);
  const offY = (block.offsetPx?.[1] ?? 0) * (CANVAS_H / 1600);
  const size = Math.max(4, Math.min(14, block.font.sizeRatio * CANVAS_W));
  const label =
    block.field === "title"
      ? "TITLE"
      : block.field === "subtitle"
        ? "subtitle"
        : block.field === "author"
          ? "author"
          : block.field.toUpperCase();
  let anchorAttr: SvgTextAnchor = "start";
  if (block.position.endsWith("-center")) anchorAttr = "middle";
  else if (block.position.endsWith("-right")) anchorAttr = "end";
  return { x: anchor.x + offX, y: anchor.y + offY, size, anchor: anchorAttr, label };
}

interface CoverTemplatePreviewProps {
  template: CoverTemplate;
  className?: string;
  /** 카드/모달 등 사용처에 따라 outer 스케일. default 1. */
  scale?: number;
}

export function CoverTemplatePreview({ template, className, scale = 1 }: CoverTemplatePreviewProps) {
  const { overlay } = template;
  const bg = overlay.background;
  const decorations = overlay.decorations ?? [];
  const textBlocks = overlay.textBlocks ?? [];
  const baseColor = bg?.color ?? "#1f2937"; // 기본 어두운 회색 — AI 사진을 흉내내는 placeholder

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width={CANVAS_W * scale}
      height={CANVAS_H * scale}
      className={className}
      aria-label={`${template.label} 미리보기`}
      role="img"
    >
      {/* AI 이미지 자리 — 옅은 그라데이션 placeholder */}
      <defs>
        <linearGradient id={`bg-${template.key}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#9ca3af" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={`url(#bg-${template.key})`} />

      {/* 추상 패턴 (사진 자리 흉내) */}
      <circle cx={CANVAS_W * 0.7} cy={CANVAS_H * 0.32} r={18} fill="rgba(255,255,255,0.35)" />
      <circle cx={CANVAS_W * 0.25} cy={CANVAS_H * 0.6} r={10} fill="rgba(0,0,0,0.08)" />

      {/* 템플릿 background */}
      {bg && (
        <rect
          {...backgroundRect(bg)}
          fill={bg.color ?? "rgba(0,0,0,0.6)"}
          opacity={bg.opacity ?? 1}
          rx={bg.cornerRadiusPx ? Math.min(8, bg.cornerRadiusPx / 10) : 0}
        />
      )}

      {/* 데코레이션 (rect 근사) */}
      {decorations.map((d, i) => {
        const r = decorationRect(d);
        const radius = d.type === "badge-pill" ? Math.min(r.h / 2, 6) : d.type === "circle" ? r.w / 2 : 0;
        if (d.type === "circle") {
          return <circle key={i} cx={r.x + r.w / 2} cy={r.y + r.h / 2} r={r.w / 2} fill={d.color} />;
        }
        if (d.type === "frame-border") {
          return (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill="none"
              stroke={d.color}
              strokeWidth={1.5}
            />
          );
        }
        return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={d.color} rx={radius} />;
      })}

      {/* 텍스트 placeholder */}
      {textBlocks.map((t, i) => {
        const p = textPlaceholder(t);
        const dy =
          t.position.startsWith("top-") || t.position === "top-bleed" ? p.size : 0;
        return (
          <text
            key={i}
            x={p.x}
            y={p.y + dy}
            fontSize={p.size}
            fontWeight={t.font.weight}
            fill={t.color}
            textAnchor={p.anchor}
            style={{ fontFamily: t.font.family ?? "Pretendard, sans-serif" }}
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

export default CoverTemplatePreview;

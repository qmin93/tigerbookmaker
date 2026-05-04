// 방문 추이 막대 그래프 (외부 라이브러리 없이 순수 SVG).
// 책 페이지 방문 (orange) + 작가 프로필 방문 (blue) 누적 막대.

"use client";

interface DataPoint {
  date: string;
  bookViews: number;
  profileViews: number;
}

export function AnalyticsChart({ data }: { data: DataPoint[] }) {
  const maxValue = Math.max(1, ...data.map((d) => d.bookViews + d.profileViews));
  const W = 800;
  const H = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const barWidth = data.length > 0 ? chartW / data.length : 0;
  const totalSum = data.reduce((s, d) => s + d.bookViews + d.profileViews, 0);
  const labelStep = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-3 gap-3 flex-wrap">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-gray-500">
            최근 {data.length}일 방문
          </div>
          <div className="text-2xl font-black tracking-tight text-ink-900">
            {totalSum.toLocaleString()}
          </div>
        </div>
        <div className="flex gap-3 text-xs text-gray-700">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-tiger-orange" />책 페이지
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />작가 프로필
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Y axis grid + ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding.top + chartH * (1 - t);
          const v = Math.round(maxValue * t);
          return (
            <g key={t}>
              <line
                x1={padding.left}
                y1={y}
                x2={W - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fontSize="9"
                fill="#9ca3af"
                textAnchor="end"
                fontFamily="monospace"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Bars (stacked: profile bottom, book on top) */}
        {data.map((d, i) => {
          const x = padding.left + i * barWidth;
          const bookH = (d.bookViews / maxValue) * chartH;
          const profileH = (d.profileViews / maxValue) * chartH;
          const showLabel = i % labelStep === 0;
          return (
            <g key={i}>
              {profileH > 0 && (
                <rect
                  x={x + 1}
                  y={padding.top + chartH - profileH}
                  width={Math.max(0, barWidth - 2)}
                  height={profileH}
                  fill="#3b82f6"
                  rx={1}
                />
              )}
              {bookH > 0 && (
                <rect
                  x={x + 1}
                  y={padding.top + chartH - profileH - bookH}
                  width={Math.max(0, barWidth - 2)}
                  height={bookH}
                  fill="#f97316"
                  rx={1}
                />
              )}
              {showLabel && (
                <text
                  x={x + barWidth / 2}
                  y={H - 12}
                  fontSize="9"
                  fill="#9ca3af"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

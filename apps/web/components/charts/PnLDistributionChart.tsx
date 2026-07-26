'use client';

/**
 * PnLDistributionChart Component
 *
 * SVG-based histogram showing distribution of trade P&L values.
 * Green bars for positive midpoint bins, red for negative.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { binValues } from '@/lib/charts/chart-utils';

interface PnLDistributionChartProps {
  pnlValues: number[];
  binCount?: number;
  height?: number;
}

export default function PnLDistributionChart({
  pnlValues,
  binCount = 10,
  height = 200,
}: PnLDistributionChartProps) {
  if (pnlValues.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No P&L data available
      </div>
    );
  }

  const { bins } = binValues(pnlValues, binCount);
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  const padding = { top: 10, right: 10, bottom: 30, left: 40 };
  const width = 400; // SVG viewBox width; component scales via CSS
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / bins.length;
  const barGap = Math.max(1, barWidth * 0.1);

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Y-axis label */}
        <text
          x={padding.left - 8}
          y={padding.top}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize="9"
        >
          {maxCount}
        </text>
        <text
          x={padding.left - 8}
          y={height - padding.bottom}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize="9"
        >
          0
        </text>

        {/* Bars */}
        {bins.map((bin, i) => {
          const barHeight = (bin.count / maxCount) * chartHeight;
          const x = padding.left + i * barWidth + barGap / 2;
          const y = padding.top + chartHeight - barHeight;
          const color = bin.midpoint >= 0 ? '#26a69a' : '#ef5350';

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth - barGap}
              height={barHeight}
              fill={color}
              rx={1}
            />
          );
        })}

        {/* X-axis baseline */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="currentColor"
          className="text-muted-foreground"
          strokeWidth={0.5}
        />

        {/* X-axis labels (first, middle, last bin midpoints) */}
        {bins.length > 0 && (
          <>
            <text
              x={padding.left + barWidth / 2}
              y={height - padding.bottom + 14}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="8"
            >
              {bins[0].midpoint.toFixed(0)}
            </text>
            {bins.length > 2 && (
              <text
                x={padding.left + Math.floor(bins.length / 2) * barWidth + barWidth / 2}
                y={height - padding.bottom + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="8"
              >
                {bins[Math.floor(bins.length / 2)].midpoint.toFixed(0)}
              </text>
            )}
            <text
              x={padding.left + (bins.length - 1) * barWidth + barWidth / 2}
              y={height - padding.bottom + 14}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="8"
            >
              {bins[bins.length - 1].midpoint.toFixed(0)}
            </text>
          </>
        )}

        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 4}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
        >
          P&L Range
        </text>
        <text
          x={8}
          y={height / 2}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
          transform={`rotate(-90, 8, ${height / 2})`}
        >
          Trades
        </text>
      </svg>
    </div>
  );
}

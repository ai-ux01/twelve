'use client';

/**
 * WinRateDonut Component
 *
 * Pure SVG donut chart showing win/loss ratio.
 * Green segment for wins, red for losses.
 * Centered label with win rate percentage.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

interface WinRateDonutProps {
  wins: number;
  losses: number;
  size?: number;
}

export default function WinRateDonut({
  wins,
  losses,
  size = 200,
}: WinRateDonutProps) {
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  const radius = size / 2 - 20;
  const strokeWidth = size * 0.12;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate arc lengths
  const winArc = total > 0 ? (wins / total) * circumference : 0;
  const lossArc = total > 0 ? (losses / total) * circumference : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring for empty state */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />

        {total > 0 && (
          <>
            {/* Win segment (green) */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#26a69a"
              strokeWidth={strokeWidth}
              strokeDasharray={`${winArc} ${circumference - winArc}`}
              strokeDashoffset={circumference / 4}
              strokeLinecap="round"
            />

            {/* Loss segment (red) */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#ef5350"
              strokeWidth={strokeWidth}
              strokeDasharray={`${lossArc} ${circumference - lossArc}`}
              strokeDashoffset={circumference / 4 - winArc}
              strokeLinecap="round"
            />
          </>
        )}

        {/* Centered label */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-2xl font-bold"
          fontSize={size * 0.14}
        >
          {winRate !== null ? `${winRate}%` : 'N/A'}
        </text>

        <text
          x={center}
          y={center + size * 0.1}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          fontSize={size * 0.06}
        >
          Win Rate
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#26a69a]" />
          <span className="text-muted-foreground">Wins: {wins}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ef5350]" />
          <span className="text-muted-foreground">Losses: {losses}</span>
        </div>
      </div>
    </div>
  );
}

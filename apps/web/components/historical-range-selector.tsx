/**
 * HistoricalRangeSelector Component
 *
 * Displays range selector buttons (1D, 1W, 1M, 3M, 6M, 1Y, 2Y) for
 * historical chart data. On click, calculates from = now - duration, to = now
 * and invokes a callback with the computed range.
 *
 * NO options beyond 2Y (no 3Y, 5Y, All-Time) per Requirement 7.2.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export type RangeLabel = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y';

export interface RangeSelection {
  from: Date;
  to: Date;
  label: RangeLabel;
}

export interface HistoricalRangeSelectorProps {
  /** Callback invoked when a range button is clicked */
  onRangeChange: (range: RangeSelection) => void;
  /** Currently active range label (controlled mode) */
  activeRange?: RangeLabel;
  /** Optional className for the container */
  className?: string;
}

// ============================================================================
// Range Definitions
// ============================================================================

const RANGES: RangeLabel[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '2Y'];

/**
 * Compute the from date for a given range label.
 * from = now - duration, to = now.
 */
export function computeRange(label: RangeLabel): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now);

  switch (label) {
    case '1D':
      from.setDate(from.getDate() - 1);
      break;
    case '1W':
      from.setDate(from.getDate() - 7);
      break;
    case '1M':
      from.setMonth(from.getMonth() - 1);
      break;
    case '3M':
      from.setMonth(from.getMonth() - 3);
      break;
    case '6M':
      from.setMonth(from.getMonth() - 6);
      break;
    case '1Y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case '2Y':
      from.setFullYear(from.getFullYear() - 2);
      break;
  }

  return { from, to: now };
}

// ============================================================================
// Component
// ============================================================================

export function HistoricalRangeSelector({
  onRangeChange,
  activeRange,
  className,
}: HistoricalRangeSelectorProps) {
  const [internalActive, setInternalActive] = useState<RangeLabel | null>(
    activeRange ?? null
  );

  const currentActive = activeRange ?? internalActive;

  const handleClick = (label: RangeLabel) => {
    setInternalActive(label);
    const { from, to } = computeRange(label);
    onRangeChange({ from, to, label });
  };

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {RANGES.map((label) => (
        <Button
          key={label}
          variant={currentActive === label ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleClick(label)}
          aria-pressed={currentActive === label}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

/**
 * DimensionSelector Component - Trade Analysis
 *
 * Dropdown selector for choosing a grouping dimension:
 * strategy, setup, market_regime, sector, time_of_day, holding_period, probability.
 *
 * Requirements: 8.5
 */

'use client';

import type { GroupingDimension } from './types';

export interface DimensionSelectorProps {
  selected: GroupingDimension;
  onChange: (dimension: GroupingDimension) => void;
}

const DIMENSION_OPTIONS: { value: GroupingDimension; label: string }[] = [
  { value: 'strategy', label: 'Strategy' },
  { value: 'setup', label: 'Setup' },
  { value: 'market_regime', label: 'Market Regime' },
  { value: 'sector', label: 'Sector' },
  { value: 'time_of_day', label: 'Time of Day' },
  { value: 'holding_period', label: 'Holding Period' },
  { value: 'probability', label: 'Probability' },
];

export function DimensionSelector({ selected, onChange }: DimensionSelectorProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <label
        htmlFor="dimension-selector"
        className="text-sm font-medium text-muted-foreground"
      >
        Group by:
      </label>
      <select
        id="dimension-selector"
        value={selected}
        onChange={(e) => onChange(e.target.value as GroupingDimension)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {DIMENSION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

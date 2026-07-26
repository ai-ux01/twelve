/**
 * ResponseModeSelector Component - AI Trading Lab
 *
 * Displays 5 mode pills/buttons: QUICK, DETAILED, TRADER, QUANT, COACH.
 * Highlights selected mode. Passes selected mode with each prompt request.
 *
 * Requirements: 6.4
 */

'use client';

import { cn } from '@/lib/utils';
import type { ResponseMode } from './types';

export interface ResponseModeSelectorProps {
  selectedMode: ResponseMode;
  onModeChange: (mode: ResponseMode) => void;
  disabled?: boolean;
}

const MODES: { value: ResponseMode; label: string; description: string }[] = [
  { value: 'QUICK', label: 'Quick', description: 'Signal + key levels' },
  { value: 'DETAILED', label: 'Detailed', description: 'Full analysis' },
  { value: 'TRADER', label: 'Trader', description: 'Actionable trade plan' },
  { value: 'QUANT', label: 'Quant', description: 'Numerical metrics' },
  { value: 'COACH', label: 'Coach', description: 'Educational' },
];

export function ResponseModeSelector({
  selectedMode,
  onModeChange,
  disabled = false,
}: ResponseModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-2 overflow-x-auto" role="radiogroup" aria-label="Response mode">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onModeChange(mode.value)}
          disabled={disabled}
          role="radio"
          aria-checked={selectedMode === mode.value}
          aria-label={`${mode.label}: ${mode.description}`}
          title={mode.description}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            selectedMode === mode.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

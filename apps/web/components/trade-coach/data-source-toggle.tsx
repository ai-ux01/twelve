/**
 * DataSourceToggle Component
 *
 * Allows users to select between Paper Trades, Live Portfolio, and Combined
 * data sources for Trade Coach analysis. Disables live options when no
 * active Kotak Neo session exists.
 *
 * Phase 15 - AI Trade Coach / Portfolio Trade Coaching
 */

'use client';

import { useState } from 'react';

export type DataSource = 'paper' | 'live' | 'combined';

export interface DataSourceToggleProps {
  /** Whether the user has an active Kotak Neo session */
  kotakSessionActive: boolean;
  /** Callback when the user selects a data source */
  onSourceChange: (source: DataSource) => void;
  /** Currently selected source (controlled) */
  value?: DataSource;
}

interface SourceOption {
  value: DataSource;
  label: string;
  requiresSession: boolean;
}

const SOURCE_OPTIONS: SourceOption[] = [
  { value: 'paper', label: 'Paper Trades', requiresSession: false },
  { value: 'live', label: 'Live Portfolio', requiresSession: true },
  { value: 'combined', label: 'Combined', requiresSession: true },
];

const DISABLED_TOOLTIP = 'Log in to Kotak Neo to analyze live trades';

export function DataSourceToggle({
  kotakSessionActive,
  onSourceChange,
  value,
}: DataSourceToggleProps) {
  const [internalValue, setInternalValue] = useState<DataSource>('paper');
  const selected = value ?? internalValue;

  const handleSelect = (source: DataSource) => {
    if (!value) {
      setInternalValue(source);
    }
    onSourceChange(source);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">Data Source</span>
      <div className="inline-flex rounded-lg border bg-muted/30 p-1 gap-1">
        {SOURCE_OPTIONS.map((option) => {
          const isDisabled = option.requiresSession && !kotakSessionActive;
          const isSelected = selected === option.value;

          return (
            <div key={option.value} className="relative group">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelect(option.value)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-md transition-all
                  ${
                    isSelected
                      ? 'bg-background text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }
                  ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed hover:text-muted-foreground'
                      : 'cursor-pointer'
                  }
                `}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
              >
                {option.label}
              </button>
              {isDisabled && (
                <div
                  role="tooltip"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10"
                >
                  {DISABLED_TOOLTIP}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

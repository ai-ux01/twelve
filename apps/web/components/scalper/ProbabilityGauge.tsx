'use client';

/**
 * ProbabilityGauge Component
 *
 * Displays a visual probability gauge (0-100%) with color coding:
 * - Red: probability < 50%
 * - Yellow: probability 50-70%
 * - Green: probability >= 70%
 *
 * Features:
 * - Minimum height of 80px for the visual indicator
 * - Percentage displayed with 1 decimal place
 * - "N/A" with gray for null/invalid/out-of-range values
 * - "Calculating..." with gray before first analysis
 * - Updates within 500ms of new analysis
 *
 * Requirements covered: 14.1-14.7
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ProbabilityGaugeProps {
  /** Probability percentage (0-100), null if not yet calculated or invalid */
  probability: number | null;
  /** Whether this is the first analysis (shows "Calculating..." state) */
  isInitializing?: boolean;
}

/**
 * Determine the color based on probability value
 */
function getGaugeColor(probability: number): {
  bgColor: string;
  textColor: string;
  fillColor: string;
  label: string;
} {
  if (probability < 50) {
    return {
      bgColor: 'bg-red-100 dark:bg-red-950',
      textColor: 'text-red-600 dark:text-red-400',
      fillColor: 'bg-red-500',
      label: 'Low',
    };
  }
  if (probability < 70) {
    return {
      bgColor: 'bg-yellow-100 dark:bg-yellow-950',
      textColor: 'text-yellow-600 dark:text-yellow-400',
      fillColor: 'bg-yellow-500',
      label: 'Moderate',
    };
  }
  return {
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-600 dark:text-green-400',
    fillColor: 'bg-green-500',
    label: 'High',
  };
}

export function ProbabilityGauge({ probability, isInitializing = false }: ProbabilityGaugeProps) {
  const [displayedProbability, setDisplayedProbability] = useState<number | null>(probability);
  const lastUpdateRef = useRef<number>(Date.now());

  // Update within 500ms of new analysis (req 14.5)
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate < 500) {
      const timeout = setTimeout(() => {
        setDisplayedProbability(probability);
        lastUpdateRef.current = Date.now();
      }, Math.max(0, 500 - timeSinceLastUpdate));
      return () => clearTimeout(timeout);
    }

    setDisplayedProbability(probability);
    lastUpdateRef.current = now;
  }, [probability]);

  // Initializing state: "Calculating..." with gray
  if (isInitializing) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 dark:bg-gray-900 p-4"
        style={{ minHeight: '80px' }}
        role="meter"
        aria-label="Probability gauge"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={undefined}
      >
        <span className="text-sm text-gray-500 dark:text-gray-400">Calculating...</span>
      </div>
    );
  }

  // Null, invalid, or out-of-range: "N/A" with gray
  const isInvalid =
    displayedProbability === null ||
    displayedProbability === undefined ||
    !isFinite(displayedProbability) ||
    displayedProbability < 0 ||
    displayedProbability > 100;

  if (isInvalid) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 dark:bg-gray-900 p-4"
        style={{ minHeight: '80px' }}
        role="meter"
        aria-label="Probability gauge"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={undefined}
      >
        <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">N/A</span>
      </div>
    );
  }

  const { bgColor, textColor, fillColor, label } = getGaugeColor(displayedProbability);
  const fillWidth = Math.min(100, Math.max(0, displayedProbability));

  return (
    <div
      className={cn('flex flex-col items-center justify-center rounded-lg border p-4', bgColor)}
      style={{ minHeight: '80px' }}
      role="meter"
      aria-label="Probability gauge"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={displayedProbability}
      aria-valuetext={`${displayedProbability.toFixed(1)} percent - ${label}`}
    >
      {/* Percentage Value */}
      <span className={cn('text-3xl font-bold', textColor)}>
        {displayedProbability.toFixed(1)}%
      </span>

      {/* Visual Bar Indicator */}
      <div className="mt-2 w-full max-w-[200px]">
        <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', fillColor)}
            style={{ width: `${fillWidth}%` }}
          />
        </div>
      </div>

      {/* Label */}
      <span className={cn('mt-1 text-xs font-medium', textColor)}>{label}</span>
    </div>
  );
}

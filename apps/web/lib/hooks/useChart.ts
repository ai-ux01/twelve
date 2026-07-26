/**
 * useChart Hook
 *
 * Shared hook for creating and managing lightweight-charts instances.
 * Handles chart creation, responsive resize, dark mode detection, and cleanup.
 *
 * Requirements: 11.1, 11.3, 11.4
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { createChart, IChartApi, ColorType } from 'lightweight-charts';
import { getChartTheme } from '@/lib/charts/chart-theme';

export interface UseChartOptions {
  height?: number;
  autoResize?: boolean;
  darkMode?: boolean;
  showGrid?: boolean;
  showCrosshair?: boolean;
  showTimeScale?: boolean;
  showPriceScale?: boolean;
  fitContent?: boolean;
}

export interface UseChartReturn {
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  chart: IChartApi | null;
  isReady: boolean;
}

/**
 * Creates and manages a lightweight-charts instance attached to a container ref.
 *
 * - Creates the chart on mount and removes it on unmount
 * - Registers a ResizeObserver (debounced <100ms) for responsive width
 * - Detects dark mode from document.documentElement.classList ('dark' class)
 * - Applies chart theme colors via getChartTheme
 *
 * @param options - Configuration options for the chart
 * @returns chartContainerRef to attach to a div, chart API instance, and readiness flag
 */
export function useChart(options?: UseChartOptions): UseChartReturn {
  const {
    height = 300,
    autoResize = true,
    darkMode,
    showGrid = true,
    showCrosshair = true,
    showTimeScale = true,
    showPriceScale = true,
    fitContent = false,
  } = options ?? {};

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Detect dark mode: use explicit prop or check document class
    const isDark =
      darkMode !== undefined
        ? darkMode
        : document.documentElement.classList.contains('dark');

    const theme = getChartTheme(isDark);

    // Create the chart instance
    const chartInstance = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.textColor,
      },
      grid: {
        vertLines: { color: showGrid ? theme.gridColor : 'transparent' },
        horzLines: { color: showGrid ? theme.gridColor : 'transparent' },
      },
      crosshair: {
        mode: showCrosshair ? 0 : 1, // 0 = Normal, 1 = Magnet
      },
      timeScale: {
        visible: showTimeScale,
        borderColor: theme.borderColor,
      },
      rightPriceScale: {
        visible: showPriceScale,
        borderColor: theme.borderColor,
      },
    });

    if (fitContent) {
      chartInstance.timeScale().fitContent();
    }

    chartRef.current = chartInstance;
    setChart(chartInstance);
    setIsReady(true);

    // ResizeObserver with debounce for responsive width
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let observer: ResizeObserver | null = null;

    if (autoResize) {
      observer = new ResizeObserver((entries) => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          for (const entry of entries) {
            if (chartRef.current) {
              chartRef.current.applyOptions({
                width: entry.contentRect.width,
              });
            }
          }
        }, 50); // debounce at 50ms (< 100ms requirement)
      });

      observer.observe(container);
    }

    // Cleanup on unmount
    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (observer) {
        observer.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      setChart(null);
      setIsReady(false);
    };
  }, []); // Run once on mount

  return { chartContainerRef, chart, isReady };
}

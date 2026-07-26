/**
 * Chart Utility Functions
 *
 * Pure utility functions for converting data into lightweight-charts formats,
 * computing aggregations, and adding chart overlays.
 *
 * Requirements: 11.1, 11.2
 */

import type {
  CandlestickData,
  HistogramData,
  LineData,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import type { OHLCVData, TrendlineLine } from '@/lib/api-client';

/**
 * Converts an array of OHLCVData to lightweight-charts CandlestickData format.
 * Timestamps are converted to Unix seconds (UTCTimestamp).
 *
 * @param data - Array of OHLCV candle data
 * @returns Array of CandlestickData for lightweight-charts
 */
export function toCandlestickData(data: OHLCVData[]): CandlestickData[] {
  return data.map((d) => ({
    time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  }));
}

/**
 * Converts an array of OHLCVData to volume HistogramData format.
 * Bars are colored green if close >= open (bullish), red otherwise (bearish).
 *
 * @param data - Array of OHLCV candle data
 * @param upColor - Color for bullish volume bars (default: green with opacity)
 * @param downColor - Color for bearish volume bars (default: red with opacity)
 * @returns Array of HistogramData for lightweight-charts
 */
export function toVolumeData(
  data: OHLCVData[],
  upColor: string = 'rgba(38, 166, 154, 0.5)',
  downColor: string = 'rgba(239, 83, 80, 0.5)'
): HistogramData[] {
  return data.map((d) => ({
    time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
    value: d.volume,
    color: d.close >= d.open ? upColor : downColor,
  }));
}

/**
 * Converts timestamped value pairs to lightweight-charts LineData format.
 * Timestamps are expected as ISO strings and are converted to Unix seconds.
 *
 * @param points - Array of { timestamp, value } objects
 * @returns Array of LineData for lightweight-charts
 */
export function toLineData(
  points: { timestamp: string; value: number }[]
): LineData[] {
  return points.map((p) => ({
    time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
    value: p.value,
  }));
}

/**
 * Adds a horizontal price level line to a chart at a fixed price.
 * Creates a line series with constant value across the visible range.
 *
 * @param chart - The lightweight-charts IChartApi instance
 * @param price - The price level to draw
 * @param color - Line color
 * @param label - Label for the price line
 * @returns The created line series API
 */
export function addPriceLevel(
  chart: IChartApi,
  price: number,
  color: string,
  label: string
): ISeriesApi<'Line'> {
  const series = chart.addLineSeries({
    color,
    lineWidth: 1,
    lineStyle: 2, // Dashed
    title: label,
    priceLineVisible: false,
    lastValueVisible: true,
    crosshairMarkerVisible: false,
  });

  series.createPriceLine({
    price,
    color,
    lineWidth: 2,
    lineStyle: 2,
    axisLabelVisible: true,
    title: label,
  });

  return series;
}

/**
 * Computes the cumulative (running) sum of an array of numeric values.
 * The value at position i equals the sum of all values from index 0 through i.
 *
 * @param values - Array of numeric values
 * @returns Array of running totals with the same length as input
 */
export function cumulativeSum(values: number[]): number[] {
  const result: number[] = [];
  let runningTotal = 0;

  for (const value of values) {
    runningTotal += value;
    result.push(runningTotal);
  }

  return result;
}

/**
 * Bins numeric values into a histogram with the specified number of bins.
 * Each bin covers an equal-width range from min to max of the input values.
 *
 * @param values - Array of numeric values to bin
 * @param binCount - Number of bins to create (must be >= 1)
 * @returns Object containing the array of bins with min, max, midpoint, and count
 */
export function binValues(
  values: number[],
  binCount: number
): { bins: { min: number; max: number; midpoint: number; count: number }[] } {
  if (values.length === 0 || binCount < 1) {
    const bins = Array.from({ length: Math.max(binCount, 0) }, () => ({
      min: 0,
      max: 0,
      midpoint: 0,
      count: 0,
    }));
    return { bins };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Handle case where all values are the same
  const range = max - min;
  const binWidth = range === 0 ? 1 : range / binCount;

  // Initialize bins
  const bins = Array.from({ length: binCount }, (_, i) => {
    const binMin = min + i * binWidth;
    const binMax = min + (i + 1) * binWidth;
    return {
      min: binMin,
      max: binMax,
      midpoint: (binMin + binMax) / 2,
      count: 0,
    };
  });

  // Assign values to bins
  for (const value of values) {
    let binIndex = range === 0 ? 0 : Math.floor((value - min) / binWidth);
    // Clamp to last bin for values exactly at max
    if (binIndex >= binCount) {
      binIndex = binCount - 1;
    }
    bins[binIndex].count++;
  }

  return { bins };
}

/**
 * Converts a trendline (slope/intercept) into two LineData points
 * for rendering on a lightweight-charts instance.
 *
 * The function clamps start_point and end_point to valid OHLCV array indices,
 * computes price as slope × clamped_index + intercept, and maps each point
 * to the corresponding OHLCV timestamp.
 *
 * @param trendline - Object with slope, intercept, start_point, end_point (or null/undefined)
 * @param ohlcvData - Array of OHLCV candles (timestamps used for mapping)
 * @returns Array of exactly 2 LineData points, or empty array if trendline is null/undefined or data is empty
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function computeTrendlinePoints(
  trendline: TrendlineLine | null | undefined,
  ohlcvData: OHLCVData[]
): LineData[] {
  if (!trendline) {
    return [];
  }

  if (ohlcvData.length === 0) {
    return [];
  }

  const maxIndex = ohlcvData.length - 1;

  // Clamp start_point and end_point to valid range [0, maxIndex]
  const clampedStart = Math.max(0, Math.min(trendline.start_point, maxIndex));
  const clampedEnd = Math.max(0, Math.min(trendline.end_point, maxIndex));

  // Compute price using linear formula: slope × index + intercept
  const startPrice = trendline.slope * clampedStart + trendline.intercept;
  const endPrice = trendline.slope * clampedEnd + trendline.intercept;

  return [
    {
      time: (new Date(ohlcvData[clampedStart].timestamp).getTime() / 1000) as UTCTimestamp,
      value: startPrice,
    },
    {
      time: (new Date(ohlcvData[clampedEnd].timestamp).getTime() / 1000) as UTCTimestamp,
      value: endPrice,
    },
  ];
}

/**
 * Chart Theme Configuration
 *
 * Provides consistent chart theming across all chart components.
 * Colors are matched to the existing ChartViewer.tsx component aesthetics.
 *
 * Requirements: 11.2, 11.3
 */

export interface ChartTheme {
  background: string;
  textColor: string;
  gridColor: string;
  borderColor: string;
  crosshairColor: string;
  upColor: string;
  downColor: string;
  volumeUpColor: string;
  volumeDownColor: string;
}

const lightTheme: ChartTheme = {
  background: '#ffffff',
  textColor: '#191919',
  gridColor: '#e0e0e0',
  borderColor: '#cccccc',
  crosshairColor: '#758696',
  upColor: '#26a69a',
  downColor: '#ef5350',
  volumeUpColor: 'rgba(38, 166, 154, 0.5)',
  volumeDownColor: 'rgba(239, 83, 80, 0.5)',
};

const darkTheme: ChartTheme = {
  background: '#1a1a2e',
  textColor: '#d1d4dc',
  gridColor: '#2a2a3e',
  borderColor: '#3a3a4e',
  crosshairColor: '#758696',
  upColor: '#26a69a',
  downColor: '#ef5350',
  volumeUpColor: 'rgba(38, 166, 154, 0.5)',
  volumeDownColor: 'rgba(239, 83, 80, 0.5)',
};

/**
 * Returns the chart theme configuration based on the dark mode flag.
 *
 * @param isDark - Whether the app is in dark mode
 * @returns ChartTheme object with all color values
 */
export function getChartTheme(isDark: boolean): ChartTheme {
  return isDark ? darkTheme : lightTheme;
}

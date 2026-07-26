/**
 * Formatting utility functions for the Options Scalper page.
 *
 * All functions are pure and handle null inputs gracefully by returning "N/A".
 *
 * Requirements: 1.2, 1.3, 1.4, 1.7
 */

/**
 * Formats a price value with the ₹ currency prefix and 2 decimal places.
 * Returns "N/A" for null inputs.
 *
 * @example formatPrice(2460.5) → "₹2460.50"
 * @example formatPrice(null) → "N/A"
 */
export function formatPrice(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }
  return `₹${value.toFixed(2)}`;
}

/**
 * Formats a risk-reward ratio as "1:X.X" with 1 decimal place.
 * Returns "N/A" for null inputs.
 *
 * @example formatRiskReward(2.5) → "1:2.5"
 * @example formatRiskReward(null) → "N/A"
 */
export function formatRiskReward(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }
  return `1:${value.toFixed(1)}`;
}

/**
 * Formats a probability value as a percentage with 1 decimal place.
 * Returns "N/A" for null inputs or values outside [0, 100].
 *
 * @example formatProbability(72.3) → "72.3%"
 * @example formatProbability(null) → "N/A"
 * @example formatProbability(101) → "N/A"
 */
export function formatProbability(value: number | null): string {
  if (value === null || value < 0 || value > 100) {
    return 'N/A';
  }
  return `${value.toFixed(1)}%`;
}

/**
 * Formats a countdown in seconds to "M:SS" format.
 *
 * @example formatCountdown(65) → "1:05"
 * @example formatCountdown(0) → "0:00"
 */
export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Unit tests for formatting utility functions.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.7
 */

import { formatPrice, formatRiskReward, formatProbability, formatCountdown } from './formatters';

describe('formatPrice', () => {
  it('formats a positive number with ₹ prefix and 2 decimal places', () => {
    expect(formatPrice(2460.5)).toBe('₹2460.50');
  });

  it('formats a whole number with 2 decimal places', () => {
    expect(formatPrice(100)).toBe('₹100.00');
  });

  it('formats zero correctly', () => {
    expect(formatPrice(0)).toBe('₹0.00');
  });

  it('returns "N/A" for null', () => {
    expect(formatPrice(null)).toBe('N/A');
  });
});

describe('formatRiskReward', () => {
  it('formats a ratio with "1:" prefix and 1 decimal place', () => {
    expect(formatRiskReward(2.5)).toBe('1:2.5');
  });

  it('formats a whole number with 1 decimal place', () => {
    expect(formatRiskReward(3)).toBe('1:3.0');
  });

  it('formats zero correctly', () => {
    expect(formatRiskReward(0)).toBe('1:0.0');
  });

  it('returns "N/A" for null', () => {
    expect(formatRiskReward(null)).toBe('N/A');
  });
});

describe('formatProbability', () => {
  it('formats a value with 1 decimal place and % suffix', () => {
    expect(formatProbability(72.3)).toBe('72.3%');
  });

  it('formats 0 correctly', () => {
    expect(formatProbability(0)).toBe('0.0%');
  });

  it('formats 100 correctly', () => {
    expect(formatProbability(100)).toBe('100.0%');
  });

  it('returns "N/A" for null', () => {
    expect(formatProbability(null)).toBe('N/A');
  });

  it('returns "N/A" for values above 100', () => {
    expect(formatProbability(101)).toBe('N/A');
  });

  it('returns "N/A" for negative values', () => {
    expect(formatProbability(-1)).toBe('N/A');
  });
});

describe('formatCountdown', () => {
  it('formats seconds into M:SS format', () => {
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('formats 0 seconds', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('formats exactly 60 seconds', () => {
    expect(formatCountdown(60)).toBe('1:00');
  });

  it('formats seconds less than 60 with leading zero', () => {
    expect(formatCountdown(5)).toBe('0:05');
  });

  it('formats large values correctly', () => {
    expect(formatCountdown(125)).toBe('2:05');
  });
});

/**
 * Unit tests for market hours utility function.
 *
 * IST = UTC + 5:30
 * Market hours: Mon–Fri, 9:15 AM – 3:30 PM IST (inclusive)
 *
 * Requirements: 2.1, 2.2, 2.5
 */

import { isMarketHours } from './market-hours';

describe('isMarketHours', () => {
  describe('weekday during market hours', () => {
    it('returns true at exactly 9:15 AM IST on a Monday', () => {
      // 9:15 IST = 3:45 UTC
      const date = new Date('2024-01-08T03:45:00.000Z'); // Monday
      expect(isMarketHours(date)).toBe(true);
    });

    it('returns true at exactly 3:30 PM IST on a Friday', () => {
      // 15:30 IST = 10:00 UTC
      const date = new Date('2024-01-12T10:00:00.000Z'); // Friday
      expect(isMarketHours(date)).toBe(true);
    });

    it('returns true at noon IST on a Wednesday', () => {
      // 12:00 IST = 6:30 UTC
      const date = new Date('2024-01-10T06:30:00.000Z'); // Wednesday
      expect(isMarketHours(date)).toBe(true);
    });

    it('returns true at 10:00 AM IST on a Tuesday', () => {
      // 10:00 IST = 4:30 UTC
      const date = new Date('2024-01-09T04:30:00.000Z'); // Tuesday
      expect(isMarketHours(date)).toBe(true);
    });

    it('returns true at 3:00 PM IST on a Thursday', () => {
      // 15:00 IST = 9:30 UTC
      const date = new Date('2024-01-11T09:30:00.000Z'); // Thursday
      expect(isMarketHours(date)).toBe(true);
    });
  });

  describe('weekday outside market hours', () => {
    it('returns false at 9:14 AM IST (1 minute before open)', () => {
      // 9:14 IST = 3:44 UTC
      const date = new Date('2024-01-08T03:44:00.000Z'); // Monday
      expect(isMarketHours(date)).toBe(false);
    });

    it('returns false at 3:31 PM IST (1 minute after close)', () => {
      // 15:31 IST = 10:01 UTC
      const date = new Date('2024-01-08T10:01:00.000Z'); // Monday
      expect(isMarketHours(date)).toBe(false);
    });

    it('returns false at midnight IST on a weekday', () => {
      // 00:00 IST = 18:30 UTC (previous day)
      const date = new Date('2024-01-07T18:30:00.000Z'); // This is Mon IST (Sun UTC)
      expect(isMarketHours(date)).toBe(false);
    });

    it('returns false at 8:00 AM IST on a weekday', () => {
      // 8:00 IST = 2:30 UTC
      const date = new Date('2024-01-09T02:30:00.000Z'); // Tuesday
      expect(isMarketHours(date)).toBe(false);
    });

    it('returns false at 4:00 PM IST on a weekday', () => {
      // 16:00 IST = 10:30 UTC
      const date = new Date('2024-01-09T10:30:00.000Z'); // Tuesday
      expect(isMarketHours(date)).toBe(false);
    });
  });

  describe('weekends', () => {
    it('returns false on Saturday during market hours time', () => {
      // 10:00 IST on Saturday = 4:30 UTC Saturday
      const date = new Date('2024-01-13T04:30:00.000Z'); // Saturday
      expect(isMarketHours(date)).toBe(false);
    });

    it('returns false on Sunday during market hours time', () => {
      // 10:00 IST on Sunday = 4:30 UTC Sunday
      const date = new Date('2024-01-14T04:30:00.000Z'); // Sunday
      expect(isMarketHours(date)).toBe(false);
    });
  });

  describe('IST day boundary edge cases', () => {
    it('handles UTC day being different from IST day (late UTC = next day IST)', () => {
      // 11:00 PM UTC on Sunday = 4:30 AM IST on Monday
      // This should be false (4:30 AM is before market open)
      const date = new Date('2024-01-07T23:00:00.000Z'); // Sun UTC, Mon IST
      expect(isMarketHours(date)).toBe(false);
    });

    it('handles UTC Friday late night being Saturday IST', () => {
      // 7:00 PM UTC on Friday = 12:30 AM IST on Saturday
      // This should be false (weekend)
      const date = new Date('2024-01-12T19:00:00.000Z'); // Fri UTC, Sat IST
      expect(isMarketHours(date)).toBe(false);
    });

    it('correctly identifies Monday IST when UTC is Sunday', () => {
      // 9:15 IST Monday = 3:45 UTC Monday — no day boundary issue here
      // But let's test: 19:00 UTC Sunday = 00:30 IST Monday
      const date = new Date('2024-01-07T18:45:00.000Z'); // Sun UTC, Mon IST 00:15
      expect(isMarketHours(date)).toBe(false); // before market open
    });
  });
});

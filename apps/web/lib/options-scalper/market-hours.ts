/**
 * Market hours utility for Indian equity market (NSE).
 *
 * Indian market hours: Monday–Friday, 9:15 AM – 3:30 PM IST.
 * IST = UTC + 5 hours 30 minutes.
 *
 * Requirements: 2.1, 2.2, 2.5
 */

/** IST offset from UTC in minutes (5 hours 30 minutes) */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Market open time in minutes from midnight IST (9:15 AM = 9*60 + 15 = 555) */
const MARKET_OPEN_MINUTES = 9 * 60 + 15;

/** Market close time in minutes from midnight IST (3:30 PM = 15*60 + 30 = 930) */
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

/**
 * Checks if the given date falls within Indian equity market hours.
 *
 * Returns true if and only if:
 * - The day of the week in IST is Monday–Friday (not Saturday or Sunday)
 * - The IST time is between 09:15:00 (inclusive) and 15:30:00 (inclusive)
 *
 * Note: "15:30:00 inclusive" means any time from 15:30:00.000 up to (but not including) 15:31:00
 * is considered market hours. Specifically, the boundary is at minute granularity:
 * the IST time in total minutes must be >= 555 (9:15) and <= 930 (15:30).
 *
 * @param date - The Date object to check (in any timezone; UTC is extracted internally)
 * @returns true if the date is within market hours, false otherwise
 */
export function isMarketHours(date: Date): boolean {
  // Convert UTC time to IST by adding the offset
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const istTotalMinutes = utcMinutes + IST_OFFSET_MINUTES;

  // Calculate IST hours and determine the IST day
  // If adding the offset crosses midnight, the IST day is the next day
  const istDay = istTotalMinutes >= 24 * 60
    ? (date.getUTCDay() + 1) % 7
    : date.getUTCDay();

  // Check if it's a weekday (Monday=1 through Friday=5)
  if (istDay === 0 || istDay === 6) {
    return false;
  }

  // Normalize IST minutes within a single day (handle overflow past midnight)
  const istMinutesInDay = istTotalMinutes % (24 * 60);

  // Check if time is within market hours (9:15 AM to 3:30 PM IST, inclusive)
  // We compare at minute granularity: seconds within the minute don't affect the result
  // since we only use hours and minutes from the UTC time.
  return istMinutesInDay >= MARKET_OPEN_MINUTES && istMinutesInDay <= MARKET_CLOSE_MINUTES;
}

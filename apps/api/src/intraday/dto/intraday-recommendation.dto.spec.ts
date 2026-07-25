import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  IntradayRecommendation,
  IntradaySignal,
  MacdValues,
  OpeningRange,
} from './intraday-recommendation.dto';

describe('IntradayRecommendation DTO', () => {
  describe('Validation', () => {
    it('should validate a complete recommendation successfully', async () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'RELIANCE';
      recommendation.signal = IntradaySignal.BUY;
      recommendation.confidence = 75;
      recommendation.timestamp = '2024-01-15T10:30:00Z';
      recommendation.entry = 2450.5;
      recommendation.stopLoss = 2430.0;
      recommendation.target = 2490.0;
      recommendation.riskReward = 2.5;
      recommendation.currentPrice = 2450.0;
      recommendation.vwap = 2445.0;
      recommendation.ema5 = 2448.0;
      recommendation.ema15 = 2440.0;
      recommendation.rsi = 58.5;

      const macd = new MacdValues();
      macd.value = 12.3;
      macd.signal = 10.1;
      macd.histogram = 2.2;
      recommendation.macd = macd;

      const openingRange = new OpeningRange();
      openingRange.high = 2455.0;
      openingRange.low = 2440.0;
      openingRange.open = 2442.0;
      recommendation.openingRange = openingRange;

      recommendation.previousDayHigh = 2460.0;
      recommendation.previousDayLow = 2420.0;
      recommendation.isStale = false;
      recommendation.dataTimestamp = '2024-01-15T10:29:00Z';
      recommendation.rationale = 'Strong uptrend with RSI in bullish zone';

      const errors = await validate(recommendation);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid signal', async () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'RELIANCE';
      (recommendation.signal as any) = 'INVALID_SIGNAL';
      recommendation.confidence = 75;
      recommendation.timestamp = '2024-01-15T10:30:00Z';

      const errors = await validate(recommendation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'signal')).toBe(true);
    });

    it('should fail validation with confidence > 100', async () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'RELIANCE';
      recommendation.signal = IntradaySignal.BUY;
      recommendation.confidence = 150; // Invalid: > 100
      recommendation.timestamp = '2024-01-15T10:30:00Z';

      const errors = await validate(recommendation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'confidence')).toBe(true);
    });

    it('should fail validation with negative price values', async () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'RELIANCE';
      recommendation.signal = IntradaySignal.BUY;
      recommendation.confidence = 75;
      recommendation.timestamp = '2024-01-15T10:30:00Z';
      recommendation.entry = -100; // Invalid: negative

      const errors = await validate(recommendation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'entry')).toBe(true);
    });

    it('should fail validation with invalid ISO8601 timestamp', async () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'RELIANCE';
      recommendation.signal = IntradaySignal.BUY;
      recommendation.confidence = 75;
      recommendation.timestamp = 'invalid-date'; // Invalid format

      const errors = await validate(recommendation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'timestamp')).toBe(true);
    });

    it('should validate optional fields when provided', async () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'RELIANCE';
      recommendation.signal = IntradaySignal.BUY;
      recommendation.confidence = 75;
      recommendation.timestamp = '2024-01-15T10:30:00Z';
      recommendation.entry = 2450.5;
      recommendation.stopLoss = 2430.0;
      recommendation.target = 2490.0;
      recommendation.riskReward = 2.5;
      recommendation.currentPrice = 2450.0;
      recommendation.vwap = 2445.0;
      recommendation.ema5 = 2448.0;
      recommendation.ema15 = 2440.0;
      recommendation.rsi = 58.5;

      const macd = new MacdValues();
      macd.value = 12.3;
      macd.signal = 10.1;
      macd.histogram = 2.2;
      recommendation.macd = macd;

      const openingRange = new OpeningRange();
      openingRange.high = 2455.0;
      openingRange.low = 2440.0;
      openingRange.open = 2442.0;
      recommendation.openingRange = openingRange;

      recommendation.previousDayHigh = 2460.0;
      recommendation.previousDayLow = 2420.0;
      recommendation.isStale = false;
      recommendation.dataTimestamp = '2024-01-15T10:29:00Z';
      recommendation.rationale = 'Strong uptrend with RSI in bullish zone';

      // Optional fields
      recommendation.validUntil = '2024-01-15T11:00:00Z';
      recommendation.warnings = ['High volatility detected', 'Low volume'];

      const errors = await validate(recommendation);
      expect(errors.length).toBe(0);
    });
  });

  describe('MacdValues', () => {
    it('should validate MACD values successfully', async () => {
      const macd = new MacdValues();
      macd.value = 12.3;
      macd.signal = 10.1;
      macd.histogram = 2.2;

      const errors = await validate(macd);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-numeric MACD values', async () => {
      const macd = new MacdValues();
      (macd.value as any) = 'not-a-number';
      macd.signal = 10.1;
      macd.histogram = 2.2;

      const errors = await validate(macd);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'value')).toBe(true);
    });
  });

  describe('OpeningRange', () => {
    it('should validate opening range successfully', async () => {
      const openingRange = new OpeningRange();
      openingRange.high = 2455.0;
      openingRange.low = 2440.0;
      openingRange.open = 2442.0;

      const errors = await validate(openingRange);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with negative values', async () => {
      const openingRange = new OpeningRange();
      openingRange.high = -100; // Invalid: negative
      openingRange.low = 2440.0;
      openingRange.open = 2442.0;

      const errors = await validate(openingRange);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'high')).toBe(true);
    });
  });

  describe('IntradaySignal Enum', () => {
    it('should have all required signal types', () => {
      expect(IntradaySignal.BUY).toBe('BUY');
      expect(IntradaySignal.SELL).toBe('SELL');
      expect(IntradaySignal.HOLD).toBe('HOLD');
      expect(IntradaySignal.NO_TRADE).toBe('NO_TRADE');
    });
  });

  describe('Field Requirements', () => {
    it('should have all required fields defined per task 60.4', () => {
      const recommendation = new IntradayRecommendation();
      recommendation.symbol = 'TEST';
      recommendation.signal = IntradaySignal.BUY;
      recommendation.confidence = 75;
      recommendation.timestamp = '2024-01-15T10:30:00Z';
      recommendation.entry = 100;
      recommendation.stopLoss = 95;
      recommendation.target = 110;
      recommendation.riskReward = 2.0;
      recommendation.currentPrice = 100;
      recommendation.vwap = 99;
      recommendation.ema5 = 101;
      recommendation.ema15 = 100;
      recommendation.rsi = 55;

      const macd = new MacdValues();
      macd.value = 1.0;
      macd.signal = 0.5;
      macd.histogram = 0.5;
      recommendation.macd = macd;

      const openingRange = new OpeningRange();
      openingRange.high = 102;
      openingRange.low = 98;
      openingRange.open = 99;
      recommendation.openingRange = openingRange;

      recommendation.previousDayHigh = 105;
      recommendation.previousDayLow = 95;
      recommendation.isStale = false;
      recommendation.dataTimestamp = '2024-01-15T10:29:00Z';
      recommendation.rationale = 'Test rationale';

      // Basic identification fields (Requirements 6.7)
      expect(recommendation).toHaveProperty('symbol');
      expect(recommendation).toHaveProperty('signal');
      expect(recommendation).toHaveProperty('confidence');
      expect(recommendation).toHaveProperty('timestamp');

      // Entry/exit levels (Requirements 6.7)
      expect(recommendation).toHaveProperty('entry');
      expect(recommendation).toHaveProperty('stopLoss');
      expect(recommendation).toHaveProperty('target');
      expect(recommendation).toHaveProperty('riskReward');

      // Technical indicators (Requirements 6.7)
      expect(recommendation).toHaveProperty('currentPrice');
      expect(recommendation).toHaveProperty('vwap');
      expect(recommendation).toHaveProperty('ema5');
      expect(recommendation).toHaveProperty('ema15');
      expect(recommendation).toHaveProperty('rsi');
      expect(recommendation).toHaveProperty('macd');

      // Price context (Requirements 6.7)
      expect(recommendation).toHaveProperty('openingRange');
      expect(recommendation).toHaveProperty('previousDayHigh');
      expect(recommendation).toHaveProperty('previousDayLow');

      // Data quality and reasoning (Requirements 6.7)
      expect(recommendation).toHaveProperty('isStale');
      expect(recommendation).toHaveProperty('dataTimestamp');
      expect(recommendation).toHaveProperty('rationale');
    });
  });
});

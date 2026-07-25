/**
 * Integration test for IntradayRecommendationService
 *
 * Tests the complete flow:
 * Market Data → Quant Engine → IntradayRecommendationService
 *
 * Verifies:
 * - Confidence threshold enforcement (minimum 65)
 * - Risk/reward threshold enforcement (minimum 1.5)
 * - Data freshness validation (maximum 5 minutes)
 * - Signal generation (BUY/SELL/HOLD/NO_TRADE)
 *
 * Requirements: 6.5, 6.6, 6.7
 */

import { Test, TestingModule } from '@nestjs/testing';
import { IntradayRecommendationService } from './intraday-recommendation.service';

describe('IntradayRecommendationService - Integration', () => {
  let service: IntradayRecommendationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntradayRecommendationService],
    }).compile();

    service = module.get<IntradayRecommendationService>(IntradayRecommendationService);
  });

  describe('Full recommendation flow', () => {
    it('should generate BUY recommendation for strong bullish setup', () => {
      // Simulate complete Quant Engine response
      const quantAnalysisResult = {
        symbol: 'RELIANCE',
        interval: '5m',
        timestamp: new Date().toISOString(),
        data_freshness: {
          timestamp: new Date().toISOString(),
          age_seconds: 45, // Fresh data
          is_stale: false,
        },
        technical_analysis: {
          rsi: 65,
          macd: {
            value: 12.5,
            signal: 10.2,
            histogram: 2.3,
          },
          ema_9: 2465,
          ema_21: 2455,
          ema_50: 2445,
          vwap: 2450,
          atr: 15.5,
          volume: 150000,
          relative_volume: 1.5,
          bollinger_bands: {
            upper: 2480,
            middle: 2460,
            lower: 2440,
          },
          support_levels: [2430, 2445],
          resistance_levels: [2475, 2490],
        },
        current_price: 2463,
        price_change: 15.5,
        price_change_percent: 0.63,
        score: {
          total_score: 75.5,
          components: {
            momentum_score: 80,
            trend_score: 75,
            volume_score: 85,
            volatility_score: 70,
            breakout_score: 65,
          },
          signals: [
            'RSI in optimal intraday range (65)',
            'Strong bullish EMA alignment',
            'High volume (1.5x average)',
            'Price above VWAP',
          ],
          strength: 'STRONG',
        },
        opening_range: {
          high: 2470,
          low: 2460,
          midpoint: 2465,
          range_size: 10,
          range_percent: 0.41,
          breakout_status: 'BREAKOUT_ABOVE',
          current_price: 2463,
          breakout_distance: 0.4,
          volume_confirmed: true,
          volume_ratio: 1.5,
        },
        prev_day_levels: {
          prev_day_high: 2500,
          prev_day_low: 2450,
          prev_day_close: 2480,
          gap_percent: 0.4,
          gap_type: 'GAP_UP',
          breach_status: 'WITHIN_RANGE',
          current_price: 2463,
          distance_from_high_percent: -1.48,
          distance_from_low_percent: 0.53,
          breach_significance: 0.0,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.755, // 75.5%
          entry: 2463,
          stop_loss: 2445,
          target: 2490,
          risk_reward: 1.5, // (2490 - 2463) / (2463 - 2445) = 27 / 18 = 1.5
          rationale:
            'Strong intraday momentum with RSI at 65, price above VWAP, and opening range breakout confirmed by volume',
          is_stale: false,
          valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          warnings: [],
        },
      };

      const result = service.generateRecommendation(quantAnalysisResult);

      expect(result.signal).toBe('BUY');
      expect(result.confidence).toBeGreaterThanOrEqual(65);
      expect(result.riskReward).toBeGreaterThanOrEqual(1.5);
      expect(result.isStale).toBe(false);
      expect(result.dataAge).toBe(45); // Task 61.2: dataAge field
      expect(result.entry).toBe(2463);
      expect(result.stopLoss).toBe(2445);
      expect(result.target).toBe(2490);
      expect(result.rationale).toContain('momentum');
    });

    it('should reject recommendation when confidence is below threshold', () => {
      const quantAnalysisResult = {
        symbol: 'WEAKSTOCK',
        interval: '5m',
        timestamp: new Date().toISOString(),
        data_freshness: {
          timestamp: new Date().toISOString(),
          age_seconds: 45,
          is_stale: false,
        },
        technical_analysis: {
          rsi: 52,
          macd: { value: 1.2, signal: 1.0, histogram: 0.2 },
          ema_9: 100,
          ema_21: 99.5,
          ema_50: 99,
          vwap: 99,
          atr: 2.5,
          volume: 50000,
          relative_volume: 1.0,
          bollinger_bands: { upper: 105, middle: 100, lower: 95 },
          support_levels: [95],
          resistance_levels: [105],
        },
        current_price: 100,
        price_change: 0.5,
        price_change_percent: 0.5,
        score: {
          total_score: 55, // Below 65 threshold
          components: {},
          signals: ['Weak setup'],
          strength: 'WEAK',
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.55, // 55% - below threshold
          entry: 100,
          stop_loss: 98,
          target: 105,
          risk_reward: 2.5,
          rationale: 'Weak setup',
        },
      };

      const result = service.generateRecommendation(quantAnalysisResult);

      expect(result.signal).toBe('NO_TRADE');
      expect(result.confidence).toBe(55);
      expect(result.dataAge).toBe(45); // Task 61.2: dataAge field
      expect(result.rationale).toContain('Confidence');
      expect(result.rationale).toContain('below minimum');
    });

    it('should reject recommendation when risk/reward is below threshold', () => {
      const quantAnalysisResult = {
        symbol: 'POORSETUP',
        interval: '5m',
        timestamp: new Date().toISOString(),
        data_freshness: {
          timestamp: new Date().toISOString(),
          age_seconds: 45,
          is_stale: false,
        },
        technical_analysis: {
          rsi: 65,
          macd: { value: 5.0, signal: 3.0, histogram: 2.0 },
          ema_9: 100,
          ema_21: 98,
          ema_50: 95,
          vwap: 95,
          atr: 2.5,
          volume: 100000,
          relative_volume: 1.5,
          bollinger_bands: { upper: 105, middle: 100, lower: 95 },
          support_levels: [95],
          resistance_levels: [105],
        },
        current_price: 100,
        price_change: 2.0,
        price_change_percent: 2.0,
        score: {
          total_score: 70,
          components: {},
          signals: ['Good momentum but limited upside'],
          strength: 'MODERATE',
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.7,
          entry: 100,
          stop_loss: 95,
          target: 102, // Risk/Reward = (102-100)/(100-95) = 2/5 = 0.4 - below 1.5
          risk_reward: 0.4,
          rationale: 'Limited upside potential',
        },
      };

      const result = service.generateRecommendation(quantAnalysisResult);

      expect(result.signal).toBe('NO_TRADE');
      expect(result.riskReward).toBe(0.4);
      expect(result.dataAge).toBe(45); // Task 61.2: dataAge field
      expect(result.rationale).toContain('Risk/Reward');
      expect(result.rationale).toContain('below minimum');
    });

    it('should reject recommendation when data is stale', () => {
      const quantAnalysisResult = {
        symbol: 'STALEDATA',
        interval: '5m',
        timestamp: new Date().toISOString(),
        data_freshness: {
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes old
          age_seconds: 600, // 10 minutes
          is_stale: true,
        },
        technical_analysis: {
          rsi: 65,
          macd: { value: 5.0, signal: 3.0, histogram: 2.0 },
          ema_9: 100,
          ema_21: 98,
          ema_50: 95,
          vwap: 95,
          atr: 2.5,
          volume: 100000,
          relative_volume: 1.5,
          bollinger_bands: { upper: 105, middle: 100, lower: 95 },
          support_levels: [95],
          resistance_levels: [105],
        },
        current_price: 100,
        score: {
          total_score: 75,
          components: {},
          signals: ['Good setup'],
          strength: 'STRONG',
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.75,
          entry: 100,
          stop_loss: 95,
          target: 110,
          risk_reward: 2.0,
          rationale: 'Good setup but stale data',
        },
      };

      const result = service.generateRecommendation(quantAnalysisResult);

      expect(result.signal).toBe('NO_TRADE');
      expect(result.isStale).toBe(true);
      expect(result.dataAge).toBe(600); // Task 61.2: dataAge field (10 minutes)
      expect(result.rationale).toContain('stale');
      expect(result.rationale).toContain('10.0 minutes old');
    });
  });
});

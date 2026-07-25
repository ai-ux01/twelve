import { Test, TestingModule } from '@nestjs/testing';
import { IntradayRecommendationService } from './intraday-recommendation.service';

describe('IntradayRecommendationService', () => {
  let service: IntradayRecommendationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntradayRecommendationService],
    }).compile();

    service = module.get<IntradayRecommendationService>(IntradayRecommendationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRecommendation', () => {
    it('should return NO_TRADE when data is stale', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 75 },
        data_freshness: {
          age_seconds: 600, // 10 minutes - stale for intraday
          timestamp: new Date().toISOString(),
          is_stale: true,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.75,
          entry: 2460,
          stop_loss: 2445,
          target: 2490,
          risk_reward: 2.0,
          rationale: 'Strong momentum',
        },
        technical_analysis: {
          rsi: 65,
          macd: { histogram: 5.2 },
          vwap: 2450,
          relative_volume: 1.5,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result.signal).toBe('NO_TRADE');
      expect(result.isStale).toBe(true);
      expect(result.dataAge).toBe(600); // Task 61.2: dataAge field
      expect(result.rationale).toContain('stale');
    });

    it('should return NO_TRADE when confidence is below threshold', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 60 }, // Below 65 threshold
        data_freshness: {
          age_seconds: 60, // Fresh data
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.6, // 60% - below threshold
          entry: 2460,
          stop_loss: 2445,
          target: 2490,
          risk_reward: 2.0,
          rationale: 'Moderate momentum',
        },
        technical_analysis: {
          rsi: 55,
          macd: { histogram: 2.1 },
          vwap: 2450,
          relative_volume: 1.2,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result.signal).toBe('NO_TRADE');
      expect(result.confidence).toBe(60);
      expect(result.dataAge).toBe(60); // Task 61.2: dataAge field
      expect(result.rationale).toContain('Confidence');
      expect(result.rationale).toContain('below minimum');
    });

    it('should return NO_TRADE when risk/reward is below threshold', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 75 },
        data_freshness: {
          age_seconds: 60,
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.75,
          entry: 2460,
          stop_loss: 2445,
          target: 2470, // Risk/Reward = 10 / 15 = 0.67 - below 1.5 threshold
          risk_reward: 0.67,
          rationale: 'Limited upside',
        },
        technical_analysis: {
          rsi: 65,
          macd: { histogram: 5.2 },
          vwap: 2450,
          relative_volume: 1.5,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result.signal).toBe('NO_TRADE');
      expect(result.riskReward).toBe(0.67);
      expect(result.dataAge).toBe(60); // Task 61.2: dataAge field
      expect(result.rationale).toContain('Risk/Reward');
      expect(result.rationale).toContain('below minimum');
    });

    it('should return BUY signal when all thresholds are met', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 75 },
        data_freshness: {
          age_seconds: 60,
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.75, // 75% - above threshold
          entry: 2460,
          stop_loss: 2445,
          target: 2490, // Risk/Reward = 30 / 15 = 2.0 - above 1.5 threshold
          risk_reward: 2.0,
          rationale: 'Strong bullish momentum',
        },
        technical_analysis: {
          rsi: 65,
          macd: { histogram: 5.2 },
          vwap: 2450,
          relative_volume: 1.5,
          ema_9: 2465,
          ema_21: 2455,
          ema_50: 2445,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result.signal).toBe('BUY');
      expect(result.confidence).toBe(75);
      expect(result.riskReward).toBe(2.0);
      expect(result.entry).toBe(2460);
      expect(result.stopLoss).toBe(2445);
      expect(result.target).toBe(2490);
      expect(result.isStale).toBe(false);
      expect(result.dataAge).toBe(60); // Task 61.2: dataAge field
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should return SELL signal when bearish conditions are met', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 70 },
        data_freshness: {
          age_seconds: 45,
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'SELL',
          confidence: 0.7,
          entry: 2460,
          stop_loss: 2475,
          target: 2430,
          risk_reward: 2.0,
          rationale: 'Strong bearish momentum',
        },
        technical_analysis: {
          rsi: 35,
          macd: { histogram: -5.2 },
          vwap: 2470,
          relative_volume: 1.5,
          ema_9: 2455,
          ema_21: 2465,
          ema_50: 2475,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result.signal).toBe('SELL');
      expect(result.confidence).toBe(70);
      expect(result.riskReward).toBe(2.0);
      expect(result.isStale).toBe(false);
      expect(result.dataAge).toBe(45); // Task 61.2: dataAge field
    });

    it('should return NO_TRADE when Quant Engine recommends NO_TRADE', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 50 },
        data_freshness: {
          age_seconds: 45,
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'NO_TRADE',
          confidence: 0.5,
          entry: null,
          stop_loss: null,
          target: null,
          risk_reward: 0,
          rationale: 'Insufficient setup quality',
        },
        technical_analysis: {
          rsi: 50,
          macd: { histogram: 0.5 },
          vwap: 2460,
          relative_volume: 0.9,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result.signal).toBe('NO_TRADE');
    });

    it('should detect conflicting indicators and return NO_TRADE', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 75 },
        data_freshness: {
          age_seconds: 60,
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.75,
          entry: 2460,
          stop_loss: 2445,
          target: 2490,
          risk_reward: 2.0,
          rationale: 'Mixed signals',
        },
        technical_analysis: {
          rsi: 25, // Oversold
          macd: { histogram: 5.0 }, // Bullish
          vwap: 2450, // Price above VWAP (2460 > 2450)
          relative_volume: 1.5,
          ema_9: 2455, // Bearish alignment (9 < 21 < 50)
          ema_21: 2465,
          ema_50: 2475,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      // Should detect: Price above VWAP but RSI oversold, MACD bullish but EMAs bearish
      expect(result.signal).toBe('NO_TRADE');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('conflicting'))).toBe(true);
    });

    it('should include warnings in the result', () => {
      const analysisResult = {
        symbol: 'RELIANCE',
        score: { total_score: 75 },
        data_freshness: {
          age_seconds: 60,
          timestamp: new Date().toISOString(),
          is_stale: false,
        },
        recommendation: {
          signal: 'BUY',
          confidence: 0.75,
          entry: 2460,
          stop_loss: 2445,
          target: 2490,
          risk_reward: 2.0,
          rationale: 'Strong momentum',
        },
        technical_analysis: {
          rsi: 65,
          macd: { histogram: 5.2 },
          vwap: 2450,
          relative_volume: 1.5,
          ema_9: 2465,
          ema_21: 2455,
          ema_50: 2445,
        },
        current_price: 2460,
      };

      const result = await service.generateRecommendation(analysisResult);

      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});

import { validate } from 'class-validator';
import { IntradayAnalysisRequestDto } from './intraday-analysis-request.dto';

describe('IntradayAnalysisRequestDto', () => {
  it('should accept valid request with all fields', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = 'RELIANCE';
    dto.interval = '5m';
    dto.userId = 'user123';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid request without optional userId', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = 'TCS';
    dto.interval = '15m';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept all valid interval values', async () => {
    const validIntervals = ['1m', '5m', '15m', '30m', '1h'];

    for (const interval of validIntervals) {
      const dto = new IntradayAnalysisRequestDto();
      dto.symbol = 'RELIANCE';
      dto.interval = interval;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('should reject invalid interval', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = 'RELIANCE';
    dto.interval = '2m'; // Invalid interval

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('interval');
  });

  it('should reject lowercase symbol', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = 'reliance'; // Should be uppercase
    dto.interval = '5m';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('symbol');
  });

  it('should reject symbol with special characters', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = 'REL-IANCE'; // Invalid characters
    dto.interval = '5m';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('symbol');
  });

  it('should reject empty symbol', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = '';
    dto.interval = '5m';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('symbol');
  });

  it('should accept symbol with numbers', async () => {
    const dto = new IntradayAnalysisRequestDto();
    dto.symbol = 'NIFTY50';
    dto.interval = '5m';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

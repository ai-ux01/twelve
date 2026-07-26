import { parseTick, parseDepth } from './tick-parser';
import { RawHsmTick, RawHsmDepth } from './interfaces';

describe('TickParser', () => {
  describe('parseTick', () => {
    it('should parse a valid RawHsmTick into a NormalizedTick', () => {
      const raw: RawHsmTick = {
        tk: '11536',
        lp: '19500.50',
        op: '19400.00',
        hp: '19600.00',
        lop: '19350.00',
        pc: '19380.00',
        v: '1250000',
        oi: '5000',
        bp1: '19499.50',
        sp1: '19501.00',
        e: 'nse_cm',
        n: 'NIFTY',
        ts: '2024-01-15T10:30:00.000Z',
      };

      const result = parseTick(raw);

      expect(result).not.toBeNull();
      expect(result!.instrumentToken).toBe('11536');
      expect(result!.lastPrice).toBe(19500.5);
      expect(result!.open).toBe(19400.0);
      expect(result!.high).toBe(19600.0);
      expect(result!.low).toBe(19350.0);
      expect(result!.previousClose).toBe(19380.0);
      expect(result!.volume).toBe(1250000);
      expect(result!.oi).toBe(5000);
      expect(result!.bid).toBe(19499.5);
      expect(result!.ask).toBe(19501.0);
      expect(result!.exchange).toBe('nse_cm');
      expect(result!.symbol).toBe('NIFTY');
      expect(result!.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should return null when token (tk) is missing', () => {
      const raw = { lp: '100.0' } as unknown as RawHsmTick;
      expect(parseTick(raw)).toBeNull();
    });

    it('should return null when lastPrice (lp) is missing', () => {
      const raw: RawHsmTick = { tk: '11536' } as unknown as RawHsmTick;
      expect(parseTick(raw)).toBeNull();
    });

    it('should return null when lastPrice is zero', () => {
      const raw: RawHsmTick = { tk: '11536', lp: '0' };
      expect(parseTick(raw)).toBeNull();
    });

    it('should return null when lastPrice is negative', () => {
      const raw: RawHsmTick = { tk: '11536', lp: '-10.5' };
      expect(parseTick(raw)).toBeNull();
    });

    it('should return null when lastPrice is not a valid number', () => {
      const raw: RawHsmTick = { tk: '11536', lp: 'abc' };
      expect(parseTick(raw)).toBeNull();
    });

    it('should use 0 as default for optional numeric fields', () => {
      const raw: RawHsmTick = { tk: '11536', lp: '100.5' };
      const result = parseTick(raw);

      expect(result).not.toBeNull();
      expect(result!.open).toBe(0);
      expect(result!.high).toBe(0);
      expect(result!.low).toBe(0);
      expect(result!.previousClose).toBe(0);
      expect(result!.volume).toBe(0);
      expect(result!.oi).toBe(0);
      expect(result!.bid).toBe(0);
      expect(result!.ask).toBe(0);
    });

    it('should use current time if timestamp is not provided', () => {
      const before = new Date().toISOString();
      const raw: RawHsmTick = { tk: '11536', lp: '100.5' };
      const result = parseTick(raw);
      const after = new Date().toISOString();

      expect(result).not.toBeNull();
      expect(result!.timestamp >= before).toBe(true);
      expect(result!.timestamp <= after).toBe(true);
    });

    it('should default exchange and symbol to empty string when not provided', () => {
      const raw: RawHsmTick = { tk: '11536', lp: '100.5' };
      const result = parseTick(raw);

      expect(result!.exchange).toBe('');
      expect(result!.symbol).toBe('');
    });
  });

  describe('parseDepth', () => {
    it('should parse a full RawHsmDepth with 5 bid and 5 ask levels', () => {
      const raw: RawHsmDepth = {
        tk: '11536',
        e: 'nse_cm',
        bp1: '100.0',
        bq1: '500',
        bo1: '10',
        bp2: '99.5',
        bq2: '300',
        bo2: '8',
        bp3: '99.0',
        bq3: '200',
        bo3: '5',
        bp4: '98.5',
        bq4: '150',
        bo4: '3',
        bp5: '98.0',
        bq5: '100',
        bo5: '2',
        sp1: '100.5',
        sq1: '400',
        so1: '9',
        sp2: '101.0',
        sq2: '250',
        so2: '7',
        sp3: '101.5',
        sq3: '180',
        so3: '4',
        sp4: '102.0',
        sq4: '120',
        so4: '3',
        sp5: '102.5',
        sq5: '80',
        so5: '1',
        ts: '2024-01-15T10:30:00.000Z',
      };

      const result = parseDepth(raw);

      expect(result.instrumentToken).toBe('11536');
      expect(result.bids).toHaveLength(5);
      expect(result.asks).toHaveLength(5);

      // Bids sorted descending
      expect(result.bids[0].price).toBe(100.0);
      expect(result.bids[4].price).toBe(98.0);

      // Asks sorted ascending
      expect(result.asks[0].price).toBe(100.5);
      expect(result.asks[4].price).toBe(102.5);

      expect(result.bestBid).toBe(100.0);
      expect(result.bestAsk).toBe(100.5);
      expect(result.spread).toBe(0.5);
      expect(result.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should sort bids descending even if input is unordered', () => {
      const raw: RawHsmDepth = {
        tk: '11536',
        e: 'nse_cm',
        bp1: '98.0',
        bq1: '100',
        bo1: '2',
        bp2: '100.0',
        bq2: '500',
        bo2: '10',
        bp3: '99.0',
        bq3: '200',
        bo3: '5',
      };

      const result = parseDepth(raw);

      expect(result.bids[0].price).toBe(100.0);
      expect(result.bids[1].price).toBe(99.0);
      expect(result.bids[2].price).toBe(98.0);
    });

    it('should sort asks ascending even if input is unordered', () => {
      const raw: RawHsmDepth = {
        tk: '11536',
        e: 'nse_cm',
        sp1: '102.0',
        sq1: '100',
        so1: '2',
        sp2: '100.5',
        sq2: '400',
        so2: '9',
        sp3: '101.0',
        sq3: '250',
        so3: '7',
      };

      const result = parseDepth(raw);

      expect(result.asks[0].price).toBe(100.5);
      expect(result.asks[1].price).toBe(101.0);
      expect(result.asks[2].price).toBe(102.0);
    });

    it('should compute spread as bestAsk - bestBid', () => {
      const raw: RawHsmDepth = {
        tk: '11536',
        e: 'nse_cm',
        bp1: '99.0',
        bq1: '100',
        bo1: '2',
        sp1: '101.0',
        sq1: '100',
        so1: '2',
      };

      const result = parseDepth(raw);
      expect(result.spread).toBe(2.0);
    });

    it('should return spread 0 when no bids or asks exist', () => {
      const raw: RawHsmDepth = { tk: '11536', e: 'nse_cm' };
      const result = parseDepth(raw);

      expect(result.bids).toHaveLength(0);
      expect(result.asks).toHaveLength(0);
      expect(result.bestBid).toBe(0);
      expect(result.bestAsk).toBe(0);
      expect(result.spread).toBe(0);
    });

    it('should use current time if timestamp is not provided', () => {
      const before = new Date().toISOString();
      const raw: RawHsmDepth = { tk: '11536', e: 'nse_cm' };
      const result = parseDepth(raw);
      const after = new Date().toISOString();

      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });
  });
});

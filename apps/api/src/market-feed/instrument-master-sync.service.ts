import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MarketFeedConfig } from './market-feed.config';
import axios, { AxiosError } from 'axios';

export interface RawInstrumentRow {
  pSymbol: string;         // instrumentToken
  pExchSeg: string;        // exchangeSegment
  pTrdSymbol: string;      // tradingSymbol
  lLotSize: string;        // lotSize
  lExpiryDate: string;     // expiry (epoch or date string)
  pSymbolName?: string;    // human-readable name
  pOptionType?: string;    // CE, PE, or empty
  dStrikePrice?: string;   // strike price for options
  pUnderlying?: string;    // underlying symbol
  dTickSize?: string;      // tick size
  pExchange?: string;      // exchange (NSE, BSE)
  pAssetType?: string;     // asset type
}

export interface SyncResult {
  success: boolean;
  totalParsed: number;
  upserted: number;
  deactivated: number;
  errors: string[];
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const BATCH_SIZE = 500;

@Injectable()
export class InstrumentMasterSync {
  private readonly logger = new Logger(InstrumentMasterSync.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MarketFeedConfig,
  ) {}

  /**
   * Orchestrates the full instrument sync pipeline:
   * 1. Fetch CSV file paths from Kotak API
   * 2. Download and parse each CSV
   * 3. Upsert instruments into the database
   * 4. Deactivate expired instruments
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      totalParsed: 0,
      upserted: 0,
      deactivated: 0,
      errors: [],
    };

    this.logger.log('Starting instrument master sync...');

    try {
      // Step 1: Fetch file paths
      const filePaths = await this.fetchFilePaths();
      this.logger.log(`Fetched ${filePaths.length} CSV file path(s)`);

      // Step 2: Download and parse each CSV
      const allRows: RawInstrumentRow[] = [];
      for (const url of filePaths) {
        try {
          const rows = await this.downloadAndParseCsv(url);
          allRows.push(...rows);
          this.logger.log(`Parsed ${rows.length} rows from ${url}`);
        } catch (error) {
          const msg = `Failed to download/parse CSV from ${url}: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(msg);
          result.errors.push(msg);
        }
      }

      result.totalParsed = allRows.length;
      this.logger.log(`Total rows parsed: ${allRows.length}`);

      // Step 3: Upsert instruments
      if (allRows.length > 0) {
        result.upserted = await this.upsertInstruments(allRows);
        this.logger.log(`Upserted ${result.upserted} instruments`);
      }

      // Step 4: Deactivate expired instruments
      result.deactivated = await this.deactivateExpired();
      this.logger.log(`Deactivated ${result.deactivated} expired instruments`);

      result.success = true;
      this.logger.log('Instrument master sync completed successfully');
    } catch (error) {
      const msg = `Instrument sync failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(msg);
      result.errors.push(msg);
    }

    return result;
  }

  /**
   * Fetch CSV file paths from the Kotak scripmaster API.
   * GET <baseUrl>/script-details/1.0/masterscrip/file-paths
   */
  async fetchFilePaths(): Promise<string[]> {
    const baseUrl = 'https://gw-napi.kotaksecurities.com';
    const url = `${baseUrl}/script-details/1.0/masterscrip/file-paths`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${process.env.KOTAK_NEO_ACCESS_TOKEN || ''}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      // The response typically contains an array of file URLs
      if (response.data && Array.isArray(response.data.filesPaths)) {
        return response.data.filesPaths;
      }

      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }

      this.logger.warn('Unexpected response format from file-paths API');
      return [];
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `Failed to fetch file paths: ${axiosError.message} (status: ${axiosError.response?.status ?? 'unknown'})`,
      );
    }
  }

  /**
   * Download a CSV file and parse it into RawInstrumentRow[].
   * Retries up to 3 times with 5-second intervals on failure.
   */
  async downloadAndParseCsv(url: string): Promise<RawInstrumentRow[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(url, {
          responseType: 'text',
          timeout: 60000,
        });

        return this.parseCsv(response.data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `CSV download attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${lastError.message}`,
        );

        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }

    throw new Error(
      `Failed to download CSV from ${url} after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Parse CSV text into RawInstrumentRow[].
   * Handles the known Kotak column format.
   */
  parseCsv(csvText: string): RawInstrumentRow[] {
    const lines = csvText.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      return [];
    }

    // First line is the header
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim());

    const rows: RawInstrumentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCsvLine(lines[i]);
        const row = this.mapToRow(headers, values);
        if (row) {
          rows.push(row);
        }
      } catch (error) {
        this.logger.warn(
          `Skipping malformed CSV row ${i}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV line, handling quoted fields.
   */
  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Map header+values to a RawInstrumentRow.
   * Returns null if the row is missing critical fields.
   */
  private mapToRow(headers: string[], values: string[]): RawInstrumentRow | null {
    const getField = (name: string): string => {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < values.length ? values[idx] : '';
    };

    const pSymbol = getField('pSymbol');
    const pExchSeg = getField('pExchSeg');
    const pTrdSymbol = getField('pTrdSymbol');

    // Skip rows with missing critical fields
    if (!pSymbol || !pExchSeg || !pTrdSymbol) {
      return null;
    }

    return {
      pSymbol,
      pExchSeg,
      pTrdSymbol,
      lLotSize: getField('lLotSize'),
      lExpiryDate: getField('lExpiryDate'),
      pSymbolName: getField('pSymbolName'),
      pOptionType: getField('pOptionType'),
      dStrikePrice: getField('dStrikePrice') || getField('dStrikePrice;'),
      pUnderlying: getField('pUnderlying'),
      dTickSize: getField('dTickSize'),
      pExchange: getField('pExchange'),
      pAssetType: getField('pAssetType'),
    };
  }

  /**
   * Batch upsert instrument rows into the database.
   * Matches on exchange + instrumentToken for idempotency.
   */
  async upsertInstruments(rows: RawInstrumentRow[]): Promise<number> {
    let upsertedCount = 0;

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const promises = batch.map((row) => this.upsertSingleInstrument(row));
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          upsertedCount++;
        } else if (result.status === 'rejected') {
          this.logger.warn(`Failed to upsert instrument: ${result.reason}`);
        }
      }

      if (i + BATCH_SIZE < rows.length) {
        this.logger.log(
          `Upsert progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`,
        );
      }
    }

    return upsertedCount;
  }

  /**
   * Upsert a single instrument row.
   */
  private async upsertSingleInstrument(row: RawInstrumentRow): Promise<boolean> {
    try {
      const exchange = this.mapExchange(row.pExchSeg);
      const expiry = this.parseExpiry(row.lExpiryDate);
      const optionType = this.mapOptionType(row.pOptionType);
      const assetType = this.inferAssetType(row);

      // Build a unique symbol combining exchange segment and trading symbol
      const uniqueSymbol = `${row.pExchSeg}:${row.pTrdSymbol}`;

      await this.prisma.instrument.upsert({
        where: { symbol: uniqueSymbol },
        update: {
          instrumentToken: row.pSymbol,
          exchangeSegment: row.pExchSeg,
          exchange,
          name: row.pSymbolName || row.pTrdSymbol,
          lotSize: row.lLotSize ? parseInt(row.lLotSize, 10) || null : null,
          tickSize: row.dTickSize ? parseFloat(row.dTickSize) || null : null,
          expiry,
          optionType,
          strikePrice: row.dStrikePrice ? parseFloat(row.dStrikePrice) || null : null,
          underlying: row.pUnderlying || null,
          isActive: expiry ? expiry > new Date() : true,
          updatedAt: new Date(),
        },
        create: {
          symbol: uniqueSymbol,
          instrumentToken: row.pSymbol,
          exchangeSegment: row.pExchSeg,
          exchange,
          name: row.pSymbolName || row.pTrdSymbol,
          assetType,
          lotSize: row.lLotSize ? parseInt(row.lLotSize, 10) || null : null,
          tickSize: row.dTickSize ? parseFloat(row.dTickSize) || null : null,
          expiry,
          optionType,
          strikePrice: row.dStrikePrice ? parseFloat(row.dStrikePrice) || null : null,
          underlying: row.pUnderlying || null,
          isActive: expiry ? expiry > new Date() : true,
        },
      });

      return true;
    } catch (error) {
      this.logger.warn(
        `Upsert failed for token ${row.pSymbol}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Set isActive=false for instruments with past expiry dates.
   */
  async deactivateExpired(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.instrument.updateMany({
      where: {
        expiry: {
          lt: now,
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return result.count;
  }

  /**
   * Map exchange segment string to exchange name.
   */
  private mapExchange(exchSeg: string): string {
    const seg = exchSeg.toLowerCase();
    if (seg.startsWith('nse')) return 'NSE';
    if (seg.startsWith('bse')) return 'BSE';
    if (seg.startsWith('mcx')) return 'MCX';
    if (seg.startsWith('cds')) return 'CDS';
    return exchSeg.toUpperCase();
  }

  /**
   * Map option type string to the OptionType enum.
   */
  private mapOptionType(optType?: string): 'CALL' | 'PUT' | null {
    if (!optType) return null;
    const upper = optType.toUpperCase();
    if (upper === 'CE' || upper === 'CALL') return 'CALL';
    if (upper === 'PE' || upper === 'PUT') return 'PUT';
    return null;
  }

  /**
   * Parse expiry from epoch string or date string.
   */
  private parseExpiry(expiryStr: string): Date | null {
    if (!expiryStr || expiryStr === '0' || expiryStr === '') return null;

    // Try parsing as epoch (seconds)
    const epoch = parseInt(expiryStr, 10);
    if (!isNaN(epoch) && epoch > 1000000000) {
      // Likely epoch in seconds (post-2001)
      return new Date(epoch * 1000);
    }

    // Try parsing as date string
    const date = new Date(expiryStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    return null;
  }

  /**
   * Infer asset type from row fields.
   * Returns values matching the Prisma AssetType enum: STOCK, OPTION_CALL, OPTION_PUT, INDEX, FUTURES
   */
  private inferAssetType(row: RawInstrumentRow): 'STOCK' | 'OPTION_CALL' | 'OPTION_PUT' | 'INDEX' | 'FUTURES' {
    const optType = row.pOptionType?.toUpperCase();
    if (optType === 'CE' || optType === 'CALL') {
      return 'OPTION_CALL';
    }
    if (optType === 'PE' || optType === 'PUT') {
      return 'OPTION_PUT';
    }
    if (row.lExpiryDate && row.lExpiryDate !== '0' && row.lExpiryDate !== '') {
      return 'FUTURES';
    }
    const seg = row.pExchSeg?.toLowerCase() || '';
    if (seg.includes('fo') || seg.includes('opt') || seg.includes('fut')) {
      return 'FUTURES';
    }
    return 'STOCK';
  }

  /**
   * Sleep utility for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

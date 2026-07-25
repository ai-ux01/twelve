/**
 * Test script for default NSE F&O universe initialization
 * Run with: ts-node --project tsconfig.json src/swing/test-default-universe.ts
 */

import { PrismaClient } from '@prisma/client';

// Default NSE F&O stocks (same as in SwingService)
const defaultStocks = [
  // Banking & Finance
  { symbol: 'HDFCBANK', sector: 'Banking', marketCap: 1200000 },
  { symbol: 'ICICIBANK', sector: 'Banking', marketCap: 700000 },
  { symbol: 'SBIN', sector: 'Banking', marketCap: 600000 },
  { symbol: 'AXISBANK', sector: 'Banking', marketCap: 300000 },
  { symbol: 'KOTAKBANK', sector: 'Banking', marketCap: 350000 },
  { symbol: 'INDUSINDBK', sector: 'Banking', marketCap: 120000 },
  { symbol: 'BAJFINANCE', sector: 'Finance', marketCap: 400000 },
  { symbol: 'BAJAJFINSV', sector: 'Finance', marketCap: 250000 },

  // IT
  { symbol: 'TCS', sector: 'IT', marketCap: 1300000 },
  { symbol: 'INFY', sector: 'IT', marketCap: 700000 },
  { symbol: 'WIPRO', sector: 'IT', marketCap: 250000 },
  { symbol: 'HCLTECH', sector: 'IT', marketCap: 350000 },
  { symbol: 'TECHM', sector: 'IT', marketCap: 120000 },

  // Oil & Gas
  { symbol: 'RELIANCE', sector: 'Oil & Gas', marketCap: 1700000 },
  { symbol: 'ONGC', sector: 'Oil & Gas', marketCap: 200000 },
  { symbol: 'BPCL', sector: 'Oil & Gas', marketCap: 100000 },

  // Automobiles
  { symbol: 'MARUTI', sector: 'Automobile', marketCap: 350000 },
  { symbol: 'TATAMOTORS', sector: 'Automobile', marketCap: 300000 },
  { symbol: 'M&M', sector: 'Automobile', marketCap: 250000 },
  { symbol: 'BAJAJ-AUTO', sector: 'Automobile', marketCap: 200000 },

  // Metals
  { symbol: 'TATASTEEL', sector: 'Metals', marketCap: 150000 },
  { symbol: 'HINDALCO', sector: 'Metals', marketCap: 100000 },
  { symbol: 'JSWSTEEL', sector: 'Metals', marketCap: 200000 },

  // Pharma
  { symbol: 'SUNPHARMA', sector: 'Pharma', marketCap: 350000 },
  { symbol: 'DRREDDY', sector: 'Pharma', marketCap: 100000 },
  { symbol: 'CIPLA', sector: 'Pharma', marketCap: 110000 },
  { symbol: 'DIVISLAB', sector: 'Pharma', marketCap: 120000 },

  // Telecom
  { symbol: 'BHARTIARTL', sector: 'Telecom', marketCap: 700000 },

  // FMCG
  { symbol: 'HINDUNILVR', sector: 'FMCG', marketCap: 600000 },
  { symbol: 'ITC', sector: 'FMCG', marketCap: 550000 },
  { symbol: 'NESTLEIND', sector: 'FMCG', marketCap: 230000 },

  // Infrastructure & Cement
  { symbol: 'LT', sector: 'Infrastructure', marketCap: 500000 },
  { symbol: 'ULTRACEMCO', sector: 'Cement', marketCap: 250000 },
  { symbol: 'GRASIM', sector: 'Cement', marketCap: 120000 },

  // Power
  { symbol: 'POWERGRID', sector: 'Power', marketCap: 200000 },
  { symbol: 'NTPC', sector: 'Power', marketCap: 180000 },

  // Others
  { symbol: 'ASIANPAINT', sector: 'Paints', marketCap: 300000 },
  { symbol: 'ADANIPORTS', sector: 'Infrastructure', marketCap: 250000 },
  { symbol: 'TITAN', sector: 'Consumer Goods', marketCap: 280000 },
];

async function initializeDefaultUniverse() {
  const prisma = new PrismaClient();

  try {
    console.log('=== Initializing Default NSE F&O Universe ===\n');
    console.log(`Total stocks to add: ${defaultStocks.length}\n`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const stock of defaultStocks) {
      try {
        const existing = await prisma.stockUniverse.findUnique({
          where: { symbol: stock.symbol },
        });

        if (!existing) {
          await prisma.stockUniverse.create({
            data: {
              symbol: stock.symbol,
              sector: stock.sector,
              marketCap: stock.marketCap,
              isActive: true,
            },
          });
          console.log(`✓ Added: ${stock.symbol} (${stock.sector})`);
          addedCount++;
        } else {
          console.log(`⊙ Skipped: ${stock.symbol} (already exists)`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error adding ${stock.symbol}:`, error);
      }
    }

    console.log(`\n=== Initialization Complete ===`);
    console.log(`Added: ${addedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Total: ${defaultStocks.length}`);

    // Display summary by sector
    console.log('\n=== Universe Summary by Sector ===');
    const allStocks = await prisma.stockUniverse.findMany({
      orderBy: { sector: 'asc' },
    });

    const bySector = allStocks.reduce(
      (acc, stock) => {
        if (!acc[stock.sector]) {
          acc[stock.sector] = [];
        }
        acc[stock.sector].push(stock.symbol);
        return acc;
      },
      {} as Record<string, string[]>
    );

    for (const [sector, symbols] of Object.entries(bySector)) {
      console.log(`${sector}: ${symbols.length} stocks`);
      console.log(`  ${symbols.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDefaultUniverse();

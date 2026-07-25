/**
 * Manual test script for StockUniverse functionality
 * Run with: ts-node --project tsconfig.json src/swing/test-universe-manual.ts
 */

import { PrismaClient } from '@prisma/client';

async function testStockUniverse() {
  const prisma = new PrismaClient();

  try {
    console.log('=== Testing StockUniverse CRUD Operations ===\n');

    // Test 1: Create a stock
    console.log('Test 1: Creating a stock...');
    const newStock = await prisma.stockUniverse.create({
      data: {
        symbol: 'TESTSTOCK',
        sector: 'Technology',
        marketCap: 50000,
        isActive: true,
      },
    });
    console.log('✓ Stock created:', newStock);

    // Test 2: Read the stock
    console.log('\nTest 2: Reading the stock...');
    const readStock = await prisma.stockUniverse.findUnique({
      where: { symbol: 'TESTSTOCK' },
    });
    console.log('✓ Stock read:', readStock);

    // Test 3: Update the stock
    console.log('\nTest 3: Updating the stock...');
    const updatedStock = await prisma.stockUniverse.update({
      where: { symbol: 'TESTSTOCK' },
      data: { marketCap: 60000, isActive: false },
    });
    console.log('✓ Stock updated:', updatedStock);

    // Test 4: List all stocks
    console.log('\nTest 4: Listing all stocks...');
    const allStocks = await prisma.stockUniverse.findMany();
    console.log(`✓ Total stocks in universe: ${allStocks.length}`);

    // Test 5: Filter by sector
    console.log('\nTest 5: Filtering by sector...');
    const techStocks = await prisma.stockUniverse.findMany({
      where: { sector: 'Technology' },
    });
    console.log(`✓ Technology stocks: ${techStocks.length}`);

    // Test 6: Filter by isActive
    console.log('\nTest 6: Filtering by isActive=true...');
    const activeStocks = await prisma.stockUniverse.findMany({
      where: { isActive: true },
    });
    console.log(`✓ Active stocks: ${activeStocks.length}`);

    // Test 7: Delete the test stock
    console.log('\nTest 7: Deleting the test stock...');
    await prisma.stockUniverse.delete({
      where: { symbol: 'TESTSTOCK' },
    });
    console.log('✓ Test stock deleted');

    console.log('\n=== All tests passed! ===');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStockUniverse();

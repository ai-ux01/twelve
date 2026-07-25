/**
 * OptionsChainViewer Component - Usage Examples
 * 
 * This file demonstrates how to use the OptionsChainViewer component
 * in different scenarios.
 */

import { OptionsChainViewer } from './options-chain-viewer';
import { OptionsChainResponse } from '@/lib/api-client';

// ============================================================================
// Example 1: Basic usage with manual fetch
// ============================================================================

export function BasicOptionsChainExample() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">NIFTY Options Chain</h2>
      <OptionsChainViewer underlying="NIFTY" />
    </div>
  );
}

// ============================================================================
// Example 2: BANKNIFTY with specific expiry date
// ============================================================================

export function BankNiftyWithExpiryExample() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">BANKNIFTY Options Chain - Specific Expiry</h2>
      <OptionsChainViewer underlying="BANKNIFTY" expiryDate="2024-12-26" />
    </div>
  );
}

// ============================================================================
// Example 3: With initial data (pre-loaded)
// ============================================================================

const mockInitialData: OptionsChainResponse = {
  underlying: 'NIFTY',
  expiryDate: '2024-12-26',
  spotPrice: 21500,
  strikes: [
    {
      strikePrice: 21400,
      call: {
        ltp: 150.5,
        volume: 5000,
        oi: 10000,
        iv: 15.5,
        bid: 149.5,
        ask: 151.0,
        changeOI: 500,
      },
      put: {
        ltp: 25.5,
        volume: 2000,
        oi: 5000,
        iv: 14.2,
        bid: 25.0,
        ask: 26.0,
        changeOI: -200,
      },
    },
    {
      strikePrice: 21500, // ATM
      call: {
        ltp: 95.75,
        volume: 15000,
        oi: 25000,
        iv: 16.0,
        bid: 95.0,
        ask: 96.5,
        changeOI: 1000,
      },
      put: {
        ltp: 94.25,
        volume: 14000,
        oi: 24000,
        iv: 16.1,
        bid: 93.5,
        ask: 95.0,
        changeOI: 800,
      },
    },
    {
      strikePrice: 21600,
      call: {
        ltp: 45.5,
        volume: 8000,
        oi: 15000,
        iv: 17.5,
        bid: 45.0,
        ask: 46.0,
        changeOI: -300,
      },
      put: {
        ltp: 145.75,
        volume: 6000,
        oi: 12000,
        iv: 16.8,
        bid: 145.0,
        ask: 146.5,
        changeOI: 400,
      },
    },
  ],
};

export function PreLoadedDataExample() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Options Chain with Pre-loaded Data</h2>
      <OptionsChainViewer underlying="NIFTY" initialData={mockInitialData} />
    </div>
  );
}

// ============================================================================
// Example 4: With callbacks for data and error handling
// ============================================================================

export function WithCallbacksExample() {
  const handleDataFetch = (data: OptionsChainResponse) => {
    console.log('Options chain data fetched:', data);
    // You can update parent state, trigger analytics, etc.
  };

  const handleError = (error: Error) => {
    console.error('Failed to fetch options chain:', error);
    // You can show a toast notification, update error state, etc.
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Options Chain with Callbacks</h2>
      <OptionsChainViewer
        underlying="NIFTY"
        onDataFetch={handleDataFetch}
        onError={handleError}
      />
    </div>
  );
}

// ============================================================================
// Example 5: Multiple options chains side by side
// ============================================================================

export function MultipleOptionsChains() {
  return (
    <div className="p-4 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">NIFTY Options Chain</h2>
        <OptionsChainViewer underlying="NIFTY" />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-4">BANKNIFTY Options Chain</h2>
        <OptionsChainViewer underlying="BANKNIFTY" />
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Integration with parent component state
// ============================================================================

import { useState } from 'react';

export function StatefulExample() {
  const [selectedUnderlying, setSelectedUnderlying] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
  const [lastFetchedData, setLastFetchedData] = useState<OptionsChainResponse | null>(null);

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-4">
        <h2 className="text-2xl font-bold">Options Chain Viewer</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedUnderlying('NIFTY')}
            className={`px-4 py-2 rounded ${
              selectedUnderlying === 'NIFTY'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            NIFTY
          </button>
          <button
            onClick={() => setSelectedUnderlying('BANKNIFTY')}
            className={`px-4 py-2 rounded ${
              selectedUnderlying === 'BANKNIFTY'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            BANKNIFTY
          </button>
        </div>
      </div>

      <OptionsChainViewer
        underlying={selectedUnderlying}
        onDataFetch={(data) => {
          setLastFetchedData(data);
          console.log(`Fetched ${data.strikes.length} strikes for ${data.underlying}`);
        }}
        onError={(error) => {
          console.error('Error:', error);
          setLastFetchedData(null);
        }}
      />

      {lastFetchedData && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-bold">Last Fetch Summary:</h3>
          <p>Underlying: {lastFetchedData.underlying}</p>
          <p>Spot Price: ₹{lastFetchedData.spotPrice}</p>
          <p>Total Strikes: {lastFetchedData.strikes.length}</p>
          <p>Expiry: {lastFetchedData.expiryDate}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Key Features Demonstrated
// ============================================================================

/*
Features:
1. ✓ Tabular display with Call and Put columns
2. ✓ All required columns: LTP, OI, ChangeOI, Vol, IV, Bid/Ask
3. ✓ ATM strike highlighting (bold text + ATM badge)
4. ✓ Near-ATM strikes highlighting (±3 strikes from ATM)
5. ✓ ITM/OTM color coding (green for ITM calls, red for ITM puts)
6. ✓ Liquidity warnings (wide spreads, low volume, low OI)
7. ✓ Manual "FETCH CHAIN" button (NO auto-refresh)
8. ✓ Loading states and error handling
9. ✓ Legend explaining color codes and warnings
10. ✓ NIFTY and BANKNIFTY support

Liquidity Warning Thresholds:
- Low Volume: <100 contracts
- Low OI: <500 contracts
- Wide Spread: Bid-Ask spread >5% of LTP

ITM/OTM Logic:
- Call ITM: Strike < Spot Price (green, bold)
- Put ITM: Strike > Spot Price (red, bold)
- OTM: Muted color

ATM Logic:
- ATM strike is the strike price closest to the spot price
- Highlighted with bold text and yellow "ATM" badge
- Row background is yellow
- Near-ATM (±3 strikes) have light gray background
*/

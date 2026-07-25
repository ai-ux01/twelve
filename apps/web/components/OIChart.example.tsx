/**
 * OIChart Component Usage Example
 *
 * This example demonstrates how to use the OIChart component
 * to visualize Open Interest comparison for options chains.
 *
 * Task: 70.3
 */

'use client';

import React from 'react';
import { OIChart } from './OIChart';
import type { OptionsChainResponse } from '@/lib/api-client';

// ============================================================================
// Example Data
// ============================================================================

const exampleOptionsChain: OptionsChainResponse = {
  underlying: 'NIFTY',
  expiryDate: '2024-12-26',
  spotPrice: 21500,
  strikes: [
    {
      strikePrice: 21100,
      call: { ltp: 450, volume: 800, oi: 25000, iv: 20 },
      put: { ltp: 20, volume: 200, oi: 15000, iv: 18 },
    },
    {
      strikePrice: 21200,
      call: { ltp: 380, volume: 1000, oi: 35000, iv: 19 },
      put: { ltp: 35, volume: 400, oi: 25000, iv: 18 },
    },
    {
      strikePrice: 21300,
      call: { ltp: 310, volume: 1200, oi: 50000, iv: 18 },
      put: { ltp: 50, volume: 600, oi: 40000, iv: 17 },
    },
    {
      strikePrice: 21400,
      call: { ltp: 240, volume: 1500, oi: 70000, iv: 17 },
      put: { ltp: 80, volume: 1000, oi: 60000, iv: 17 },
    },
    {
      strikePrice: 21500, // ATM
      call: { ltp: 180, volume: 2000, oi: 100000, iv: 16 },
      put: { ltp: 180, volume: 2000, oi: 100000, iv: 16 },
    },
    {
      strikePrice: 21600,
      call: { ltp: 130, volume: 1500, oi: 70000, iv: 17 },
      put: { ltp: 280, volume: 1200, oi: 65000, iv: 17 },
    },
    {
      strikePrice: 21700,
      call: { ltp: 90, volume: 1000, oi: 45000, iv: 18 },
      put: { ltp: 380, volume: 800, oi: 50000, iv: 18 },
    },
    {
      strikePrice: 21800,
      call: { ltp: 60, volume: 600, oi: 30000, iv: 19 },
      put: { ltp: 480, volume: 600, oi: 35000, iv: 19 },
    },
    {
      strikePrice: 21900,
      call: { ltp: 40, volume: 400, oi: 20000, iv: 20 },
      put: { ltp: 590, volume: 500, oi: 25000, iv: 20 },
    },
  ],
};

// Support zones: strikes with high Put OI (indicating support levels)
const supportZones = [21300, 21400]; // High put writing at these strikes

// Resistance zones: strikes with high Call OI (indicating resistance levels)
const resistanceZones = [21600, 21700]; // High call writing at these strikes

// ============================================================================
// Example Component
// ============================================================================

export function OIChartExample() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">OIChart Component Examples</h1>
        <p className="text-gray-600">
          Visualize Open Interest comparison between Call and Put options across strikes.
        </p>
      </div>

      {/* Basic Usage */}
      <div>
        <h2 className="text-xl font-semibold mb-4">1. Basic Usage</h2>
        <OIChart optionsChain={exampleOptionsChain} />
      </div>

      {/* With Support/Resistance Zones */}
      <div>
        <h2 className="text-xl font-semibold mb-4">2. With Support/Resistance Zones</h2>
        <OIChart
          optionsChain={exampleOptionsChain}
          supportZones={supportZones}
          resistanceZones={resistanceZones}
        />
      </div>

      {/* Custom Height */}
      <div>
        <h2 className="text-xl font-semibold mb-4">3. Custom Height</h2>
        <OIChart optionsChain={exampleOptionsChain} height={300} />
      </div>

      {/* BANKNIFTY Example */}
      <div>
        <h2 className="text-xl font-semibold mb-4">4. BANKNIFTY Example</h2>
        <OIChart
          optionsChain={{
            underlying: 'BANKNIFTY',
            expiryDate: '2024-12-26',
            spotPrice: 45000,
            strikes: [
              {
                strikePrice: 44500,
                call: { ltp: 550, volume: 1000, oi: 40000, iv: 18 },
                put: { ltp: 50, volume: 500, oi: 25000, iv: 16 },
              },
              {
                strikePrice: 44750,
                call: { ltp: 350, volume: 1200, oi: 55000, iv: 17 },
                put: { ltp: 100, volume: 700, oi: 35000, iv: 16 },
              },
              {
                strikePrice: 45000, // ATM
                call: { ltp: 250, volume: 2000, oi: 80000, iv: 16 },
                put: { ltp: 250, volume: 2000, oi: 80000, iv: 16 },
              },
              {
                strikePrice: 45250,
                call: { ltp: 150, volume: 1200, oi: 55000, iv: 17 },
                put: { ltp: 400, volume: 1000, oi: 50000, iv: 17 },
              },
              {
                strikePrice: 45500,
                call: { ltp: 80, volume: 500, oi: 30000, iv: 18 },
                put: { ltp: 580, volume: 800, oi: 40000, iv: 18 },
              },
            ],
          }}
        />
      </div>

      {/* Features Documentation */}
      <div className="rounded-lg border bg-gray-50 p-6">
        <h2 className="text-xl font-semibold mb-4">Features</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Bar Chart:</strong> Displays Call OI (blue) and Put OI (red) side by side for
              each strike
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>ATM Marker:</strong> Highlights the At-The-Money strike with an orange
              vertical line
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Support/Resistance Zones:</strong> Optional zones shown as dashed horizontal
              lines
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Interactive Tooltip:</strong> Hover over strikes to see exact OI values
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Summary Statistics:</strong> Shows spot price, total Call OI, and total Put
              OI
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>
              <strong>Responsive:</strong> Automatically adjusts to container width
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default OIChartExample;

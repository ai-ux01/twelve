/**
 * Usage examples for OptionsRiskPanel component
 * 
 * This file demonstrates how to integrate the OptionsRiskPanel component
 * with actual risk data from the backend API.
 */

'use client';

import { useState, useEffect } from 'react';
import { OptionsRiskPanel, OptionsRiskMetrics } from './options-risk-panel';
import { Button } from '@/components/ui/button';

/**
 * Example 1: Basic usage with mock data
 */
export function BasicExample() {
  const mockMetrics: OptionsRiskMetrics = {
    totalOptionsExposure: 50000,
    totalOptionsExposurePercent: 10,
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 3,
    maxOpenPositions: 10,
    liquidityWarnings: [],
    riskViolations: [],
    recommendations: [],
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Basic Example - Healthy Portfolio</h2>
      <OptionsRiskPanel 
        metrics={mockMetrics} 
        portfolioValue={500000}
      />
    </div>
  );
}

/**
 * Example 2: Portfolio with warnings
 */
export function WarningExample() {
  const metricsWithWarnings: OptionsRiskMetrics = {
    totalOptionsExposure: 80000,
    totalOptionsExposurePercent: 16, // 80% of max
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 5,
    maxOpenPositions: 10,
    liquidityWarnings: [
      {
        symbol: 'NIFTY',
        strikePrice: 21500,
        optionType: 'CALL',
        reason: 'Low Volume - only 50 contracts traded',
        severity: 'WARNING',
      },
    ],
    riskViolations: [
      {
        rule: 'APPROACHING_EXPOSURE_LIMIT',
        message: 'Options exposure at 80% of maximum allowed',
        severity: 'WARNING',
      },
    ],
    recommendations: [
      'Consider reducing options exposure to maintain safety margin',
      'Monitor liquidity on NIFTY 21500 CALL position',
    ],
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Warning Example - Approaching Limits</h2>
      <OptionsRiskPanel 
        metrics={metricsWithWarnings} 
        portfolioValue={500000}
      />
    </div>
  );
}

/**
 * Example 3: Portfolio with risk violations
 */
export function ErrorExample() {
  const metricsWithErrors: OptionsRiskMetrics = {
    totalOptionsExposure: 120000,
    totalOptionsExposurePercent: 24,
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 8,
    maxOpenPositions: 10,
    liquidityWarnings: [
      {
        symbol: 'BANKNIFTY',
        strikePrice: 45000,
        optionType: 'PUT',
        reason: 'Wide Bid-Ask Spread - 8% of LTP',
        severity: 'CRITICAL',
      },
    ],
    riskViolations: [
      {
        rule: 'MAX_OPTIONS_EXPOSURE',
        message: 'Total options exposure 24% exceeds max 20%',
        severity: 'ERROR',
        currentValue: 24,
        limit: 20,
      },
    ],
    recommendations: [
      'URGENT: Reduce options exposure immediately',
      'Close or reduce BANKNIFTY 45000 PUT position due to liquidity concerns',
    ],
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Error Example - Limits Breached</h2>
      <OptionsRiskPanel 
        metrics={metricsWithErrors} 
        portfolioValue={500000}
      />
    </div>
  );
}

/**
 * Example 4: Empty state (no positions)
 */
export function EmptyStateExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Empty State Example - No Positions</h2>
      <OptionsRiskPanel 
        metrics={null} 
        portfolioValue={500000}
      />
    </div>
  );
}

/**
 * Example 5: Loading state
 */
export function LoadingExample() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Loading State Example</h2>
      <OptionsRiskPanel 
        metrics={null} 
        isLoading={true}
      />
    </div>
  );
}

/**
 * Example 6: Integration with API (placeholder for when backend is ready)
 * 
 * This example shows how the component would be used with real API data.
 * Note: The /api/risk/options endpoint needs to be implemented in the backend.
 */
export function IntegratedExample() {
  const [metrics, setMetrics] = useState<OptionsRiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRiskMetrics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call when backend endpoint is ready
      // const response = await apiClient.getOptionsRiskMetrics(userId);
      // setMetrics(response);

      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock response
      const mockResponse: OptionsRiskMetrics = {
        totalOptionsExposure: 75000,
        totalOptionsExposurePercent: 15,
        maxOptionsExposurePercent: 20,
        optionsPositionCount: 4,
        maxOpenPositions: 10,
        liquidityWarnings: [],
        riskViolations: [],
        recommendations: [
          'Your options portfolio is well-balanced',
        ],
      };
      
      setMetrics(mockResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch risk metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskMetrics();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Integrated Example - Live Data</h2>
        <Button onClick={fetchRiskMetrics} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 rounded-lg">
          <p className="text-sm font-medium">Error: {error}</p>
        </div>
      )}

      <OptionsRiskPanel 
        metrics={metrics} 
        portfolioValue={500000}
        isLoading={isLoading}
        onRefresh={fetchRiskMetrics}
      />
    </div>
  );
}

/**
 * Example 7: All examples on one page
 */
export default function AllExamples() {
  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold mb-8">OptionsRiskPanel Examples</h1>
      
      <BasicExample />
      <WarningExample />
      <ErrorExample />
      <EmptyStateExample />
      <LoadingExample />
      <IntegratedExample />
    </div>
  );
}

/**
 * OptionsRiskPanel Component
 * 
 * Displays options risk metrics summary including:
 * - Total options exposure as percentage of portfolio
 * - Number of options positions
 * - Liquidity warnings for illiquid contracts
 * - Risk violations (red) when limits are breached
 * - Warnings (yellow) when approaching limits (80% of max)
 * - Risk recommendations for user action
 * 
 * Requirements covered: 8.5, 13.2
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle, TrendingUp, Shield } from 'lucide-react';

export interface OptionsRiskMetrics {
  totalOptionsExposure: number; // Absolute value in currency
  totalOptionsExposurePercent: number; // Percentage of portfolio (0-100)
  maxOptionsExposurePercent: number; // Maximum allowed (default 20%)
  optionsPositionCount: number; // Number of open options positions
  maxOpenPositions?: number; // Maximum allowed positions
  liquidityWarnings: LiquidityWarning[];
  riskViolations: RiskViolation[];
  recommendations: string[];
}

export interface LiquidityWarning {
  symbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  reason: string; // e.g., "Wide Bid-Ask Spread", "Low Volume", "Low OI"
  severity: 'WARNING' | 'CRITICAL';
}

export interface RiskViolation {
  rule: string; // e.g., "MAX_OPTIONS_EXPOSURE", "ILLIQUID_POSITION"
  message: string;
  severity: 'ERROR' | 'WARNING';
  currentValue?: number;
  limit?: number;
}

export interface OptionsRiskPanelProps {
  metrics: OptionsRiskMetrics | null;
  portfolioValue?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * OptionsRiskPanel - Summary display of options risk metrics
 * 
 * Features:
 * - Shows total options exposure as percentage
 * - Displays position count
 * - Highlights liquidity warnings
 * - Shows violations in red when limits breached
 * - Shows warnings in yellow when approaching limits (80%)
 * - Provides actionable recommendations
 */
export function OptionsRiskPanel({
  metrics,
  portfolioValue,
  isLoading = false,
  onRefresh,
}: OptionsRiskPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Options Risk Summary
          </CardTitle>
          <CardDescription>Loading risk metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">
              Calculating risk metrics...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Options Risk Summary
          </CardTitle>
          <CardDescription>No options positions found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>You currently have no options positions.</p>
            <p className="text-sm mt-2">Risk metrics will appear when you open options positions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine overall risk status
  const hasErrors = metrics.riskViolations.some((v) => v.severity === 'ERROR');
  const hasWarnings = metrics.riskViolations.some((v) => v.severity === 'WARNING') || 
                      metrics.liquidityWarnings.length > 0;
  const isApproachingLimit = metrics.totalOptionsExposurePercent >= (metrics.maxOptionsExposurePercent * 0.8);

  // Get status color and icon
  const getStatusInfo = () => {
    if (hasErrors) {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950',
        icon: <AlertCircle className="h-5 w-5" />,
        label: 'Risk Violations',
      };
    }
    if (hasWarnings || isApproachingLimit) {
      return {
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950',
        icon: <AlertTriangle className="h-5 w-5" />,
        label: 'Warnings',
      };
    }
    return {
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
      icon: <CheckCircle className="h-5 w-5" />,
      label: 'Healthy',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Options Risk Summary</CardTitle>
          </div>
          <Badge variant={hasErrors ? 'destructive' : hasWarnings ? 'secondary' : 'default'} 
                 className={hasErrors ? '' : hasWarnings ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}>
            <div className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.label}
            </div>
          </Badge>
        </div>
        <CardDescription>
          {portfolioValue && (
            <>Portfolio Value: ₹{portfolioValue.toLocaleString()}</>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Exposure */}
          <div className={`p-4 rounded-lg ${isApproachingLimit || hasErrors ? statusInfo.bgColor : 'bg-slate-50 dark:bg-slate-900'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Options Exposure</span>
              <TrendingUp className={`h-4 w-4 ${isApproachingLimit || hasErrors ? statusInfo.color : 'text-muted-foreground'}`} />
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${isApproachingLimit || hasErrors ? statusInfo.color : ''}`}>
                {metrics.totalOptionsExposurePercent.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                ₹{metrics.totalOptionsExposure.toLocaleString()} / {metrics.maxOptionsExposurePercent}% max
              </div>
              {/* Progress bar */}
              <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    hasErrors ? 'bg-red-600' : isApproachingLimit ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((metrics.totalOptionsExposurePercent / metrics.maxOptionsExposurePercent) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Position Count */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Open Positions</span>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{metrics.optionsPositionCount}</div>
              <div className="text-xs text-muted-foreground">
                {metrics.maxOpenPositions ? `${metrics.maxOpenPositions} max` : 'Options contracts'}
              </div>
            </div>
          </div>

          {/* Liquidity Warnings Count */}
          <div className={`p-4 rounded-lg ${metrics.liquidityWarnings.length > 0 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-slate-50 dark:bg-slate-900'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Liquidity Issues</span>
              <AlertTriangle className={`h-4 w-4 ${metrics.liquidityWarnings.length > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`} />
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${metrics.liquidityWarnings.length > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                {metrics.liquidityWarnings.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.liquidityWarnings.length === 0 ? 'All positions liquid' : 'Contracts with warnings'}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Violations Section */}
        {metrics.riskViolations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Risk Violations
            </h4>
            <div className="space-y-2">
              {metrics.riskViolations.map((violation, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    violation.severity === 'ERROR'
                      ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {violation.severity === 'ERROR' ? (
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${
                          violation.severity === 'ERROR' ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
                        }`}>
                          {violation.rule.replace(/_/g, ' ')}
                        </span>
                        <Badge variant={violation.severity === 'ERROR' ? 'destructive' : 'secondary'}
                               className={violation.severity === 'ERROR' ? '' : 'bg-yellow-500 hover:bg-yellow-600'}>
                          {violation.severity}
                        </Badge>
                      </div>
                      <p className={`text-sm ${
                        violation.severity === 'ERROR' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {violation.message}
                      </p>
                      {violation.currentValue !== undefined && violation.limit !== undefined && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Current: {violation.currentValue.toFixed(2)} | Limit: {violation.limit.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liquidity Warnings Section */}
        {metrics.liquidityWarnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Liquidity Warnings
            </h4>
            <div className="space-y-2">
              {metrics.liquidityWarnings.map((warning, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    warning.severity === 'CRITICAL'
                      ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                      warning.severity === 'CRITICAL' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${
                          warning.severity === 'CRITICAL' ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
                        }`}>
                          {warning.symbol} {warning.strikePrice} {warning.optionType}
                        </span>
                        <Badge variant={warning.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                               className={warning.severity === 'CRITICAL' ? '' : 'bg-yellow-500 hover:bg-yellow-600'}>
                          {warning.severity}
                        </Badge>
                      </div>
                      <p className={`text-sm ${
                        warning.severity === 'CRITICAL' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {warning.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Section */}
        {metrics.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Risk Recommendations
            </h4>
            <div className="space-y-2">
              {metrics.recommendations.map((recommendation, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">{recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Issues Message */}
        {!hasErrors && !hasWarnings && metrics.liquidityWarnings.length === 0 && metrics.recommendations.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">All Risk Checks Passed</span>
            </div>
            <p className="text-sm">Your options positions are within safe risk limits.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * Options Scalper Page
 *
 * Main page component for the AI-powered Options Scalping Agent.
 * Uses the useOptionsScalperPolling hook for auto-refresh with:
 * - 60-second polling interval during market hours
 * - Circuit breaker after 3 consecutive failures
 * - Page visibility handling (pause on hidden, resume on visible)
 * - Market hours awareness (IST 9:15–15:30 Mon–Fri)
 *
 * Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.3, 2.4
 */

import { useState, useCallback } from 'react';
import { Settings, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LiveStatusPanel,
  SignalCard,
  ProbabilityGauge,
} from '@/components/scalper';
import { TradeDetailsCard } from '@/components/scalper/TradeDetailsCard';
import { MarketAnalysisPanel } from '@/components/scalper/MarketAnalysisPanel';
import { RationalePanel } from '@/components/scalper/RationalePanel';
import { ActionButtons } from '@/components/scalper/ActionButtons';
import { SettingsPanel } from '@/components/scalper/SettingsPanel';
import { AnalysisHistoryView } from '@/components/scalper/AnalysisHistoryView';

import { useOptionsScalperPolling } from '@/hooks/use-options-scalper-polling';

import type { LiveStatus } from '@/components/scalper';
import type { SignalData } from '@/components/scalper/SignalCard';
import type { TradeDetails } from '@/components/scalper/TradeDetailsCard';
import type { MarketAnalysisData } from '@/components/scalper/MarketAnalysisPanel';
import type { PaperTradeParams } from '@/components/scalper/ActionButtons';
import type { ScalperConfig } from '@/components/scalper/SettingsPanel';

const API_BASE = 'http://localhost:8000/api';

type ViewMode = 'dashboard' | 'history';

export default function OptionsScalperPage() {
  // --- Polling hook (primary data source) ---
  const {
    data,
    status: hookStatus,
    secondsUntilRefresh,
    isRefreshing,
    errorMessage,
    consecutiveFailures,
    refreshNow,
    togglePause,
  } = useOptionsScalperPolling({
    underlying: 'NIFTY',
    refreshIntervalSeconds: 60,
    apiUrl: 'http://localhost:8000/api/options-scalper/analyze',
    requestTimeoutMs: 10000,
  });

  // --- Local UI state ---
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<ScalperConfig | null>(null);
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [showRationale, setShowRationale] = useState(true);

  // --- Map hook status to LiveStatusPanel's expected type ---
  const mapStatus = (s: typeof hookStatus): LiveStatus => {
    if (s === 'market-closed') return 'paused';
    if (s === 'initializing') return 'initializing';
    return s; // 'active' | 'paused' | 'error'
  };

  // --- Derive component props from hook data ---
  const signalData: SignalData | null = data
    ? {
        signalType: data.signal_type,
        strikePrice: data.strike_price,
        expiryDate: data.expiry_date,
        entryPrice: data.entry_price,
        targetPrice: data.target_price,
        stopLoss: data.stop_loss,
        probability: data.probability,
        riskRewardRatio: data.risk_reward_ratio,
        trend: data.trend,
        oiInterpretation: data.oi_interpretation,
        pcr: data.pcr,
        trendlineStatus: data.trendline_status,
        supportLevel: data.support_level,
        resistanceLevel: data.resistance_level,
        holdReason: data.hold_reason,
      }
    : null;

  const tradeDetails: TradeDetails | null = data
    ? {
        signalType: data.signal_type,
        underlying: data.underlying as 'NIFTY' | 'BANKNIFTY',
        optionType:
          data.signal_type === 'BUY CE'
            ? 'CE'
            : data.signal_type === 'BUY PE'
              ? 'PE'
              : null,
        strikePrice: data.strike_price,
        expiryDate: data.expiry_date,
        entryPrice: data.entry_price,
        targetPrice: data.target_price,
        stopLoss: data.stop_loss,
        riskRewardRatio: data.risk_reward_ratio,
        lotSize: data.lot_size,
      }
    : null;

  const marketData: MarketAnalysisData | null = data
    ? {
        spotPrice: data.spot_price,
        trend: data.trend,
        rsi: data.rsi,
        macd: data.macd,
        macdSignal: data.macd_signal,
        vwap: data.vwap,
        ema5: data.ema_5,
        ema15: data.ema_15,
        supportLevel: data.support_level,
        resistanceLevel: data.resistance_level,
        trendlineStatus: data.trendline_status,
        callOI: data.call_oi,
        putOI: data.put_oi,
        callOIChange: data.call_oi_change,
        putOIChange: data.put_oi_change,
        callOIChangePct: null,
        putOIChangePct: null,
        pcr: data.pcr,
        atr: data.atr,
      }
    : null;

  const paperTradeParams: PaperTradeParams | null = data
    ? {
        signalType: data.signal_type,
        underlying: data.underlying as 'NIFTY' | 'BANKNIFTY',
        optionType:
          data.signal_type === 'BUY CE'
            ? 'CE'
            : data.signal_type === 'BUY PE'
              ? 'PE'
              : null,
        strikePrice: data.strike_price,
        expiryDate: data.expiry_date,
        entryPrice: data.entry_price,
        targetPrice: data.target_price,
        stopLoss: data.stop_loss,
      }
    : null;

  const lastUpdated = data ? new Date(data.timestamp) : null;

  // --- Handlers ---
  const handleRefreshNow = useCallback(() => {
    refreshNow();
  }, [refreshNow]);

  const handleTogglePause = useCallback(
    (paused: boolean) => {
      togglePause(paused);
    },
    [togglePause]
  );

  const handleSettingsSave = useCallback(
    async (newConfig: ScalperConfig) => {
      try {
        await fetch(`${API_BASE}/options-scalper/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig),
        });
        setConfig(newConfig);
        setSettingsOpen(false);
      } catch {
        // Keep settings panel open on error
      }
    },
    []
  );

  // --- History view ---
  if (viewMode === 'history') {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <AnalysisHistoryView onBackToDashboard={() => setViewMode('dashboard')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Fixed Header - Live Status */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <LiveStatusPanel
              status={mapStatus(hookStatus)}
              lastUpdated={lastUpdated}
              secondsUntilRefresh={secondsUntilRefresh}
              isRefreshing={isRefreshing}
              errorMessage={errorMessage}
              onRefreshNow={handleRefreshNow}
              onTogglePause={handleTogglePause}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* History link */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('history')}
              className="min-h-[44px] min-w-[44px] flex items-center gap-1.5"
              aria-label="View analysis history"
            >
              <History className="h-4 w-4" />
              <span className="hidden md:inline">History</span>
            </Button>

            {/* Settings button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[44px] min-w-[44px]"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline ml-1.5">SETTINGS</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 lg:p-8">
        {/* Waiting state when no data */}
        {!data && (
          <div className="flex items-center justify-center py-16">
            <p className="text-lg text-muted-foreground">Waiting for analysis...</p>
          </div>
        )}

        {/* Signal data display */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Signal Card */}
            <div className="md:col-span-1 lg:col-span-1 overflow-hidden">
              <SignalCard signal={signalData} />
            </div>

            {/* Probability Gauge */}
            <div className="md:col-span-1 lg:col-span-1 overflow-hidden">
              <ProbabilityGauge probability={data.probability} />
            </div>

            {/* Trade Details Card - hidden when HOLD */}
            <div className="md:col-span-1 lg:col-span-1 overflow-hidden">
              {data.signal_type === 'HOLD' ? (
                <div className="rounded-lg border bg-card p-6">
                  <h3 className="text-lg font-semibold mb-2">Trade Details</h3>
                  <p className="text-sm text-muted-foreground break-words">
                    {data.hold_reason || 'No active trade signal. Waiting for favorable conditions.'}
                  </p>
                </div>
              ) : (
                <TradeDetailsCard trade={tradeDetails} />
              )}
            </div>

            {/* Market Analysis Panel */}
            <div className="md:col-span-2 lg:col-span-2 overflow-hidden">
              {/* Mobile toggle */}
              <div className="md:hidden mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMarketAnalysis(!showMarketAnalysis)}
                  className="w-full min-h-[44px] min-w-[44px]"
                  aria-expanded={showMarketAnalysis}
                  aria-controls="market-analysis-content"
                >
                  {showMarketAnalysis ? 'Hide Market Analysis' : 'Show Market Analysis'}
                </Button>
              </div>
              <div
                id="market-analysis-content"
                className={cn('md:block', showMarketAnalysis ? 'block' : 'hidden')}
              >
                <MarketAnalysisPanel data={marketData} />
              </div>
            </div>

            {/* Rationale Panel */}
            <div className="md:col-span-2 lg:col-span-1 overflow-hidden">
              {/* Mobile accordion toggle */}
              <div className="md:hidden mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRationale(!showRationale)}
                  className="w-full min-h-[44px] min-w-[44px] justify-between"
                  aria-expanded={showRationale}
                  aria-controls="rationale-content"
                >
                  <span>Analysis Rationale</span>
                  <span className="text-xs">{showRationale ? '▲' : '▼'}</span>
                </Button>
              </div>
              <div
                id="rationale-content"
                className={cn('md:block', showRationale ? 'block' : 'hidden md:block')}
              >
                <RationalePanel rationale={data.rationale} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-2 lg:col-span-3 overflow-hidden">
              <ActionButtons tradeParams={paperTradeParams} />
            </div>
          </div>
        )}
      </main>

      {/* Settings Panel (slide-over) */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
        currentConfig={config}
      />
    </div>
  );
}

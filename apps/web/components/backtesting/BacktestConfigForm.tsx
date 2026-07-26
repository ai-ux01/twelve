/**
 * BacktestConfigForm Component
 *
 * Configuration form for backtesting strategy parameters.
 * Includes: symbol, OHLCV source, capital, indicators, entry rules,
 * stop loss, target, trailing stop, holding period, slippage, brokerage,
 * test mode, split ratio, walk-forward config, position size.
 *
 * Submits JSON matching BacktestRunRequest from the backend.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Types matching backend models
interface IndicatorConfig {
  name: string;
  indicator_type: string;
  params: Record<string, number>;
}

interface RuleCondition {
  indicator: string;
  comparator: string;
  value: number | string;
}

interface RuleConfig {
  conditions: RuleCondition[];
}

interface ModelValue {
  model: 'fixed' | 'percentage';
  value: number;
}

interface WalkForwardConfig {
  in_sample_bars: number;
  out_of_sample_bars: number;
  step_bars: number;
}

export interface BacktestFormData {
  symbol: string;
  ohlcv_source: { file_path: string | null; api_url: string | null };
  initial_capital: number;
  indicators: IndicatorConfig[];
  entry_rules: RuleConfig[];
  stop_loss: ModelValue | null;
  target: ModelValue | null;
  trailing_stop: ModelValue | null;
  max_holding_period: number | null;
  slippage: ModelValue;
  brokerage: ModelValue;
  test_mode: string;
  split_ratio: number;
  walk_forward_config: WalkForwardConfig | null;
  position_size: number;
}

export interface BacktestConfigFormProps {
  onSubmit: (data: BacktestFormData) => void;
  isLoading: boolean;
}

const INDICATOR_TYPES = ['RSI', 'EMA', 'MACD', 'ATR', 'ADX', 'VWAP'] as const;
const COMPARATORS = ['GT', 'LT', 'GTE', 'LTE', 'CROSSES_ABOVE', 'CROSSES_BELOW'] as const;
const TEST_MODES = ['in_sample', 'out_of_sample', 'walk_forward'] as const;

const DEFAULT_INDICATOR_PARAMS: Record<string, Record<string, number>> = {
  RSI: { period: 14 },
  EMA: { period: 20 },
  MACD: { fast_period: 12, slow_period: 26, signal_period: 9 },
  ATR: { period: 14 },
  ADX: { period: 14 },
  VWAP: {},
};

export function BacktestConfigForm({ onSubmit, isLoading }: BacktestConfigFormProps) {
  const [symbol, setSymbol] = useState('');
  const [ohlcvFilePath, setOhlcvFilePath] = useState('');
  const [ohlcvApiUrl, setOhlcvApiUrl] = useState('');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const [entryRules, setEntryRules] = useState<RuleConfig[]>([]);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState<ModelValue>({ model: 'percentage', value: 2 });
  const [targetEnabled, setTargetEnabled] = useState(false);
  const [target, setTarget] = useState<ModelValue>({ model: 'percentage', value: 4 });
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(false);
  const [trailingStop, setTrailingStop] = useState<ModelValue>({ model: 'percentage', value: 1 });
  const [maxHoldingPeriod, setMaxHoldingPeriod] = useState<number | ''>('');
  const [slippage, setSlippage] = useState<ModelValue>({ model: 'fixed', value: 0 });
  const [brokerage, setBrokerage] = useState<ModelValue>({ model: 'fixed', value: 0 });
  const [testMode, setTestMode] = useState<string>('in_sample');
  const [splitRatio, setSplitRatio] = useState(0.7);
  const [walkForwardConfig, setWalkForwardConfig] = useState<WalkForwardConfig>({
    in_sample_bars: 252,
    out_of_sample_bars: 63,
    step_bars: 63,
  });
  const [positionSize, setPositionSize] = useState(1.0);

  // Indicator add form state
  const [newIndicatorType, setNewIndicatorType] = useState<string>('RSI');
  const [newIndicatorParams, setNewIndicatorParams] = useState<Record<string, number>>(
    DEFAULT_INDICATOR_PARAMS['RSI']
  );

  // Rule add form state
  const [newRuleIndicator, setNewRuleIndicator] = useState('');
  const [newRuleComparator, setNewRuleComparator] = useState<string>('GT');
  const [newRuleValue, setNewRuleValue] = useState<string>('');

  const addIndicator = () => {
    const paramStr = Object.entries(newIndicatorParams)
      .map(([, v]) => v)
      .join('_');
    const name = `${newIndicatorType}_${paramStr}`;
    setIndicators([
      ...indicators,
      { name, indicator_type: newIndicatorType, params: { ...newIndicatorParams } },
    ]);
  };

  const removeIndicator = (index: number) => {
    setIndicators(indicators.filter((_, i) => i !== index));
  };

  const addEntryRule = () => {
    if (!newRuleIndicator || !newRuleValue) return;
    const value = isNaN(Number(newRuleValue)) ? newRuleValue : Number(newRuleValue);
    const condition: RuleCondition = {
      indicator: newRuleIndicator,
      comparator: newRuleComparator,
      value,
    };
    setEntryRules([...entryRules, { conditions: [condition] }]);
    setNewRuleValue('');
  };

  const removeEntryRule = (index: number) => {
    setEntryRules(entryRules.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: BacktestFormData = {
      symbol,
      ohlcv_source: {
        file_path: ohlcvFilePath || null,
        api_url: ohlcvApiUrl || null,
      },
      initial_capital: initialCapital,
      indicators,
      entry_rules: entryRules,
      stop_loss: stopLossEnabled ? stopLoss : null,
      target: targetEnabled ? target : null,
      trailing_stop: trailingStopEnabled ? trailingStop : null,
      max_holding_period: maxHoldingPeriod !== '' ? Number(maxHoldingPeriod) : null,
      slippage,
      brokerage,
      test_mode: testMode,
      split_ratio: splitRatio,
      walk_forward_config: testMode === 'walk_forward' ? walkForwardConfig : null,
      position_size: positionSize,
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)] pr-2">
      {/* Symbol & Source */}
      <Card>
        <CardHeader>
          <CardTitle>Symbol &amp; Data Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Symbol</label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. RELIANCE, NIFTY50"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">OHLCV File Path</label>
            <Input
              value={ohlcvFilePath}
              onChange={(e) => setOhlcvFilePath(e.target.value)}
              placeholder="/path/to/data.json"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">OHLCV API URL</label>
            <Input
              value={ohlcvApiUrl}
              onChange={(e) => setOhlcvApiUrl(e.target.value)}
              placeholder="http://api.example.com/ohlcv"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Initial Capital</label>
            <Input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              min={1}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Indicators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {indicators.map((ind, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{ind.name}</span>
              <span className="text-muted-foreground">({ind.indicator_type})</span>
              <button
                type="button"
                onClick={() => removeIndicator(i)}
                className="ml-auto text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2">
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={newIndicatorType}
                onChange={(e) => {
                  setNewIndicatorType(e.target.value);
                  setNewIndicatorParams(
                    DEFAULT_INDICATOR_PARAMS[e.target.value] || {}
                  );
                }}
              >
                {INDICATOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {Object.entries(newIndicatorParams).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-24">{key}</label>
                <Input
                  type="number"
                  className="w-20"
                  value={val}
                  onChange={(e) =>
                    setNewIndicatorParams({ ...newIndicatorParams, [key]: Number(e.target.value) })
                  }
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addIndicator}>
              + Add Indicator
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entry Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Entry Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entryRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {rule.conditions.map((c, j) => (
                <span key={j} className="font-mono text-xs bg-muted px-2 py-1 rounded">
                  {c.indicator} {c.comparator} {c.value}
                </span>
              ))}
              <button
                type="button"
                onClick={() => removeEntryRule(i)}
                className="ml-auto text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Input
                className="w-28"
                value={newRuleIndicator}
                onChange={(e) => setNewRuleIndicator(e.target.value)}
                placeholder="Indicator"
              />
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={newRuleComparator}
                onChange={(e) => setNewRuleComparator(e.target.value)}
              >
                {COMPARATORS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Input
                className="w-20"
                value={newRuleValue}
                onChange={(e) => setNewRuleValue(e.target.value)}
                placeholder="Value"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addEntryRule}>
              + Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exit Rules: Stop Loss, Target, Trailing Stop */}
      <Card>
        <CardHeader>
          <CardTitle>Exit Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stop Loss */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={stopLossEnabled}
                onChange={(e) => setStopLossEnabled(e.target.checked)}
                className="rounded"
              />
              Stop Loss
            </label>
            {stopLossEnabled && (
              <div className="flex gap-2 pl-6">
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={stopLoss.model}
                  onChange={(e) => setStopLoss({ ...stopLoss, model: e.target.value as 'fixed' | 'percentage' })}
                >
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
                <Input
                  type="number"
                  className="w-24"
                  value={stopLoss.value}
                  onChange={(e) => setStopLoss({ ...stopLoss, value: Number(e.target.value) })}
                  step="0.1"
                  min={0}
                />
              </div>
            )}
          </div>

          {/* Target */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={targetEnabled}
                onChange={(e) => setTargetEnabled(e.target.checked)}
                className="rounded"
              />
              Target
            </label>
            {targetEnabled && (
              <div className="flex gap-2 pl-6">
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={target.model}
                  onChange={(e) => setTarget({ ...target, model: e.target.value as 'fixed' | 'percentage' })}
                >
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
                <Input
                  type="number"
                  className="w-24"
                  value={target.value}
                  onChange={(e) => setTarget({ ...target, value: Number(e.target.value) })}
                  step="0.1"
                  min={0}
                />
              </div>
            )}
          </div>

          {/* Trailing Stop */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={trailingStopEnabled}
                onChange={(e) => setTrailingStopEnabled(e.target.checked)}
                className="rounded"
              />
              Trailing Stop
            </label>
            {trailingStopEnabled && (
              <div className="flex gap-2 pl-6">
                <select
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={trailingStop.model}
                  onChange={(e) => setTrailingStop({ ...trailingStop, model: e.target.value as 'fixed' | 'percentage' })}
                >
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
                <Input
                  type="number"
                  className="w-24"
                  value={trailingStop.value}
                  onChange={(e) => setTrailingStop({ ...trailingStop, value: Number(e.target.value) })}
                  step="0.1"
                  min={0}
                />
              </div>
            )}
          </div>

          {/* Max Holding Period */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Max Holding Period (bars)</label>
            <Input
              type="number"
              value={maxHoldingPeriod}
              onChange={(e) => setMaxHoldingPeriod(e.target.value ? Number(e.target.value) : '')}
              placeholder="Optional"
              min={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Costs */}
      <Card>
        <CardHeader>
          <CardTitle>Costs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Slippage</label>
            <div className="flex gap-2">
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={slippage.model}
                onChange={(e) => setSlippage({ ...slippage, model: e.target.value as 'fixed' | 'percentage' })}
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage</option>
              </select>
              <Input
                type="number"
                className="w-24"
                value={slippage.value}
                onChange={(e) => setSlippage({ ...slippage, value: Number(e.target.value) })}
                step="0.01"
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Brokerage</label>
            <div className="flex gap-2">
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={brokerage.model}
                onChange={(e) => setBrokerage({ ...brokerage, model: e.target.value as 'fixed' | 'percentage' })}
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage</option>
              </select>
              <Input
                type="number"
                className="w-24"
                value={brokerage.value}
                onChange={(e) => setBrokerage({ ...brokerage, value: Number(e.target.value) })}
                step="0.01"
                min={0}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Mode & Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Test Mode</label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              value={testMode}
              onChange={(e) => setTestMode(e.target.value)}
            >
              {TEST_MODES.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Split Ratio: {splitRatio.toFixed(2)}
            </label>
            <input
              type="range"
              className="w-full"
              min={0.1}
              max={0.99}
              step={0.01}
              value={splitRatio}
              onChange={(e) => setSplitRatio(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.10</span>
              <span>0.99</span>
            </div>
          </div>

          {testMode === 'walk_forward' && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Walk-Forward Config</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-32">In-sample bars</label>
                <Input
                  type="number"
                  className="w-24"
                  value={walkForwardConfig.in_sample_bars}
                  onChange={(e) =>
                    setWalkForwardConfig({ ...walkForwardConfig, in_sample_bars: Number(e.target.value) })
                  }
                  min={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-32">OOS bars</label>
                <Input
                  type="number"
                  className="w-24"
                  value={walkForwardConfig.out_of_sample_bars}
                  onChange={(e) =>
                    setWalkForwardConfig({ ...walkForwardConfig, out_of_sample_bars: Number(e.target.value) })
                  }
                  min={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-32">Step bars</label>
                <Input
                  type="number"
                  className="w-24"
                  value={walkForwardConfig.step_bars}
                  onChange={(e) =>
                    setWalkForwardConfig({ ...walkForwardConfig, step_bars: Number(e.target.value) })
                  }
                  min={1}
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Position Size: {positionSize.toFixed(2)}
            </label>
            <input
              type="range"
              className="w-full"
              min={0.01}
              max={1}
              step={0.01}
              value={positionSize}
              onChange={(e) => setPositionSize(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.01</span>
              <span>1.00</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button type="submit" className="w-full" size="lg" disabled={isLoading || !symbol}>
        {isLoading ? 'Running Backtest...' : 'Run Backtest'}
      </Button>
    </form>
  );
}

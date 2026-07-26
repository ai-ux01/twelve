/**
 * ManualTradeForm Component - Trade Analysis
 *
 * Form for manually entering a single trade with required fields
 * (symbol, entry date, entry price, exit date, exit price, quantity, direction)
 * and optional fields (strategy, setup, sector, stop loss).
 *
 * Requirements: 8.2, 8.3
 */

'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ManualTradeRequest, TradeDirection } from './types';

export interface ManualTradeFormProps {
  onSubmit: (trade: ManualTradeRequest) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onSuccess?: () => void;
}

interface FormState {
  symbol: string;
  entry_date: string;
  entry_price: string;
  exit_date: string;
  exit_price: string;
  quantity: string;
  direction: TradeDirection;
  strategy: string;
  setup: string;
  sector: string;
  stop_loss: string;
}

const INITIAL_FORM: FormState = {
  symbol: '',
  entry_date: '',
  entry_price: '',
  exit_date: '',
  exit_price: '',
  quantity: '',
  direction: 'LONG',
  strategy: '',
  setup: '',
  sector: '',
  stop_loss: '',
};

export function ManualTradeForm({ onSubmit, isLoading, error, onSuccess }: ManualTradeFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.symbol.trim()) errors.push('Symbol is required');
    if (!form.entry_date) errors.push('Entry date is required');
    if (!form.entry_price || Number(form.entry_price) <= 0)
      errors.push('Entry price must be positive');
    if (!form.exit_date) errors.push('Exit date is required');
    if (!form.exit_price || Number(form.exit_price) <= 0)
      errors.push('Exit price must be positive');
    if (!form.quantity || Number(form.quantity) <= 0)
      errors.push('Quantity must be positive');
    if (form.stop_loss && Number(form.stop_loss) <= 0)
      errors.push('Stop loss must be positive if provided');
    return errors;
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const errors = validate();
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      const trade: ManualTradeRequest = {
        symbol: form.symbol.trim().toUpperCase(),
        entry_date: new Date(form.entry_date).toISOString(),
        entry_price: Number(form.entry_price),
        exit_date: new Date(form.exit_date).toISOString(),
        exit_price: Number(form.exit_price),
        quantity: Number(form.quantity),
        direction: form.direction,
        ...(form.strategy && { strategy: form.strategy.trim() }),
        ...(form.setup && { setup: form.setup.trim() }),
        ...(form.sector && { sector: form.sector.trim() }),
        ...(form.stop_loss && { stop_loss: Number(form.stop_loss) }),
      };

      await onSubmit(trade);
      setForm(INITIAL_FORM);
      onSuccess?.();
    },
    [form, onSubmit, onSuccess]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Trade Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-symbol">
                Symbol *
              </label>
              <Input
                id="ta-symbol"
                value={form.symbol}
                onChange={(e) => updateField('symbol', e.target.value)}
                placeholder="e.g. RELIANCE"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-direction">
                Direction *
              </label>
              <select
                id="ta-direction"
                value={form.direction}
                onChange={(e) => updateField('direction', e.target.value as TradeDirection)}
                disabled={isLoading}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-entry-date">
                Entry Date *
              </label>
              <Input
                id="ta-entry-date"
                type="datetime-local"
                value={form.entry_date}
                onChange={(e) => updateField('entry_date', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-entry-price">
                Entry Price *
              </label>
              <Input
                id="ta-entry-price"
                type="number"
                step="0.01"
                min="0"
                value={form.entry_price}
                onChange={(e) => updateField('entry_price', e.target.value)}
                placeholder="₹"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-exit-date">
                Exit Date *
              </label>
              <Input
                id="ta-exit-date"
                type="datetime-local"
                value={form.exit_date}
                onChange={(e) => updateField('exit_date', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-exit-price">
                Exit Price *
              </label>
              <Input
                id="ta-exit-price"
                type="number"
                step="0.01"
                min="0"
                value={form.exit_price}
                onChange={(e) => updateField('exit_price', e.target.value)}
                placeholder="₹"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-quantity">
                Quantity *
              </label>
              <Input
                id="ta-quantity"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => updateField('quantity', e.target.value)}
                placeholder="e.g. 10"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-stop-loss">
                Stop Loss (optional)
              </label>
              <Input
                id="ta-stop-loss"
                type="number"
                step="0.01"
                min="0"
                value={form.stop_loss}
                onChange={(e) => updateField('stop_loss', e.target.value)}
                placeholder="₹"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-strategy">
                Strategy
              </label>
              <Input
                id="ta-strategy"
                value={form.strategy}
                onChange={(e) => updateField('strategy', e.target.value)}
                placeholder="e.g. Breakout"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-setup">
                Setup
              </label>
              <Input
                id="ta-setup"
                value={form.setup}
                onChange={(e) => updateField('setup', e.target.value)}
                placeholder="e.g. Flag"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ta-sector">
                Sector
              </label>
              <Input
                id="ta-sector"
                value={form.sector}
                onChange={(e) => updateField('sector', e.target.value)}
                placeholder="e.g. IT"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3">
              <ul className="text-xs text-destructive space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* API Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Saving...' : 'Add Trade'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

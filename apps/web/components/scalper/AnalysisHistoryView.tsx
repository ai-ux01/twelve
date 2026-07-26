'use client';

/**
 * AnalysisHistoryView Component
 *
 * Displays past analysis signals with filtering and pagination:
 * - Link from dashboard to analysis history
 * - Past signals in reverse chronological order
 * - Filter controls: underlying dropdown, signal_type dropdown, date range pickers
 * - Fetches from GET /api/options-scalper/history
 * - Pagination controls (50 per page)
 * - "No results" message for empty filters
 *
 * Requirements covered: 20.4-20.6, 20.12
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowLeft,
  Calendar,
  Search,
} from 'lucide-react';

export interface HistoryRecord {
  id: string;
  timestamp: string;
  underlying: 'NIFTY' | 'BANKNIFTY';
  signalType: 'BUY CE' | 'BUY PE' | 'HOLD';
  probability: number;
  riskRewardRatio: number;
  strikePrice: number | null;
  expiryDate: string | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  holdReason: string | null;
}

export interface HistoryFilters {
  underlying: string;
  signalType: string;
  dateFrom: string;
  dateTo: string;
}

export interface AnalysisHistoryViewProps {
  /** Callback to navigate back to dashboard */
  onBackToDashboard: () => void;
}

const PAGE_SIZE = 50;

export function AnalysisHistoryView({ onBackToDashboard }: AnalysisHistoryViewProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<HistoryFilters>({
    underlying: '',
    signalType: '',
    dateFrom: '',
    dateTo: '',
  });

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.underlying) params.set('underlying', filters.underlying);
      if (filters.signalType) params.set('signal_type', filters.signalType);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));

      const response = await fetch(
        `http://localhost:4000/api/options-scalper/history?${params.toString()}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }

      const data = await response.json();
      setRecords(data.records || data || []);
      setTotalPages(data.totalPages || Math.ceil((data.total || 0) / PAGE_SIZE) || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = (key: keyof HistoryFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  };

  const getSignalBadgeColor = (signalType: string) => {
    if (signalType === 'BUY CE') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (signalType === 'BUY PE') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBackToDashboard}
        className="flex items-center gap-2 min-h-[44px]"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Analysis History</h2>
            <Filter className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Underlying Filter */}
            <div className="space-y-1">
              <label htmlFor="filter-underlying" className="text-xs text-muted-foreground">
                Underlying
              </label>
              <select
                id="filter-underlying"
                value={filters.underlying}
                onChange={(e) => handleFilterChange('underlying', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All</option>
                <option value="NIFTY">NIFTY</option>
                <option value="BANKNIFTY">BANKNIFTY</option>
              </select>
            </div>

            {/* Signal Type Filter */}
            <div className="space-y-1">
              <label htmlFor="filter-signal-type" className="text-xs text-muted-foreground">
                Signal Type
              </label>
              <select
                id="filter-signal-type"
                value={filters.signalType}
                onChange={(e) => handleFilterChange('signalType', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All</option>
                <option value="BUY CE">BUY CE</option>
                <option value="BUY PE">BUY PE</option>
                <option value="HOLD">HOLD</option>
              </select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-1">
              <label htmlFor="filter-date-from" className="text-xs text-muted-foreground">
                From Date
              </label>
              <Input
                id="filter-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Date To Filter */}
            <div className="space-y-1">
              <label htmlFor="filter-date-to" className="text-xs text-muted-foreground">
                To Date
              </label>
              <Input
                id="filter-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-muted-foreground">Loading history...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-red-600">{error}</span>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                No results found for the selected filters.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-left font-medium">Underlying</th>
                    <th className="px-4 py-3 text-left font-medium">Signal</th>
                    <th className="px-4 py-3 text-left font-medium">Probability</th>
                    <th className="px-4 py-3 text-left font-medium">R:R</th>
                    <th className="px-4 py-3 text-left font-medium">Strike</th>
                    <th className="px-4 py-3 text-left font-medium">Entry</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTimestamp(record.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-medium">{record.underlying}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block rounded px-2 py-0.5 text-xs font-medium',
                            getSignalBadgeColor(record.signalType)
                          )}
                        >
                          {record.signalType}
                        </span>
                      </td>
                      <td className="px-4 py-3">{record.probability.toFixed(1)}%</td>
                      <td className="px-4 py-3">1:{record.riskRewardRatio.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        {record.strikePrice
                          ? new Intl.NumberFormat('en-IN').format(record.strikePrice)
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {record.entryPrice ? `₹${record.entryPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.holdReason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && records.length > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="min-h-[44px] min-w-[44px]"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="min-h-[44px] min-w-[44px]"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

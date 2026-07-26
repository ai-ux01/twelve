/**
 * GroupedMetricsTable Component - Trade Analysis
 *
 * Displays a table with grouped metrics per dimension value.
 * Columns: dimension value, trade count, win rate, profit factor, expectancy.
 *
 * Requirements: 8.5, 8.6
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { GroupedMetricsItem, GroupingDimension } from './types';

export interface GroupedMetricsTableProps {
  groups: GroupedMetricsItem[] | null;
  dimension: GroupingDimension;
  isLoading: boolean;
  error: string | null;
}

const DIMENSION_LABELS: Record<GroupingDimension, string> = {
  strategy: 'Strategy',
  setup: 'Setup',
  market_regime: 'Market Regime',
  sector: 'Sector',
  time_of_day: 'Time of Day',
  holding_period: 'Holding Period',
  probability: 'Probability',
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function GroupedMetricsTable({
  groups,
  dimension,
  isLoading,
  error,
}: GroupedMetricsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grouped Breakdown — {DIMENSION_LABELS[dimension]}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading grouped metrics...
          </div>
        ) : !groups || groups.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No data available for this dimension.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{DIMENSION_LABELS[dimension]}</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Profit Factor</TableHead>
                  <TableHead className="text-right">Expectancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.dimension_value}>
                    <TableCell className="font-medium">
                      {group.dimension_value}
                    </TableCell>
                    <TableCell className="text-right">{group.trade_count}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono',
                        group.win_rate >= 50
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {group.win_rate.toFixed(1)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono',
                        group.profit_factor >= 1
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {group.profit_factor >= 9999
                        ? '∞'
                        : group.profit_factor.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono',
                        group.expectancy >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {currencyFormatter.format(group.expectancy)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

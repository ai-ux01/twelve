/**
 * TradeList Component
 *
 * Displays a table of individual trades from backtest results.
 * Columns: trade_id, direction, entry_bar, exit_bar, entry_price,
 * exit_price, quantity, net_pnl, exit_reason, holding_period.
 * Color-codes P&L values green/red.
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TradeRecord {
  trade_id: number;
  direction: string;
  entry_bar: number;
  exit_bar: number;
  entry_price: number;
  exit_price: number;
  quantity: number;
  gross_pnl: number;
  net_pnl: number;
  entry_cost: number;
  exit_cost: number;
  exit_reason: string;
  holding_period: number;
}

export interface TradeListProps {
  trades: TradeRecord[];
}

export function TradeList({ trades }: TradeListProps) {
  if (!trades || trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No trades to display.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade Log ({trades.length} trades)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Entry Bar</TableHead>
              <TableHead>Exit Bar</TableHead>
              <TableHead>Entry Price</TableHead>
              <TableHead>Exit Price</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Net P&amp;L</TableHead>
              <TableHead>Exit Reason</TableHead>
              <TableHead>Holding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.trade_id}>
                <TableCell className="font-mono text-xs">{trade.trade_id}</TableCell>
                <TableCell>
                  <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
                    {trade.direction.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{trade.entry_bar}</TableCell>
                <TableCell className="font-mono text-xs">{trade.exit_bar}</TableCell>
                <TableCell className="font-mono text-xs">₹{trade.entry_price.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs">₹{trade.exit_price.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs">{trade.quantity.toFixed(2)}</TableCell>
                <TableCell
                  className={cn(
                    'font-mono text-xs font-bold',
                    trade.net_pnl >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  ₹{trade.net_pnl.toFixed(2)}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {trade.exit_reason.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{trade.holding_period} bars</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

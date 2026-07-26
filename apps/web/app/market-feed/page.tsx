'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

// --- Types ---

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

interface TickData {
  instrumentToken: string;
  exchange: string;
  symbol: string;
  lastPrice: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  oi: number;
  bid: number;
  ask: number;
  timestamp: string;
}

interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

interface DepthData {
  instrumentToken: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  bestBid: number;
  bestAsk: number;
  spread: number;
  timestamp: string;
}

// --- Helpers ---

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'CONNECTED':
      return 'bg-green-500';
    case 'DISCONNECTED':
      return 'bg-red-500';
    case 'RECONNECTING':
      return 'bg-yellow-500';
  }
}

function getStatusBadgeVariant(status: ConnectionStatus) {
  switch (status) {
    case 'CONNECTED':
      return 'default' as const;
    case 'DISCONNECTED':
      return 'destructive' as const;
    case 'RECONNECTING':
      return 'secondary' as const;
  }
}

function formatChange(lastPrice: number, previousClose: number) {
  if (!previousClose || previousClose === 0) return { change: 0, changePercent: 0 };
  const change = lastPrice - previousClose;
  const changePercent = (change / previousClose) * 100;
  return { change, changePercent };
}

function getChangeColor(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

// --- Component ---

export default function MarketFeedPage() {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [ticks, setTicks] = useState<Map<string, TickData>>(new Map());
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [depth, setDepth] = useState<DepthData | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Connect to Socket.IO on mount
  useEffect(() => {
    const socket = io('http://localhost:4000/market-feed', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 60000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('CONNECTED');
    });

    socket.on('disconnect', () => {
      setStatus('DISCONNECTED');
    });

    socket.on('reconnecting', () => {
      setStatus('RECONNECTING');
    });

    socket.on('reconnect_attempt', () => {
      setStatus('RECONNECTING');
    });

    // Listen for status events from the backend
    socket.on('market-feed.status', (data: { status: ConnectionStatus }) => {
      setStatus(data.status);
    });

    // Listen for tick events
    socket.on('tick', (tick: TickData) => {
      setTicks((prev) => {
        const next = new Map(prev);
        next.set(tick.instrumentToken, tick);
        return next;
      });
    });

    // Listen for depth events
    socket.on('depth', (depthData: DepthData) => {
      setDepth((prev) => {
        // Only update if it's for the selected token
        if (depthData.instrumentToken === selectedToken) {
          return depthData;
        }
        return prev;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to depth when a token is selected
  const handleSelectInstrument = useCallback(
    (token: string) => {
      // Unsubscribe from previous
      if (selectedToken && socketRef.current) {
        socketRef.current.emit('unsubscribe', { token: selectedToken, type: 'depth' });
      }

      setSelectedToken(token);
      setDepth(null);

      if (socketRef.current) {
        socketRef.current.emit('subscribe', { token, type: 'depth' });
      }
    },
    [selectedToken]
  );

  // Update depth when selectedToken changes (for incoming depth events)
  useEffect(() => {
    if (!socketRef.current) return;

    const handler = (depthData: DepthData) => {
      if (depthData.instrumentToken === selectedToken) {
        setDepth(depthData);
      }
    };

    socketRef.current.on('depth', handler);
    return () => {
      socketRef.current?.off('depth', handler);
    };
  }, [selectedToken]);

  // Derive options data from ticks (CE/PE instruments)
  const optionsTicks = Array.from(ticks.values()).filter(
    (t) => t.symbol.includes('CE') || t.symbol.includes('PE')
  );

  const ticksArray = Array.from(ticks.values());

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Market Feed</h1>
          <p className="text-muted-foreground">
            Real-time market data via HSM WebSocket
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${getStatusColor(status)} animate-pulse`} />
            <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
          </div>
          <Badge variant="outline">{ticksArray.length} subscriptions</Badge>
        </div>
      </div>

      {/* Active Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>
            Live tick data for subscribed instruments. Click a row to view market depth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ticksArray.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active subscriptions. Connect and subscribe to instruments to see live data.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">LTP</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Change%</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticksArray.map((tick) => {
                  const { change, changePercent } = formatChange(
                    tick.lastPrice,
                    tick.previousClose
                  );
                  const isSelected = tick.instrumentToken === selectedToken;
                  return (
                    <TableRow
                      key={tick.instrumentToken}
                      className={`cursor-pointer ${isSelected ? 'bg-accent' : ''}`}
                      onClick={() => handleSelectInstrument(tick.instrumentToken)}
                    >
                      <TableCell className="font-mono text-xs">
                        {tick.instrumentToken}
                      </TableCell>
                      <TableCell className="font-medium">{tick.symbol}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{tick.lastPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right ${getChangeColor(change)}`}>
                        {change >= 0 ? '+' : ''}
                        {change.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right ${getChangeColor(changePercent)}`}>
                        {changePercent >= 0 ? '+' : ''}
                        {changePercent.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {tick.volume.toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Options Monitor + Market Depth */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Options Monitor Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Options Monitor</CardTitle>
            <CardDescription>CE/PE data for ATM ± strikes</CardDescription>
          </CardHeader>
          <CardContent>
            {optionsTicks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Connect and subscribe to options to see data
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strike</TableHead>
                    <TableHead className="text-right">CE LTP</TableHead>
                    <TableHead className="text-right">CE Chg%</TableHead>
                    <TableHead className="text-right">PE LTP</TableHead>
                    <TableHead className="text-right">PE Chg%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildOptionsRows(optionsTicks).map((row) => (
                    <TableRow key={row.strike}>
                      <TableCell className="font-medium">{row.strike}</TableCell>
                      <TableCell className="text-right">
                        {row.ceLTP != null ? `₹${row.ceLTP.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right ${getChangeColor(row.ceChangePercent ?? 0)}`}
                      >
                        {row.ceChangePercent != null
                          ? `${row.ceChangePercent >= 0 ? '+' : ''}${row.ceChangePercent.toFixed(2)}%`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.peLTP != null ? `₹${row.peLTP.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right ${getChangeColor(row.peChangePercent ?? 0)}`}
                      >
                        {row.peChangePercent != null
                          ? `${row.peChangePercent >= 0 ? '+' : ''}${row.peChangePercent.toFixed(2)}%`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Market Depth Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Market Depth</CardTitle>
            <CardDescription>
              {selectedToken
                ? `5-level depth for ${ticks.get(selectedToken)?.symbol ?? selectedToken}`
                : 'Select an instrument to view depth'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedToken ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Click on a row in the subscriptions table to view market depth
              </p>
            ) : !depth ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Waiting for depth data...
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Bids */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                    Bids
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(depth.bids || []).map((level, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-right text-green-600 font-medium">
                            {level.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {level.quantity.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">{level.orders}</TableCell>
                        </TableRow>
                      ))}
                      {(depth.bids || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No bid data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Asks */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                    Asks
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(depth.asks || []).map((level, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-right text-red-600 font-medium">
                            {level.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {level.quantity.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">{level.orders}</TableCell>
                        </TableRow>
                      ))}
                      {(depth.asks || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No ask data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Spread info */}
                <div className="col-span-2 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <span>
                    Best Bid: <span className="text-green-600 font-medium">{depth.bestBid.toFixed(2)}</span>
                  </span>
                  <span>
                    Spread: <span className="font-medium">{depth.spread.toFixed(2)}</span>
                  </span>
                  <span>
                    Best Ask: <span className="text-red-600 font-medium">{depth.bestAsk.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Options row builder ---

interface OptionsRow {
  strike: string;
  ceLTP: number | null;
  ceChangePercent: number | null;
  peLTP: number | null;
  peChangePercent: number | null;
}

function buildOptionsRows(optionsTicks: TickData[]): OptionsRow[] {
  const strikeMap = new Map<string, { ce?: TickData; pe?: TickData }>();

  for (const tick of optionsTicks) {
    // Extract strike from symbol - pattern: NIFTY24JUN23000CE or BANKNIFTY24JUN50000PE
    const ceMatch = tick.symbol.match(/(\d+)CE$/);
    const peMatch = tick.symbol.match(/(\d+)PE$/);

    if (ceMatch) {
      const strike = ceMatch[1];
      const entry = strikeMap.get(strike) || {};
      entry.ce = tick;
      strikeMap.set(strike, entry);
    } else if (peMatch) {
      const strike = peMatch[1];
      const entry = strikeMap.get(strike) || {};
      entry.pe = tick;
      strikeMap.set(strike, entry);
    }
  }

  return Array.from(strikeMap.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([strike, { ce, pe }]) => {
      const ceChange = ce ? formatChange(ce.lastPrice, ce.previousClose) : null;
      const peChange = pe ? formatChange(pe.lastPrice, pe.previousClose) : null;

      return {
        strike,
        ceLTP: ce?.lastPrice ?? null,
        ceChangePercent: ceChange?.changePercent ?? null,
        peLTP: pe?.lastPrice ?? null,
        peChangePercent: peChange?.changePercent ?? null,
      };
    });
}

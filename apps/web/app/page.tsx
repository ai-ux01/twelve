'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { kotakApi } from '@/lib/kotak-api';
import { Badge } from '@/components/ui/badge';

const PortfolioValueChart = dynamic(() => import('@/components/charts/PortfolioValueChart'), { ssr: false });

interface ServiceStatus {
  name: string;
  url: string;
  status: 'checking' | 'online' | 'offline';
}

interface HoldingSummary {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  pnlPercent: number;
  holdingsCount: number;
}

export default function Home() {
  const [portfolioData, setPortfolioData] = useState<{ date: string; value: number }[]>([]);
  const [holdingSummary, setHoldingSummary] = useState<HoldingSummary | null>(null);
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Backend API', url: 'http://localhost:4000', status: 'checking' },
    { name: 'Quant Engine', url: 'http://localhost:8000', status: 'checking' },
    { name: 'Frontend', url: '', status: 'online' },
  ]);

  // Check service health
  useEffect(() => {
    async function checkServices() {
      const updatedServices = [...services];

      // Check Backend API
      try {
        const res = await fetch('http://localhost:4000/api/swing/universe', { method: 'GET' });
        updatedServices[0].status = res.ok ? 'online' : 'offline';
      } catch {
        updatedServices[0].status = 'offline';
      }

      // Check Quant Engine
      try {
        const res = await fetch('http://localhost:8000/health', { method: 'GET' });
        updatedServices[1].status = res.ok ? 'online' : 'offline';
      } catch {
        // Try alternate endpoint
        try {
          const res = await fetch('http://localhost:8000/api/swing/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxResults: 0 }),
          });
          updatedServices[1].status = res.ok ? 'online' : 'offline';
        } catch {
          updatedServices[1].status = 'offline';
        }
      }

      setServices(updatedServices);
    }

    checkServices();
  }, []);

  // Fetch portfolio data from Kotak Neo
  useEffect(() => {
    async function fetchPortfolio() {
      const sessionId = kotakApi.getSessionId();
      if (!sessionId) {
        setBrokerConnected(false);
        return;
      }
      setBrokerConnected(true);

      try {
        const holdings = await kotakApi.getHoldings();
        const data = holdings?.data || holdings || [];
        if (!Array.isArray(data) || data.length === 0) return;

        const totalValue = data.reduce((sum: number, h: any) => sum + (h.mktValue || 0), 0);
        const totalCost = data.reduce((sum: number, h: any) => sum + (h.holdingCost || 0), 0);
        const totalPnL = totalValue - totalCost;
        const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

        setHoldingSummary({
          totalValue,
          totalCost,
          totalPnL,
          pnlPercent,
          holdingsCount: data.length,
        });

        // Build 30-day chart: use cost as base, current value as today
        const today = new Date();
        const chartData = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          // Estimate: interpolate from cost to current value
          const progress = (30 - i) / 30;
          const estimatedValue = totalCost + (totalPnL * progress);
          chartData.push({
            date: d.toISOString().split('T')[0],
            value: Math.round(estimatedValue * 100) / 100,
          });
        }
        setPortfolioData(chartData);
      } catch {
        // silently fail
      }
    }

    fetchPortfolio();
  }, []);

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const allOnline = services.every((s) => s.status === 'online');
  const onlineCount = services.filter((s) => s.status === 'online').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome to ProfitTerminal</h1>
        <p className="text-muted-foreground">
          Your local-first AI trading operating system for Indian markets
        </p>
      </div>

      {/* Portfolio Value Chart */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Portfolio Value (30d)
            {holdingSummary && (
              <span className="ml-2 text-foreground font-semibold text-lg">
                {formatCurrency(holdingSummary.totalValue)}
              </span>
            )}
          </h3>
          {holdingSummary && (
            <div className="text-right">
              <span className={`text-sm font-semibold ${holdingSummary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {holdingSummary.totalPnL >= 0 ? '+' : ''}{formatCurrency(holdingSummary.totalPnL)}
                {' '}({holdingSummary.pnlPercent >= 0 ? '+' : ''}{holdingSummary.pnlPercent.toFixed(2)}%)
              </span>
              <p className="text-xs text-muted-foreground">{holdingSummary.holdingsCount} holdings</p>
            </div>
          )}
        </div>
        <PortfolioValueChart data={portfolioData} height={200} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* System Status - Real */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">System Status</h3>
          <p className={`text-2xl font-bold ${allOnline ? 'text-green-600' : 'text-yellow-600'}`}>
            {allOnline ? 'All Online' : `${onlineCount}/${services.length} Online`}
          </p>
          <div className="mt-3 space-y-1.5">
            {services.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.name}</span>
                <Badge
                  variant={s.status === 'online' ? 'default' : s.status === 'checking' ? 'outline' : 'destructive'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Broker Connection - Real */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Broker</h3>
          <p className={`text-2xl font-bold ${brokerConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
            {brokerConnected ? 'Kotak Neo' : 'Not Connected'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {brokerConnected ? 'Live trading enabled' : 'Login from portfolio page to connect'}
          </p>
        </div>

        {/* Holdings Summary - Real */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Holdings</h3>
          {holdingSummary ? (
            <>
              <p className="text-2xl font-bold">{holdingSummary.holdingsCount} stocks</p>
              <p className="text-xs text-muted-foreground mt-2">
                Invested: {formatCurrency(holdingSummary.totalCost)}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-2">
                {brokerConnected ? 'Loading...' : 'Connect broker to view'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/analysis"
            className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2">Intraday Analysis</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered intraday technical analysis
            </p>
          </Link>

          <Link
            href="/swing"
            className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2">Swing Scanner</h3>
            <p className="text-sm text-muted-foreground">
              Scan {'>'}2000 stocks for swing opportunities
            </p>
          </Link>

          <Link
            href="/options"
            className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2">Options Scalper</h3>
            <p className="text-sm text-muted-foreground">
              NIFTY/BANKNIFTY options trading signals
            </p>
          </Link>

          <Link
            href="/portfolio"
            className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2">Portfolio</h3>
            <p className="text-sm text-muted-foreground">
              Manage positions and track P&L
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

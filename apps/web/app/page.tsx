import Link from 'next/link';

export default function Home() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome to ProfitTerminal</h1>
        <p className="text-muted-foreground">
          Your local-first AI trading operating system for Indian markets
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Stats Cards */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">System Status</h3>
          <p className="text-2xl font-bold text-green-600">Active</p>
          <p className="text-xs text-muted-foreground mt-2">All services running</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Market Data</h3>
          <p className="text-2xl font-bold">NSE</p>
          <p className="text-xs text-muted-foreground mt-2">Kite Connect</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">AI Provider</h3>
          <p className="text-2xl font-bold">OpenAI</p>
          <p className="text-xs text-muted-foreground mt-2">Ready for analysis</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/analysis"
            className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2">Start Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Use natural language to analyze stocks and get AI-powered trade recommendations
            </p>
          </Link>

          <Link
            href="/portfolio"
            className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
          >
            <h3 className="text-lg font-semibold mb-2">View Portfolio</h3>
            <p className="text-sm text-muted-foreground">
              Monitor your positions, track PnL, and manage your trades
            </p>
          </Link>
        </div>
      </div>

      {/* System Information */}
      <div className="mt-8 rounded-lg border bg-muted/40 p-6">
        <h2 className="text-lg font-semibold mb-4">System Information</h2>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">Frontend</p>
            <p className="font-mono">localhost:3000</p>
          </div>
          <div>
            <p className="text-muted-foreground">Backend API</p>
            <p className="font-mono">localhost:4000</p>
          </div>
          <div>
            <p className="text-muted-foreground">Quant Engine</p>
            <p className="font-mono">localhost:8000</p>
          </div>
        </div>
      </div>
    </div>
  );
}

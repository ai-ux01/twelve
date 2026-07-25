import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { QueryProvider } from '@/components/providers/query-provider';
import { ToastProvider } from '@/components/ui/toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ProfitTerminal - AI Trading System',
  description: 'Local-first AI trading operating system for Indian markets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className="min-h-screen bg-background">
        <QueryProvider>
          <ToastProvider>
            <div className="flex min-h-screen">
              {/* Sidebar Navigation */}
              <aside className="w-64 border-r bg-muted/40 p-6">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold">ProfitTerminal</h1>
                  <p className="text-xs text-muted-foreground">AI Trading System</p>
                </div>
                <nav className="space-y-2">
                  <Link
                    href="/"
                    className="block rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/analysis"
                    className="block rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Analysis
                  </Link>
                  <Link
                    href="/swing"
                    className="block rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Swing Scanner
                  </Link>
                  <Link
                    href="/portfolio"
                    className="block rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Portfolio
                  </Link>
                </nav>
              </aside>

              {/* Main Content */}
              <main className="flex-1">{children}</main>
            </div>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

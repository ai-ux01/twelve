import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/components/providers/query-provider';
import { ToastProvider } from '@/components/ui/toast';
import { BrokerHeader } from '@/components/broker-header';
import { SidebarNav } from '@/components/sidebar-nav';

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
                <SidebarNav />
              </aside>

              {/* Main Content */}
              <div className="flex-1 flex flex-col">
                <BrokerHeader />
                <main className="flex-1">{children}</main>
              </div>
            </div>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

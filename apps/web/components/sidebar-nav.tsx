'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/analysis', label: 'Analysis' },
  { href: '/swing', label: 'Swing Scanner' },
  { href: '/intraday', label: 'Intraday' },
  { href: '/options-scalper', label: 'Options Scalper' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/ai-trading', label: 'AI Trading' },
  { href: '/paper-trading', label: 'Paper Trading' },
  { href: '/trade-analysis', label: 'Trade Analysis' },
  { href: '/backtesting', label: 'Backtesting' },
  { href: '/trade-coach', label: 'Trade Coach' },
  { href: '/agents', label: 'Agents' },
  { href: '/agent-readiness', label: 'Agent Readiness' },
  { href: '/market-feed', label: 'Market Feed' },
  { href: '/prompts', label: 'Prompts' },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {navLinks.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'block rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
            {...(isActive ? { 'aria-current': 'page' as const } : {})}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

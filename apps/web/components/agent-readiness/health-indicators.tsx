/**
 * Health Indicators Component
 *
 * Displays 4 health status cards with traffic-light colors:
 * Data Health, Quant Engine Health, AI Health, Risk Engine Health.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

'use client';

import type { HealthIndicators as HealthIndicatorsType } from './types';

interface HealthIndicatorsProps {
  health: HealthIndicatorsType;
}

function getHealthColor(status: string): string {
  switch (status) {
    case 'connected':
    case 'running':
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'degraded':
    case 'error':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'disconnected':
    case 'stopped':
    case 'inactive':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function getDotColor(status: string): string {
  switch (status) {
    case 'connected':
    case 'running':
    case 'active':
      return 'bg-green-500';
    case 'degraded':
    case 'error':
      return 'bg-yellow-500';
    case 'disconnected':
    case 'stopped':
    case 'inactive':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

interface HealthCardProps {
  title: string;
  status: string;
}

function HealthCard({ title, status }: HealthCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${getHealthColor(status)}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${getDotColor(status)}`} />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <p className="text-xs capitalize font-semibold">{status.replace('_', ' ')}</p>
    </div>
  );
}

export function HealthIndicators({ health }: HealthIndicatorsProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Health Indicators
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthCard title="Data Health" status={health.data_health} />
        <HealthCard title="Quant Engine" status={health.quant_engine_health} />
        <HealthCard title="AI Health" status={health.ai_health} />
        <HealthCard title="Risk Engine" status={health.risk_engine_health} />
      </div>
    </div>
  );
}

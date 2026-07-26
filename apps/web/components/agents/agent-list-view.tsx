/**
 * AgentListView Component
 *
 * Displays a table of all agents with type, status (color-coded badge),
 * active task count, and last activity. Supports filtering by type and status.
 *
 * Requirements: 11.1, 11.6
 */

'use client';

import { useState } from 'react';
import type { Agent, AgentType, AgentStatus } from './types';
import {
  AGENT_TYPES,
  AGENT_STATUSES,
  AGENT_TYPE_LABELS,
  STATUS_COLORS,
} from './types';

export interface AgentListViewProps {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onTypeFilterChange: (type: AgentType | null) => void;
  onStatusFilterChange: (status: AgentStatus | null) => void;
}

export function AgentListView({
  agents,
  isLoading,
  error,
  selectedAgentId,
  onSelectAgent,
  onTypeFilterChange,
  onStatusFilterChange,
}: AgentListViewProps) {
  const [typeFilter, setTypeFilter] = useState<AgentType | ''>('');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | ''>('');

  const handleTypeChange = (value: string) => {
    const type = value === '' ? null : (value as AgentType);
    setTypeFilter(value as AgentType | '');
    onTypeFilterChange(type);
  };

  const handleStatusChange = (value: string) => {
    const status = value === '' ? null : (value as AgentStatus);
    setStatusFilter(value as AgentStatus | '');
    onStatusFilterChange(status);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error loading agents: {error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Filters */}
      <div className="flex items-center gap-3 border-b p-4">
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          {AGENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {AGENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {AGENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">No agents found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                    selectedAgentId === agent.id ? 'bg-muted' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{agent.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {AGENT_TYPE_LABELS[agent.agent_type]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[agent.status]}`}
                    >
                      {agent.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(agent.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

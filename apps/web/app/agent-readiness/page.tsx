/**
 * Agent Readiness Dashboard Page
 *
 * Page with agent selector dropdown and detail view.
 * Fetches list of all agents and displays readiness detail for selected agent.
 *
 * Requirements: 13.2
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useAgentReadiness,
  AgentReadinessDetail,
} from '@/components/agent-readiness';

interface AgentSummary {
  id: string;
  name: string;
  agent_type: string;
  status: string;
}

export default function AgentReadinessPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoadingAgents(true);
    setAgentsError(null);
    try {
      const response = await fetch('http://localhost:8000/api/agents');
      if (!response.ok) throw new Error(`Failed to fetch agents: ${response.status}`);
      const data: AgentSummary[] = await response.json();
      setAgents(data);
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const {
    readiness,
    isLoading: isLoadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useAgentReadiness(selectedAgentId);

  // Auto-check health when agent is selected (runs once per agent selection)
  useEffect(() => {
    if (!selectedAgentId) return;
    let cancelled = false;

    async function checkAndUpdateHealth() {
      try {
        // Check quant engine health
        const quantRes = await fetch('http://localhost:8000/health').catch(() => null);
        const quantRunning = quantRes?.ok ? 'running' : 'stopped';

        // Check data health (NestJS API)
        const dataRes = await fetch('http://localhost:4000/api').catch(() => null);
        const dataConnected = dataRes ? 'connected' : 'disconnected';

        // Update health via API
        await fetch(`http://localhost:8000/api/agent-readiness/${selectedAgentId}/health`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_health: dataConnected,
            quant_engine_health: quantRunning,
            ai_health: quantRunning === 'running' ? 'connected' : 'disconnected',
            risk_engine_health: quantRunning === 'running' ? 'active' : 'inactive',
          }),
        });

        // Small delay then refetch to show updated health
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled) refetchDetail();
          }, 300);
        }
      } catch {
        // Silently fail — health indicators will show defaults
      }
    }

    checkAndUpdateHealth();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId]);

  const handleAdvanced = () => {
    refetchDetail();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Readiness Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and advance agent readiness through gated stages
          </p>
        </div>
      </div>

      {/* Agent Selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="agent-select" className="text-sm font-medium">
          Select Agent:
        </label>
        <select
          id="agent-select"
          value={selectedAgentId || ''}
          onChange={(e) => setSelectedAgentId(e.target.value || null)}
          className="px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">-- Select an agent --</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.agent_type}) — {agent.status}
            </option>
          ))}
        </select>
        {isLoadingAgents && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>

      {agentsError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {agentsError}
        </div>
      )}

      {/* Detail View */}
      {selectedAgentId && isLoadingDetail && (
        <div className="text-sm text-muted-foreground">Loading readiness data...</div>
      )}

      {selectedAgentId && detailError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {detailError}
        </div>
      )}

      {selectedAgentId && readiness && (
        <AgentReadinessDetail readiness={readiness} onAdvanced={handleAdvanced} />
      )}

      {!selectedAgentId && !isLoadingAgents && agents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No agents found</p>
          <p className="text-sm mt-1">
            Create agents in the AI Agents module first.
          </p>
        </div>
      )}

      {!selectedAgentId && agents.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Select an agent above to view its readiness dashboard.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Agent Management Dashboard Page
 *
 * Main page for the AI Agent Architecture system. Displays:
 * - Agent list with filtering (left panel)
 * - Agent detail view with lifecycle controls (right panel)
 * - Create form for new agents
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

'use client';

import { useState, useCallback } from 'react';
import { AgentListView } from '@/components/agents/agent-list-view';
import { AgentDetailView } from '@/components/agents/agent-detail-view';
import { AgentCreateForm } from '@/components/agents/agent-create-form';
import { useAgents, useAgentDetail, useAgentMutations } from '@/components/agents/use-agents';
import type { AgentType, AgentStatus, CreateAgentRequest } from '@/components/agents/types';

export default function AgentsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgentStatus | null>(null);

  const {
    agents,
    isLoading: isLoadingAgents,
    error: agentsError,
    refetch: refetchAgents,
  } = useAgents({ typeFilter, statusFilter });

  const {
    agent: selectedAgent,
    tasks,
    policies,
    decisions,
    isLoading: isLoadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useAgentDetail(selectedAgentId);

  const {
    createAgent,
    updateAgent,
    isCreating,
    createError,
  } = useAgentMutations();

  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
  }, []);

  const handleTypeFilterChange = useCallback((type: AgentType | null) => {
    setTypeFilter(type);
  }, []);

  const handleStatusFilterChange = useCallback((status: AgentStatus | null) => {
    setStatusFilter(status);
  }, []);

  const handleCreateAgent = useCallback(
    async (request: CreateAgentRequest) => {
      const newAgent = await createAgent(request);
      if (newAgent) {
        await refetchAgents();
        setSelectedAgentId(newAgent.id);
      }
    },
    [createAgent, refetchAgents]
  );

  const handleStatusChange = useCallback(
    async (agentId: string, newStatus: string, reason: string) => {
      const updated = await updateAgent(agentId, {
        status: newStatus as AgentStatus,
        status_reason: reason,
      });
      if (updated) {
        await refetchAgents();
        await refetchDetail();
      }
    },
    [updateAgent, refetchAgents, refetchDetail]
  );

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage autonomous and semi-autonomous trading agents
          </p>
        </div>
        <AgentCreateForm
          onSubmit={handleCreateAgent}
          isSubmitting={isCreating}
          error={createError}
        />
      </header>

      {/* Main Content: List + Detail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Agent List (left) */}
        <div className="lg:col-span-2">
          <AgentListView
            agents={agents}
            isLoading={isLoadingAgents}
            error={agentsError}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
            onTypeFilterChange={handleTypeFilterChange}
            onStatusFilterChange={handleStatusFilterChange}
          />
        </div>

        {/* Agent Detail (right) */}
        <div className="lg:col-span-3">
          <AgentDetailView
            agent={selectedAgent}
            tasks={tasks}
            policies={policies}
            decisions={decisions}
            isLoading={isLoadingDetail}
            error={detailError}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>
    </div>
  );
}

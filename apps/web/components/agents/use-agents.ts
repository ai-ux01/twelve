/**
 * Agent Architecture - Data Fetching Hooks
 *
 * Custom hooks for fetching and mutating agent data from the
 * Python quant engine API at http://localhost:8000/api/agents/*.
 *
 * Requirements: 11.1, 11.2, 12.2, 12.3
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  Agent,
  AgentTask,
  AgentPolicy,
  AgentDecision,
  AuditTrail,
  AgentType,
  AgentStatus,
  CreateAgentRequest,
  UpdateAgentRequest,
} from './types';

const API_BASE = 'http://localhost:8000/api/agents';

// === List Agents Hook ===

interface UseAgentsOptions {
  typeFilter?: AgentType | null;
  statusFilter?: AgentStatus | null;
}

interface UseAgentsResult {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAgents({ typeFilter, statusFilter }: UseAgentsOptions = {}): UseAgentsResult {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('agent_type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      const query = params.toString();
      const url = query ? `${API_BASE}?${query}` : API_BASE;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch agents: ${response.status}`);
      const data: Agent[] = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, isLoading, error, refetch: fetchAgents };
}

// === Agent Detail Hook ===

interface UseAgentDetailResult {
  agent: Agent | null;
  tasks: AgentTask[];
  policies: AgentPolicy[];
  decisions: AgentDecision[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAgentDetail(agentId: string | null): UseAgentDetailResult {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [policies, setPolicies] = useState<AgentPolicy[]>([]);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!agentId) {
      setAgent(null);
      setTasks([]);
      setPolicies([]);
      setDecisions([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [agentRes, tasksRes, policiesRes, decisionsRes] = await Promise.all([
        fetch(`${API_BASE}/${agentId}`),
        fetch(`${API_BASE}/${agentId}/tasks`),
        fetch(`${API_BASE}/${agentId}/policies`),
        fetch(`${API_BASE}/${agentId}/decisions`),
      ]);

      if (!agentRes.ok) throw new Error(`Failed to fetch agent: ${agentRes.status}`);

      const agentData: Agent = await agentRes.json();
      setAgent(agentData);

      if (tasksRes.ok) {
        const tasksData: AgentTask[] = await tasksRes.json();
        setTasks(tasksData);
      }

      if (policiesRes.ok) {
        const policiesData: AgentPolicy[] = await policiesRes.json();
        setPolicies(policiesData);
      }

      if (decisionsRes.ok) {
        const decisionsData: AgentDecision[] = await decisionsRes.json();
        setDecisions(decisionsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent detail');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { agent, tasks, policies, decisions, isLoading, error, refetch: fetchDetail };
}

// === Audit Trail Hook ===

interface UseAuditTrailResult {
  auditTrail: AuditTrail | null;
  isLoading: boolean;
  error: string | null;
  fetchAuditTrail: (agentId: string, decisionId: string) => Promise<void>;
}

export function useAuditTrail(): UseAuditTrailResult {
  const [auditTrail, setAuditTrail] = useState<AuditTrail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditTrail = useCallback(async (agentId: string, decisionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/${agentId}/decisions/${decisionId}/audit-trail`
      );
      if (!response.ok) throw new Error(`Failed to fetch audit trail: ${response.status}`);
      const data: AuditTrail = await response.json();
      setAuditTrail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit trail');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { auditTrail, isLoading, error, fetchAuditTrail };
}

// === Mutation Hooks ===

interface UseAgentMutationsResult {
  createAgent: (request: CreateAgentRequest) => Promise<Agent | null>;
  updateAgent: (agentId: string, request: UpdateAgentRequest) => Promise<Agent | null>;
  isCreating: boolean;
  isUpdating: boolean;
  createError: string | null;
  updateError: string | null;
}

export function useAgentMutations(): UseAgentMutationsResult {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const createAgent = useCallback(async (request: CreateAgentRequest): Promise<Agent | null> => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Failed to create agent: ${response.status}`);
      }
      const data: Agent = await response.json();
      return data;
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateAgent = useCallback(
    async (agentId: string, request: UpdateAgentRequest): Promise<Agent | null> => {
      setIsUpdating(true);
      setUpdateError(null);
      try {
        const response = await fetch(`${API_BASE}/${agentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || `Failed to update agent: ${response.status}`);
        }
        const data: Agent = await response.json();
        return data;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : 'Failed to update agent');
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  return { createAgent, updateAgent, isCreating, isUpdating, createError, updateError };
}

/**
 * Agent Readiness - Data Fetching Hooks
 *
 * Custom hooks for fetching agent readiness data, advancing stages,
 * and updating health/metrics via the quant engine API.
 *
 * Requirements: 11.1-11.5
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AgentReadiness, AdvanceRequest } from './types';

const API_BASE = 'http://localhost:8000/api/agent-readiness';

interface UseAgentReadinessListResult {
  records: AgentReadiness[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAgentReadinessList(): UseAgentReadinessListResult {
  const [records, setRecords] = useState<AgentReadiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE);
      if (!response.ok) throw new Error(`Failed to fetch readiness list: ${response.status}`);
      const data: AgentReadiness[] = await response.json();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch readiness list');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { records, isLoading, error, refetch: fetchList };
}

interface UseAgentReadinessResult {
  readiness: AgentReadiness | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAgentReadiness(agentId: string | null): UseAgentReadinessResult {
  const [readiness, setReadiness] = useState<AgentReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    if (!agentId) {
      setReadiness(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/${agentId}`);
      if (!response.ok) throw new Error(`Failed to fetch readiness: ${response.status}`);
      const data: AgentReadiness = await response.json();
      setReadiness(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch readiness');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  return { readiness, isLoading, error, refetch: fetchReadiness };
}

interface UseAdvanceStageResult {
  advance: (reason: string) => Promise<{ success: boolean; error?: string; unmetCriteria?: string[] }>;
  isAdvancing: boolean;
}

export function useAdvanceStage(agentId: string | null): UseAdvanceStageResult {
  const [isAdvancing, setIsAdvancing] = useState(false);

  const advance = useCallback(
    async (reason: string) => {
      if (!agentId) return { success: false, error: 'No agent selected' };
      setIsAdvancing(true);
      try {
        const response = await fetch(`${API_BASE}/${agentId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason } as AdvanceRequest),
        });
        if (!response.ok) {
          const errorData = await response.json();
          const detail = errorData.detail;
          if (typeof detail === 'object' && detail.unmet_criteria) {
            return { success: false, error: detail.detail, unmetCriteria: detail.unmet_criteria };
          }
          return { success: false, error: typeof detail === 'string' ? detail : JSON.stringify(detail) };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Advance failed' };
      } finally {
        setIsAdvancing(false);
      }
    },
    [agentId]
  );

  return { advance, isAdvancing };
}

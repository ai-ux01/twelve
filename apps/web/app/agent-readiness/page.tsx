/**
 * Agent Readiness Dashboard Page
 *
 * Page with agent selector dropdown and detail view.
 * Fetches list of tracked agents, displays readiness detail for selected agent.
 *
 * Requirements: 13.2
 */

'use client';

import { useState } from 'react';
import {
  useAgentReadinessList,
  useAgentReadiness,
  AgentReadinessDetail,
} from '@/components/agent-readiness';

export default function AgentReadinessPage() {
  const { records, isLoading: isLoadingList, error: listError, refetch: refetchList } =
    useAgentReadinessList();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const {
    readiness,
    isLoading: isLoadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useAgentReadiness(selectedAgentId);

  const handleAdvanced = () => {
    refetchDetail();
    refetchList();
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
          {records.map((record) => (
            <option key={record.agent_id} value={record.agent_id}>
              {record.agent_id} — {record.current_stage}
            </option>
          ))}
        </select>
        {isLoadingList && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>

      {listError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {listError}
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

      {!selectedAgentId && !isLoadingList && records.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No agents tracked yet</p>
          <p className="text-sm mt-1">
            Create agents in the Agents module, then access their readiness here.
          </p>
        </div>
      )}

      {!selectedAgentId && records.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Select an agent above to view its readiness dashboard.</p>
        </div>
      )}
    </div>
  );
}

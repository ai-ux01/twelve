/**
 * AuditTrailTimeline Component
 *
 * Vertical timeline showing the decision audit pipeline:
 * Observations → Decision → Actions → Executions → Outcomes
 *
 * Each node shows type, timestamp, and summary data.
 * Fetches from GET /api/agents/{id}/decisions/{did}/audit-trail.
 *
 * Requirements: 11.5
 */

'use client';

import { useEffect } from 'react';
import { useAuditTrail } from './use-agents';
import type { AuditTrail } from './types';

export interface AuditTrailTimelineProps {
  agentId: string;
  decisionId: string;
}

interface TimelineNode {
  type: string;
  label: string;
  timestamp: string;
  summary: string;
  color: string;
}

function buildTimelineNodes(trail: AuditTrail): TimelineNode[] {
  const nodes: TimelineNode[] = [];

  // Observations
  for (const obs of trail.observations) {
    nodes.push({
      type: 'observation',
      label: `Observation: ${obs.observation_type.replace('_', ' ')}`,
      timestamp: obs.timestamp,
      summary: `Source: ${obs.source} (v${obs.data_version})`,
      color: 'bg-blue-500',
    });
  }

  // Decision
  nodes.push({
    type: 'decision',
    label: `Decision: ${trail.decision.decision_type.replace('_', ' ')}`,
    timestamp: trail.decision.timestamp,
    summary: `${trail.decision.reasoning.slice(0, 100)}${trail.decision.reasoning.length > 100 ? '...' : ''} (Confidence: ${(trail.decision.confidence * 100).toFixed(0)}%)`,
    color: 'bg-purple-500',
  });

  // Actions
  for (const action of trail.actions) {
    nodes.push({
      type: 'action',
      label: `Action: ${action.action_type.replace('_', ' ')}`,
      timestamp: action.timestamp,
      summary: Object.keys(action.parameters).length > 0
        ? `Params: ${JSON.stringify(action.parameters).slice(0, 80)}`
        : 'No parameters',
      color: 'bg-orange-500',
    });
  }

  // Executions
  for (const exec of trail.executions) {
    nodes.push({
      type: 'execution',
      label: `Execution: ${exec.status}`,
      timestamp: exec.started_at || exec.completed_at || '',
      summary: exec.requires_approval
        ? `Requires approval${exec.approved_by ? ` (approved by ${exec.approved_by})` : ''}`
        : `Status: ${exec.status}`,
      color: 'bg-cyan-500',
    });
  }

  // Outcomes
  for (const outcome of trail.outcomes) {
    nodes.push({
      type: 'outcome',
      label: `Outcome: ${outcome.outcome_status.replace('_', ' ')}`,
      timestamp: outcome.timestamp,
      summary: Object.keys(outcome.result_data).length > 0
        ? `Result: ${JSON.stringify(outcome.result_data).slice(0, 80)}`
        : 'No result data',
      color: outcome.outcome_status === 'SUCCESS'
        ? 'bg-green-500'
        : outcome.outcome_status === 'FAILURE'
        ? 'bg-red-500'
        : 'bg-yellow-500',
    });
  }

  return nodes;
}

export function AuditTrailTimeline({ agentId, decisionId }: AuditTrailTimelineProps) {
  const { auditTrail, isLoading, error, fetchAuditTrail } = useAuditTrail();

  useEffect(() => {
    fetchAuditTrail(agentId, decisionId);
  }, [agentId, decisionId, fetchAuditTrail]);

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">Audit Trail</h3>
        <p className="text-xs text-muted-foreground">Loading audit trail...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">Audit Trail</h3>
        <p className="text-xs text-red-600">Failed to load: {error}</p>
      </div>
    );
  }

  if (!auditTrail) {
    return null;
  }

  const nodes = buildTimelineNodes(auditTrail);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-4 text-sm font-medium">Audit Trail</h3>

      {nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No audit trail data</p>
      ) : (
        <div className="relative ml-3">
          {/* Vertical line */}
          <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-border" />

          {/* Timeline nodes */}
          <div className="space-y-4">
            {nodes.map((node, index) => (
              <div key={index} className="relative pl-6">
                {/* Dot */}
                <div
                  className={`absolute left-0 top-1 h-3 w-3 rounded-full ${node.color}`}
                />

                {/* Content */}
                <div className="rounded border bg-card p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{node.label}</span>
                    {node.timestamp && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(node.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {node.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

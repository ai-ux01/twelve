/**
 * AgentDetailView Component
 *
 * Displays detailed information about a selected agent including:
 * name, type, status, config JSON, policies list, and recent
 * decisions (last 5-10).
 *
 * Requirements: 11.2
 */

'use client';

import type { Agent, AgentTask, AgentPolicy, AgentDecision } from './types';
import { AGENT_TYPE_LABELS, STATUS_COLORS } from './types';
import { LifecycleControls } from './lifecycle-controls';
import { AuditTrailTimeline } from './audit-trail-timeline';

export interface AgentDetailViewProps {
  agent: Agent | null;
  tasks: AgentTask[];
  policies: AgentPolicy[];
  decisions: AgentDecision[];
  isLoading: boolean;
  error: string | null;
  onStatusChange: (agentId: string, newStatus: string, reason: string) => void;
}

export function AgentDetailView({
  agent,
  tasks,
  policies,
  decisions,
  isLoading,
  error,
  onStatusChange,
}: AgentDetailViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading agent details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Select an agent to view details</p>
      </div>
    );
  }

  const activeTasks = tasks.filter(
    (t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  );
  const recentDecisions = decisions.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">
            {AGENT_TYPE_LABELS[agent.agent_type]} Agent
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[agent.status]}`}
        >
          {agent.status.replace('_', ' ')}
        </span>
      </div>

      {/* Lifecycle Controls */}
      <LifecycleControls agent={agent} onStatusChange={onStatusChange} />

      {/* Configuration */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">Configuration</h3>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(agent.config, null, 2) || '{}'}
        </pre>
      </div>

      {/* Policies */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">
          Policies ({policies.length})
        </h3>
        {policies.length === 0 ? (
          <p className="text-xs text-muted-foreground">No policies configured</p>
        ) : (
          <ul className="space-y-2">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="flex items-center justify-between rounded border px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium">{policy.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    ({policy.policy_type.replace('_', ' ')})
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    policy.enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {policy.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Active Tasks */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">
          Active Tasks ({activeTasks.length})
        </h3>
        {activeTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active tasks</p>
        ) : (
          <ul className="space-y-1">
            {activeTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between text-xs"
              >
                <span>{task.description}</span>
                <span className="rounded bg-muted px-2 py-0.5">
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent Decisions */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">
          Recent Decisions ({recentDecisions.length})
        </h3>
        {recentDecisions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No decisions recorded</p>
        ) : (
          <ul className="space-y-2">
            {recentDecisions.map((decision) => (
              <li key={decision.id} className="rounded border p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {decision.decision_type.replace('_', ' ')}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(decision.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {decision.reasoning}
                </p>
                <div className="mt-1 text-xs">
                  Confidence: {(decision.confidence * 100).toFixed(0)}%
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Audit Trail for most recent decision */}
      {recentDecisions.length > 0 && (
        <AuditTrailTimeline
          agentId={agent.id}
          decisionId={recentDecisions[0].id}
        />
      )}
    </div>
  );
}

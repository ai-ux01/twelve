/**
 * LifecycleControls Component
 *
 * Displays current status badge and buttons for valid next transitions
 * based on the VALID_TRANSITIONS map. Prompts for a reason before
 * transitioning via PATCH /api/agents/{id}.
 *
 * Requirements: 11.4
 */

'use client';

import { useState } from 'react';
import type { Agent, AgentStatus } from './types';
import { VALID_TRANSITIONS, STATUS_COLORS } from './types';

export interface LifecycleControlsProps {
  agent: Agent;
  onStatusChange: (agentId: string, newStatus: string, reason: string) => void;
}

const TRANSITION_LABELS: Record<string, string> = {
  TESTING: 'Start Testing',
  PAPER: 'Promote to Paper',
  SHADOW: 'Promote to Shadow',
  CONTROLLED_LIVE: 'Go Live (Controlled)',
  PAUSED: 'Pause',
  DISABLED: 'Disable',
};

const TRANSITION_STYLES: Record<string, string> = {
  TESTING: 'bg-green-600 hover:bg-green-700 text-white',
  PAPER: 'bg-green-600 hover:bg-green-700 text-white',
  SHADOW: 'bg-green-600 hover:bg-green-700 text-white',
  CONTROLLED_LIVE: 'bg-green-600 hover:bg-green-700 text-white',
  PAUSED: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  DISABLED: 'bg-red-600 hover:bg-red-700 text-white',
};

export function LifecycleControls({ agent, onStatusChange }: LifecycleControlsProps) {
  const [pendingStatus, setPendingStatus] = useState<AgentStatus | null>(null);
  const [reason, setReason] = useState('');

  const validTransitions = VALID_TRANSITIONS[agent.status] || [];

  const handleTransitionClick = (status: AgentStatus) => {
    setPendingStatus(status);
    setReason('');
  };

  const handleConfirm = () => {
    if (!pendingStatus || !reason.trim()) return;
    onStatusChange(agent.id, pendingStatus, reason.trim());
    setPendingStatus(null);
    setReason('');
  };

  const handleCancel = () => {
    setPendingStatus(null);
    setReason('');
  };

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">Lifecycle</h3>

      {/* Current Status */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Current:</span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[agent.status]}`}
        >
          {agent.status.replace('_', ' ')}
        </span>
      </div>

      {/* Transition Buttons */}
      {validTransitions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No transitions available (terminal state)
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {validTransitions.map((status) => (
            <button
              key={status}
              onClick={() => handleTransitionClick(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                TRANSITION_STYLES[status] || 'bg-muted hover:bg-muted/80'
              }`}
            >
              {TRANSITION_LABELS[status] || status}
            </button>
          ))}
        </div>
      )}

      {/* Reason Modal */}
      {pendingStatus && (
        <div className="mt-4 rounded-lg border bg-muted/50 p-3">
          <p className="mb-2 text-xs font-medium">
            Transition to{' '}
            <span className="font-bold">{pendingStatus.replace('_', ' ')}</span>
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for transition..."
            className="mb-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={!reason.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={handleCancel}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

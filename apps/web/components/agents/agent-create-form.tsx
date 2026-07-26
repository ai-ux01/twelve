/**
 * AgentCreateForm Component
 *
 * Form to create a new agent with name, type dropdown (8 values),
 * and config textarea (JSON). Submits POST /api/agents.
 *
 * Requirements: 11.3
 */

'use client';

import { useState } from 'react';
import type { AgentType, CreateAgentRequest } from './types';
import { AGENT_TYPES, AGENT_TYPE_LABELS } from './types';

export interface AgentCreateFormProps {
  onSubmit: (request: CreateAgentRequest) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

export function AgentCreateForm({ onSubmit, isSubmitting, error }: AgentCreateFormProps) {
  const [name, setName] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('SWING');
  const [configText, setConfigText] = useState('{}');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText);
    } catch {
      setValidationError('Config must be valid JSON');
      return;
    }

    await onSubmit({
      name: name.trim(),
      agent_type: agentType,
      config,
    });

    // Reset form on success
    setName('');
    setConfigText('{}');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Create Agent
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Create New Agent</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="agent-name" className="block text-xs font-medium mb-1">
            Name
          </label>
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Trading Agent"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            maxLength={100}
            required
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="agent-type" className="block text-xs font-medium mb-1">
            Type
          </label>
          <select
            id="agent-type"
            value={agentType}
            onChange={(e) => setAgentType(e.target.value as AgentType)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {AGENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {AGENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Config */}
        <div>
          <label htmlFor="agent-config" className="block text-xs font-medium mb-1">
            Configuration (JSON)
          </label>
          <textarea
            id="agent-config"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder='{"key": "value"}'
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            rows={4}
          />
        </div>

        {/* Errors */}
        {(validationError || error) && (
          <p className="text-xs text-red-600">{validationError || error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Agent'}
        </button>
      </form>
    </div>
  );
}

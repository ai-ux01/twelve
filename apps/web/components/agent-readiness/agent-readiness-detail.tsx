/**
 * Agent Readiness Detail Component
 *
 * Combined view composing Health, Stage, Validation, and Metrics components.
 * Includes "Advance Stage" button with gate checklist.
 *
 * Requirements: 10.1-10.4
 */

'use client';

import { useState } from 'react';
import type { AgentReadiness } from './types';
import { ReadinessStage, STAGE_ORDER, STAGE_LABELS } from './types';
import { HealthIndicators } from './health-indicators';
import { StageProgression } from './stage-progression';
import { ValidationStatus } from './validation-status';
import { PerformanceMetrics } from './performance-metrics';
import { useAdvanceStage } from './use-agent-readiness';

interface AgentReadinessDetailProps {
  readiness: AgentReadiness;
  onAdvanced: () => void;
}

export function AgentReadinessDetail({ readiness, onAdvanced }: AgentReadinessDetailProps) {
  const { advance, isAdvancing } = useAdvanceStage(readiness.agent_id);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [unmetCriteria, setUnmetCriteria] = useState<string[]>([]);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [reason, setReason] = useState('');

  const currentIndex = STAGE_ORDER.indexOf(readiness.current_stage);
  const nextStage = currentIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIndex + 1] : null;
  const isAtControlledLive = readiness.current_stage === ReadinessStage.CONTROLLED_LIVE;
  const canAdvance = nextStage !== null && nextStage !== ReadinessStage.AUTONOMOUS;

  const handleAdvance = async () => {
    if (!reason.trim()) return;
    setAdvanceError(null);
    setUnmetCriteria([]);

    const result = await advance(reason.trim());
    if (result.success) {
      setShowAdvanceForm(false);
      setReason('');
      onAdvanced();
    } else {
      setAdvanceError(result.error || 'Advance failed');
      setUnmetCriteria(result.unmetCriteria || []);
    }
  };

  return (
    <div className="space-y-6">
      <HealthIndicators health={readiness.health} />
      <StageProgression currentStage={readiness.current_stage} />
      <ValidationStatus
        validations={readiness.validations}
        metrics={readiness.metrics}
        calibration={readiness.calibration}
      />
      <PerformanceMetrics metrics={readiness.metrics} calibration={readiness.calibration} />

      {/* Advance Stage Section */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Stage Advancement
          </h2>
          {canAdvance && nextStage && (
            <span className="text-xs text-muted-foreground">
              Next: {STAGE_LABELS[nextStage]}
            </span>
          )}
        </div>

        {isAtControlledLive && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            <span>🔒</span>
            <span>AUTONOMOUS stage is disabled in V1. This agent is at its maximum reachable stage.</span>
          </div>
        )}

        {canAdvance && !showAdvanceForm && (
          <button
            onClick={() => setShowAdvanceForm(true)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Advance to {nextStage ? STAGE_LABELS[nextStage] : ''}
          </button>
        )}

        {showAdvanceForm && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Reason for advancement..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdvance}
                disabled={isAdvancing || !reason.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isAdvancing ? 'Advancing...' : 'Confirm Advance'}
              </button>
              <button
                onClick={() => {
                  setShowAdvanceForm(false);
                  setAdvanceError(null);
                  setUnmetCriteria([]);
                }}
                className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {advanceError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            <p className="font-medium">{advanceError}</p>
            {unmetCriteria.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {unmetCriteria.map((criteria) => (
                  <li key={criteria} className="flex items-center gap-1">
                    <span className="text-red-500">✗</span>
                    <span>{criteria}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

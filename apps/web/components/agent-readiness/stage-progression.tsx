/**
 * Stage Progression Component
 *
 * Horizontal 9-step timeline showing readiness stages.
 * Green = completed, Blue = current, Gray = future, Red/locked = AUTONOMOUS.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 6.3, 7.3
 */

'use client';

import { ReadinessStage, STAGE_ORDER, STAGE_LABELS } from './types';

interface StageProgressionProps {
  currentStage: ReadinessStage;
}

export function StageProgression({ currentStage }: StageProgressionProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const showNotValidated =
    currentStage === ReadinessStage.DRAFT || currentStage === ReadinessStage.KNOWLEDGE_READY;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Stage Progression
        </h2>
        {showNotValidated && (
          <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full border border-orange-300">
            Not Validated
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STAGE_ORDER.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isAutonomous = stage === ReadinessStage.AUTONOMOUS;

          let stageClasses = '';
          let dotClasses = '';

          if (isAutonomous) {
            stageClasses = 'bg-red-50 border-red-300 text-red-600';
            dotClasses = 'bg-red-400';
          } else if (isCompleted) {
            stageClasses = 'bg-green-50 border-green-300 text-green-700';
            dotClasses = 'bg-green-500';
          } else if (isCurrent) {
            stageClasses = 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-200';
            dotClasses = 'bg-blue-500 animate-pulse';
          } else {
            stageClasses = 'bg-gray-50 border-gray-200 text-gray-500';
            dotClasses = 'bg-gray-300';
          }

          return (
            <div key={stage} className="flex items-center">
              <div
                className={`flex flex-col items-center px-2 py-2 rounded-lg border min-w-[90px] ${stageClasses}`}
                title={isAutonomous ? 'Disabled in V1' : STAGE_LABELS[stage]}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className={`w-2 h-2 rounded-full ${dotClasses}`} />
                  {isCompleted && <span className="text-green-600 text-xs">✓</span>}
                  {isAutonomous && <span className="text-red-500 text-xs">🔒</span>}
                </div>
                <span className="text-[10px] font-medium text-center leading-tight">
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {index < STAGE_ORDER.length - 1 && (
                <div
                  className={`w-4 h-0.5 ${
                    index < currentIndex ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

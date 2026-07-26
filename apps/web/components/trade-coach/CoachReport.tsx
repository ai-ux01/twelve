/**
 * CoachReport Component
 *
 * Displays the AI coaching report with sections for strengths,
 * weaknesses, setups, conditions, mistakes, and recommendations.
 *
 * Phase 15 - AI Trade Coach
 */

'use client';

import type { CoachReportData } from './types';

export interface CoachReportProps {
  report: CoachReportData | null;
  isLoading: boolean;
  totalTrades: number;
  generatedAt: string | null;
}

export function CoachReport({ report, isLoading, totalTrades, generatedAt }: CoachReportProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">AI Coaching Report</h2>
        <div className="text-sm text-muted-foreground">
          {totalTrades > 0 && <span>{totalTrades} trades analyzed</span>}
          {generatedAt && (
            <span className="ml-2">
              • {new Date(generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        {report.strengths.length > 0 && (
          <ReportSection
            title="Strengths"
            items={report.strengths}
            icon="💪"
            colorClass="border-l-green-500"
          />
        )}

        {/* Weaknesses */}
        {report.weaknesses.length > 0 && (
          <ReportSection
            title="Weaknesses"
            items={report.weaknesses}
            icon="⚠️"
            colorClass="border-l-red-500"
          />
        )}

        {/* Best Setups */}
        {report.best_setups.length > 0 && (
          <ReportSection
            title="Best Setups"
            items={report.best_setups}
            icon="🎯"
            colorClass="border-l-blue-500"
          />
        )}

        {/* Worst Setups */}
        {report.worst_setups.length > 0 && (
          <ReportSection
            title="Worst Setups"
            items={report.worst_setups}
            icon="📉"
            colorClass="border-l-orange-500"
          />
        )}

        {/* Best Market Conditions */}
        {report.best_conditions.length > 0 && (
          <ReportSection
            title="Best Conditions"
            items={report.best_conditions}
            icon="🌤️"
            colorClass="border-l-cyan-500"
          />
        )}

        {/* Common Mistakes */}
        {report.common_mistakes.length > 0 && (
          <ReportSection
            title="Common Mistakes"
            items={report.common_mistakes}
            icon="🚫"
            colorClass="border-l-yellow-500"
          />
        )}
      </div>

      {/* Recommendations - Full Width */}
      {report.recommendations.length > 0 && (
        <div className="mt-6">
          <ReportSection
            title="Recommendations"
            items={report.recommendations}
            icon="💡"
            colorClass="border-l-purple-500"
          />
        </div>
      )}
    </div>
  );
}

interface ReportSectionProps {
  title: string;
  items: string[];
  icon: string;
  colorClass: string;
}

function ReportSection({ title, items, icon, colorClass }: ReportSectionProps) {
  return (
    <div className={`border-l-4 ${colorClass} pl-4 py-2`}>
      <h3 className="text-sm font-semibold mb-2">
        {icon} {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

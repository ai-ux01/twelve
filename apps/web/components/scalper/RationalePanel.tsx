'use client';

/**
 * RationalePanel Component
 *
 * Displays the AI-generated analysis rationale explaining the signal decision:
 * - Section labeled "Analysis Rationale"
 * - Rationale text (100-300 words from AI)
 * - "Rationale generation failed" error if rationale is missing
 *
 * Requirements covered: 17.1-17.12
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export interface RationalePanelProps {
  /** AI-generated rationale text (100-300 words) */
  rationale: string | null | undefined;
}

export function RationalePanel({ rationale }: RationalePanelProps) {
  const hasRationale = typeof rationale === 'string' && rationale.trim().length > 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Analysis Rationale</h3>
      </CardHeader>

      <CardContent>
        {hasRationale ? (
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {rationale}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Rationale generation failed</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

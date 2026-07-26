/**
 * Trade Coach Page
 *
 * Main page for the AI Trade Coach feature.
 * Displays an "Analyze My Trading" button, coaching report,
 * detected behavior patterns, and source comparison.
 *
 * Phase 15 - AI Trade Coach
 */

'use client';

import { useState } from 'react';
import { CoachReport } from '@/components/trade-coach/CoachReport';
import { BehaviorList } from '@/components/trade-coach/BehaviorList';
import { SourceComparison } from '@/components/trade-coach/SourceComparison';
import type {
  CoachResponse,
  BehaviorsResponse,
  SourceComparisonResponse,
} from '@/components/trade-coach/types';

const QUANT_API = process.env.NEXT_PUBLIC_QUANT_URL || 'http://localhost:8000';

export default function TradeCoachPage() {
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [behaviorsResponse, setBehaviorsResponse] = useState<BehaviorsResponse | null>(null);
  const [comparisonResponse, setComparisonResponse] = useState<SourceComparisonResponse | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingBehaviors, setIsLoadingBehaviors] = useState(false);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setIsLoadingBehaviors(true);
    setIsLoadingComparison(true);
    setError(null);

    try {
      // Run all three requests in parallel
      const [coachRes, behaviorsRes, comparisonRes] = await Promise.allSettled([
        fetch(`${QUANT_API}/api/trade-coach/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: 'default' }),
        }),
        fetch(`${QUANT_API}/api/trade-coach/behaviors?user_id=default`),
        fetch(`${QUANT_API}/api/trade-coach/compare?user_id=default`),
      ]);

      // Process coaching report
      if (coachRes.status === 'fulfilled' && coachRes.value.ok) {
        const data: CoachResponse = await coachRes.value.json();
        setCoachResponse(data);
      } else {
        const errMsg =
          coachRes.status === 'rejected'
            ? coachRes.reason?.message
            : `HTTP ${coachRes.value.status}`;
        setError(`Analysis failed: ${errMsg}`);
      }

      // Process behaviors
      if (behaviorsRes.status === 'fulfilled' && behaviorsRes.value.ok) {
        const data: BehaviorsResponse = await behaviorsRes.value.json();
        setBehaviorsResponse(data);
      }

      // Process comparison
      if (comparisonRes.status === 'fulfilled' && comparisonRes.value.ok) {
        const data: SourceComparisonResponse = await comparisonRes.value.json();
        setComparisonResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAnalyzing(false);
      setIsLoadingBehaviors(false);
      setIsLoadingComparison(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold">AI Trade Coach</h1>
        <p className="text-sm text-muted-foreground">
          Get personalized coaching based on your actual trading data
        </p>
      </header>

      {/* Analyze Button */}
      <section className="mb-6">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze My Trading'}
        </button>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </section>

      {/* Coaching Report */}
      <section className="mb-6">
        <CoachReport
          report={coachResponse?.report || null}
          isLoading={isAnalyzing}
          totalTrades={coachResponse?.total_trades_analyzed || 0}
          generatedAt={coachResponse?.generated_at || null}
        />
      </section>

      {/* Behaviors + Source Comparison side by side */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BehaviorList
          behaviors={
            behaviorsResponse?.behaviors || coachResponse?.behaviors || []
          }
          isLoading={isLoadingBehaviors && !behaviorsResponse}
        />
        <SourceComparison
          comparison={comparisonResponse}
          isLoading={isLoadingComparison && !comparisonResponse}
        />
      </section>
    </div>
  );
}

/**
 * Trade Analysis Page
 *
 * Main page for the Trade Analysis Engine. Displays:
 * - Header with title
 * - Import section (CSV Upload + Manual Entry)
 * - Performance Metrics panel
 * - Grouped Breakdown (Dimension Selector + Table)
 * - AI Analysis chat
 *
 * Requirements: 8.1
 */

'use client';

import { useState } from 'react';
import { CSVUpload } from '@/components/trade-analysis/csv-upload';
import { ManualTradeForm } from '@/components/trade-analysis/manual-trade-form';
import { PerformanceMetricsDisplay } from '@/components/trade-analysis/performance-metrics';
import { DimensionSelector } from '@/components/trade-analysis/dimension-selector';
import { GroupedMetricsTable } from '@/components/trade-analysis/grouped-metrics-table';
import { AIAnalysis } from '@/components/trade-analysis/ai-analysis';
import { useTradeAnalysis } from '@/components/trade-analysis/use-trade-analysis';
import type { GroupingDimension } from '@/components/trade-analysis/types';

export default function TradeAnalysisPage() {
  const [selectedDimension, setSelectedDimension] = useState<GroupingDimension>('strategy');

  const {
    metrics,
    groupedMetrics,
    importResult,
    aiResponse,
    isLoadingMetrics,
    isLoadingGrouped,
    isImporting,
    isCreatingTrade,
    isAnalyzing,
    errorMetrics,
    errorGrouped,
    errorImport,
    errorCreate,
    errorAI,
    importCSV,
    createTrade,
    getGroupedMetrics,
    analyzeWithAI,
    refreshMetrics,
  } = useTradeAnalysis();

  const handleDimensionChange = (dimension: GroupingDimension) => {
    setSelectedDimension(dimension);
    getGroupedMetrics(dimension);
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Trade Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Import, analyze, and get AI insights on your trading performance
        </p>
      </header>

      {/* Import Section */}
      <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CSVUpload
          onUpload={importCSV}
          isLoading={isImporting}
          error={errorImport}
          result={importResult}
        />
        <ManualTradeForm
          onSubmit={createTrade}
          isLoading={isCreatingTrade}
          error={errorCreate}
          onSuccess={refreshMetrics}
        />
      </section>

      {/* Performance Metrics */}
      <section className="mb-6">
        <PerformanceMetricsDisplay
          metrics={metrics}
          isLoading={isLoadingMetrics}
          error={errorMetrics}
        />
      </section>

      {/* Grouped Breakdown */}
      <section className="mb-6">
        <DimensionSelector
          selected={selectedDimension}
          onChange={handleDimensionChange}
        />
        <GroupedMetricsTable
          groups={groupedMetrics}
          dimension={selectedDimension}
          isLoading={isLoadingGrouped}
          error={errorGrouped}
        />
      </section>

      {/* AI Analysis */}
      <section>
        <AIAnalysis
          onAnalyze={analyzeWithAI}
          response={aiResponse}
          isLoading={isAnalyzing}
          error={errorAI}
        />
      </section>
    </div>
  );
}

/**
 * Prompt Library Page
 *
 * Main page for managing AI trading prompts. Fetches prompt list from API,
 * renders category filter tabs and prompt grid, with detail view for
 * version history, performance metrics, comparison, and testing.
 *
 * Requirements: 11.1
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  CategoryFilter,
  PromptList,
  PromptEditor,
  VersionHistory,
  PerformancePanel,
  CompareView,
  TestRunner,
} from '@/components/prompt-library';
import type {
  PromptCategory,
  PromptResponse,
  PromptDetailResponse,
  PerformanceMetrics,
  PromptVersion,
  TestResult,
  CompareVersionsResponse,
} from '@/components/prompt-library';

const API_BASE = 'http://localhost:8000/api/prompts';

export default function PromptsPage() {
  // List state
  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<PromptCategory | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail state
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDetailResponse | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionMetrics, setVersionMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Compare state
  const [compareData, setCompareData] = useState<{
    versionA: PromptVersion | null;
    versionB: PromptVersion | null;
    metricsA: PerformanceMetrics | null;
    metricsB: PerformanceMetrics | null;
    contentDiff: string | null;
  } | null>(null);

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const url = `${API_BASE}${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.status}`);
      const data = await res.json();
      setPrompts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Fetch prompt detail
  const fetchPromptDetail = async (promptId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${promptId}`);
      if (!res.ok) throw new Error('Failed to fetch prompt details');
      const data: PromptDetailResponse = await res.json();
      setSelectedPrompt(data);
      const latestVersion = data.versions[data.versions.length - 1]?.version ?? null;
      setSelectedVersion(latestVersion);
      setCompareData(null);
    } catch {
      // silently fail — user can retry
    }
  };

  // Fetch metrics for a version
  useEffect(() => {
    if (!selectedPrompt || selectedVersion === null) {
      setVersionMetrics(null);
      return;
    }

    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const res = await fetch(
          `${API_BASE}/${selectedPrompt.id}/versions/${selectedVersion}/metrics`
        );
        if (res.ok) {
          const data = await res.json();
          setVersionMetrics(data);
        } else {
          setVersionMetrics(null);
        }
      } catch {
        setVersionMetrics(null);
      } finally {
        setIsLoadingMetrics(false);
      }
    };
    loadMetrics();
  }, [selectedPrompt, selectedVersion]);

  // Create or edit prompt
  const handleSubmit = async (data: { name: string; category: PromptCategory; content: string }) => {
    setIsSubmitting(true);
    try {
      const isEditing = editingPrompt !== null;
      const url = isEditing ? `${API_BASE}/${editingPrompt.id}` : API_BASE;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save prompt');

      setEditorOpen(false);
      setEditingPrompt(null);
      fetchPrompts();
    } catch {
      // error handling could be added here
    } finally {
      setIsSubmitting(false);
    }
  };

  // Duplicate prompt
  const handleDuplicate = async (promptId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${promptId}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to duplicate');
      fetchPrompts();
    } catch {
      // silently fail
    }
  };

  // Archive prompt
  const handleArchive = async (promptId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${promptId}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to archive');
      fetchPrompts();
      if (selectedPrompt?.id === promptId) {
        setSelectedPrompt(null);
      }
    } catch {
      // silently fail
    }
  };

  // Compare versions
  const handleCompare = async (versionA: number, versionB: number) => {
    if (!selectedPrompt) return;

    try {
      const res = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_ids: [
            { prompt_id: selectedPrompt.id, version: versionA },
            { prompt_id: selectedPrompt.id, version: versionB },
          ],
        }),
      });

      if (!res.ok) throw new Error('Failed to compare');
      const data: CompareVersionsResponse = await res.json();

      setCompareData({
        versionA: data.versions[0] || null,
        versionB: data.versions[1] || null,
        metricsA: data.metrics[0] || null,
        metricsB: data.metrics[1] || null,
        contentDiff: data.content_diffs[0] || null,
      });
    } catch {
      // silently fail
    }
  };

  // Test prompt
  const handleTest = async (
    promptId: string,
    version: number,
    inputText: string
  ): Promise<TestResult> => {
    const res = await fetch(`${API_BASE}/${promptId}/versions/${version}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_text: inputText }),
    });

    if (!res.ok) throw new Error('Test execution failed');
    return res.json();
  };

  // Open editor for edit
  const handleEdit = (prompt: PromptResponse) => {
    setEditingPrompt(prompt);
    setEditorOpen(true);
  };

  // Open editor for test (select prompt detail)
  const handleTestPrompt = (prompt: PromptResponse) => {
    fetchPromptDetail(prompt.id);
  };

  // Select prompt to view detail
  const handleSelectPrompt = (prompt: PromptResponse) => {
    fetchPromptDetail(prompt.id);
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Prompt Library</h1>
          <p className="text-sm text-muted-foreground">
            Manage AI trading prompts with version control and performance tracking
          </p>
        </div>
        <Button onClick={() => { setEditingPrompt(null); setEditorOpen(true); }}>
          Create Prompt
        </Button>
      </header>

      {/* Category Filter */}
      <div className="mb-6">
        <CategoryFilter selected={categoryFilter} onSelect={setCategoryFilter} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompt Grid */}
        <div className={selectedPrompt ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <PromptList
            prompts={prompts}
            isLoading={isLoading}
            error={error}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onArchive={handleArchive}
            onTest={handleTestPrompt}
            onSelect={handleSelectPrompt}
          />
        </div>

        {/* Detail Panel */}
        {selectedPrompt && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selectedPrompt.name}</h2>
              <button
                onClick={() => { setSelectedPrompt(null); setCompareData(null); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            {/* Version History */}
            <VersionHistory
              versions={selectedPrompt.versions}
              onCompare={handleCompare}
              onSelectVersion={setSelectedVersion}
              selectedVersion={selectedVersion}
            />

            {/* Performance Panel */}
            <PerformancePanel
              metrics={versionMetrics}
              isLoading={isLoadingMetrics}
            />

            {/* Compare View */}
            {compareData && (
              <CompareView
                versionA={compareData.versionA}
                versionB={compareData.versionB}
                metricsA={compareData.metricsA}
                metricsB={compareData.metricsB}
                contentDiff={compareData.contentDiff}
                onClose={() => setCompareData(null)}
              />
            )}

            {/* Test Runner */}
            {selectedVersion !== null && (
              <TestRunner
                promptId={selectedPrompt.id}
                version={selectedVersion}
                onTest={handleTest}
              />
            )}
          </div>
        )}
      </div>

      {/* Prompt Editor Modal */}
      <PromptEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        prompt={editingPrompt}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

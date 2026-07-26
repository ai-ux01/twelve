/**
 * AIAnalysis Component - Trade Analysis
 *
 * Provides a text input for submitting AI analysis prompts and displays
 * the AI response with formatted statistics. Handles loading and error states.
 *
 * Requirements: 8.7, 8.8
 */

'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AIAnalysisResponse } from './types';

export interface AIAnalysisProps {
  onAnalyze: (prompt: string) => Promise<void>;
  response: AIAnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function AIAnalysis({ onAnalyze, response, isLoading, error }: AIAnalysisProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    await onAnalyze(trimmed);
  }, [prompt, isLoading, onAnalyze]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input area */}
        <div className="flex items-center gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Analyze my trades and tell me what I'm doing wrong"
            disabled={isLoading}
            className="flex-1"
            aria-label="AI analysis prompt"
          />
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Analyzing your trades...</span>
            </div>
          </div>
        )}

        {/* AI Response */}
        {response && !isLoading && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {response.analysis}
              </div>
            </div>
            {response.data_source && response.data_source !== 'error' && (
              <p className="mt-3 text-xs text-muted-foreground">
                Based on: {response.data_source}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

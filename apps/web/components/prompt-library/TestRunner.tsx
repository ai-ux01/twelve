/**
 * TestRunner - Test prompt execution interface
 *
 * Input textarea for test input, execute button calls POST test endpoint,
 * and displays the output result.
 *
 * Requirements: 11.2
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TestResult } from './types';

export interface TestRunnerProps {
  promptId: string;
  version: number;
  onTest: (promptId: string, version: number, inputText: string) => Promise<TestResult>;
}

export function TestRunner({ promptId, version, onTest }: TestRunnerProps) {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!inputText.trim()) return;
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const testResult = await onTest(promptId, version, inputText.trim());
      setResult(testResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Test Runner (v{version})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="test-input" className="text-xs font-medium text-muted-foreground">
            Test Input
          </label>
          <textarea
            id="test-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter test input..."
            rows={4}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          />
        </div>

        <Button
          size="sm"
          onClick={handleExecute}
          disabled={isRunning || !inputText.trim()}
        >
          {isRunning ? 'Running...' : 'Execute'}
        </Button>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Output</label>
            <pre className="rounded-md bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
              {result.output_text}
            </pre>
            <p className="text-xs text-muted-foreground">
              Executed at: {new Date(result.executed_at).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

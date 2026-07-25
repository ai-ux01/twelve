/**
 * PromptInput Component
 *
 * Natural language input component for submitting trading prompts.
 * Displays parsing feedback showing extracted symbols, timeframe, and asset type.
 *
 * Requirements: 13.1, 13.2
 * Task: 18.1
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, type PromptResponse } from '@/lib/api-client';
import { Loader2, Send, AlertCircle } from 'lucide-react';

interface PromptInputProps {
  onSubmit?: (response: PromptResponse) => void;
  className?: string;
}

export function PromptInput({ onSubmit, className }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<PromptResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.submitPrompt(prompt);
      setLastResponse(response);

      // Call the optional callback
      if (onSubmit) {
        onSubmit(response);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit prompt';
      setError(errorMessage);
      setLastResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={className}>
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter your trading prompt (e.g., 'Find the best swing trade in RELIANCE')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !prompt.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Parsing Feedback */}
      {lastResponse && (
        <Card className="mt-4 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Prompt Analysis</h3>
            <Badge variant="outline" className="text-xs">
              Parsed Successfully
            </Badge>
          </div>

          <div className="space-y-2">
            {/* Intent */}
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium text-gray-500 min-w-[80px]">Intent:</span>
              <Badge variant="secondary" className="text-xs">
                {lastResponse.parsed.intent.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Symbols */}
            {lastResponse.parsed.symbols.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 min-w-[80px]">Symbols:</span>
                <div className="flex flex-wrap gap-1">
                  {lastResponse.parsed.symbols.map((symbol, index) => (
                    <Badge key={index} variant="default" className="text-xs">
                      {symbol}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Timeframe */}
            {lastResponse.parsed.timeframe && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 min-w-[80px]">Timeframe:</span>
                <Badge variant="secondary" className="text-xs">
                  {lastResponse.parsed.timeframe}
                </Badge>
              </div>
            )}

            {/* Asset Type */}
            {lastResponse.parsed.assetType && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-500 min-w-[80px]">Asset Type:</span>
                <Badge variant="secondary" className="text-xs">
                  {lastResponse.parsed.assetType.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}

            {/* Raw Prompt */}
            <div className="pt-2 border-t">
              <span className="text-xs font-medium text-gray-500">Original Prompt:</span>
              <p className="text-xs text-gray-600 mt-1 italic">
                &quot;{lastResponse.rawPrompt}&quot;
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

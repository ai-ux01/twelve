/**
 * SSE Streaming Hook for AI Trading Lab
 *
 * Custom hook that uses fetch with ReadableStream to consume SSE events
 * from POST /api/ai-trading/prompt. Supports AbortController for cancellation.
 *
 * Requirements: 9.4, 6.8
 */

'use client';

import { useCallback, useRef } from 'react';
import type {
  ChatMessage,
  PromptRequestBody,
  RecommendationData,
  SSEChunkEvent,
  SSEErrorEvent,
  SSERecommendationEvent,
  SSEStatusEvent,
} from './types';

const QUANT_ENGINE_URL = 'http://localhost:8000';

interface UseSSEStreamOptions {
  onStatusUpdate?: (status: SSEStatusEvent) => void;
  onChunk?: (messageId: string, text: string) => void;
  onRecommendation?: (messageId: string, data: RecommendationData) => void;
  onError?: (messageId: string, error: { message: string; detail?: string }) => void;
  onDone?: (messageId: string) => void;
  onConnectionLost?: (messageId: string) => void;
}

export function useSSEStream(options: UseSSEStreamOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const submitPrompt = useCallback(
    async (body: PromptRequestBody): Promise<string> => {
      // Create new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const messageId = crypto.randomUUID();

      try {
        const response = await fetch(`${QUANT_ENGINE_URL}/api/ai-trading/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          options.onError?.(messageId, {
            message: `Request failed with status ${response.status}`,
          });
          return messageId;
        }

        if (!response.body) {
          options.onError?.(messageId, { message: 'No response body received' });
          return messageId;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffer
            if (buffer.trim()) {
              processSSEBuffer(buffer, messageId, options);
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (double newline separated)
          const events = buffer.split('\n\n');
          // Keep the last chunk (may be incomplete)
          buffer = events.pop() || '';

          for (const eventStr of events) {
            if (eventStr.trim()) {
              processSSEEvent(eventStr, messageId, options);
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled — not an error
          return messageId;
        }
        // Connection lost
        options.onConnectionLost?.(messageId);
      } finally {
        abortControllerRef.current = null;
      }

      return messageId;
    },
    [options]
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const getAbortController = useCallback(() => abortControllerRef.current, []);

  return { submitPrompt, abort, getAbortController };
}

function processSSEBuffer(buffer: string, messageId: string, options: UseSSEStreamOptions) {
  const events = buffer.split('\n\n');
  for (const eventStr of events) {
    if (eventStr.trim()) {
      processSSEEvent(eventStr, messageId, options);
    }
  }
}

function processSSEEvent(eventStr: string, messageId: string, options: UseSSEStreamOptions) {
  const lines = eventStr.split('\n');
  let eventType = '';
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    }
  }

  if (!eventType || !dataStr) return;

  try {
    const data = JSON.parse(dataStr);

    switch (eventType) {
      case 'status':
        options.onStatusUpdate?.(data as SSEStatusEvent);
        break;

      case 'chunk':
        options.onChunk?.(messageId, (data as SSEChunkEvent).text);
        break;

      case 'recommendation': {
        const rec = data as SSERecommendationEvent;
        const recommendationData: RecommendationData = {
          decisionId: rec.decision_id,
          signal: rec.signal,
          probability: rec.probability,
          riskRewardRatio: rec.risk_reward_ratio,
          entryPrice: rec.entry_price,
          stopLoss: rec.stop_loss,
          targetPrice: rec.target_price,
          positionSize: rec.position_size,
          rationale: rec.rationale,
          isLowConfidence: rec.is_low_confidence,
          isHighRisk: rec.is_high_risk,
          warnings: rec.warnings,
          marketDataTimestamp: rec.market_data_timestamp,
        };
        options.onRecommendation?.(messageId, recommendationData);
        break;
      }

      case 'error': {
        const err = data as SSEErrorEvent;
        options.onError?.(messageId, { message: err.message, detail: err.detail });
        break;
      }

      case 'done':
        options.onDone?.(messageId);
        break;
    }
  } catch {
    // Invalid JSON in SSE data — ignore
  }
}

'use client';

/**
 * AI Trading Lab Page
 *
 * Conversational AI trading assistant with SSE streaming,
 * response mode selection, action buttons, and error handling.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.1, 8.2, 8.3, 8.4
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bot } from 'lucide-react';
import { ChatInput } from '@/components/trading-lab/chat-input';
import { MessageList } from '@/components/trading-lab/message-list';
import { ResponseModeSelector } from '@/components/trading-lab/response-mode-selector';
import { ConnectionLostBanner, PaperTradeError } from '@/components/trading-lab/error-display';
import { useSSEStream } from '@/components/trading-lab/use-sse-stream';
import type {
  ChatMessage,
  ResponseMode,
  ActionType,
  RecommendationData,
  ActionResponseBody,
} from '@/components/trading-lab/types';

const QUANT_ENGINE_URL = 'http://localhost:8000';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  const stored = sessionStorage.getItem('ai-trading-session-id');
  if (stored) return stored;
  const newId = crypto.randomUUID();
  sessionStorage.setItem('ai-trading-session-id', newId);
  return newId;
}

export default function AITradingPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>('QUICK');
  const [sessionId, setSessionId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [connectionLost, setConnectionLost] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [paperTradeError, setPaperTradeError] = useState<string | null>(null);

  const currentMessageIdRef = useRef<string | null>(null);

  // Initialize session on mount
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // SSE stream callbacks
  const sseOptions = useMemo(
    () => ({
      onStatusUpdate: (status: { step: string; message: string }) => {
        setStatusMessage(status.message);
      },
      onChunk: (messageId: string, text: string) => {
        setStatusMessage(undefined);
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === messageId);
          if (existing) {
            return prev.map((m) =>
              m.id === messageId ? { ...m, content: m.content + text, isStreaming: true } : m
            );
          }
          // Create new assistant message
          const newMsg: ChatMessage = {
            id: messageId,
            role: 'assistant',
            content: text,
            timestamp: new Date(),
            isStreaming: true,
          };
          return [...prev, newMsg];
        });
      },
      onRecommendation: (messageId: string, data: RecommendationData) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, recommendation: data, isStreaming: false } : m
          )
        );
      },
      onError: (messageId: string, error: { message: string; detail?: string }) => {
        setStatusMessage(undefined);
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === messageId);
          if (existing) {
            return prev.map((m) =>
              m.id === messageId
                ? { ...m, error: { message: error.message, detail: error.detail }, isStreaming: false }
                : m
            );
          }
          const newMsg: ChatMessage = {
            id: messageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            error: { message: error.message, detail: error.detail },
            isStreaming: false,
          };
          return [...prev, newMsg];
        });
      },
      onDone: (messageId: string) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isStreaming: false } : m))
        );
        setIsLoading(false);
        setStatusMessage(undefined);
        currentMessageIdRef.current = null;
      },
      onConnectionLost: (messageId: string) => {
        setConnectionLost(true);
        setIsLoading(false);
        setStatusMessage(undefined);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isStreaming: false } : m))
        );
        currentMessageIdRef.current = null;
      },
    }),
    []
  );

  const { submitPrompt, abort } = useSSEStream(sseOptions);

  // Handle prompt submission
  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!sessionId) return;

      setIsLoading(true);
      setConnectionLost(false);
      setPaperTradeError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Submit to SSE endpoint
      const messageId = await submitPrompt({
        prompt,
        response_mode: responseMode,
        session_id: sessionId,
      });
      currentMessageIdRef.current = messageId;
    },
    [sessionId, responseMode, submitPrompt]
  );

  // Handle stop
  const handleStop = useCallback(() => {
    abort();
    setIsLoading(false);
    setStatusMessage(undefined);
    if (currentMessageIdRef.current) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === currentMessageIdRef.current ? { ...m, isStreaming: false } : m
        )
      );
    }
    currentMessageIdRef.current = null;
  }, [abort]);

  // Handle action buttons
  const handleAction = useCallback(
    async (action: ActionType, decisionId: string) => {
      if (!sessionId) return;

      // STOP action
      if (action === 'STOP') {
        handleStop();
        return;
      }

      // IGNORE action - dismiss
      if (action === 'IGNORE') {
        // Remove recommendation from the message to hide action buttons
        setMessages((prev) =>
          prev.map((m) =>
            m.recommendation?.decisionId === decisionId
              ? { ...m, recommendation: undefined }
              : m
          )
        );
        return;
      }

      // ANALYZE_MARKET - submit follow-up prompt
      if (action === 'ANALYZE_MARKET') {
        try {
          const response = await fetch(`${QUANT_ENGINE_URL}/api/ai-trading/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ANALYZE_MARKET',
              decision_id: decisionId,
              session_id: sessionId,
            }),
          });
          const data: ActionResponseBody = await response.json();
          if (data.success && data.data?.original_prompt) {
            handleSubmit(`Analyze market for: ${data.data.original_prompt}`);
          }
        } catch {
          // Silently fail - user can retry
        }
        return;
      }

      // BUY_ON_PAPER
      if (action === 'BUY_ON_PAPER') {
        setActionInProgress(decisionId);
        setPaperTradeError(null);
        try {
          const response = await fetch(`${QUANT_ENGINE_URL}/api/ai-trading/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'BUY_ON_PAPER',
              decision_id: decisionId,
              session_id: sessionId,
            }),
          });
          const data: ActionResponseBody = await response.json();
          if (data.success) {
            // Add success message
            const successMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'system',
              content: `✅ ${data.message}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, successMsg]);
          } else {
            setPaperTradeError(data.message);
          }
        } catch (err) {
          setPaperTradeError(
            err instanceof Error ? err.message : 'Failed to execute paper trade'
          );
        } finally {
          setActionInProgress(null);
        }
      }
    },
    [sessionId, handleStop, handleSubmit]
  );

  // Handle reconnection after connection lost
  const handleReconnect = useCallback(() => {
    setConnectionLost(false);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 lg:px-6">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">AI Trading Lab</h1>
        </div>
        <ResponseModeSelector
          selectedMode={responseMode}
          onModeChange={setResponseMode}
          disabled={isLoading}
        />
      </header>

      {/* Error Banners */}
      {connectionLost && (
        <ConnectionLostBanner onReconnect={handleReconnect} className="mx-4 mt-2" />
      )}
      {paperTradeError && (
        <PaperTradeError
          message={paperTradeError}
          onDismiss={() => setPaperTradeError(null)}
          className="mx-4 mt-2"
        />
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        statusMessage={statusMessage}
        onAction={handleAction}
        actionInProgress={actionInProgress}
      />

      {/* Chat Input */}
      <ChatInput
        onSubmit={handleSubmit}
        onStop={handleStop}
        isLoading={isLoading}
      />
    </div>
  );
}

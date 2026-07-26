/**
 * MessageList Component - AI Trading Lab
 *
 * Displays user and assistant messages in chronological order.
 * User messages aligned right, assistant messages aligned left.
 * Shows streaming indicator during generation. Auto-scrolls to latest.
 * Renders markdown in assistant responses.
 *
 * Requirements: 6.3
 */

'use client';

import { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from './types';
import { RecommendationCard } from './recommendation-card';
import { ActionButtons } from './action-buttons';
import type { ActionType } from './types';

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  statusMessage?: string;
  onAction?: (action: ActionType, decisionId: string) => void;
  actionInProgress?: string | null;
}

export function MessageList({
  messages,
  isLoading,
  statusMessage,
  onAction,
  actionInProgress,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, statusMessage]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Bot className="h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium">AI Trading Lab</h3>
          <p className="text-sm mt-2 max-w-md">
            Ask me about any stock or trading strategy. Try &quot;Should I buy RELIANCE for a swing
            trade?&quot; or &quot;Intraday levels for HDFC Bank&quot;.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'flex gap-3 max-w-[85%]',
            message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>

          {/* Message content */}
          <div
            className={cn(
              'flex flex-col gap-2',
              message.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'rounded-lg px-4 py-3 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block ml-1 animate-pulse">▊</span>
                  )}
                </div>
              ) : (
                <p>{message.content}</p>
              )}

              {/* Error display */}
              {message.error && (
                <div className="mt-2 text-destructive text-xs bg-destructive/10 rounded px-2 py-1">
                  {message.error.message}
                </div>
              )}
            </div>

            {/* Recommendation Card */}
            {message.recommendation && (
              <RecommendationCard recommendation={message.recommendation} />
            )}

            {/* Action Buttons */}
            {message.recommendation && onAction && (
              <ActionButtons
                decisionId={message.recommendation.decisionId}
                onAction={onAction}
                isLoading={actionInProgress === message.recommendation.decisionId}
              />
            )}

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      ))}

      {/* Streaming indicator */}
      {isLoading && (
        <div className="flex gap-3 mr-auto max-w-[85%]">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div className="rounded-lg px-4 py-3 bg-muted text-sm">
            {statusMessage ? (
              <p className="text-muted-foreground animate-pulse">{statusMessage}</p>
            ) : (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:300ms]" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

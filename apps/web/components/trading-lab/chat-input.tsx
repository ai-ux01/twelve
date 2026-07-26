/**
 * ChatInput Component - AI Trading Lab
 *
 * Text input for natural-language trading prompts with submit on Enter
 * or click Send button. Disables while loading/streaming.
 *
 * Requirements: 6.2
 */

'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ChatInputProps {
  onSubmit: (prompt: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSubmit, onStop, isLoading, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSubmit(trimmed);
    setValue('');
  }, [value, isLoading, disabled, onSubmit]);

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
    <div className="flex items-center gap-2 p-4 border-t bg-background">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me about trading..."
        disabled={isLoading || disabled}
        className="flex-1 min-h-[44px]"
        aria-label="Trading prompt input"
      />
      {isLoading ? (
        <Button
          onClick={onStop}
          variant="destructive"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          aria-label="Stop generation"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          aria-label="Send prompt"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

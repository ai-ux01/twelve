/**
 * PromptList - Responsive grid display of prompt cards
 *
 * Requirements: 11.1, 11.2
 */

'use client';

import type { PromptResponse } from './types';
import { PromptCard } from './PromptCard';

export interface PromptListProps {
  prompts: PromptResponse[];
  isLoading: boolean;
  error: string | null;
  onEdit: (prompt: PromptResponse) => void;
  onDuplicate: (promptId: string) => void;
  onArchive: (promptId: string) => void;
  onTest: (prompt: PromptResponse) => void;
  onSelect: (prompt: PromptResponse) => void;
}

export function PromptList({
  prompts,
  isLoading,
  error,
  onEdit,
  onDuplicate,
  onArchive,
  onTest,
  onSelect,
}: PromptListProps) {
  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading prompts...
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No prompts found. Create one to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
          onTest={onTest}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

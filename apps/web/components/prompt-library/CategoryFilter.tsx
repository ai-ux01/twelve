/**
 * CategoryFilter - Horizontal tab bar for filtering prompts by category
 *
 * Displays "All" + 13 category tabs. Clicking a category filters the prompt list.
 *
 * Requirements: 11.1
 */

'use client';

import { cn } from '@/lib/utils';
import { PROMPT_CATEGORIES, CATEGORY_LABELS, type PromptCategory } from './types';

export interface CategoryFilterProps {
  selected: PromptCategory | null;
  onSelect: (category: PromptCategory | null) => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          selected === null
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        All
      </button>
      {PROMPT_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            selected === cat
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
    </div>
  );
}

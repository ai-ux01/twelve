/**
 * PromptEditor - Modal/dialog for creating and editing prompts
 *
 * Name field, category dropdown, content textarea.
 * Submit calls POST /api/prompts or PUT /api/prompts/{id}.
 *
 * Requirements: 11.2
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PROMPT_CATEGORIES,
  CATEGORY_LABELS,
  type PromptCategory,
  type PromptResponse,
} from './types';

export interface PromptEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptResponse | null;
  onSubmit: (data: { name: string; category: PromptCategory; content: string }) => void;
  isSubmitting: boolean;
}

export function PromptEditor({
  open,
  onOpenChange,
  prompt,
  onSubmit,
  isSubmitting,
}: PromptEditorProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PromptCategory>('MASTER_AGENT');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setCategory(prompt.category);
      setContent(prompt.latest_content);
    } else {
      setName('');
      setCategory('MASTER_AGENT');
      setContent('');
    }
  }, [prompt, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    onSubmit({ name: name.trim(), category, content: content.trim() });
  };

  const isEditing = prompt !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Prompt' : 'Create Prompt'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="prompt-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="prompt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter prompt name"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="prompt-category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="prompt-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as PromptCategory)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PROMPT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="prompt-content" className="text-sm font-medium">
              Content
            </label>
            <textarea
              id="prompt-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter prompt content..."
              rows={10}
              required
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[200px]"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !name.trim() || !content.trim()}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Prompt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

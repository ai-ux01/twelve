/**
 * PromptCard - Individual prompt card with actions
 *
 * Shows name, category badge, latest version number, and action buttons
 * (edit, duplicate, archive, test).
 *
 * Requirements: 11.1, 11.2
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_LABELS, type PromptResponse } from './types';

export interface PromptCardProps {
  prompt: PromptResponse;
  onEdit: (prompt: PromptResponse) => void;
  onDuplicate: (promptId: string) => void;
  onArchive: (promptId: string) => void;
  onTest: (prompt: PromptResponse) => void;
  onSelect: (prompt: PromptResponse) => void;
}

export function PromptCard({
  prompt,
  onEdit,
  onDuplicate,
  onArchive,
  onTest,
  onSelect,
}: PromptCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onSelect(prompt)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
            {prompt.name}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            v{prompt.latest_version}
          </Badge>
        </div>
        <Badge variant="outline" className="w-fit text-xs">
          {CATEGORY_LABELS[prompt.category]}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {prompt.latest_content}
        </p>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => onEdit(prompt)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDuplicate(prompt.id)}>
            Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onArchive(prompt.id)}>
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onTest(prompt)}>
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

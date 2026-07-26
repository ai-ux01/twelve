/**
 * VersionHistory - Display version list for a selected prompt
 *
 * Shows version number, timestamp, content preview.
 * Allows selecting versions for comparison.
 *
 * Requirements: 11.3
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PromptVersion } from './types';

export interface VersionHistoryProps {
  versions: PromptVersion[];
  onCompare: (versionA: number, versionB: number) => void;
  onSelectVersion: (version: number) => void;
  selectedVersion: number | null;
}

export function VersionHistory({
  versions,
  onCompare,
  onSelectVersion,
  selectedVersion,
}: VersionHistoryProps) {
  const [compareSelection, setCompareSelection] = useState<number[]>([]);

  const toggleCompareSelection = (version: number) => {
    setCompareSelection((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const handleCompare = () => {
    if (compareSelection.length === 2) {
      onCompare(compareSelection[0], compareSelection[1]);
    }
  };

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No versions available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Version History</CardTitle>
          {compareSelection.length === 2 && (
            <Button size="sm" onClick={handleCompare}>
              Compare v{compareSelection[0]} vs v{compareSelection[1]}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...versions].reverse().map((version) => (
          <div
            key={version.version}
            className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
              selectedVersion === version.version
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelectVersion(version.version)}
          >
            <input
              type="checkbox"
              checked={compareSelection.includes(version.version)}
              onChange={(e) => {
                e.stopPropagation();
                toggleCompareSelection(version.version);
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 shrink-0"
              aria-label={`Select version ${version.version} for comparison`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">v{version.version}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(version.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {version.content}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

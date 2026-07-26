/**
 * CSVUpload Component - Trade Analysis
 *
 * File upload component supporting drag-and-drop or click to select CSV files.
 * Displays import results including trade count, errors, and unmatched entries.
 *
 * Requirements: 8.2
 */

'use client';

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CSVImportResponse } from './types';

export interface CSVUploadProps {
  onUpload: (file: File) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  result: CSVImportResponse | null;
}

export function CSVUpload({ onUpload, isLoading, error, result }: CSVUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        return;
      }
      await onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-uploaded
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Trades (CSV)</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          role="button"
          aria-label="Upload CSV file"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
          />
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Importing trades...</p>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">
                Drag and drop your CSV file here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse. Columns: date, symbol, action, quantity, price
              </p>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Import Results */}
        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={result.success ? 'default' : 'destructive'}>
                {result.trades_imported} trades imported
              </Badge>
              {result.errors.length > 0 && (
                <Badge variant="destructive">
                  {result.errors.length} errors
                </Badge>
              )}
              {result.unmatched.length > 0 && (
                <Badge variant="secondary">
                  {result.unmatched.length} unmatched
                </Badge>
              )}
            </div>

            {/* Errors list */}
            {result.errors.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-destructive mb-2">Parse Errors:</p>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-muted-foreground">
                      Row {err.row_number}: {err.field_name} — {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unmatched entries */}
            {result.unmatched.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Unmatched Entries:
                </p>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {result.unmatched.map((entry, i) => (
                    <li key={i} className="text-muted-foreground">
                      Row {entry.row_number}: {entry.action} {entry.quantity}x {entry.symbol} @ ₹{entry.price} — {entry.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

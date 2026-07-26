/**
 * SwingScanner Component
 * 
 * Provides UI for scanning the stock universe for swing trading opportunities.
 * Displays scan configuration inputs and triggers universe scan via API.
 * 
 * Requirements covered: 5.1, 5.4, 13.1, 13.2
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp } from 'lucide-react';
import { apiClient, SwingScanResponse } from '@/lib/api-client';
import { DEFAULT_USER_ID } from '@/lib/constants';

export interface SwingScannerProps {
  userId?: string;
  onScanComplete?: (results: SwingScanResponse) => void;
  onScanError?: (error: Error) => void;
}

/**
 * SwingScanner - Scan configuration and trigger component
 * 
 * Features:
 * - Configurable minimum score filter
 * - Configurable maximum results limit
 * - Loading state during scan
 * - Error handling and display
 */
export function SwingScanner({ userId = DEFAULT_USER_ID, onScanComplete, onScanError }: SwingScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [minScore, setMinScore] = useState(60);
  const [maxResults, setMaxResults] = useState(20);

  const handleScan = async () => {
    setIsScanning(true);

    try {
      const data = await apiClient.scanSwingUniverse({
        minScore,
        maxResults,
        userId,
      });

      if (onScanComplete) {
        onScanComplete(data);
      }
    } catch (error) {
      console.error('Scan error:', error);
      if (onScanError) {
        onScanError(error instanceof Error ? error : new Error('Scan failed'));
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan Settings</CardTitle>
        <CardDescription>Configure parameters for the swing trading scan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="minScore" className="text-sm font-medium mb-1 block">
              Minimum Score
            </label>
            <Input
              id="minScore"
              type="number"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              placeholder="60"
              disabled={isScanning}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="maxResults" className="text-sm font-medium mb-1 block">
              Max Results
            </label>
            <Input
              id="maxResults"
              type="number"
              min="1"
              max="100"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              placeholder="20"
              disabled={isScanning}
            />
          </div>
          <Button onClick={handleScan} disabled={isScanning} className="flex gap-2">
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4" />
                Scan Universe
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

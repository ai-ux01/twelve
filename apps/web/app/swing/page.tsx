'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { SwingScanner } from '@/components/swing-scanner';
import { SwingAnalysisPanel } from '@/components/swing-analysis-panel';
import { SwingRecommendationCard } from '@/components/swing-recommendation-card';
import { SwingCandidate, SwingScanResponse } from '@/lib/api-client';

/**
 * Swing Scanner Page
 * 
 * Provides a UI for scanning the stock universe for swing trading opportunities
 * and executing paper trades on selected candidates.
 * 
 * Requirements: 5.1, 5.4, 5.7, 13.1, 13.2
 * - 5.1: Swing trading analysis and scanning
 * - 5.4: POST /swing/scan endpoint integration
 * - 5.7: Paper trading for swing opportunities
 * - 13.1: Natural language input and API integration
 * - 13.2: Structured recommendation display
 */
export default function SwingScannerPage() {
  const [scanResults, setScanResults] = useState<SwingScanResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<SwingCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userId] = useState('user-123'); // TODO: Get from auth context

  const handleScanComplete = (results: SwingScanResponse) => {
    setScanResults(results);
    setSelectedCandidate(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleScanError = (error: Error) => {
    setErrorMessage(error.message);
    setScanResults(null);
    setSelectedCandidate(null);
  };

  const handleCandidateClick = (candidate: SwingCandidate) => {
    setSelectedCandidate(candidate);
    setSuccessMessage(null);
  };

  const handlePaperTradeSuccess = (tradeId: string) => {
    setSuccessMessage(`Paper trade executed successfully! Trade ID: ${tradeId}`);
  };

  const handlePaperTradeError = (error: Error) => {
    setErrorMessage(error.message);
  };

  const getTrendBadgeColor = (trend: string) => {
    if (trend.includes('UPTREND')) return 'bg-green-500';
    if (trend.includes('DOWNTREND')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Swing Trading Scanner</h1>
        <p className="text-muted-foreground">
          Scan the stock universe for high-quality swing trading opportunities
        </p>
      </div>

      {/* Scan Configuration Component */}
      <div className="mb-6">
        <SwingScanner
          userId={userId}
          onScanComplete={handleScanComplete}
          onScanError={handleScanError}
        />
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert className="mb-6 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {successMessage && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Two Column Layout: Candidates List + Detail View */}
      {scanResults && scanResults.candidates.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Scan Results Table */}
          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">
                  Scan Results ({scanResults.candidatesFound} candidates found)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Scanned {scanResults.scannedCount} stocks
                </p>
              </div>
              <div className="overflow-auto max-h-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead className="text-right">R:R</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.candidates.map((candidate) => (
                      <TableRow
                        key={candidate.symbol}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 ${
                          selectedCandidate?.symbol === candidate.symbol
                            ? 'bg-blue-50 dark:bg-blue-950'
                            : ''
                        }`}
                        onClick={() => handleCandidateClick(candidate)}
                      >
                        <TableCell className="font-medium">{candidate.symbol}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.score.toFixed(1)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTrendBadgeColor(candidate.trend)}>
                            {candidate.trend}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={candidate.riskReward >= 2 ? 'default' : 'secondary'}>
                            {candidate.riskReward.toFixed(2)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Detail View */}
          <div className="space-y-6">
            {selectedCandidate ? (
              <>
                {/* Recommendation Card with Paper Trade Button */}
                <SwingRecommendationCard
                  candidate={selectedCandidate}
                  userId={userId}
                  onPaperTradeSuccess={handlePaperTradeSuccess}
                  onPaperTradeError={handlePaperTradeError}
                />

                {/* Detailed Analysis Panel */}
                <SwingAnalysisPanel candidate={selectedCandidate} />
              </>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Select a Candidate</p>
                    <p className="text-sm">
                      Click on a stock from the list to view detailed analysis and execute paper trades
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Empty State: No Results */}
      {scanResults && scanResults.candidates.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Candidates Found</p>
              <p className="text-sm">
                No stocks met the minimum score criteria. Try lowering the minimum score or adjusting
                your scan parameters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Scan Yet State */}
      {!scanResults && !errorMessage && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Ready to Scan</p>
              <p className="text-sm">
                Configure your scan settings above and click &quot;Scan Universe&quot; to find swing
                trading opportunities
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

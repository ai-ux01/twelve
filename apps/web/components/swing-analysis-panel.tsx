/**
 * SwingAnalysisPanel Component
 * 
 * Displays comprehensive technical analysis for swing trading opportunities.
 * Shows all technical factors organized in logical sections.
 * 
 * Requirements covered: 5.2, 13.2
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SwingCandidate } from '@/lib/api-client';

export interface SwingAnalysisPanelProps {
  candidate: SwingCandidate;
}

/**
 * SwingAnalysisPanel - Detailed technical analysis display
 * 
 * Sections:
 * - Price Action (trend, setup type)
 * - Technical Indicators (score breakdown)
 * - Entry/Exit Levels
 * - Scoring Breakdown (component scores with visual indicators)
 */
export function SwingAnalysisPanel({ candidate }: SwingAnalysisPanelProps) {
  const { symbol, score, trend, setupType, entry, stopLoss, target, riskReward, components } = candidate;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendColor = (trend: string) => {
    if (trend.includes('UPTREND')) return 'text-green-600';
    if (trend.includes('DOWNTREND')) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">{symbol}</CardTitle>
            <CardDescription>Detailed Swing Trading Analysis</CardDescription>
          </div>
          <Badge className="text-lg px-4 py-2" variant={score >= 70 ? 'default' : 'secondary'}>
            Score: {score.toFixed(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Price Action Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Price Action</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <p className={`text-lg font-medium ${getTrendColor(trend)}`}>{trend}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Setup Type</p>
                <p className="text-lg font-medium">{setupType}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Entry/Exit Levels Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Entry & Exit Levels</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Entry Price</p>
                <p className="text-lg font-medium">₹{entry.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Target Price</p>
                <p className="text-lg font-medium text-green-600">₹{target.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stop Loss</p>
                <p className="text-lg font-medium text-red-600">₹{stopLoss.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk/Reward</p>
                <Badge variant={riskReward >= 2 ? 'default' : 'secondary'} className="text-lg">
                  {riskReward.toFixed(2)}:1
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Scoring Breakdown Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Scoring Breakdown</h3>
            <div className="space-y-3">
              <ScoreRow label="Trend" score={components.trendScore} weight={20} />
              <ScoreRow label="Technical" score={components.technicalScore} weight={20} />
              <ScoreRow label="Volume" score={components.volumeScore} weight={15} />
              <ScoreRow label="Relative Strength" score={components.relativeStrengthScore} weight={15} />
              <ScoreRow label="Breakout" score={components.breakoutScore} weight={10} />
              <ScoreRow label="Sector" score={components.sectorScore} weight={10} />
              <ScoreRow label="Risk/Reward" score={components.riskRewardScore} weight={10} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ScoreRow - Individual score component with progress bar
 */
function ScoreRow({ label, score, weight }: { label: string; score: number; weight: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {score.toFixed(1)} / 100 ({weight}%)
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getScoreColor(score)} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

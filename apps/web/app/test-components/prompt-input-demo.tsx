/**
 * Demo page for PromptInput component
 *
 * Shows the PromptInput component in action
 */

'use client';

import { useState } from 'react';
import { PromptInput } from '@/components/prompt-input';
import { Card } from '@/components/ui/card';
import type { PromptResponse } from '@/lib/api-client';

export default function PromptInputDemo() {
  const [lastResponse, setLastResponse] = useState<PromptResponse | null>(null);

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">PromptInput Component Demo</h1>
          <p className="text-gray-600">
            Natural language input component for trading prompts. Try entering a prompt like
            &quot;Find the best swing trade in RELIANCE&quot; or &quot;Analyze intraday
            opportunities in TCS&quot;.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Interactive Component</h2>
          <PromptInput
            onSubmit={(response) => {
              console.log('Prompt submitted:', response);
              setLastResponse(response);
            }}
          />
        </div>

        {lastResponse && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Recommendation Response</h2>
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Trade Recommendation</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Action:</span>
                    <p className="font-medium">{lastResponse.recommendation.action}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Symbol:</span>
                    <p className="font-medium">{lastResponse.recommendation.symbol}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Entry Price:</span>
                    <p className="font-medium">₹{lastResponse.recommendation.entryPrice}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Target:</span>
                    <p className="font-medium">₹{lastResponse.recommendation.target}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Stop Loss:</span>
                    <p className="font-medium">₹{lastResponse.recommendation.stopLoss}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Confidence:</span>
                    <p className="font-medium">
                      {(lastResponse.recommendation.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">AI Reasoning</h4>
                <p className="text-sm text-gray-700">{lastResponse.recommendation.reasoning}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Technical Indicators</h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">RSI:</span>{' '}
                    <span className="font-medium">
                      {lastResponse.recommendation.quantData.indicators.rsi.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">SMA 50:</span>{' '}
                    <span className="font-medium">
                      {lastResponse.recommendation.quantData.indicators.sma_50.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">SMA 200:</span>{' '}
                    <span className="font-medium">
                      {lastResponse.recommendation.quantData.indicators.sma_200.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Example Prompts</h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>&quot;Find the best swing trade in RELIANCE&quot;</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>&quot;Analyze intraday opportunities in TCS&quot;</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>&quot;Show me scalping setups for NIFTY options&quot;</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>&quot;What are the best stocks for swing trading today?&quot;</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

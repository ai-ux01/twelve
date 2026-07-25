# ChartViewer Component

A React component that wraps TradingView Lightweight Charts to display interactive candlestick charts with technical indicators, support/resistance levels, and trendlines.

## Features

- 📊 **Candlestick Charts**: Display OHLCV data with customizable colors
- 📈 **Technical Indicators**: SMA 20/50/200, EMA 20, overlaid on price chart
- 🎯 **Support/Resistance Levels**: Horizontal lines with strength indicators
- 📐 **Trendlines**: Linear regression trendlines with R² values
- 📊 **Volume Display**: Optional histogram showing trading volume
- 🎨 **Interactive Legend**: Shows all indicators with current values
- 📱 **Responsive**: Automatically resizes with window
- ⚡ **Performance**: Efficient rendering with React refs

## Installation

The component uses TradingView Lightweight Charts, which is already installed:

```bash
pnpm add lightweight-charts
```

## Usage

### Basic Usage

```tsx
import { ChartViewer } from '@/components/ChartViewer';

function MyComponent() {
  const data = [
    {
      timestamp: '2024-01-01T00:00:00Z',
      open: 2450,
      high: 2470,
      low: 2445,
      close: 2465,
      volume: 1000000,
    },
    // ... more data
  ];

  return <ChartViewer symbol="RELIANCE" data={data} height={500} showVolume={true} />;
}
```

### With Technical Analysis

```tsx
import { ChartViewer } from '@/components/ChartViewer';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

function AnalysisView({ symbol }: { symbol: string }) {
  // Fetch market data
  const { data: marketData } = useQuery({
    queryKey: ['market', symbol, '1d'],
    queryFn: () => apiClient.getMarketData(symbol, '1d'),
  });

  // Fetch recommendation with quant analysis
  const { data: recommendation } = useQuery({
    queryKey: ['recommendation', symbol],
    queryFn: () => apiClient.submitPrompt(`Analyze ${symbol}`),
  });

  if (!marketData) return <div>Loading...</div>;

  return (
    <ChartViewer
      symbol={symbol}
      data={marketData.data}
      quantAnalysis={recommendation?.recommendation.quantData}
      height={600}
      showVolume={true}
    />
  );
}
```

## Props

| Prop            | Type                  | Required | Default     | Description                     |
| --------------- | --------------------- | -------- | ----------- | ------------------------------- |
| `symbol`        | `string`              | Yes      | -           | Trading symbol to display       |
| `data`          | `OHLCVData[]`         | Yes      | -           | Array of OHLCV candlestick data |
| `quantAnalysis` | `QuantAnalysisResult` | No       | `undefined` | Technical analysis results      |
| `height`        | `number`              | No       | `500`       | Chart height in pixels          |
| `showVolume`    | `boolean`             | No       | `true`      | Show/hide volume histogram      |

## Type Definitions

### OHLCVData

```typescript
interface OHLCVData {
  timestamp: string; // ISO 8601 format
  open: number; // Opening price
  high: number; // Highest price
  low: number; // Lowest price
  close: number; // Closing price
  volume: number; // Trading volume
}
```

### QuantAnalysisResult

```typescript
interface QuantAnalysisResult {
  symbol: string;
  timeframe: string;
  indicators: {
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    sma_20: number;
    sma_50: number;
    sma_200: number;
    ema_20: number;
    bollingerBands: { upper: number; middle: number; lower: number };
  };
  supportResistance: Array<{
    level: number;
    strength: number; // 0-1
  }>;
  trendlines: Array<{
    slope: number;
    intercept: number;
    rSquared: number; // 0-1
  }>;
}
```

## Technical Indicators

### Moving Averages

- **SMA 20** (Blue solid line): 20-period simple moving average
- **SMA 50** (Orange solid line): 50-period simple moving average
- **SMA 200** (Purple solid line): 200-period simple moving average
- **EMA 20** (Cyan dashed line): 20-period exponential moving average

### Support/Resistance Levels

- Displayed as horizontal dashed lines
- **Strong levels** (strength > 0.7): Red color
- **Moderate levels** (strength ≤ 0.7): Orange color
- Includes price line markers on right axis

### Trendlines

- Linear regression trendlines from quant analysis
- **Strong fit** (R² > 0.8): Green color
- **Moderate fit** (R² ≤ 0.8): Lime color
- Shows slope and R² in legend

## Chart Interactions

- **Zoom**: Scroll wheel to zoom in/out
- **Pan**: Click and drag to pan
- **Crosshair**: Hover to see price/time at cursor
- **Auto-fit**: Chart automatically fits content on load

## Styling

The component uses:

- shadcn/ui Card components for layout
- Tailwind CSS for styling
- Custom colors for profit/loss indicators

### Color Scheme

- **Up Candles**: Green (`#26a69a`)
- **Down Candles**: Red (`#ef5350`)
- **Volume Up**: Green with transparency
- **Volume Down**: Red with transparency

## Performance

- Uses React `useRef` to store chart instances (prevents re-renders)
- Separate `useEffect` hooks for different data types
- Debounced window resize handler
- Efficient data format conversions

## Browser Support

Supports all modern browsers that support:

- HTML5 Canvas
- ES6+ JavaScript
- CSS Grid/Flexbox

## Testing

### Visual Testing

View the component in action:

```
http://localhost:3000/test-components
```

### Unit Tests

Run unit tests:

```bash
pnpm test ChartViewer.spec.tsx
```

## Examples

### Example 1: Basic Candlestick Chart

```tsx
<ChartViewer symbol="TCS" data={ohlcvData} height={400} showVolume={false} />
```

### Example 2: Chart with Technical Indicators

```tsx
<ChartViewer
  symbol="RELIANCE"
  data={ohlcvData}
  quantAnalysis={{
    symbol: 'RELIANCE',
    timeframe: '1d',
    indicators: {
      rsi: 45.2,
      macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
      sma_20: 2455.0,
      sma_50: 2450.0,
      sma_200: 2380.0,
      ema_20: 2458.0,
      bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
    },
    supportResistance: [
      { level: 2400, strength: 0.85 },
      { level: 2500, strength: 0.72 },
    ],
    trendlines: [{ slope: 2.5, intercept: 2350, rSquared: 0.89 }],
  }}
  height={600}
  showVolume={true}
/>
```

## Troubleshooting

### Chart not displaying

1. Ensure `data` array is not empty
2. Check that OHLCV data has valid `high >= low` values
3. Verify timestamps are valid ISO 8601 strings

### Performance issues with large datasets

- Consider downsampling data for very large datasets (>10,000 points)
- Use time-based aggregation for intraday data
- Enable chart caching if fetching the same data repeatedly

### Indicators not showing

1. Verify `quantAnalysis` prop is provided
2. Check that indicator values are valid numbers
3. Ensure data array has sufficient points for calculations

## Related Components

- `PromptInput`: Natural language input for analysis
- `RecommendationCard`: Display AI recommendations
- `PortfolioTable`: Display positions with P&L

## Future Enhancements

Potential additions:

- [ ] Multiple timeframe selection
- [ ] Drawing tools (manual trendlines, annotations)
- [ ] Save/export chart as image
- [ ] Additional indicators (Stochastic, ATR, etc.)
- [ ] Dark mode theme
- [ ] Custom color schemes
- [ ] Comparison with other symbols
- [ ] Alerts on price levels

## License

Part of ProfitTerminal project.

## Requirements

Implements **Requirement 13.3**: Interactive price charts using TradingView Lightweight Charts.

## Documentation

For more details, see:

- [TradingView Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)
- [ProfitTerminal Design Document](/.kiro/specs/profit-terminal/design.md)
- [Task 18.4 Completion Report](../TASK_18.4_COMPLETION.md)

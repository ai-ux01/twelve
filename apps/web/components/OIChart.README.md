# OIChart Component

## Overview

The `OIChart` component visualizes Open Interest (OI) comparison between Call and Put options across different strike prices. It provides an intuitive bar chart representation that helps traders identify support/resistance zones and analyze option positioning.

**Requirements:** 7.1, 13.3  
**Task:** 70.3

## Features

- **Bar Chart Visualization**: Displays Call OI (blue) and Put OI (red) for each strike price
- **ATM Strike Marker**: Highlights the At-The-Money strike with an orange vertical line
- **Support/Resistance Zones**: Optional visualization of key price levels as dashed horizontal lines
- **Interactive Tooltip**: Hover over strikes to see exact OI values for both calls and puts
- **Summary Statistics**: Displays spot price, total Call OI, and total Put OI
- **Responsive Design**: Automatically adjusts to container width
- **Empty State Handling**: Gracefully handles empty strike arrays

## Usage

### Basic Usage

```tsx
import { OIChart } from '@/components/OIChart';
import type { OptionsChainResponse } from '@/lib/api-client';

const optionsChain: OptionsChainResponse = {
  underlying: 'NIFTY',
  expiryDate: '2024-12-26',
  spotPrice: 21500,
  strikes: [
    {
      strikePrice: 21400,
      call: { ltp: 240, volume: 1500, oi: 70000, iv: 17 },
      put: { ltp: 80, volume: 1000, oi: 60000, iv: 17 },
    },
    {
      strikePrice: 21500,
      call: { ltp: 180, volume: 2000, oi: 100000, iv: 16 },
      put: { ltp: 180, volume: 2000, oi: 100000, iv: 16 },
    },
    // ... more strikes
  ],
};

function MyComponent() {
  return <OIChart optionsChain={optionsChain} />;
}
```

### With Support/Resistance Zones

```tsx
<OIChart
  optionsChain={optionsChain}
  supportZones={[21300, 21400]} // Strikes with high Put OI
  resistanceZones={[21600, 21700]} // Strikes with high Call OI
/>
```

### Custom Height

```tsx
<OIChart optionsChain={optionsChain} height={500} />
```

## Props

### `OIChartProps`

| Prop                | Type                    | Required | Default | Description                                        |
| ------------------- | ----------------------- | -------- | ------- | -------------------------------------------------- |
| `optionsChain`      | `OptionsChainResponse`  | Yes      | -       | Options chain data containing strikes with OI data |
| `height`            | `number`                | No       | `400`   | Chart height in pixels                             |
| `supportZones`      | `number[]`              | No       | `[]`    | Array of strike prices to mark as support zones   |
| `resistanceZones`   | `number[]`              | No       | `[]`    | Array of strike prices to mark as resistance zones |

### `OptionsChainResponse` Type

```typescript
interface OptionsChainResponse {
  underlying: 'NIFTY' | 'BANKNIFTY';
  expiryDate: string;
  spotPrice: number;
  strikes: {
    strikePrice: number;
    call: {
      ltp: number;
      volume: number;
      oi: number; // Open Interest
      iv: number;
    };
    put: {
      ltp: number;
      volume: number;
      oi: number; // Open Interest
      iv: number;
    };
  }[];
}
```

## Visual Elements

### Chart Legend

- **Blue bars**: Call Open Interest
- **Red bars**: Put Open Interest
- **Orange vertical line**: At-The-Money (ATM) strike
- **Green dashed lines**: Support zones (high Put OI)
- **Red dashed lines**: Resistance zones (high Call OI)

### Summary Statistics Panel

Displays three key metrics:

1. **Spot Price**: Current price of the underlying asset
2. **Total Call OI**: Sum of all Call Open Interest across strikes
3. **Total Put OI**: Sum of all Put Open Interest across strikes

### Interactive Tooltip

When hovering over the chart, a tooltip appears showing:

- Strike price
- ATM indicator (if applicable)
- Call OI value (formatted with commas)
- Put OI value (formatted with commas)

## Understanding Open Interest

**Open Interest (OI)** represents the total number of outstanding option contracts that have not been settled. In the context of this chart:

- **High Call OI**: May indicate resistance levels where traders expect price to stall
- **High Put OI**: May indicate support levels where traders expect price to find support
- **OI Buildup**: Increasing OI suggests new positions are being created
- **OI Unwinding**: Decreasing OI suggests positions are being closed

### Interpreting the Chart

1. **Call OI > Put OI at a strike**: Suggests potential resistance at that level
2. **Put OI > Call OI at a strike**: Suggests potential support at that level
3. **High OI at ATM strike**: Indicates significant interest at current price level
4. **Symmetric OI distribution**: May indicate uncertainty about direction
5. **Asymmetric OI distribution**: May indicate directional bias

## Examples

See `OIChart.example.tsx` for comprehensive usage examples including:

- Basic usage
- With support/resistance zones
- Custom height configuration
- BANKNIFTY example

## Testing

The component has comprehensive unit tests in `OIChart.test.tsx` covering:

- ✅ Rendering without errors
- ✅ Displaying options chain data correctly
- ✅ Highlighting ATM strike
- ✅ Showing Call OI and Put OI
- ✅ Displaying support/resistance zones
- ✅ Empty state handling
- ✅ NIFTY and BANKNIFTY support
- ✅ Number formatting with commas

Run tests with:

```bash
npm test -- OIChart.test.tsx
```

## Dependencies

- `lightweight-charts`: For chart rendering
- `@/components/ui/card`: Card component from shadcn/ui
- `@/lib/api-client`: Type definitions for options chain data

## Browser Compatibility

The component uses TradingView's Lightweight Charts library which supports:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Considerations

- Chart instances are created once and reused
- Data updates trigger efficient re-renders
- Cleanup on unmount prevents memory leaks
- Resize events are handled with proper event listeners

## Accessibility

- Semantic HTML structure
- Color-coded visual elements with text labels
- Keyboard-navigable chart (via lightweight-charts)
- Screen reader friendly summary statistics

## Architecture Integration

This component is part of the Options Chain Visualization Components (Task 70) and integrates with:

- **OptionsChainViewer** (Task 70.1): Tabular view of options chain
- **OptionsAnalysisPanel** (Task 70.2): Analysis and insights panel
- **Backend API** (Task 70.4): Data fetching from `/api/options/chain`

## Future Enhancements

Potential improvements for future iterations:

- [ ] Export chart as image
- [ ] Configurable color schemes
- [ ] Animation on data updates
- [ ] Zoom and pan controls
- [ ] Historical OI comparison
- [ ] OI change highlighting (increasing/decreasing)
- [ ] Max Pain calculation and visualization
- [ ] PCR (Put-Call Ratio) overlay

## License

Part of the ProfitTerminal project.

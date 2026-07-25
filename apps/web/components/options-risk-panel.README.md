# OptionsRiskPanel Component

## Overview

The `OptionsRiskPanel` component displays a comprehensive summary of options risk metrics for a trading portfolio. It provides visual feedback about risk exposure, position counts, liquidity warnings, and actionable recommendations.

**Requirements Covered:**
- **8.5**: Risk validation results with violations and reasons
- **13.2**: Structured display of AI recommendations and risk metrics

## Features

### Visual Risk Indicators
- **Color-coded status badges**: Green (healthy), Yellow (warnings), Red (violations)
- **Progress bar visualization**: Shows exposure percentage with color coding
- **Icon-based indicators**: Quick visual reference for different risk states

### Key Metrics Display
1. **Total Options Exposure**
   - Absolute value in currency
   - Percentage of portfolio
   - Visual progress bar
   - Comparison against maximum allowed

2. **Position Count**
   - Number of open options positions
   - Maximum allowed positions (if configured)

3. **Liquidity Warnings**
   - Count of positions with liquidity concerns
   - Detailed breakdown of each warning

### Risk Violations
- **Error Severity (Red)**: Limits have been breached
  - Shows rule name, message, and current vs. limit values
  - Blocks trading actions

- **Warning Severity (Yellow)**: Approaching limits (80% threshold)
  - Shows early warning when getting close to limits
  - Allows trading with caution

### Liquidity Warnings
- **WARNING**: Standard liquidity concerns (low volume, low OI, wide spreads)
- **CRITICAL**: Severe liquidity issues requiring immediate attention

### Recommendations
- Actionable suggestions for risk management
- Context-aware based on current portfolio state
- Prioritized by urgency

## Props

```typescript
interface OptionsRiskPanelProps {
  // Required: Risk metrics data (null if no positions or loading)
  metrics: OptionsRiskMetrics | null;
  
  // Optional: Total portfolio value for context
  portfolioValue?: number;
  
  // Optional: Loading state indicator
  isLoading?: boolean;
  
  // Optional: Callback for refresh action
  onRefresh?: () => void;
}
```

### OptionsRiskMetrics Interface

```typescript
interface OptionsRiskMetrics {
  // Total options exposure
  totalOptionsExposure: number; // Absolute value in currency
  totalOptionsExposurePercent: number; // Percentage (0-100)
  maxOptionsExposurePercent: number; // Maximum allowed (e.g., 20)
  
  // Position counts
  optionsPositionCount: number;
  maxOpenPositions?: number;
  
  // Warnings and violations
  liquidityWarnings: LiquidityWarning[];
  riskViolations: RiskViolation[];
  
  // Recommendations
  recommendations: string[];
}
```

### LiquidityWarning Interface

```typescript
interface LiquidityWarning {
  symbol: string; // e.g., 'NIFTY', 'BANKNIFTY'
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  reason: string; // Explanation of liquidity issue
  severity: 'WARNING' | 'CRITICAL';
}
```

### RiskViolation Interface

```typescript
interface RiskViolation {
  rule: string; // Rule identifier (e.g., 'MAX_OPTIONS_EXPOSURE')
  message: string; // Human-readable explanation
  severity: 'ERROR' | 'WARNING';
  currentValue?: number; // Current metric value
  limit?: number; // Limit that was exceeded
}
```

## Usage Examples

### Basic Usage

```tsx
import { OptionsRiskPanel } from '@/components/options-risk-panel';

function MyComponent() {
  const metrics = {
    totalOptionsExposure: 50000,
    totalOptionsExposurePercent: 10,
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 3,
    maxOpenPositions: 10,
    liquidityWarnings: [],
    riskViolations: [],
    recommendations: [],
  };

  return (
    <OptionsRiskPanel 
      metrics={metrics} 
      portfolioValue={500000}
    />
  );
}
```

### With Loading State

```tsx
function LoadingExample() {
  return (
    <OptionsRiskPanel 
      metrics={null} 
      isLoading={true}
    />
  );
}
```

### With Risk Violations

```tsx
function RiskViolationExample() {
  const metrics = {
    totalOptionsExposure: 120000,
    totalOptionsExposurePercent: 24,
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 8,
    riskViolations: [
      {
        rule: 'MAX_OPTIONS_EXPOSURE',
        message: 'Total options exposure 24% exceeds max 20%',
        severity: 'ERROR',
        currentValue: 24,
        limit: 20,
      },
    ],
    liquidityWarnings: [],
    recommendations: [
      'URGENT: Reduce options exposure immediately',
    ],
  };

  return (
    <OptionsRiskPanel 
      metrics={metrics} 
      portfolioValue={500000}
    />
  );
}
```

### Integrated with API

```tsx
function IntegratedExample() {
  const [metrics, setMetrics] = useState<OptionsRiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await apiClient.getOptionsRiskMetrics(userId);
      // setMetrics(response);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <OptionsRiskPanel 
      metrics={metrics} 
      isLoading={isLoading}
      portfolioValue={500000}
      onRefresh={fetchMetrics}
    />
  );
}
```

## Visual States

### Healthy State (Green)
- No risk violations
- No liquidity warnings
- Exposure well below limits
- Shows success message

### Warning State (Yellow)
- Approaching limits (80% threshold)
- Minor liquidity concerns
- Non-blocking warnings
- Shows recommendations

### Error State (Red)
- Limits breached
- Critical violations
- May block trading
- Shows urgent recommendations

## Color Coding

### Exposure Progress Bar
- **Green**: 0-79% of maximum (healthy)
- **Yellow**: 80-99% of maximum (warning)
- **Red**: 100%+ of maximum (violation)

### Violations
- **Red Background**: ERROR severity
- **Yellow Background**: WARNING severity

### Liquidity Warnings
- **Yellow Background**: WARNING severity
- **Red Background**: CRITICAL severity

## Integration with Backend

The component is designed to work with options risk data from the backend RiskService. When task 71.1 is completed, the backend will provide:

1. **GET /api/risk/options/:userId** - Fetch current options risk metrics
2. **POST /api/risk/validate-options** - Validate an options trade request

Example backend integration:

```typescript
// api-client.ts
async getOptionsRiskMetrics(userId: string): Promise<OptionsRiskMetrics> {
  return this.fetch<OptionsRiskMetrics>(`/risk/options/${userId}`);
}
```

## Styling

The component uses:
- **Tailwind CSS** for styling
- **shadcn/ui components**: Card, Badge
- **Lucide React icons**: AlertCircle, AlertTriangle, CheckCircle, Shield, TrendingUp
- **Dark mode support** via Tailwind dark: classes

## Accessibility

- Semantic HTML structure
- Color is not the only indicator (icons and text included)
- Proper heading hierarchy
- Screen reader friendly

## Testing

Comprehensive unit tests cover:
- Loading state
- Empty state
- Healthy metrics display
- Warning state display
- Error state display
- Multiple violations
- Color coding
- Requirements 8.5 and 13.2

Run tests:
```bash
npm test -- options-risk-panel.test.tsx
```

## Future Enhancements

When backend implementation (Task 71.1) is complete:
1. Real-time risk metric updates
2. Refresh button functionality
3. Integration with portfolio positions
4. Historical risk tracking
5. Risk alerts and notifications

## Related Components

- **OptionsChainViewer**: Displays options chain data
- **TradeConfirmationDialog**: Uses risk validation for trade confirmation
- **PortfolioTable**: Shows portfolio positions
- **RiskValidationPanel**: General risk validation display (if created)

## Notes

- Component is ready for integration but requires backend support (Task 71.1)
- Currently displays static/mock data until backend endpoint is available
- Designed to be responsive and mobile-friendly
- Supports both light and dark themes

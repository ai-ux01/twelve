# TradeConfirmationDialog Component

## Overview

The `TradeConfirmationDialog` is a modal dialog component that displays detailed information about a live trade before execution. It requires explicit user confirmation before executing any live trade, implementing a critical safety measure for the ProfitTerminal trading system.

## Features

- **Trade Details Display**: Shows symbol, action (BUY/SELL), quantity, entry price, target, and stop-loss
- **Risk Validation**: Displays risk validation results from the Risk Engine with color-coded pass/fail/warning states
- **Portfolio Impact**: Shows how the trade will affect the user's portfolio including exposure and potential profit/loss
- **User Confirmation**: Requires explicit user click on "Confirm" button to proceed
- **Loading States**: Handles loading states during trade execution
- **Responsive Design**: Works on mobile and desktop screens
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## Requirements Covered

- **Requirement 10.1**: Frontend displays a confirmation dialog for live trades
- **Requirement 10.2**: User must explicitly confirm before live trade execution

## Usage

### Basic Example

```tsx
import { useState } from 'react';
import { TradeConfirmationDialog, PortfolioImpact } from '@/components/trade-confirmation-dialog';
import { apiClient, Recommendation, RiskValidationResult } from '@/lib/api-client';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [riskValidation, setRiskValidation] = useState<RiskValidationResult | null>(null);
  const [portfolioImpact, setPortfolioImpact] = useState<PortfolioImpact | null>(null);

  const recommendation: Recommendation = {
    // ... your recommendation data
  };

  const handleConfirm = async () => {
    // Execute the live trade
    const result = await apiClient.executeLiveTrade({
      userId: 'user-123',
      symbol: recommendation.symbol,
      action: recommendation.action,
      quantity: 10,
      price: recommendation.entryPrice,
      stopLoss: recommendation.stopLoss,
      target: recommendation.target,
      userConfirmed: true,
    });

    if (result.status === 'EXECUTED') {
      alert('Trade executed successfully!');
      setIsOpen(false);
    }
  };

  return (
    <TradeConfirmationDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      recommendation={recommendation}
      quantity={10}
      riskValidation={riskValidation}
      portfolioImpact={portfolioImpact}
      onConfirm={handleConfirm}
      onCancel={() => setIsOpen(false)}
    />
  );
}
```

### Complete Integration Example

See `trade-confirmation-dialog.example.tsx` for a complete example showing:

1. Risk validation before opening dialog
2. Portfolio impact calculation
3. Trade execution on confirmation
4. Error handling

## Props

### `open: boolean`

Controls whether the dialog is visible.

### `onOpenChange: (open: boolean) => void`

Callback when dialog open state changes.

### `recommendation: Recommendation | null`

The AI recommendation containing trade details. If `null`, the dialog will not render.

### `quantity: number`

The quantity of shares/contracts to trade.

### `riskValidation: RiskValidationResult | null`

Result from the Risk Engine validation. Shows pass/fail status and violations.

### `portfolioImpact: PortfolioImpact | null`

Portfolio impact estimate. If provided, shows how the trade affects portfolio metrics.

### `isLoading?: boolean`

Whether a trade execution is in progress. Disables buttons when `true`.

### `onConfirm: () => void`

Callback when user clicks "Confirm Trade" button. This should execute the live trade.

### `onCancel: () => void`

Callback when user clicks "Cancel" button. This should close the dialog without executing the trade.

## Types

### `PortfolioImpact`

```typescript
interface PortfolioImpact {
  currentValue: number; // Current portfolio value
  newInvestment: number; // Amount to be invested in this trade
  newTotalValue: number; // Portfolio value after trade
  newExposurePercent: number; // Portfolio exposure percentage after trade
  maxPotentialLoss: number; // Maximum potential loss from this trade
  maxPotentialProfit: number; // Maximum potential profit from this trade
  existingPositions: number; // Number of existing open positions
}
```

## Visual States

### Risk Validation States

1. **Passed (Green)**: All risk checks passed successfully
2. **Failed (Red)**: Trade violates risk rules and cannot be executed (Confirm button disabled)
3. **Warning (Yellow)**: Risk warnings present but trade can proceed
4. **Pending (Gray)**: Risk validation is loading or not yet performed

### Button States

- **Confirm Button**:
  - Enabled when `riskValidation.passed === true`
  - Disabled when validation failed or is loading
  - Shows "Executing..." when `isLoading === true`

- **Cancel Button**:
  - Always enabled unless trade is executing
  - Closes dialog without executing trade

## Integration with Risk Engine

The dialog displays risk validation results from the Risk Engine. Before opening the dialog:

```typescript
// Validate trade with Risk Engine
const validation = await apiClient.validateTrade({
  userId: 'user-123',
  symbol: 'RELIANCE',
  action: 'BUY',
  quantity: 10,
  price: 2460,
  stopLoss: 2430,
  target: 2520,
});

setRiskValidation(validation);
```

If `validation.passed === false`, the Confirm button will be disabled and violations will be displayed.

## Calculation Details

### Risk-Reward Ratio

For BUY: `(target - entry) / (entry - stopLoss)`
For SELL: `(entry - target) / (stopLoss - entry)`

### Potential Profit/Loss

For BUY:

- Profit: `(target - entry) * quantity`
- Loss: `(entry - stopLoss) * quantity`

For SELL:

- Profit: `(entry - target) * quantity`
- Loss: `(stopLoss - entry) * quantity`

### Profit/Loss Percentage

For BUY:

- Profit %: `((target - entry) / entry) * 100`
- Loss %: `((entry - stopLoss) / entry) * 100`

For SELL:

- Profit %: `((entry - target) / entry) * 100`
- Loss %: `((stopLoss - entry) / entry) * 100`

## Styling

The component uses:

- Tailwind CSS for styling
- shadcn/ui components (Dialog, Button, Badge, Separator)
- Lucide React icons
- Color-coded states (green for profit, red for loss, yellow for warnings)

## Testing

The component has comprehensive unit tests covering:

- Dialog display states
- Trade details rendering
- Risk validation display (passed/failed/warning)
- Portfolio impact display
- User interaction (confirm/cancel)
- BUY and SELL action handling
- Edge cases (large quantities, zero/full confidence, multiple violations)

Run tests with:

```bash
npm test -- trade-confirmation-dialog.test.tsx
```

## Accessibility

- Proper semantic HTML structure
- Keyboard navigation support (Tab, Enter, Escape)
- Screen reader friendly labels
- Focus management when dialog opens/closes
- Color is not the only indicator of state (icons + text)

## Security Considerations

- **No Auto-execution**: Trade is NEVER executed without explicit user confirmation
- **Risk Validation Required**: Confirm button disabled if risk validation fails
- **Clear Trade Details**: All trade parameters displayed clearly before confirmation
- **Confirmation Feedback**: Loading state prevents double-submission

## Architecture Notes

This component is part of the Phase 4 Live Trading implementation and enforces the architectural constraint that:

> Live trades require explicit user confirmation via Frontend_App

The component integrates with:

- Risk Engine (via `apiClient.validateTrade`)
- Trading Service (via `apiClient.executeLiveTrade`)
- Portfolio Service (for impact calculation)

## Related Components

- `RecommendationCard`: Displays AI recommendations and triggers live trade flow
- `PortfolioTable`: Shows portfolio positions after trade execution
- `PromptInput`: Initiates analysis that leads to recommendations

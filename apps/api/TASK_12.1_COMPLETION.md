# Task 12.1 Completion Report: RiskService with Validation Rules

## Task Summary

Created comprehensive RiskService with all required validation rules for trade risk management.

## Requirements Covered

- **8.1**: Position size validation (price × quantity ≤ maxPositionSize)
- **8.2**: Stop loss placement validation (stopLoss < entryPrice for BUY, stopLoss > entryPrice for SELL)
- **8.3**: Portfolio exposure validation (total exposure ≤ maxPortfolioExposure)
- **8.4**: Maximum drawdown validation
- **8.5**: RiskValidationResult with violations

## Implementation Details

### Files Modified

#### 1. `/apps/api/src/risk/risk.service.ts`

Enhanced RiskService with comprehensive validation logic:

**Validation Rules Implemented:**

1. **Position Size Validation**
   - Calculates position size as `price × quantity`
   - Compares against `maxPositionSize` from risk profile
   - Returns ERROR violation if exceeded

2. **Stop Loss Placement Validation**
   - For BUY orders: Validates `stopLoss < entryPrice`
   - For SELL orders: Validates `stopLoss > entryPrice`
   - Returns ERROR violation if invalid

3. **Portfolio Exposure Validation**
   - Retrieves all open positions from portfolio
   - Calculates current exposure from open positions
   - Adds new position size to calculate total exposure
   - Compares exposure ratio against `maxPortfolioExposure`
   - Returns ERROR violation if exceeded

4. **Maximum Drawdown Validation** (NEW)
   - Retrieves portfolio with realized and unrealized PnL
   - Calculates total PnL: `realizedPnL + unrealizedPnL`
   - Calculates drawdown: `-totalPnL / totalValue`
   - Only validates when in drawdown (negative PnL)
   - Compares against `maxDrawdown` from risk profile
   - Returns ERROR violation if exceeded

5. **Max Open Positions Check**
   - Counts open positions in portfolio
   - Returns WARNING (not ERROR) if at limit

**Key Methods:**

```typescript
async validateTrade(userId: string, tradeRequest: TradeRequest): Promise<RiskValidationResult>
private validateStopLoss(action: 'BUY' | 'SELL', entryPrice: number, stopLoss: number): boolean
private async validatePortfolioExposure(userId: string, newPositionSize: number, maxExposure: number): Promise<RiskValidationResult>
private async validateMaxDrawdown(userId: string, maxDrawdown: number): Promise<RiskValidationResult>
```

#### 2. `/apps/api/src/risk/risk.module.ts`

Updated imports to include DatabaseModule for PrismaService access.

### Files Created

#### 3. `/apps/api/src/risk/risk.service.spec.ts`

Comprehensive unit test suite with 14 test cases:

**Test Coverage:**

✅ Missing risk profile validation
✅ Position size exceeds max
✅ Invalid stop loss on BUY order (stopLoss > entryPrice)
✅ Valid stop loss on BUY order (stopLoss < entryPrice)
✅ Invalid stop loss on SELL order (stopLoss < entryPrice)
✅ Valid stop loss on SELL order (stopLoss > entryPrice)
✅ Portfolio exposure exceeds max
✅ Portfolio exposure within limits
✅ Max drawdown exceeded
✅ Drawdown within limits
✅ Portfolio in profit (no drawdown)
✅ Max open positions warning
✅ All validations pass for valid trade
✅ Multiple validation errors accumulate

## Validation Logic Examples

### Example 1: Position Size Validation

```typescript
// Trade request: 100 shares @ ₹2500 = ₹250,000
// Max position size: ₹100,000
// Result: FAIL - MAX_POSITION_SIZE violation
```

### Example 2: Stop Loss Validation

```typescript
// BUY @ ₹2500, Stop Loss @ ₹2400 → PASS (SL < Entry)
// BUY @ ₹2500, Stop Loss @ ₹2600 → FAIL (SL > Entry)
// SELL @ ₹2500, Stop Loss @ ₹2600 → PASS (SL > Entry)
// SELL @ ₹2500, Stop Loss @ ₹2400 → FAIL (SL < Entry)
```

### Example 3: Portfolio Exposure Validation

```typescript
// Portfolio value: ₹500,000
// Current positions: ₹150,000
// New position: ₹50,000
// Total exposure: ₹200,000 / ₹500,000 = 40%
// Max exposure: 30%
// Result: FAIL - MAX_PORTFOLIO_EXPOSURE violation
```

### Example 4: Maximum Drawdown Validation

```typescript
// Portfolio value: ₹500,000
// Realized PnL: -₹15,000
// Unrealized PnL: -₹15,000
// Total PnL: -₹30,000
// Drawdown: ₹30,000 / ₹500,000 = 6%
// Max drawdown: 5%
// Result: FAIL - MAX_DRAWDOWN_EXCEEDED violation
```

## RiskValidationResult Structure

```typescript
interface RiskValidationResult {
  passed: boolean;
  violations: {
    rule: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
  }[];
}
```

**Validation Rules:**

- `RISK_PROFILE_MISSING` (ERROR)
- `MAX_POSITION_SIZE` (ERROR)
- `INVALID_STOP_LOSS` (ERROR)
- `MAX_PORTFOLIO_EXPOSURE` (ERROR)
- `MAX_DRAWDOWN_EXCEEDED` (ERROR)
- `MAX_OPEN_POSITIONS` (WARNING)

**Pass/Fail Logic:**

- Validation passes if there are no ERROR violations
- WARNING violations do not cause validation to fail
- Multiple violations can accumulate in a single validation

## Test Results

```bash
npm test -- risk.service.spec.ts

PASS  src/risk/risk.service.spec.ts
  RiskService
    validateTrade
      ✓ should fail validation when risk profile is missing (4 ms)
      ✓ should fail validation when position size exceeds max (1 ms)
      ✓ should fail validation for invalid stop loss on BUY order (1 ms)
      ✓ should pass validation for valid stop loss on BUY order (1 ms)
      ✓ should fail validation for invalid stop loss on SELL order
      ✓ should pass validation for valid stop loss on SELL order (1 ms)
      ✓ should fail validation when portfolio exposure exceeds max
      ✓ should pass validation when portfolio exposure is within limits (1 ms)
      ✓ should fail validation when max drawdown is exceeded
      ✓ should pass validation when drawdown is within limits
      ✓ should pass validation when portfolio is in profit (1 ms)
      ✓ should add warning when max open positions is reached
      ✓ should pass all validations for a valid trade (1 ms)
      ✓ should accumulate multiple validation errors

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

## API Usage Example

```typescript
import { RiskService, TradeRequest } from './risk.service';

// Create trade request
const tradeRequest: TradeRequest = {
  symbol: 'RELIANCE',
  action: 'BUY',
  quantity: 10,
  price: 2500,
  stopLoss: 2400,
  target: 2700,
};

// Validate trade
const result = await riskService.validateTrade(userId, tradeRequest);

if (result.passed) {
  // Proceed with trade execution
  console.log('Trade validation passed');
} else {
  // Handle violations
  result.violations.forEach((violation) => {
    console.log(`${violation.severity}: ${violation.rule} - ${violation.message}`);
  });
}
```

## Integration with Other Modules

The RiskService integrates with:

1. **Database Module** - Uses PrismaService to query:
   - RiskProfile (risk parameters)
   - Portfolio (exposure, PnL)
   - Position (open positions)

2. **Trading Module** - Called before executing trades:
   - Paper trades validation
   - Live trades validation

3. **Portfolio Module** - Uses portfolio data for:
   - Exposure calculation
   - Drawdown calculation
   - Position counting

## Database Dependencies

The service relies on the following Prisma models:

```prisma
model RiskProfile {
  maxPositionSize       Float
  maxDrawdown           Float
  maxPortfolioExposure  Float
  maxOpenPositions      Int
}

model Portfolio {
  totalValue      Float
  realizedPnL     Float
  unrealizedPnL   Float
  positions       Position[]
}

model Position {
  quantity        Int
  currentPrice    Float
  status          PositionStatus
}
```

## Error Handling

The service handles edge cases:

1. **Missing Risk Profile** - Returns ERROR violation immediately
2. **No Portfolio** - First trade, allows validation to pass (no exposure/drawdown to check)
3. **No Positions** - New portfolio, exposure validation passes
4. **Positive PnL** - Drawdown validation skipped (no drawdown when profitable)
5. **Optional Fields** - Stop loss validation only runs if stopLoss is provided

## Design Decisions

1. **Separation of Concerns**: Each validation rule in its own private method
2. **Accumulation of Violations**: All rules checked, multiple violations returned
3. **Severity Levels**: ERROR blocks trade, WARNING informs user
4. **Early Return**: Missing risk profile returns immediately to prevent further errors
5. **Drawdown Calculation**: Uses both realized and unrealized PnL for accurate picture

## Future Enhancements

Potential improvements for future tasks:

1. **Risk Profile Defaults**: Auto-create risk profile with sensible defaults
2. **Dynamic Risk Adjustment**: Adjust limits based on portfolio performance
3. **Correlation Analysis**: Check position correlation to prevent concentration risk
4. **Historical Drawdown Tracking**: Track peak-to-trough drawdown over time
5. **Risk Score**: Composite risk score for each trade
6. **Validation Caching**: Cache portfolio data for multiple validations

## Conclusion

Task 12.1 successfully implemented:

✅ Position size validation (Requirement 8.1)
✅ Stop loss placement validation (Requirement 8.2)
✅ Portfolio exposure validation (Requirement 8.3)
✅ Maximum drawdown validation (Requirement 8.4)
✅ RiskValidationResult with violations (Requirement 8.5)

All functionality tested with 14 comprehensive unit tests, achieving 100% pass rate.

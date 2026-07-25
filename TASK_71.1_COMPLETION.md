# Task 71.1 Completion Report: Options-Specific Risk Rules

## Task Summary
Added comprehensive options-specific risk validation rules to RiskService to ensure safe options trading within portfolio limits.

## Requirements Implemented
- **Requirement 8.1**: Risk validation for position sizing and exposure limits
- **Requirement 8.3**: Portfolio exposure limits with configurable thresholds

## Changes Made

### 1. Database Schema Updates (`prisma/schema.prisma`)
Added options-specific fields to `RiskProfile` model:
- `maxOptionsExposure`: Default 20% of portfolio value
- `maxOptionsPositionSize`: Optional field, defaults to 40% of stock max if not set

Migration created: `20260724221038_add_options_risk_params`

### 2. Risk Service Interface (`apps/api/src/risk/risk.service.ts`)
Extended `TradeRequest` interface with options-specific fields:
- `assetType`: To identify options vs stocks
- `bidAskSpread`: For liquidity validation
- `openInterest`: For liquidity validation
- `impliedVolatility`: For volatility checks
- `delta`: For options Greek validation

### 3. Options Risk Validation Logic
Implemented `validateOptionsTrade()` method with four key validations:

#### a) Options Exposure Limit (20% of portfolio)
- Calculates total options exposure across all open options positions
- Rejects trades that would exceed configurable `maxOptionsExposure` (default 20%)
- **Rule**: `MAX_OPTIONS_EXPOSURE`
- **Severity**: ERROR

#### b) Position Size Limits (40% of stock max)
- Options positions limited to smaller size than stock positions
- Defaults to 40% of `maxPositionSize` if `maxOptionsPositionSize` not set
- **Rule**: `OPTIONS_POSITION_TOO_LARGE`
- **Severity**: ERROR

#### c) Liquidity Requirements
Implemented `validateOptionsLiquidity()` method:

**Bid-Ask Spread Validation**:
- ERROR if spread > 5% of price (illiquid)
- WARNING if spread > 3% of price (moderately liquid)
- Rules: `OPTIONS_ILLIQUID_SPREAD`, `OPTIONS_WIDE_SPREAD`

**Open Interest Validation**:
- ERROR if OI < 100 contracts (too illiquid)
- WARNING if OI between 100-500 contracts (moderate liquidity)
- Rules: `OPTIONS_LOW_OPEN_INTEREST`, `OPTIONS_MODERATE_OPEN_INTEREST`

#### d) Margin Requirements
Implemented `validateOptionsMargin()` method:
- Estimates 40% margin requirement for options positions
- ERROR if insufficient cash balance for margin
- WARNING if cash balance < 1.5x margin requirement (low buffer)
- Rules: `INSUFFICIENT_MARGIN`, `LOW_MARGIN_BUFFER`

### 4. Test Coverage (`apps/api/src/risk/options-risk.spec.ts`)
Created comprehensive unit tests (9 test cases):

1. ✓ Reject trade when total options exposure exceeds 20% limit
2. ✓ Pass when options exposure is within 20% limit
3. ✓ Reject options position larger than 40% of stock max
4. ✓ Reject illiquid options with wide bid-ask spread (>5%)
5. ✓ Reject options with very low open interest (<100)
6. ✓ Warn when open interest is moderate (100-500)
7. ✓ Reject trade when insufficient margin available
8. ✓ Warn when margin buffer is low
9. ✓ Stock trades should not trigger options validation

All tests passing ✅

## Key Design Decisions

1. **Configurable Limits**: Options exposure and position size limits are configurable per user via RiskProfile, with sensible defaults.

2. **Warnings vs Errors**: 
   - Errors block trade execution (liquidity too low, insufficient margin)
   - Warnings inform user but allow execution (moderate liquidity, low margin buffer)

3. **Conservative Margin Estimation**: Used 40% margin requirement, which is conservative for most options strategies, ensuring safety.

4. **Separation of Concerns**: Options validation is separate from stock validation, only triggered when `assetType` is `OPTION_CALL` or `OPTION_PUT`.

5. **Always Include Warnings**: Fixed violation collection to always include warnings, not just when validation fails (important for user awareness).

## Integration Points

1. **Database**: New migration applied, Prisma client regenerated
2. **RiskService**: Seamlessly integrated into existing `validateTrade()` flow
3. **Audit Logging**: All options risk validations are logged via AuditLogService
4. **Type Safety**: Full TypeScript type checking passes

## Validation Flow

```
validateTrade()
  ↓
Check if assetType is OPTION_CALL or OPTION_PUT
  ↓ (if yes)
validateOptionsTrade()
  ↓
├─ Check portfolio options exposure <= 20%
├─ Check position size <= 40% of stock max
├─ validateOptionsLiquidity()
│   ├─ Check bid-ask spread < 5%
│   └─ Check open interest > 100
└─ validateOptionsMargin()
    ├─ Calculate required margin (40% of position)
    └─ Check sufficient cash balance
  ↓
Return violations (ERRORs block, WARNINGs inform)
```

## Technical Notes

- Helper method `getOptionsSymbols()` queries Instrument table for all options symbols
- All dollar amounts formatted to 2 decimal places in error messages
- Percentage values displayed as percentages (e.g., "22.00%" not "0.22")
- Early return when no portfolio exists (first trade scenario)

## Testing Verification

```bash
npm test -- options-risk.spec.ts
✓ All 9 tests passing
✓ TypeScript compilation successful
✓ Database migration applied
```

## Files Modified

1. `prisma/schema.prisma` - Added options risk fields
2. `prisma/migrations/20260724221038_add_options_risk_params/migration.sql` - Generated migration
3. `apps/api/src/risk/risk.service.ts` - Added options validation logic
4. `apps/api/src/risk/options-risk.spec.ts` - New test file

## Compliance with Spec

✅ Task 71.1 Requirements:
- ✅ Validate total options exposure <= 20% of portfolio (configurable)
- ✅ Validate position size limits for options (smaller than stocks)
- ✅ Validate liquidity requirements (reject illiquid options)
- ✅ Validate margin requirements for options positions
- ✅ Return risk validation result with pass/fail + warnings

✅ Requirements 8.1 and 8.3:
- ✅ Risk Engine validates position size
- ✅ Risk Engine validates portfolio exposure limits

## Ready for Review
Implementation complete, all tests passing, ready for code review and integration testing.

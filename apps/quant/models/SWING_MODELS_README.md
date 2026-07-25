# Swing Trading Candidate Result Models

**Requirements:** 5.4  
**Task:** 46.2

## Overview

This module provides Pydantic models for structuring swing trading scanner results. These models ensure type safety, validation, and consistent data structures for the swing trading module.

## Models

### SwingCandidate

Represents a single swing trading candidate with complete analysis.

**Key Fields:**
- `symbol`: Stock symbol (e.g., "RELIANCE")
- `score`: Overall score (0-100)
- `signal`: BUY, SELL, HOLD, or NO_TRADE
- `setup_type`: BREAKOUT, RETEST, PULLBACK, CONTINUATION, REVERSAL, CONSOLIDATION_BREAKOUT
- `entry`, `stop_loss`, `target`: Trade levels
- `risk_reward`: Risk/reward ratio
- `component_scores`: Breakdown of 7 scoring components
- `key_metrics`: Technical indicators summary

**Validations:**
- For BUY: `stop_loss < entry < target`
- For SELL: `target < entry < stop_loss`
- Risk/reward calculated correctly
- All scores in 0-100 range
- Prices positive

### ScanResult

Container for scanner output with multiple candidates.

**Key Fields:**
- `candidates`: List of SwingCandidate (sorted by score)
- `total_scanned`: Number of stocks analyzed
- `filters_applied`: List of filter descriptions
- `scan_timestamp`: ISO 8601 timestamp (optional)
- `market_regime`: Market condition (optional)

**Validations:**
- Candidates must be sorted by score (descending)
- Total scanned must be non-negative

### ComponentScoresBreakdown

Breakdown of the 7 scoring components (each 0-100):
- `trend_score`
- `technical_score`
- `volume_score`
- `relative_strength_score`
- `breakout_score`
- `sector_score`
- `risk_reward_score`

### KeyMetricsSummary

Summary of key technical indicators:
- `current_price`
- `volume`
- `trend_direction`
- `rsi` (0-100)
- `adx` (0-100)
- `relative_volume`
- `distance_from_52w_high`
- `distance_from_52w_low`

## Usage

### Basic Example

```python
from models.swing import (
    SwingCandidate,
    ScanResult,
    ComponentScoresBreakdown,
    KeyMetricsSummary,
    Signal,
    SetupType
)

# Create a candidate
candidate = SwingCandidate(
    symbol="RELIANCE",
    score=78.5,
    sector="Energy",
    signal=Signal.BUY,
    setup_type=SetupType.BREAKOUT,
    entry=2460.0,
    stop_loss=2430.0,
    target=2520.0,
    risk_reward=2.0,
    component_scores=ComponentScoresBreakdown(
        trend_score=85.0,
        technical_score=75.0,
        volume_score=80.0,
        relative_strength_score=70.0,
        breakout_score=90.0,
        sector_score=65.0,
        risk_reward_score=75.0
    ),
    key_metrics=KeyMetricsSummary(
        current_price=2460.0,
        volume=1200000,
        trend_direction="UPTREND",
        rsi=58.5,
        adx=32.4,
        relative_volume=1.35,
        distance_from_52w_high=-5.4,
        distance_from_52w_low=11.8
    )
)

# Create scan result
scan_result = ScanResult(
    candidates=[candidate],
    total_scanned=150,
    filters_applied=["min_score >= 60"]
)

# JSON serialization
json_str = scan_result.model_dump_json(indent=2)
```

### Integration with Swing Scanner

```python
def scan_universe() -> ScanResult:
    """Swing scanner returns ScanResult."""
    candidates = []
    
    for stock in universe:
        # Analyze stock
        analysis = analyze_stock(stock)
        
        # Create candidate
        candidate = SwingCandidate(
            symbol=stock.symbol,
            score=analysis.total_score,
            # ... other fields
        )
        
        if candidate.score >= min_score:
            candidates.append(candidate)
    
    # Sort by score
    candidates.sort(key=lambda c: c.score, reverse=True)
    
    return ScanResult(
        candidates=candidates,
        total_scanned=len(universe),
        filters_applied=filters
    )
```

## Testing

Run the comprehensive test suite:

```bash
pytest tests/test_swing_candidate_model.py -v
```

**Test Coverage:**
- ✅ 17 tests, all passing
- ✅ Field validations
- ✅ Cross-field validations
- ✅ Sorting validations
- ✅ Edge cases

## Demo Scripts

1. **`demo_swing_candidate_model.py`**  
   Shows basic model creation and usage

2. **`examples/swing_scanner_integration.py`**  
   Demonstrates scanner integration pattern

Run demos:
```bash
python demo_swing_candidate_model.py
python examples/swing_scanner_integration.py
```

## Files

- `models/swing.py` - Model definitions (520 lines)
- `tests/test_swing_candidate_model.py` - Test suite (17 tests)
- `demo_swing_candidate_model.py` - Basic demo
- `examples/swing_scanner_integration.py` - Integration demo
- `TASK_46.2_COMPLETION.md` - Detailed completion report

## Benefits

1. **Type Safety**: Pydantic ensures correct types
2. **Validation**: Business logic enforced at model level
3. **Documentation**: Self-documenting with field descriptions
4. **JSON Support**: Native serialization/deserialization
5. **IDE Support**: Full autocomplete and type hints
6. **Error Messages**: Clear validation error messages

## Next Steps

These models will be used by:
- Task 46.1: Swing Scanner implementation
- Task 46.3: Scanner performance optimization
- Backend API: Endpoint response models
- Frontend: TypeScript type generation

## Related Documentation

- See `TASK_46.2_COMPLETION.md` for full implementation details
- See `design.md` Section 6 for Swing Trading Module architecture
- See `requirements.md` Requirement 5.4 for specifications

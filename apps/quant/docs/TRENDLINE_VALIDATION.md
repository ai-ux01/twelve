# Trendline Validation Documentation

## Overview

The trendline validation module provides comprehensive quality assessment for detected trendlines, ensuring only high-quality, reliable trendlines are used for trading decisions.

## Features

### 1. Minimum Touch Point Validation

Validates that a trendline has a minimum number of price touches to be considered reliable.

- **Default threshold**: 2 touches
- **Configurable**: Can be adjusted based on trading strategy
- **Touch detection**: Uses tolerance-based approach (default 1% of trendline price)

**Example:**
```python
from calculators.trendline_validator import TrendlineValidator

validator = TrendlineValidator(min_touches=3)
is_valid = validator.validate_minimum_touches(trendline, market_data, tolerance=0.01)
```

### 2. Strength Score Calculation (0-100)

Calculates a comprehensive strength score based on:
- **R² value (70% weight)**: Goodness of fit from linear regression
- **Touch count (30% weight)**: Number of times price touches the trendline

**Formula:**
```
Strength = (R² × 70) + (normalized_touches × 30)
```

Where `normalized_touches` = min(touches / 10, 1.0)

**Score Interpretation:**
- **80-100**: Excellent - Very strong trendline with high confidence
- **60-79**: Good - Reliable trendline for trading decisions
- **40-59**: Fair - Acceptable but requires caution
- **0-39**: Weak - Should be filtered out

**Example:**
```python
validator = TrendlineValidator()
strength = validator.calculate_strength_score(trendline, market_data)
print(f"Trendline strength: {strength:.2f}/100")
```

### 3. Angle Classification

Classifies trendlines based on their slope relative to average price:

- **STEEP**: |normalized_slope| >= 3.0% per period
  - Very aggressive trends
  - Higher risk, higher reward potential
  
- **MODERATE**: 0.5% < |normalized_slope| < 3.0% per period
  - Sustainable trends
  - Balanced risk-reward profile
  
- **FLAT**: |normalized_slope| <= 0.5% per period
  - Sideways or weak trends
  - Lower risk, lower reward potential

**Example:**
```python
validator = TrendlineValidator()
angle = validator.detect_angle_classification(trendline, market_data)

if angle == "STEEP":
    print("Aggressive trend detected - use wider stop losses")
elif angle == "MODERATE":
    print("Sustainable trend - ideal for position trading")
else:  # FLAT
    print("Weak trend - consider range-bound strategies")
```

### 4. Weak Trendline Filtering

Automatically filters out low-quality trendlines based on multiple criteria:

**Default filter criteria:**
- R² < 0.7 (poor fit)
- Strength score < 40 (weak overall quality)
- Touch count < 2 (insufficient validation)

**Example:**
```python
from calculators.trendlines import detect_and_validate_trendlines

# Detect and validate trendlines with quality filtering
results = detect_and_validate_trendlines(
    market_data,
    min_touches=2,
    min_r_squared=0.7,
    min_strength=40.0
)

# Results are sorted by strength (highest first)
for result in results:
    print(f"Strength: {result['strength']:.2f}")
    print(f"Touches: {result['touches']}")
    print(f"Angle: {result['angle']}")
    print(f"R²: {result['r_squared']:.3f}")
```

## API Reference

### TrendlineValidator Class

#### Constructor

```python
TrendlineValidator(
    min_touches: int = 2,
    min_r_squared: float = 0.7,
    min_strength: float = 40.0,
    steep_angle_threshold: float = 3.0,
    flat_angle_threshold: float = 0.5
)
```

**Parameters:**
- `min_touches`: Minimum touch points required (must be >= 2)
- `min_r_squared`: Minimum R² value (must be between 0 and 1)
- `min_strength`: Minimum strength score (must be between 0 and 100)
- `steep_angle_threshold`: Normalized slope threshold for steep classification
- `flat_angle_threshold`: Normalized slope threshold for flat classification

#### Methods

##### validate_minimum_touches()

```python
validate_minimum_touches(
    trendline: TrendlineResult,
    data: List[OHLCVData],
    tolerance: float = 0.01
) -> bool
```

Validates that trendline has minimum required touches.

**Returns:** True if valid, False otherwise

##### calculate_strength_score()

```python
calculate_strength_score(
    trendline: TrendlineResult,
    data: List[OHLCVData],
    tolerance: float = 0.01
) -> float
```

Calculates trendline strength score (0-100).

**Returns:** Strength score between 0 and 100

##### detect_angle_classification()

```python
detect_angle_classification(
    trendline: TrendlineResult,
    data: List[OHLCVData]
) -> str
```

Classifies trendline angle.

**Returns:** "STEEP", "MODERATE", or "FLAT"

##### filter_weak_trendlines()

```python
filter_weak_trendlines(
    trendlines: List[TrendlineResult],
    data: List[OHLCVData],
    tolerance: float = 0.01
) -> List[TrendlineResult]
```

Filters out weak trendlines based on validation criteria.

**Returns:** List of strong trendlines, sorted by strength (highest first)

##### validate_and_score_trendline()

```python
validate_and_score_trendline(
    trendline: TrendlineResult,
    data: List[OHLCVData],
    tolerance: float = 0.01
) -> Optional[dict]
```

Comprehensive validation returning all metrics.

**Returns:** Dictionary with validation metrics:
```python
{
    "is_valid": bool,
    "strength": float,
    "touches": int,
    "angle": str,
    "r_squared": float,
    "slope": float
}
```

### Standalone Functions

##### detect_and_validate_trendlines()

```python
detect_and_validate_trendlines(
    data: List[OHLCVData],
    min_touches: int = 2,
    min_r_squared: float = 0.7,
    min_strength: float = 40.0,
    tolerance: float = 0.01
) -> List[dict]
```

High-level function combining detection and validation.

**Returns:** List of validated trendlines with metrics:
```python
[
    {
        "trendline": TrendlineResult,
        "strength": float,
        "touches": int,
        "angle": str,
        "r_squared": float,
        "slope": float
    },
    ...
]
```

Results are sorted by strength score (highest first).

## Usage Examples

### Example 1: Basic Trendline Validation

```python
from models import OHLCVData
from calculators.trendlines import detect_and_validate_trendlines

# Assume market_data is a List[OHLCVData]
results = detect_and_validate_trendlines(
    market_data,
    min_touches=2,
    min_r_squared=0.7,
    min_strength=40.0
)

if results:
    best_trendline = results[0]  # Highest strength
    print(f"Best trendline strength: {best_trendline['strength']:.2f}")
    print(f"Angle: {best_trendline['angle']}")
    print(f"Touches: {best_trendline['touches']}")
else:
    print("No valid trendlines found")
```

### Example 2: Custom Validation Thresholds

```python
from calculators.trendline_validator import TrendlineValidator

# Create validator with strict requirements
strict_validator = TrendlineValidator(
    min_touches=5,      # Require more touches
    min_r_squared=0.8,  # Higher R² requirement
    min_strength=60.0   # Higher strength requirement
)

# Validate individual trendline
metrics = strict_validator.validate_and_score_trendline(trendline, market_data)

if metrics and metrics["is_valid"]:
    print(f"High-quality trendline validated!")
    print(f"Strength: {metrics['strength']:.2f}")
    print(f"Angle: {metrics['angle']}")
else:
    print("Trendline does not meet strict criteria")
```

### Example 3: Trading Strategy Integration

```python
from calculators.trendlines import detect_and_validate_trendlines

# Detect trendlines with validation
results = detect_and_validate_trendlines(market_data)

for result in results:
    strength = result["strength"]
    angle = result["angle"]
    trendline = result["trendline"]
    
    # Trading logic based on validation metrics
    if strength >= 80:
        if angle == "STEEP":
            print(f"Strong steep trend - Use wide stop loss")
            stop_loss_pct = 0.05  # 5%
        elif angle == "MODERATE":
            print(f"Strong sustainable trend - Ideal for entry")
            stop_loss_pct = 0.03  # 3%
        else:  # FLAT
            print(f"Strong but flat trend - Consider range trading")
            stop_loss_pct = 0.02  # 2%
        
        # Calculate entry based on trendline
        latest_index = len(market_data) - 1
        expected_price = trendline.slope * latest_index + trendline.intercept
        
        print(f"Expected price at trendline: {expected_price:.2f}")
        print(f"Recommended stop loss: {stop_loss_pct * 100}%")
```

### Example 4: Filtering for High-Quality Only

```python
from calculators.trendlines import detect_trendlines
from calculators.trendline_validator import TrendlineValidator

# Detect all trendlines (relaxed initial criteria)
all_trendlines = detect_trendlines(market_data, min_touches=2, min_r_squared=0.5)

# Create validator for high-quality filtering
validator = TrendlineValidator(min_r_squared=0.8, min_strength=70.0)

# Filter to only high-quality trendlines
high_quality = validator.filter_weak_trendlines(all_trendlines, market_data)

print(f"Found {len(all_trendlines)} trendlines total")
print(f"Found {len(high_quality)} high-quality trendlines")

for trendline in high_quality:
    strength = validator.calculate_strength_score(trendline, market_data)
    angle = validator.detect_angle_classification(trendline, market_data)
    print(f"  Strength: {strength:.2f}, Angle: {angle}, R²: {trendline.r_squared:.3f}")
```

## Testing

The trendline validation module has comprehensive test coverage:

### Unit Tests (`test_trendline_validator.py`)
- Validator initialization and parameter validation
- Touch counting and validation
- Strength score calculation
- Angle classification
- Weak trendline filtering
- Comprehensive validation metrics

Run unit tests:
```bash
pytest tests/test_trendline_validator.py -v
```

### Integration Tests (`test_trendline_integration.py`)
- End-to-end detection and validation
- Strong vs weak trend differentiation
- Threshold enforcement
- Result structure and sorting
- Edge cases and error handling

Run integration tests:
```bash
pytest tests/test_trendline_integration.py -v
```

## Performance Considerations

### Time Complexity
- Touch counting: O(n) where n is number of data points
- Strength calculation: O(n) for touch counting
- Angle classification: O(n) for average price calculation
- Filtering: O(m×n) where m is number of trendlines, n is data points

### Recommendations
- Use appropriate tolerance values (0.01-0.05 typical)
- Cache validation results when analyzing multiple timeframes
- Filter early with R² before expensive touch counting
- Adjust thresholds based on asset volatility

## Best Practices

1. **Start with default thresholds** and adjust based on backtesting results
2. **Use stricter criteria for higher timeframes** (daily vs intraday)
3. **Consider market volatility** when setting tolerance
4. **Validate angle classification** against your risk management rules
5. **Combine strength score with other indicators** for confirmation
6. **Re-validate trendlines** as new data arrives
7. **Document your threshold choices** for different trading strategies

## Troubleshooting

### No trendlines detected
- Check if data has sufficient swing points (needs local extrema)
- Reduce `min_r_squared` threshold temporarily
- Reduce `min_strength` threshold
- Increase `tolerance` parameter

### Too many weak trendlines
- Increase `min_r_squared` threshold (e.g., 0.8)
- Increase `min_strength` threshold (e.g., 60.0)
- Increase `min_touches` requirement (e.g., 3 or 4)

### Unexpected angle classifications
- Adjust `steep_angle_threshold` and `flat_angle_threshold`
- Verify average price calculation is appropriate for your data
- Consider asset-specific thresholds

## References

- **Requirements**: Requirement 3.1 (Quantitative Analysis Engine)
- **Task**: Task 36.2 (Implement Trendline Validation)
- **Parent Task**: Task 36 (Implement Trendline Calculation)
- **Related Modules**:
  - `calculators/trendlines.py` - Core trendline detection
  - `calculators/swing_detector.py` - Swing point detection
  - `models/market_data.py` - Data models

## Version History

- **v1.0.0** (2024-01-15): Initial implementation
  - Minimum touch point validation
  - Strength score calculation (R² + touch count)
  - Angle classification (STEEP/MODERATE/FLAT)
  - Weak trendline filtering
  - Comprehensive validation metrics

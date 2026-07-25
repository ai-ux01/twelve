# Liquidity Analyzer Service

## Overview

The Liquidity Analyzer Service is a component of the ProfitTerminal Quant Engine that analyzes options contracts to identify illiquid contracts based on multiple criteria. It provides both individual contract warnings and summary metrics for the entire options chain.

**Requirements:** 7.1, 8.1

## Features

### Liquidity Detection Criteria

The service identifies illiquid contracts based on four key criteria:

1. **Wide Bid-Ask Spread**: Spread > 5% of mid-price (configurable)
2. **Low Volume**: Trading volume < 100 contracts (configurable)
3. **Low Open Interest**: Open interest < 500 contracts (configurable)
4. **Deep Out-of-the-Money (OTM)**: > 10% away from ATM strike (configurable)

### Output

The service provides:

- **Individual Contract Analysis**: Each contract receives liquidity warnings indicating which criteria are violated
- **Summary Metrics**: Aggregate statistics including:
  - Total contracts analyzed
  - Count of liquid vs illiquid contracts
  - Average volume, OI, and bid-ask spread
  - Count of contracts triggering each warning type
  - List of all illiquid contracts with detailed information

## Usage

### Basic Example

```python
from services.liquidity_analyzer import (
    LiquidityAnalyzer,
    OptionContractInput,
)

# Create analyzer with default thresholds
analyzer = LiquidityAnalyzer(
    wide_spread_threshold=5.0,      # 5% spread threshold
    low_volume_threshold=100,       # Volume < 100
    low_oi_threshold=500,           # OI < 500
    deep_otm_threshold=10.0,        # > 10% from ATM
)

# Create option contracts
contracts = [
    OptionContractInput(
        strike_price=21500,
        option_type="CALL",
        bid=100.0,
        ask=102.0,
        ltp=101.0,
        volume=5000,
        open_interest=15000,
    ),
    # ... more contracts
]

# Analyze liquidity
atm_strike = 21500
metrics = analyzer.analyze_liquidity(contracts, atm_strike)

# Access summary metrics
print(f"Total Contracts: {metrics.total_contracts}")
print(f"Illiquid Contracts: {metrics.illiquid_contracts}")
print(f"Average Bid-Ask Spread: {metrics.average_bid_ask_spread:.2f}%")

# Check illiquid contracts
for contract in metrics.illiquid_contracts_list:
    if contract.liquidity_warning.wide_bid_ask_spread:
        print(f"Wide spread detected: {contract.strike_price} {contract.option_type}")
```

### Custom Thresholds

You can customize the detection thresholds:

```python
# More strict thresholds
strict_analyzer = LiquidityAnalyzer(
    wide_spread_threshold=3.0,      # More strict: 3% spread
    low_volume_threshold=200,       # Higher minimum: 200 contracts
    low_oi_threshold=1000,          # Higher minimum: 1000 OI
    deep_otm_threshold=8.0,         # Tighter: 8% from ATM
)

# More lenient thresholds
lenient_analyzer = LiquidityAnalyzer(
    wide_spread_threshold=10.0,     # More lenient: 10% spread
    low_volume_threshold=50,        # Lower minimum: 50 contracts
    low_oi_threshold=200,           # Lower minimum: 200 OI
    deep_otm_threshold=15.0,        # Wider: 15% from ATM
)
```

## Data Models

### Input Models

#### OptionContractInput

Input model for a single option contract to be analyzed.

```python
OptionContractInput(
    strike_price: float,      # Strike price (> 0)
    option_type: str,         # "CALL" or "PUT"
    bid: float,               # Bid price (>= 0)
    ask: float,               # Ask price (>= 0)
    ltp: float,               # Last traded price (>= 0)
    volume: int,              # Trading volume (>= 0)
    open_interest: int,       # Open interest (>= 0)
)
```

### Output Models

#### LiquidityMetrics

Summary liquidity metrics for the entire options chain.

```python
LiquidityMetrics(
    total_contracts: int,               # Total contracts analyzed
    liquid_contracts: int,              # Count of liquid contracts
    illiquid_contracts: int,            # Count of illiquid contracts
    average_volume: float,              # Average volume across all
    average_oi: float,                  # Average OI across all
    average_bid_ask_spread: float,      # Average spread % across all
    wide_spread_count: int,             # Contracts with wide spreads
    low_volume_count: int,              # Contracts with low volume
    low_oi_count: int,                  # Contracts with low OI
    deep_otm_count: int,                # Deep OTM contracts
    illiquid_contracts_list: List[ContractLiquidity],  # Details
)
```

#### ContractLiquidity

Liquidity analysis for a single option contract.

```python
ContractLiquidity(
    strike_price: float,
    option_type: str,
    bid: float,
    ask: float,
    ltp: float,
    mid_price: float,                   # Calculated: (bid + ask) / 2
    bid_ask_spread: float,              # Calculated: ask - bid
    bid_ask_spread_percent: float,      # Calculated: (spread / mid) * 100
    volume: int,
    open_interest: int,
    distance_from_atm_percent: float,   # Calculated: abs distance from ATM
    liquidity_warning: LiquidityWarning,  # Warning flags
)
```

#### LiquidityWarning

Liquidity warning flags for a contract.

```python
LiquidityWarning(
    wide_bid_ask_spread: bool,   # True if spread > threshold
    low_volume: bool,            # True if volume < threshold
    low_oi: bool,                # True if OI < threshold
    deep_otm: bool,              # True if > threshold % from ATM
)

# Helper properties
warning.is_illiquid          # True if any warning flag is set
warning.warning_count        # Count of warning flags set (0-4)
```

## Calculations

### Bid-Ask Spread Percentage

```
mid_price = (bid + ask) / 2
spread = ask - bid
spread_percent = (spread / mid_price) * 100
```

If mid_price is 0 (both bid and ask are 0), the spread percentage is set to 100% to indicate extreme illiquidity.

### Distance from ATM

```
distance_percent = abs(strike_price - atm_strike) / atm_strike * 100
```

The distance calculation uses absolute value, so both calls above ATM and puts below ATM are treated the same way.

## Integration with Options Chain Analysis

The Liquidity Analyzer is designed to work alongside the Options Analysis Service:

```python
from services import (
    OptionsAnalysisService,
    LiquidityAnalyzer,
)

# 1. Perform options analysis (PCR, ATM, OI)
options_service = OptionsAnalysisService()
analysis_result = options_service.analyze(
    symbol="NIFTY",
    spot_price=21500,
    contracts=option_contracts,
)

# 2. Use ATM strike from analysis for liquidity check
liquidity_analyzer = LiquidityAnalyzer()
liquidity_metrics = liquidity_analyzer.analyze_liquidity(
    contracts=option_contract_inputs,
    atm_strike=analysis_result.atm_analysis.atm_strike,
)

# 3. Filter out illiquid contracts if needed
liquid_contracts = [
    c for c in contracts
    if c not in liquidity_metrics.illiquid_contracts_list
]
```

## Testing

The service includes comprehensive unit tests covering:

- Liquid contract detection (no warnings)
- Wide bid-ask spread detection
- Low volume detection
- Low open interest detection
- Deep OTM detection
- Multiple simultaneous warnings
- Summary metrics calculation
- Edge cases (zero prices, invalid inputs)
- Custom threshold configuration

Run tests:

```bash
python -m pytest tests/test_liquidity_analyzer.py -v
```

## Demo

A demo script is provided to show the analyzer in action:

```bash
python demo_liquidity_analyzer.py
```

The demo shows:
- Configuration of thresholds
- Analysis of a mix of liquid and illiquid contracts
- Summary metrics output
- Detailed information for each illiquid contract

## Performance Considerations

The Liquidity Analyzer is designed for efficiency:

- **Time Complexity**: O(n) where n is the number of contracts
- **Space Complexity**: O(n) for storing contract results
- **No External Dependencies**: All calculations are performed in-memory
- **Deterministic**: Same inputs always produce same outputs

For typical options chains (100-200 contracts), analysis completes in milliseconds.

## Error Handling

The service validates inputs and raises appropriate errors:

```python
# Empty contracts list
ValueError: "No contracts provided for liquidity analysis"

# Invalid ATM strike
ValueError: "Invalid ATM strike: {value}"
```

## Best Practices

1. **Use ATM from Options Analysis**: Get ATM strike from `OptionsAnalysisService` rather than estimating manually
2. **Adjust Thresholds by Market**: Different markets (NIFTY vs BANKNIFTY) may need different thresholds
3. **Consider Multiple Factors**: A contract triggering multiple warnings is more illiquid than one with a single warning
4. **Filter Before Trading**: Exclude illiquid contracts from trading recommendations to protect users
5. **Monitor Trends**: Track average liquidity metrics over time to detect market conditions

## Future Enhancements

Potential improvements for future versions:

- **Time-of-day Awareness**: Different thresholds for market open vs close
- **Relative Liquidity Scoring**: Score contracts relative to chain average
- **Historical Liquidity Tracking**: Track liquidity changes over time
- **Market Maker Detection**: Identify if spreads are due to lack of market makers
- **Liquidity Heat Maps**: Visual representation of liquidity across strikes

## References

- Requirements: 7.1 (Options Analysis), 8.1 (Risk Validation)
- Related Services: `OptionsAnalysisService`
- Integration: Backend API OptionsService (Task 69.1)

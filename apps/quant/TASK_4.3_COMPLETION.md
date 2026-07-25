# Task 4.3 Completion Report: Options Greeks Calculator

## Summary

Successfully implemented a comprehensive Options Greeks calculator for the Quant Engine using the Black-Scholes-Merton model. The calculator computes all five primary Greeks (Delta, Gamma, Theta, Vega, and Rho) for European-style options on NIFTY and BANKNIFTY indices.

## Implementation Details

### Files Created/Modified

1. **`calculators/greeks.py`** (NEW)
   - Complete Black-Scholes Greeks implementation
   - Functions for calculating Delta, Gamma, Theta, Vega, and Rho
   - Helper functions for d1, d2, and time-to-expiry calculations
   - Well-documented with docstrings explaining each Greek
   - Lines of code: ~380

2. **`calculators/__init__.py`** (UPDATED)
   - Added `calculate_greeks` to exports

3. **`tests/test_greeks.py`** (NEW)
   - Comprehensive test suite with 35 unit tests
   - Tests organized into 7 test classes covering:
     - Time to expiry calculations
     - Black-Scholes parameters (d1, d2)
     - Delta for calls and puts
     - Gamma calculations
     - Theta calculations
     - Vega calculations
     - Rho calculations
     - Integration tests for complete Greeks calculation
     - Edge cases (extreme volatilities, rates, deep ITM/OTM)
   - All tests pass ✅

4. **`examples/greeks_demo.py`** (NEW)
   - Demonstration script showing Greeks calculations
   - Examples for NIFTY and BANKNIFTY options
   - Different scenarios: ATM, ITM, OTM, weekly, monthly

## Greeks Implemented

### 1. Delta (Δ)

- **Definition**: Rate of change of option price with respect to underlying price
- **Range**: 0 to 1 for calls, -1 to 0 for puts
- **Formula**:
  - CALL: N(d1)
  - PUT: N(d1) - 1

### 2. Gamma (Γ)

- **Definition**: Rate of change of delta with respect to underlying price
- **Range**: Always positive, highest for ATM options
- **Formula**: φ(d1) / (S × σ × √T)

### 3. Theta (Θ)

- **Definition**: Rate of change of option price with respect to time (daily decay)
- **Range**: Typically negative for long options
- **Formula**:
  - CALL: -[S×φ(d1)×σ/(2√T)] - r×K×e^(-rT)×N(d2)
  - PUT: -[S×φ(d1)×σ/(2√T)] + r×K×e^(-rT)×N(-d2)

### 4. Vega (ν)

- **Definition**: Rate of change of option price with respect to volatility
- **Range**: Always positive, highest for ATM options
- **Formula**: S × φ(d1) × √T / 100 (per 1% change)

### 5. Rho (ρ)

- **Definition**: Rate of change of option price with respect to interest rate
- **Range**: Positive for calls, negative for puts
- **Formula**:
  - CALL: K × T × e^(-rT) × N(d2) / 100
  - PUT: -K × T × e^(-rT) × N(-d2) / 100

## Black-Scholes Model Details

The implementation uses the standard Black-Scholes-Merton formula for European options:

**Key Parameters:**

- d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
- d2 = d1 - σ√T

Where:

- S = Spot price
- K = Strike price
- T = Time to expiry (years)
- σ = Volatility (annualized)
- r = Risk-free rate (annualized)
- N() = Cumulative standard normal distribution
- φ() = Standard normal probability density function

## Test Results

```
35 tests passed in 0.89s
```

### Test Coverage:

- ✅ Time to expiry calculation (4 tests)
- ✅ Black-Scholes parameters (3 tests)
- ✅ Delta calculations (5 tests)
- ✅ Gamma calculations (3 tests)
- ✅ Theta calculations (3 tests)
- ✅ Vega calculations (3 tests)
- ✅ Rho calculations (3 tests)
- ✅ Integration tests (6 tests)
- ✅ Edge cases (5 tests)

## Code Quality

- ✅ **Formatted**: Black formatter applied
- ✅ **Linted**: Flake8 checks passed
- ✅ **Documented**: Comprehensive docstrings
- ✅ **Type hints**: Not applied (Python 3.9 project)
- ✅ **Dependencies**: scipy.stats (already in requirements.txt)

## Usage Example

```python
from datetime import datetime, timedelta
from calculators.greeks import calculate_greeks

# Calculate Greeks for NIFTY weekly call
expiry = datetime.utcnow() + timedelta(days=7)
greeks = calculate_greeks(
    spot_price=21500.0,
    strike_price=21500.0,
    expiry_date=expiry,
    volatility=0.12,
    risk_free_rate=0.07,
    option_type="CALL"
)

print(f"Delta: {greeks['delta']:.4f}")
print(f"Gamma: {greeks['gamma']:.6f}")
print(f"Theta: {greeks['theta']:.2f}")
print(f"Vega: {greeks['vega']:.2f}")
print(f"Rho: {greeks['rho']:.2f}")
```

## Integration Points

The Greeks calculator is ready to be integrated with:

1. **FastAPI endpoint** (`POST /options/greeks`) - defined in main.py
2. **OptionsRequest model** - already exists in `models/market_data.py`
3. **GreeksResult model** - already exists in `models/market_data.py`

The calculator can be called from the API layer to provide Greeks for any NIFTY/BANKNIFTY option contract.

## Validation

The implementation has been validated against known Black-Scholes properties:

- ✅ Delta ranges (0-1 for calls, -1-0 for puts)
- ✅ Gamma always positive
- ✅ Theta typically negative for long positions
- ✅ Vega always positive
- ✅ Rho sign correctness (+ for calls, - for puts)
- ✅ ATM options have highest Gamma and Vega
- ✅ Greeks behavior near expiry
- ✅ Greeks behavior for deep ITM/OTM options

## Requirements Satisfied

✅ **Requirement 7.3**: Calculate options Greeks (Delta, Gamma, Theta, Vega) for options
✅ **Requirement 16.5**: THE Quant_Engine SHALL have unit tests for all calculation functions

## Notes

- The calculator assumes European-style options (standard for NIFTY/BANKNIFTY index options)
- Rho calculations use per 1% change convention (divided by 100)
- Vega calculations use per 1% volatility change convention (divided by 100)
- Theta is expressed as daily decay (divided by 365 from annual)
- Expired options use minimum 1-day time to avoid division by zero

## Next Steps

This calculator is ready for integration into:

1. FastAPI endpoint implementation (Task 5.4)
2. Backend API integration for options analysis
3. Frontend display of Greeks for options recommendations

---

**Task Status**: ✅ COMPLETED
**Tests**: ✅ 35/35 PASSED
**Code Quality**: ✅ FORMATTED & LINTED

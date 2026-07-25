"""Debug price action detection."""

from calculators.price_action import PriceActionAnalyzer

analyzer = PriceActionAnalyzer(lookback_period=2, momentum_period=5)

# Downtrend data
highs = [119, 117, 119, 121, 115, 113, 115, 111, 109, 111, 107, 105, 107, 103, 101]
lows = [116, 112, 116, 119, 112, 108, 112, 108, 104, 108, 104, 100, 104, 101, 97]

# Find swing highs and lows
swing_highs = analyzer._find_swing_highs(highs)
swing_lows = analyzer._find_swing_lows(lows)

print("Highs:", highs)
print("Swing Highs:", swing_highs)
print()
print("Lows:", lows)
print("Swing Lows:", swing_lows)
print()

# Analyze trend
trend_result = analyzer._analyze_trend_pattern(highs, lows)
print("Trend analysis:", trend_result)

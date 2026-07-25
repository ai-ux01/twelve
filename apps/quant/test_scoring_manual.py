#!/usr/bin/env python3
"""Manual test of IntradayScoringService implementation."""

import sys
sys.path.insert(0, '/Users/anshulkumar/Desktop/twelve/apps/quant')

# Direct imports to avoid module initialization issues
from pydantic import BaseModel, Field
from typing import List, Optional

# Import scoring service components
import importlib.util
spec = importlib.util.spec_from_file_location(
    "intraday_scoring", 
    "/Users/anshulkumar/Desktop/twelve/apps/quant/services/intraday_scoring_service.py"
)
scoring_module = importlib.util.module_from_spec(spec)

# Mock the models we need
class MACDIndicator(BaseModel):
    value: float
    signal: float
    histogram: float

class BollingerBands(BaseModel):
    upper: float
    middle: float
    lower: float

class IntradayTechnicalAnalysis(BaseModel):
    rsi: float
    macd: MACDIndicator
    ema_9: float
    ema_21: float
    ema_50: float
    vwap: float
    atr: float
    volume: int
    relative_volume: float
    bollinger_bands: BollingerBands
    support_levels: List[float] = []
    resistance_levels: List[float] = []

# Inject mocks into the module
import models.intraday as intraday_models
intraday_models.IntradayTechnicalAnalysis = IntradayTechnicalAnalysis
intraday_models.MACDIndicator = MACDIndicator
intraday_models.BollingerBands = BollingerBands

# Now load the scoring service
spec.loader.exec_module(scoring_module)

IntradayScoringService = scoring_module.IntradayScoringService

# Create test data
analysis = IntradayTechnicalAnalysis(
    rsi=60.0,
    macd=MACDIndicator(value=2.0, signal=1.5, histogram=0.5),
    ema_9=98.0,
    ema_21=95.0,
    ema_50=93.0,
    vwap=97.0,
    atr=2.0,
    volume=150000,
    relative_volume=1.5,
    bollinger_bands=BollingerBands(upper=105.0, middle=100.0, lower=95.0),
)

# Create scoring service
print("Creating IntradayScoringService...")
service = IntradayScoringService()

print("\nDefault weights:")
print(f"  Trend: {service.weights['trend']*100}%")
print(f"  Momentum: {service.weights['momentum']*100}%")
print(f"  Volume: {service.weights['volume']*100}%")
print(f"  VWAP: {service.weights['vwap']*100}%")
print(f"  Opening Range: {service.weights['opening_range']*100}%")
print(f"  Prev Day Levels: {service.weights['prev_day_levels']*100}%")
print(f"  Risk/Reward: {service.weights['risk_reward']*100}%")

# Test scoring
print("\nCalculating score...")
result = service.calculate_score(
    current_price=100.0,
    technical_analysis=analysis,
    stop_loss=98.0,
    target=104.0,
)

print(f"\n{'='*60}")
print(f"INTRADAY SCORING RESULT")
print(f"{'='*60}")
print(f"\nTotal Score: {result.total_score:.2f} / 100")
print(f"Strength: {result.strength}")

print(f"\n{'Component Scores:':<40}")
print(f"{'  Trend:':<40} {result.components.trend_score:.2f}")
print(f"{'  Momentum:':<40} {result.components.momentum_score:.2f}")
print(f"{'  Volume:':<40} {result.components.volume_score:.2f}")
print(f"{'  VWAP:':<40} {result.components.vwap_score:.2f}")
print(f"{'  Opening Range:':<40} {result.components.opening_range_score:.2f}")
print(f"{'  Prev Day Levels:':<40} {result.components.prev_day_levels_score:.2f}")
print(f"{'  Risk/Reward:':<40} {result.components.risk_reward_score:.2f}")

print(f"\nSignals ({len(result.signals)} total):")
for i, signal in enumerate(result.signals, 1):
    print(f"  {i}. {signal}")

print(f"\n{'='*60}")
print("Test completed successfully!")
print(f"{'='*60}")

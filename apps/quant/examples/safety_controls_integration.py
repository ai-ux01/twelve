"""
Example integration of Safety Controls with Swing Scanner.

This example shows how to integrate the safety controls service
with the swing trading scanner to prevent unfavorable trades.

Requirements: 5.7, 12.2
"""

from datetime import datetime, timedelta
from typing import List, Optional

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.market_data import OHLCVData
from models.swing import (
    SwingCandidate,
    Signal,
    SetupType,
    ComponentScoresBreakdown,
    KeyMetricsSummary,
)
from services.swing_analysis_service import SwingAnalysisService
from services.swing_scoring_service import SwingScoringService
from services.safety_controls import SafetyControlsService, SafetyThresholds


def generate_mock_data(symbol: str, days: int = 300) -> List[OHLCVData]:
    """Generate mock OHLCV data for demonstration."""
    base_time = datetime.utcnow() - timedelta(days=days)
    data = []

    base_price = 2450.0 + hash(symbol) % 500

    for i in range(days):
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=base_price + i * 0.5,
                high=base_price + i * 0.5 + 20,
                low=base_price + i * 0.5 - 15,
                close=base_price + i * 0.5 + 10,
                volume=1000000 + i * 10000,
            )
        )

    return data


def analyze_with_safety_controls(
    symbol: str,
    data: List[OHLCVData],
    safety_service: SafetyControlsService,
) -> Optional[SwingCandidate]:
    """
    Analyze a stock with safety controls.

    This function demonstrates the complete flow:
    1. Perform technical analysis
    2. Calculate score
    3. Validate with safety controls
    4. Create SwingCandidate with appropriate signal

    Args:
        symbol: Trading symbol
        data: OHLCV data
        safety_service: Safety controls service

    Returns:
        SwingCandidate or None if data is insufficient
    """
    print(f"\n{'=' * 70}")
    print(f"Analyzing {symbol} with Safety Controls")
    print("=" * 70)

    # Step 1: Technical Analysis
    print("\nStep 1: Performing technical analysis...")
    analysis_service = SwingAnalysisService()

    try:
        analysis = analysis_service.analyze(
            symbol=symbol,
            timeframe="1d",
            data=data,
            include_trendlines=True,
        )
        print(f"✓ Technical analysis complete")
    except Exception as e:
        print(f"✗ Technical analysis failed: {e}")
        return None

    # Step 2: Calculate Score
    print("\nStep 2: Calculating swing trading score...")
    scoring_service = SwingScoringService()

    current_price = data[-1].close
    indicators = analysis.indicators
    volume_analysis = analysis.volume_analysis

    # Mock values (in production, these would come from real analysis)
    sector_comparison = 70.0
    market_comparison = 65.0
    sector_strength = 68.0

    # Detect breakout
    breakout_detected = False
    volume_confirmed = False
    retest_detected = False

    if analysis.trendline_analysis and "breakout" in analysis.trendline_analysis:
        breakout = analysis.trendline_analysis["breakout"]
        breakout_detected = breakout.get("breakout_type") is not None
        volume_confirmed = breakout.get("confirmed", False)

    # Calculate entry, stop, target
    entry_price = current_price
    stop_loss = current_price * 0.97  # 3% stop
    target = current_price * 1.06  # 6% target
    risk_reward = (target - entry_price) / (entry_price - stop_loss)

    scoring_result = scoring_service.calculate_total_score(
        current_price=current_price,
        ema_20=indicators.ema_20,
        ema_50=indicators.ema_50,
        ema_200=indicators.ema_200,
        adx=indicators.adx,
        rsi=indicators.rsi,
        macd_histogram=indicators.macd.histogram,
        atr=indicators.atr,
        relative_volume=indicators.relative_volume,
        volume_trend=volume_analysis["volume_trend"],
        sector_comparison=sector_comparison,
        market_comparison=market_comparison,
        breakout_detected=breakout_detected,
        volume_confirmed=volume_confirmed,
        retest_detected=retest_detected,
        sector_strength=sector_strength,
        entry_price=entry_price,
        stop_loss=stop_loss,
        target=target,
    )

    print(f"✓ Score calculated: {scoring_result.total_score:.1f}/100")

    # Step 3: Safety Controls Validation
    print("\nStep 3: Validating with safety controls...")

    # Determine market regime (mock - in production this would be calculated)
    market_regime = (
        "BULL_MARKET" if current_price > indicators.ema_200 else "BEAR_MARKET"
    )
    market_regime_strength = 0.75 if market_regime == "BULL_MARKET" else 0.65

    # Check if we have support/resistance and trendlines
    has_support_resistance = len(analysis.support_resistance) > 0
    has_trendlines = (
        analysis.trendline_analysis is not None
        and "error" not in analysis.trendline_analysis
    )

    # Mock AI signal and confidence (in production, this comes from AI service)
    ai_signal = "BUY" if scoring_result.total_score >= 70 else "HOLD"
    ai_confidence = min(1.0, scoring_result.total_score / 100.0)

    # Validate with safety controls
    safety_result = safety_service.validate_recommendation(
        score=scoring_result.total_score,
        risk_reward_ratio=risk_reward,
        market_regime=market_regime,
        market_regime_strength=market_regime_strength,
        has_support_resistance=has_support_resistance,
        has_trendlines=has_trendlines,
        ai_signal=ai_signal,
        ai_confidence=ai_confidence,
        symbol=symbol,
        additional_context={
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "target": target,
            "setup_type": "BREAKOUT" if breakout_detected else "CONTINUATION",
        },
    )

    # Print safety result
    if safety_result.passed:
        print(f"✓ Safety check PASSED")
        print(f"  Decision: {safety_result.decision.value}")
        print(f"  {safety_result.recommendation}")
    else:
        print(f"✗ Safety check FAILED")
        print(f"  Decision: {safety_result.decision.value}")
        print(f"  {safety_result.recommendation}")
        print(f"\n  Violations ({len(safety_result.violations)}):")
        for violation in safety_result.violations:
            print(f"    - [{violation.severity}] {violation.rule}")
            print(f"      {violation.message}")

    # Step 4: Create SwingCandidate
    print("\nStep 4: Creating SwingCandidate...")

    # Determine final signal based on safety check
    if safety_result.passed and ai_signal == "BUY":
        final_signal = Signal.BUY
    elif safety_result.passed and ai_signal == "SELL":
        final_signal = Signal.SELL
    else:
        final_signal = Signal.NO_TRADE

    # Determine setup type
    if breakout_detected:
        setup_type = SetupType.BREAKOUT
    elif retest_detected:
        setup_type = SetupType.RETEST
    else:
        setup_type = SetupType.CONTINUATION

    # Create component scores breakdown
    component_scores = ComponentScoresBreakdown(
        trend_score=scoring_result.components.trend_score,
        technical_score=scoring_result.components.technical_score,
        volume_score=scoring_result.components.volume_score,
        relative_strength_score=scoring_result.components.relative_strength_score,
        breakout_score=scoring_result.components.breakout_score,
        sector_score=scoring_result.components.sector_score,
        risk_reward_score=scoring_result.components.risk_reward_score,
    )

    # Create key metrics summary
    key_metrics = KeyMetricsSummary(
        current_price=current_price,
        volume=int(data[-1].volume),
        trend_direction=(
            "UPTREND" if current_price > indicators.ema_200 else "DOWNTREND"
        ),
        rsi=indicators.rsi,
        adx=indicators.adx,
        relative_volume=indicators.relative_volume,
        distance_from_52w_high=indicators.week_52_high
        and ((current_price - indicators.week_52_high) / indicators.week_52_high) * 100
        or 0.0,
        distance_from_52w_low=indicators.week_52_low
        and ((current_price - indicators.week_52_low) / indicators.week_52_low) * 100
        or 0.0,
    )

    # Generate rationale
    if final_signal == Signal.NO_TRADE:
        rationale = f"NO TRADE: {safety_result.recommendation}"
    else:
        rationale = (
            f"{len(scoring_result.signals)} technical signals detected. "
            + scoring_result.signals[0]
        )

    candidate = SwingCandidate(
        symbol=symbol,
        name=f"{symbol} Limited",  # Mock name
        score=scoring_result.total_score,
        sector="Technology",  # Mock sector
        signal=final_signal,
        setup_type=setup_type,
        entry=entry_price,
        stop_loss=stop_loss,
        target=target,
        risk_reward=risk_reward,
        component_scores=component_scores,
        key_metrics=key_metrics,
        rationale=rationale,
    )

    print(f"✓ SwingCandidate created:")
    print(f"  Signal: {candidate.signal.value}")
    print(f"  Setup: {candidate.setup_type.value}")
    print(f"  Score: {candidate.score:.1f}")
    print(f"  Entry: {candidate.entry:.2f}")
    print(f"  Stop: {candidate.stop_loss:.2f}")
    print(f"  Target: {candidate.target:.2f}")
    print(f"  R:R: {candidate.risk_reward:.2f}")

    return candidate


def main():
    """Run safety controls integration examples."""
    print("=" * 70)
    print("SAFETY CONTROLS INTEGRATION EXAMPLE")
    print("=" * 70)
    print("\nThis example shows how to integrate safety controls")
    print("with the swing trading scanner.")

    # Initialize safety controls with default thresholds
    safety_service = SafetyControlsService()

    print("\nSafety Thresholds:")
    print(f"  - Min Score: {safety_service.thresholds.min_score}")
    print(f"  - Min Risk/Reward: {safety_service.thresholds.min_risk_reward}")
    print(
        f"  - Bear Market Threshold: {safety_service.thresholds.bear_market_threshold}"
    )
    print(f"  - Min AI Confidence: {safety_service.thresholds.min_ai_confidence}")

    # Example 1: High-quality candidate (should pass)
    print("\n" + "=" * 70)
    print("EXAMPLE 1: High-Quality Candidate")
    print("=" * 70)

    data1 = generate_mock_data("RELIANCE", days=300)
    candidate1 = analyze_with_safety_controls("RELIANCE", data1, safety_service)

    # Example 2: Low-quality candidate (should fail)
    print("\n" + "=" * 70)
    print("EXAMPLE 2: Low-Quality Candidate (Simulated)")
    print("=" * 70)
    print("\nNote: This example simulates a low-quality setup by using")
    print("custom thresholds that would reject a marginal candidate.")

    # Create stricter thresholds for this example
    strict_thresholds = SafetyThresholds(
        min_score=80.0,  # Very high requirement
        min_risk_reward=3.0,
    )
    strict_safety = SafetyControlsService(thresholds=strict_thresholds)

    data2 = generate_mock_data("TCS", days=300)
    candidate2 = analyze_with_safety_controls("TCS", data2, strict_safety)

    # Summary
    print("\n" + "=" * 70)
    print("INTEGRATION SUMMARY")
    print("=" * 70)
    print("\nThe safety controls service integrates seamlessly with:")
    print("  1. Swing Analysis Service (technical analysis)")
    print("  2. Swing Scoring Service (deterministic scoring)")
    print("  3. SwingCandidate model (final recommendations)")
    print("\nKey Benefits:")
    print("  ✓ Prevents low-quality trades automatically")
    print("  ✓ Respects AI NO_TRADE recommendations")
    print("  ✓ Enforces minimum score and R:R thresholds")
    print("  ✓ Blocks trades in strong bear markets")
    print("  ✓ Requires complete technical analysis data")
    print("  ✓ Maintains full audit trail")
    print("  ✓ Configurable for different risk profiles")
    print("\nIntegration Points:")
    print("  1. Add to swing_scanner_service.py: validate before creating candidates")
    print("  2. Add to API endpoints: validate before returning recommendations")
    print("  3. Store audit logs in database: complete compliance trail")
    print("=" * 70)


if __name__ == "__main__":
    main()

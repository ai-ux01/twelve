"""
Demo script for Swing Candidate Result Models.

Demonstrates how to create SwingCandidate and ScanResult instances
with proper data structures for the swing scanner output.

Requirements: 5.4
"""

from models.swing import (
    SwingCandidate,
    ScanResult,
    ComponentScoresBreakdown,
    KeyMetricsSummary,
    SetupType,
    Signal,
)


def demo_single_candidate():
    """Demonstrate creating a single swing candidate."""
    print("=" * 70)
    print("DEMO: Creating a Single SwingCandidate")
    print("=" * 70)

    # Create component scores breakdown
    component_scores = ComponentScoresBreakdown(
        trend_score=85.0,
        technical_score=75.0,
        volume_score=80.0,
        relative_strength_score=70.0,
        breakout_score=90.0,
        sector_score=65.0,
        risk_reward_score=75.0,
    )

    # Create key metrics summary
    key_metrics = KeyMetricsSummary(
        current_price=2460.0,
        volume=1200000,
        trend_direction="UPTREND",
        rsi=58.5,
        adx=32.4,
        relative_volume=1.35,
        distance_from_52w_high=-5.4,
        distance_from_52w_low=11.8,
    )

    # Create swing candidate
    candidate = SwingCandidate(
        symbol="RELIANCE",
        name="Reliance Industries Limited",
        score=78.5,
        sector="Energy",
        signal=Signal.BUY,
        setup_type=SetupType.BREAKOUT,
        entry=2460.0,
        stop_loss=2430.0,
        target=2520.0,
        risk_reward=2.0,
        component_scores=component_scores,
        key_metrics=key_metrics,
        rationale="Strong uptrend breakout with volume confirmation and favorable risk/reward",
    )

    print(f"\n✓ Candidate Created: {candidate.symbol}")
    print(f"  Score: {candidate.score}/100")
    print(f"  Signal: {candidate.signal.value}")
    print(f"  Setup: {candidate.setup_type.value}")
    print(f"  Entry: ₹{candidate.entry}")
    print(f"  Stop Loss: ₹{candidate.stop_loss}")
    print(f"  Target: ₹{candidate.target}")
    print(f"  Risk/Reward: {candidate.risk_reward}:1")
    print(f"\n  Component Scores:")
    print(f"    Trend: {candidate.component_scores.trend_score}")
    print(f"    Technical: {candidate.component_scores.technical_score}")
    print(f"    Volume: {candidate.component_scores.volume_score}")
    print(
        f"    Relative Strength: {candidate.component_scores.relative_strength_score}"
    )
    print(f"    Breakout: {candidate.component_scores.breakout_score}")
    print(f"    Sector: {candidate.component_scores.sector_score}")
    print(f"    Risk/Reward: {candidate.component_scores.risk_reward_score}")
    print(f"\n  Key Metrics:")
    print(f"    RSI: {candidate.key_metrics.rsi}")
    print(f"    ADX: {candidate.key_metrics.adx}")
    print(f"    Relative Volume: {candidate.key_metrics.relative_volume}x")
    print(
        f"    Distance from 52w High: {candidate.key_metrics.distance_from_52w_high}%"
    )
    print()

    return candidate


def demo_scan_result():
    """Demonstrate creating a complete scan result with multiple candidates."""
    print("=" * 70)
    print("DEMO: Creating a Complete ScanResult")
    print("=" * 70)

    # Create multiple candidates
    candidates = [
        SwingCandidate(
            symbol="RELIANCE",
            name="Reliance Industries Limited",
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
                risk_reward_score=75.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=2460.0,
                volume=1200000,
                trend_direction="UPTREND",
                rsi=58.5,
                adx=32.4,
                relative_volume=1.35,
                distance_from_52w_high=-5.4,
                distance_from_52w_low=11.8,
            ),
            rationale="Strong uptrend breakout with volume confirmation",
        ),
        SwingCandidate(
            symbol="TCS",
            name="Tata Consultancy Services",
            score=72.3,
            sector="Technology",
            signal=Signal.BUY,
            setup_type=SetupType.RETEST,
            entry=3500.0,
            stop_loss=3450.0,
            target=3600.0,
            risk_reward=2.0,
            component_scores=ComponentScoresBreakdown(
                trend_score=75.0,
                technical_score=70.0,
                volume_score=65.0,
                relative_strength_score=80.0,
                breakout_score=60.0,
                sector_score=85.0,
                risk_reward_score=70.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=3500.0,
                volume=800000,
                trend_direction="UPTREND",
                rsi=52.1,
                adx=28.7,
                relative_volume=1.15,
                distance_from_52w_high=-8.2,
                distance_from_52w_low=15.3,
            ),
            rationale="Successful retest of breakout level with sector strength",
        ),
        SwingCandidate(
            symbol="INFY",
            name="Infosys Limited",
            score=68.7,
            sector="Technology",
            signal=Signal.BUY,
            setup_type=SetupType.PULLBACK,
            entry=1480.0,
            stop_loss=1450.0,
            target=1540.0,
            risk_reward=2.0,
            component_scores=ComponentScoresBreakdown(
                trend_score=70.0,
                technical_score=68.0,
                volume_score=60.0,
                relative_strength_score=75.0,
                breakout_score=55.0,
                sector_score=80.0,
                risk_reward_score=73.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=1480.0,
                volume=650000,
                trend_direction="UPTREND",
                rsi=48.3,
                adx=24.2,
                relative_volume=1.05,
                distance_from_52w_high=-12.5,
                distance_from_52w_low=18.4,
            ),
            rationale="Healthy pullback to support in strong uptrend",
        ),
    ]

    # Create scan result
    scan_result = ScanResult(
        candidates=candidates,
        total_scanned=150,
        filters_applied=[
            "min_score >= 60",
            "min_volume >= 100000",
            "active_stocks_only",
            "min_risk_reward >= 1.5",
        ],
        scan_timestamp="2024-01-15T10:30:00Z",
        market_regime="BULL_MARKET",
    )

    print(f"\n✓ Scan Completed")
    print(f"  Total Scanned: {scan_result.total_scanned} stocks")
    print(f"  Candidates Found: {len(scan_result.candidates)}")
    print(f"  Market Regime: {scan_result.market_regime}")
    print(f"  Filters Applied: {len(scan_result.filters_applied)}")

    print(f"\n  Top Candidates (sorted by score):")
    for i, candidate in enumerate(scan_result.candidates, 1):
        print(f"\n  {i}. {candidate.symbol} ({candidate.name})")
        print(f"     Score: {candidate.score}/100")
        print(f"     Setup: {candidate.setup_type.value}")
        print(
            f"     Entry: ₹{candidate.entry} | Target: ₹{candidate.target} | Stop: ₹{candidate.stop_loss}"
        )
        print(f"     R:R = {candidate.risk_reward}:1")
        print(f"     {candidate.rationale}")

    print()
    return scan_result


def demo_json_serialization():
    """Demonstrate JSON serialization of models."""
    print("=" * 70)
    print("DEMO: JSON Serialization")
    print("=" * 70)

    candidate = SwingCandidate(
        symbol="HDFC",
        score=75.2,
        sector="Finance",
        signal=Signal.BUY,
        setup_type=SetupType.CONTINUATION,
        entry=1650.0,
        stop_loss=1620.0,
        target=1710.0,
        risk_reward=2.0,
        component_scores=ComponentScoresBreakdown(
            trend_score=78.0,
            technical_score=72.0,
            volume_score=70.0,
            relative_strength_score=68.0,
            breakout_score=65.0,
            sector_score=75.0,
            risk_reward_score=80.0,
        ),
        key_metrics=KeyMetricsSummary(
            current_price=1650.0,
            volume=950000,
            trend_direction="UPTREND",
            rsi=55.8,
            adx=29.3,
            relative_volume=1.22,
            distance_from_52w_high=-7.8,
            distance_from_52w_low=13.6,
        ),
    )

    # Serialize to JSON
    json_str = candidate.model_dump_json(indent=2)
    print("\n✓ JSON Serialization:")
    print(json_str[:500] + "..." if len(json_str) > 500 else json_str)
    print()


def demo_validation_features():
    """Demonstrate validation features."""
    print("=" * 70)
    print("DEMO: Model Validations")
    print("=" * 70)

    print("\n✓ Validations Enforced:")
    print("  1. Score must be 0-100")
    print("  2. For BUY signals: stop_loss < entry < target")
    print("  3. For SELL signals: target < entry < stop_loss")
    print("  4. Risk/reward must match calculated value from entry/stop/target")
    print("  5. RSI and ADX must be 0-100")
    print("  6. Prices and volumes must be positive")
    print("  7. ScanResult candidates must be sorted by score (descending)")
    print("\n✓ All validations are enforced at model creation time")
    print("✓ Invalid data will raise ValidationError with clear messages")
    print()


if __name__ == "__main__":
    print("\n")
    print("*" * 70)
    print("SWING CANDIDATE RESULT MODEL DEMO")
    print("Requirements: 5.4")
    print("*" * 70)
    print("\n")

    # Run demos
    demo_single_candidate()
    demo_scan_result()
    demo_json_serialization()
    demo_validation_features()

    print("=" * 70)
    print("✅ All demos completed successfully!")
    print("=" * 70)
    print("\nThe SwingCandidate and ScanResult models are ready for use.")
    print("They provide comprehensive data structures for swing scanner output")
    print("with full validation and type safety.")
    print()

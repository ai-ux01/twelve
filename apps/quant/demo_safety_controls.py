"""
Demo script for AI Safety Controls Service.

This script demonstrates how the safety controls prevent trades when conditions
are not favorable. It shows various scenarios:

1. Valid trade (all checks pass)
2. AI NO_TRADE signal (blocks trade)
3. Low score (below threshold)
4. Poor risk/reward ratio
5. Strong bear market
6. Missing critical data
7. Low AI confidence

Requirements: 5.7, 12.2
"""

from services.safety_controls import (
    SafetyControlsService,
    SafetyThresholds,
    TradeDecision,
)


def print_result(title: str, result):
    """Print safety check result in formatted way."""
    print(f"\n{'=' * 70}")
    print(f"SCENARIO: {title}")
    print("=" * 70)

    print(f"\nDecision: {result.decision.value}")
    print(f"Passed: {result.passed}")
    print(f"Recommendation: {result.recommendation}")

    if result.violations:
        print(f"\nViolations ({len(result.violations)}):")
        for i, violation in enumerate(result.violations, 1):
            print(f"  {i}. [{violation.severity}] {violation.rule}")
            print(f"     {violation.message}")
            if violation.threshold is not None:
                print(
                    f"     Threshold: {violation.threshold:.2f}, "
                    f"Actual: {violation.actual:.2f}"
                )
    else:
        print("\nNo violations - all safety checks passed!")

    print(f"\nAudit Trail:")
    print(f"  Checked at: {result.checked_at}")
    print(f"  Symbol: {result.audit_log.get('symbol', 'N/A')}")
    print(f"  Total checks: {len(result.audit_log['checks_performed'])}")
    print(
        f"  Error violations: "
        f"{result.audit_log['final_decision']['error_violations']}"
    )
    print(
        f"  Warning violations: "
        f"{result.audit_log['final_decision']['warning_violations']}"
    )


def main():
    """Run safety controls demonstrations."""
    print("=" * 70)
    print("AI SAFETY CONTROLS SERVICE DEMONSTRATION")
    print("=" * 70)
    print("\nThis demo shows how safety controls prevent unfavorable trades.")

    # Initialize service with default thresholds
    service = SafetyControlsService()

    print(f"\nDefault Safety Thresholds:")
    print(f"  - Minimum Score: {service.thresholds.min_score}")
    print(f"  - Minimum Risk/Reward: {service.thresholds.min_risk_reward}")
    print(f"  - Bear Market Threshold: {service.thresholds.bear_market_threshold}")
    print(f"  - Minimum AI Confidence: {service.thresholds.min_ai_confidence}")
    print(
        f"  - Require Support/Resistance: "
        f"{service.thresholds.require_support_resistance}"
    )
    print(f"  - Require Trendlines: {service.thresholds.require_trendlines}")

    # Scenario 1: Valid trade (all checks pass)
    result1 = service.validate_recommendation(
        score=78.5,
        risk_reward_ratio=2.5,
        market_regime="BULL_MARKET",
        market_regime_strength=0.75,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=0.85,
        symbol="RELIANCE",
    )
    print_result("Valid Trade - All Checks Pass", result1)

    # Scenario 2: AI NO_TRADE signal
    result2 = service.validate_recommendation(
        score=95.0,  # Even with excellent conditions
        risk_reward_ratio=5.0,
        market_regime="BULL_MARKET",
        market_regime_strength=0.8,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="NO_TRADE",  # AI says no
        ai_confidence=0.95,
        symbol="TCS",
    )
    print_result("AI NO_TRADE Signal - Trade Blocked", result2)

    # Scenario 3: Low score
    result3 = service.validate_recommendation(
        score=55.0,  # Below 60.0 threshold
        risk_reward_ratio=2.5,
        market_regime="BULL_MARKET",
        market_regime_strength=0.5,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=0.75,
        symbol="INFY",
    )
    print_result("Low Score - Below Threshold", result3)

    # Scenario 4: Poor risk/reward ratio
    result4 = service.validate_recommendation(
        score=75.0,
        risk_reward_ratio=1.5,  # Below 2.0 threshold
        market_regime="BULL_MARKET",
        market_regime_strength=0.5,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=0.75,
        symbol="HDFC",
    )
    print_result("Poor Risk/Reward Ratio", result4)

    # Scenario 5: Strong bear market
    result5 = service.validate_recommendation(
        score=75.0,
        risk_reward_ratio=2.5,
        market_regime="BEAR_MARKET",
        market_regime_strength=0.85,  # Above 0.7 threshold
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=0.75,
        symbol="ICICIBANK",
    )
    print_result("Strong Bear Market - Trade Blocked", result5)

    # Scenario 6: Missing critical data
    result6 = service.validate_recommendation(
        score=75.0,
        risk_reward_ratio=2.5,
        market_regime="BULL_MARKET",
        market_regime_strength=0.5,
        has_support_resistance=False,  # Missing
        has_trendlines=False,  # Missing
        ai_signal="BUY",
        ai_confidence=0.75,
        symbol="SBIN",
    )
    print_result("Missing Critical Data", result6)

    # Scenario 7: Low AI confidence
    result7 = service.validate_recommendation(
        score=75.0,
        risk_reward_ratio=2.5,
        market_regime="BULL_MARKET",
        market_regime_strength=0.5,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=0.5,  # Below 0.6 threshold
        symbol="AXISBANK",
    )
    print_result("Low AI Confidence", result7)

    # Scenario 8: Multiple violations
    result8 = service.validate_recommendation(
        score=55.0,  # Too low
        risk_reward_ratio=1.5,  # Too low
        market_regime="BEAR_MARKET",
        market_regime_strength=0.85,  # Too high
        has_support_resistance=False,  # Missing
        has_trendlines=False,  # Missing
        ai_signal="BUY",
        ai_confidence=0.5,  # Too low
        symbol="WIPRO",
    )
    print_result("Multiple Violations - Worst Case", result8)

    # Scenario 9: Warnings only (missing optional data)
    result9 = service.validate_recommendation(
        score=75.0,
        risk_reward_ratio=2.5,
        market_regime=None,  # Missing - generates warning
        market_regime_strength=None,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=None,  # Missing - generates warning
        symbol="KOTAKBANK",
    )
    print_result("Warnings Only - Trade Still Approved", result9)

    # Scenario 10: Custom thresholds
    print(f"\n{'=' * 70}")
    print("CUSTOM THRESHOLDS DEMO")
    print("=" * 70)

    custom_thresholds = SafetyThresholds(
        min_score=70.0,  # Stricter
        min_risk_reward=3.0,  # Stricter
        bear_market_threshold=0.8,  # More lenient
        min_ai_confidence=0.7,  # Stricter
    )

    custom_service = SafetyControlsService(thresholds=custom_thresholds)

    print("\nCustom Thresholds:")
    print(f"  - Minimum Score: 70.0 (default: 60.0)")
    print(f"  - Minimum Risk/Reward: 3.0 (default: 2.0)")
    print(f"  - Bear Market Threshold: 0.8 (default: 0.7)")
    print(f"  - Minimum AI Confidence: 0.7 (default: 0.6)")

    # This would pass with default thresholds but fails with custom
    result10 = custom_service.validate_recommendation(
        score=65.0,  # Above 60, below 70
        risk_reward_ratio=2.5,  # Above 2.0, below 3.0
        market_regime="BULL_MARKET",
        market_regime_strength=0.5,
        has_support_resistance=True,
        has_trendlines=True,
        ai_signal="BUY",
        ai_confidence=0.65,  # Above 0.6, below 0.7
        symbol="TATAMOTORS",
    )
    print_result("Custom Thresholds - More Strict", result10)

    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print("=" * 70)
    print("\nSafety Controls Features:")
    print("  ✓ AI NO_TRADE signal always blocks trades")
    print("  ✓ Score threshold prevents low-quality setups")
    print("  ✓ Risk/reward minimum ensures favorable trades")
    print("  ✓ Bear market filter prevents trading in downtrends")
    print("  ✓ Data completeness check requires critical analysis")
    print("  ✓ AI confidence filter blocks uncertain recommendations")
    print("  ✓ Complete audit trail for all decisions")
    print("  ✓ Configurable thresholds for different risk profiles")
    print("  ✓ Warning system for optional data")
    print("\nAll trade decisions are logged with full audit trail!")
    print("=" * 70)


if __name__ == "__main__":
    main()

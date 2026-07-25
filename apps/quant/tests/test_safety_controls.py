"""
Unit tests for AI Safety Controls Service.

Tests the safety controls that prevent trades when conditions are not favorable.

Requirements: 5.7, 12.2
"""

import pytest
from services.safety_controls import (
    SafetyControlsService,
    SafetyThresholds,
    TradeDecision,
    SafetyCheckResult,
)


class TestSafetyControlsService:
    """Test suite for SafetyControlsService."""

    def test_initialization_default_thresholds(self):
        """Test service initialization with default thresholds."""
        service = SafetyControlsService()

        assert service.thresholds.min_score == 60.0
        assert service.thresholds.min_risk_reward == 2.0
        assert service.thresholds.bear_market_threshold == 0.7
        assert service.thresholds.min_ai_confidence == 0.6
        assert service.thresholds.require_support_resistance is True
        assert service.thresholds.require_trendlines is True

    def test_initialization_custom_thresholds(self):
        """Test service initialization with custom thresholds."""
        custom_thresholds = SafetyThresholds(
            min_score=70.0,
            min_risk_reward=3.0,
            bear_market_threshold=0.8,
            min_ai_confidence=0.7,
            require_support_resistance=False,
            require_trendlines=False,
        )
        service = SafetyControlsService(thresholds=custom_thresholds)

        assert service.thresholds.min_score == 70.0
        assert service.thresholds.min_risk_reward == 3.0
        assert service.thresholds.bear_market_threshold == 0.8
        assert service.thresholds.min_ai_confidence == 0.7
        assert service.thresholds.require_support_resistance is False
        assert service.thresholds.require_trendlines is False

    def test_all_checks_pass(self):
        """Test scenario where all safety checks pass."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.8,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.85,
            symbol="RELIANCE",
        )

        assert result.passed is True
        assert result.decision == TradeDecision.APPROVED
        assert len(result.violations) == 0
        assert "passed" in result.recommendation.lower()
        assert result.audit_log is not None
        assert result.audit_log["symbol"] == "RELIANCE"

    def test_ai_no_trade_signal_blocks_trade(self):
        """Test that AI NO_TRADE signal blocks trade regardless of other conditions."""
        service = SafetyControlsService()

        # Even with perfect conditions, NO_TRADE should block
        result = service.validate_recommendation(
            score=95.0,  # Excellent score
            risk_reward_ratio=5.0,  # Excellent R:R
            market_regime="BULL_MARKET",
            market_regime_strength=0.9,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="NO_TRADE",  # AI says no
            ai_confidence=0.95,
            symbol="RELIANCE",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert len(result.violations) == 1
        assert result.violations[0].rule == "AI_NO_TRADE_SIGNAL"
        assert result.violations[0].severity == "ERROR"
        assert "NO_TRADE" in result.violations[0].message

    def test_score_below_threshold(self):
        """Test rejection when score is below minimum threshold."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=55.0,  # Below 60.0 threshold
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TCS",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "SCORE_THRESHOLD" for v in result.violations)

        score_violation = next(
            v for v in result.violations if v.rule == "SCORE_THRESHOLD"
        )
        assert score_violation.severity == "ERROR"
        assert score_violation.threshold == 60.0
        assert score_violation.actual == 55.0

    def test_risk_reward_below_threshold(self):
        """Test rejection when risk/reward ratio is too low."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=1.5,  # Below 2.0 threshold
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="INFY",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "RISK_REWARD_RATIO" for v in result.violations)

        rr_violation = next(
            v for v in result.violations if v.rule == "RISK_REWARD_RATIO"
        )
        assert rr_violation.severity == "ERROR"
        assert rr_violation.threshold == 2.0
        assert rr_violation.actual == 1.5

    def test_bear_market_blocks_trade(self):
        """Test rejection in strong bear market."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BEAR_MARKET",
            market_regime_strength=0.85,  # Above 0.7 threshold
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="HDFC",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "MARKET_REGIME" for v in result.violations)

        market_violation = next(
            v for v in result.violations if v.rule == "MARKET_REGIME"
        )
        assert market_violation.severity == "ERROR"
        assert market_violation.threshold == 0.7
        assert market_violation.actual == 0.85
        assert "bear market" in market_violation.message.lower()

    def test_weak_bear_market_allows_trade(self):
        """Test that weak bear market doesn't block trades."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BEAR_MARKET",
            market_regime_strength=0.5,  # Below 0.7 threshold
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="ICICIBANK",
        )

        assert result.passed is True
        assert result.decision == TradeDecision.APPROVED

    def test_missing_support_resistance_blocks_trade(self):
        """Test rejection when support/resistance data is missing."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=False,  # Missing
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="SBIN",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "DATA_COMPLETENESS" for v in result.violations)

        data_violation = next(
            v for v in result.violations if v.rule == "DATA_COMPLETENESS"
        )
        assert data_violation.severity == "ERROR"
        assert "support/resistance" in data_violation.message.lower()

    def test_missing_trendlines_blocks_trade(self):
        """Test rejection when trendline data is missing."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=False,  # Missing
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="WIPRO",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "DATA_COMPLETENESS" for v in result.violations)

        data_violation = next(
            v for v in result.violations if v.rule == "DATA_COMPLETENESS"
        )
        assert data_violation.severity == "ERROR"
        assert "trendline" in data_violation.message.lower()

    def test_missing_both_data_types_blocks_trade(self):
        """Test rejection when both critical data types are missing."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=False,  # Missing
            has_trendlines=False,  # Missing
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="HDFCBANK",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE

        data_violation = next(
            v for v in result.violations if v.rule == "DATA_COMPLETENESS"
        )
        assert "support/resistance" in data_violation.message.lower()
        assert "trendline" in data_violation.message.lower()

    def test_ai_confidence_below_threshold(self):
        """Test rejection when AI confidence is too low."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
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

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "AI_CONFIDENCE" for v in result.violations)

        confidence_violation = next(
            v for v in result.violations if v.rule == "AI_CONFIDENCE"
        )
        assert confidence_violation.severity == "ERROR"
        assert confidence_violation.threshold == 0.6
        assert confidence_violation.actual == 0.5

    def test_missing_market_regime_generates_warning(self):
        """Test that missing market regime generates warning but doesn't block."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime=None,  # Missing
            market_regime_strength=None,  # Missing
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="KOTAKBANK",
        )

        # Should still pass with warning
        assert result.passed is True
        assert result.decision == TradeDecision.APPROVED
        assert any(v.rule == "MARKET_REGIME" for v in result.violations)

        market_violation = next(
            v for v in result.violations if v.rule == "MARKET_REGIME"
        )
        assert market_violation.severity == "WARNING"

    def test_missing_ai_confidence_generates_warning(self):
        """Test that missing AI confidence generates warning but doesn't block."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=None,  # Missing
            symbol="INDUSINDBK",
        )

        # Should still pass with warning
        assert result.passed is True
        assert result.decision == TradeDecision.APPROVED
        assert any(v.rule == "AI_CONFIDENCE" for v in result.violations)

        confidence_violation = next(
            v for v in result.violations if v.rule == "AI_CONFIDENCE"
        )
        assert confidence_violation.severity == "WARNING"

    def test_multiple_violations(self):
        """Test scenario with multiple safety violations."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=55.0,  # Too low
            risk_reward_ratio=1.5,  # Too low
            market_regime="BEAR_MARKET",
            market_regime_strength=0.85,  # Too high
            has_support_resistance=False,  # Missing
            has_trendlines=False,  # Missing
            ai_signal="BUY",
            ai_confidence=0.5,  # Too low
            symbol="M&M",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert len(result.violations) == 5  # 5 ERROR violations

        violation_rules = [v.rule for v in result.violations]
        assert "SCORE_THRESHOLD" in violation_rules
        assert "RISK_REWARD_RATIO" in violation_rules
        assert "MARKET_REGIME" in violation_rules
        assert "DATA_COMPLETENESS" in violation_rules
        assert "AI_CONFIDENCE" in violation_rules

    def test_update_thresholds(self):
        """Test updating safety thresholds."""
        service = SafetyControlsService()

        # Initial validation fails with default thresholds
        result1 = service.validate_recommendation(
            score=65.0,  # Above 60, below 70
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TATAMOTORS",
        )
        assert result1.passed is True  # Passes with min_score=60

        # Update to stricter thresholds
        new_thresholds = SafetyThresholds(min_score=70.0)
        service.update_thresholds(new_thresholds)

        # Same conditions now fail
        result2 = service.validate_recommendation(
            score=65.0,  # Now below 70
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TATAMOTORS",
        )
        assert result2.passed is False  # Fails with min_score=70

    def test_audit_log_structure(self):
        """Test that audit log contains all required information."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="BHARTIARTL",
            additional_context={"entry_price": 850.0, "setup_type": "BREAKOUT"},
        )

        # Check audit log structure
        assert "symbol" in result.audit_log
        assert "timestamp" in result.audit_log
        assert "inputs" in result.audit_log
        assert "thresholds" in result.audit_log
        assert "checks_performed" in result.audit_log
        assert "final_decision" in result.audit_log
        assert "additional_context" in result.audit_log

        # Check inputs
        assert result.audit_log["inputs"]["score"] == 75.0
        assert result.audit_log["inputs"]["ai_signal"] == "BUY"

        # Check final decision
        assert result.audit_log["final_decision"]["decision"] == TradeDecision.APPROVED
        assert result.audit_log["final_decision"]["passed"] is True

        # Check additional context
        assert result.audit_log["additional_context"]["entry_price"] == 850.0

    def test_disabled_data_requirements(self):
        """Test that data requirements can be disabled."""
        custom_thresholds = SafetyThresholds(
            require_support_resistance=False,
            require_trendlines=False,
        )
        service = SafetyControlsService(thresholds=custom_thresholds)

        # Should pass even without support/resistance and trendlines
        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=False,
            has_trendlines=False,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="ADANIPORTS",
        )

        assert result.passed is True
        assert result.decision == TradeDecision.APPROVED
        assert not any(v.rule == "DATA_COMPLETENESS" for v in result.violations)

    def test_get_thresholds(self):
        """Test getting current thresholds."""
        custom_thresholds = SafetyThresholds(
            min_score=70.0,
            min_risk_reward=3.0,
        )
        service = SafetyControlsService(thresholds=custom_thresholds)

        thresholds = service.get_thresholds()

        assert thresholds.min_score == 70.0
        assert thresholds.min_risk_reward == 3.0
        assert thresholds.bear_market_threshold == 0.7  # Default

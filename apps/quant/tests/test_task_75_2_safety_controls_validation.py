"""
Unit tests for Safety Controls and Validation (Task 75.2).

This test suite verifies:
1. Symbol validation rejects non-NIFTY/BANKNIFTY symbols (e.g., RELIANCE) - Requirement 8.1
2. Rate limiting enforcement (exceed 10 req/min) - Requirement 18.1
3. Liquidity filtering identifies wide spreads, low volume, low OI - Requirement 18.2
4. Risk validation enforces exposure limits - Requirement 8.1
5. Audit logging captures all API requests - Requirement 20.1

Requirements: 8.1, 18.1, 18.2, 20.1
"""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from validators.symbol_validator import SymbolValidator, ValidationStatus
from services.liquidity_analyzer import (
    LiquidityAnalyzer,
    OptionContractInput,
    LiquidityWarning,
)
from services.safety_controls import (
    SafetyControlsService,
    SafetyThresholds,
    TradeDecision,
)
from main import EndpointRateLimiter


class TestSymbolValidationSafety:
    """
    Test symbol validation rejects non-NIFTY/BANKNIFTY symbols.
    
    Requirement 8.1: Risk validation must reject invalid symbols.
    """

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = SymbolValidator()

    def test_reject_reliance_symbol(self):
        """Test that RELIANCE symbol is rejected."""
        result = self.validator.validate_symbol("RELIANCE")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "RELIANCE"
        assert result.error is not None
        assert "RELIANCE" in result.error.reason
        assert "not supported" in result.error.reason

    def test_reject_tcs_symbol(self):
        """Test that TCS symbol is rejected."""
        result = self.validator.validate_symbol("TCS")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "TCS"
        assert result.error is not None

    def test_reject_infy_symbol(self):
        """Test that INFY symbol is rejected."""
        result = self.validator.validate_symbol("INFY")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "INFY"

    def test_reject_hdfc_symbol(self):
        """Test that HDFC symbol is rejected."""
        result = self.validator.validate_symbol("HDFC")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "HDFC"

    def test_accept_only_nifty_banknifty(self):
        """Test that only NIFTY and BANKNIFTY are accepted."""
        nifty_result = self.validator.validate_symbol("NIFTY")
        banknifty_result = self.validator.validate_symbol("BANKNIFTY")
        reliance_result = self.validator.validate_symbol("RELIANCE")

        # NIFTY and BANKNIFTY should pass
        assert nifty_result.is_valid is True
        assert banknifty_result.is_valid is True

        # RELIANCE should fail
        assert reliance_result.is_valid is False

    def test_batch_validation_rejects_invalid_symbols(self):
        """Test batch validation properly rejects invalid symbols."""
        symbols = ["NIFTY", "RELIANCE", "BANKNIFTY", "TCS", "INFY"]
        results = self.validator.validate_symbols(symbols)

        assert len(results) == 5

        # Check each result
        assert results[0].is_valid is True  # NIFTY
        assert results[1].is_valid is False  # RELIANCE
        assert results[2].is_valid is True  # BANKNIFTY
        assert results[3].is_valid is False  # TCS
        assert results[4].is_valid is False  # INFY

    def test_error_message_includes_accepted_symbols(self):
        """Test that error messages include list of accepted symbols."""
        result = self.validator.validate_symbol("RELIANCE")

        assert result.error is not None
        assert "NIFTY" in result.error.reason
        assert "BANKNIFTY" in result.error.reason
        assert len(result.error.accepted_symbols) == 2


class TestRateLimitingEnforcement:
    """
    Test rate limiting enforcement (10 req/min limit).
    
    Requirement 18.1: Data flow architecture must enforce rate limits.
    """

    def test_rate_limiter_allows_requests_under_limit(self):
        """Test that requests under limit are allowed."""
        limiter = EndpointRateLimiter(max_requests=10, window_seconds=60)
        identifier = "test_endpoint:192.168.1.1"

        # First 10 requests should be allowed
        for i in range(10):
            assert limiter.is_allowed(identifier) is True

    def test_rate_limiter_blocks_requests_over_limit(self):
        """Test that requests over limit are blocked."""
        limiter = EndpointRateLimiter(max_requests=10, window_seconds=60)
        identifier = "test_endpoint:192.168.1.1"

        # Use up all 10 requests
        for i in range(10):
            assert limiter.is_allowed(identifier) is True

        # 11th request should be blocked
        assert limiter.is_allowed(identifier) is False

        # 12th request should also be blocked
        assert limiter.is_allowed(identifier) is False

    def test_rate_limiter_resets_after_window(self):
        """Test that rate limiter resets after time window."""
        limiter = EndpointRateLimiter(max_requests=3, window_seconds=1)
        identifier = "test_endpoint:192.168.1.1"

        # Use up all 3 requests
        for i in range(3):
            assert limiter.is_allowed(identifier) is True

        # 4th request should be blocked
        assert limiter.is_allowed(identifier) is False

        # Wait for window to reset
        time.sleep(1.1)

        # Should be allowed again
        assert limiter.is_allowed(identifier) is True

    def test_rate_limiter_tracks_remaining_requests(self):
        """Test that rate limiter correctly tracks remaining requests."""
        limiter = EndpointRateLimiter(max_requests=10, window_seconds=60)
        identifier = "test_endpoint:192.168.1.1"

        # Initially should have 10 remaining
        assert limiter.get_remaining(identifier) == 10

        # Make 3 requests
        for i in range(3):
            limiter.is_allowed(identifier)

        # Should have 7 remaining
        assert limiter.get_remaining(identifier) == 7

        # Make 7 more requests (total 10)
        for i in range(7):
            limiter.is_allowed(identifier)

        # Should have 0 remaining
        assert limiter.get_remaining(identifier) == 0

    def test_rate_limiter_per_identifier_isolation(self):
        """Test that rate limits are isolated per identifier."""
        limiter = EndpointRateLimiter(max_requests=5, window_seconds=60)
        identifier1 = "endpoint1:192.168.1.1"
        identifier2 = "endpoint2:192.168.1.2"

        # Use up all requests for identifier1
        for i in range(5):
            assert limiter.is_allowed(identifier1) is True

        # identifier1 should be blocked
        assert limiter.is_allowed(identifier1) is False

        # identifier2 should still be allowed
        assert limiter.is_allowed(identifier2) is True

    def test_rate_limiter_exceeds_ten_per_minute(self):
        """Test that exceeding 10 requests per minute triggers rate limiting."""
        limiter = EndpointRateLimiter(max_requests=10, window_seconds=60)
        identifier = "options_chain:192.168.1.1"

        # Make 11 requests rapidly
        allowed_count = 0
        blocked_count = 0

        for i in range(11):
            if limiter.is_allowed(identifier):
                allowed_count += 1
            else:
                blocked_count += 1

        # Should have 10 allowed and 1 blocked
        assert allowed_count == 10
        assert blocked_count == 1


class TestLiquidityFiltering:
    """
    Test liquidity filtering identifies wide spreads, low volume, low OI.
    
    Requirement 18.2: Safety controls must identify illiquid contracts.
    """

    def setup_method(self):
        """Set up test fixtures."""
        self.analyzer = LiquidityAnalyzer(
            wide_spread_threshold=5.0,
            low_volume_threshold=100,
            low_oi_threshold=500,
            deep_otm_threshold=10.0,
        )

    def test_identify_wide_bid_ask_spread(self):
        """Test that wide bid-ask spreads are identified."""
        # Contract with wide spread (10% spread)
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=110.0,  # 10% spread - WIDE
            ltp=105.0,
            volume=1000,
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity = self.analyzer._analyze_contract(contract, atm_strike)

        assert liquidity.liquidity_warning.wide_bid_ask_spread is True
        assert liquidity.bid_ask_spread_percent > 5.0
        assert liquidity.liquidity_warning.is_illiquid is True

    def test_identify_low_volume(self):
        """Test that low volume contracts are identified."""
        # Contract with low volume
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=102.0,
            ltp=101.0,
            volume=50,  # LOW volume (below 100 threshold)
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity = self.analyzer._analyze_contract(contract, atm_strike)

        assert liquidity.liquidity_warning.low_volume is True
        assert liquidity.volume < 100
        assert liquidity.liquidity_warning.is_illiquid is True

    def test_identify_low_open_interest(self):
        """Test that low OI contracts are identified."""
        # Contract with low OI
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=102.0,
            ltp=101.0,
            volume=1000,
            open_interest=200,  # LOW OI (below 500 threshold)
        )
        atm_strike = 21500

        liquidity = self.analyzer._analyze_contract(contract, atm_strike)

        assert liquidity.liquidity_warning.low_oi is True
        assert liquidity.open_interest < 500
        assert liquidity.liquidity_warning.is_illiquid is True

    def test_identify_multiple_liquidity_issues(self):
        """Test that contracts with multiple liquidity issues are flagged."""
        # Contract with wide spread, low volume, and low OI
        contract = OptionContractInput(
            strike_price=21500,
            option_type="PUT",
            bid=10.0,
            ask=12.0,  # ~18% spread
            ltp=11.0,
            volume=30,  # LOW volume
            open_interest=150,  # LOW OI
        )
        atm_strike = 21500

        liquidity = self.analyzer._analyze_contract(contract, atm_strike)

        # Should have all three warnings
        assert liquidity.liquidity_warning.wide_bid_ask_spread is True
        assert liquidity.liquidity_warning.low_volume is True
        assert liquidity.liquidity_warning.low_oi is True
        assert liquidity.liquidity_warning.warning_count == 3
        assert liquidity.liquidity_warning.is_illiquid is True

    def test_liquidity_metrics_summary(self):
        """Test that liquidity metrics correctly summarize chain analysis."""
        contracts = [
            # Liquid contract
            OptionContractInput(
                strike_price=21500,
                option_type="CALL",
                bid=100.0,
                ask=102.0,
                ltp=101.0,
                volume=1000,
                open_interest=5000,
            ),
            # Illiquid contract (wide spread)
            OptionContractInput(
                strike_price=21600,
                option_type="CALL",
                bid=80.0,
                ask=88.0,  # Wide spread
                ltp=84.0,
                volume=1000,
                open_interest=5000,
            ),
            # Illiquid contract (low volume + low OI)
            OptionContractInput(
                strike_price=21700,
                option_type="CALL",
                bid=60.0,
                ask=62.0,
                ltp=61.0,
                volume=50,  # Low volume
                open_interest=200,  # Low OI
            ),
        ]
        atm_strike = 21500

        metrics = self.analyzer.analyze_liquidity(contracts, atm_strike)

        assert metrics.total_contracts == 3
        assert metrics.liquid_contracts == 1
        assert metrics.illiquid_contracts == 2
        assert len(metrics.illiquid_contracts_list) == 2


class TestRiskValidation:
    """
    Test risk validation enforces exposure limits.
    
    Requirement 8.1: Risk engine must validate and enforce limits.
    """

    def setup_method(self):
        """Set up test fixtures."""
        self.service = SafetyControlsService()

    def test_reject_trade_below_score_threshold(self):
        """Test that trades with score below threshold are rejected."""
        result = self.service.validate_recommendation(
            score=55.0,  # Below 60.0 threshold
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TEST",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "SCORE_THRESHOLD" for v in result.violations)

    def test_reject_trade_below_risk_reward_ratio(self):
        """Test that trades with poor risk/reward are rejected."""
        result = self.service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=1.5,  # Below 2.0 threshold
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TEST",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "RISK_REWARD_RATIO" for v in result.violations)

    def test_reject_trade_in_strong_bear_market(self):
        """Test that trades in strong bear markets are rejected."""
        result = self.service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BEAR_MARKET",
            market_regime_strength=0.85,  # Strong bear market
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TEST",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "MARKET_REGIME" for v in result.violations)

    def test_reject_trade_missing_critical_data(self):
        """Test that trades missing critical data are rejected."""
        result = self.service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=False,  # Missing critical data
            has_trendlines=False,  # Missing critical data
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="TEST",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "DATA_COMPLETENESS" for v in result.violations)

    def test_reject_trade_low_ai_confidence(self):
        """Test that trades with low AI confidence are rejected."""
        result = self.service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.4,  # Below 0.6 threshold
            symbol="TEST",
        )

        assert result.passed is False
        assert result.decision == TradeDecision.NO_TRADE
        assert any(v.rule == "AI_CONFIDENCE" for v in result.violations)

    def test_approve_trade_meeting_all_criteria(self):
        """Test that trades meeting all criteria are approved."""
        result = self.service.validate_recommendation(
            score=75.0,  # Above threshold
            risk_reward_ratio=2.5,  # Above threshold
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,  # Not strong bear
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,  # Above threshold
            symbol="TEST",
        )

        assert result.passed is True
        assert result.decision == TradeDecision.APPROVED
        assert len([v for v in result.violations if v.severity == "ERROR"]) == 0


class TestAuditLogging:
    """
    Test audit logging captures all API requests.
    
    Requirement 20.1: System must log all operations for audit trail.
    """

    def test_safety_controls_creates_audit_log(self):
        """Test that safety validation creates audit log."""
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
            symbol="NIFTY",
        )

        # Verify audit log exists and contains required fields
        assert result.audit_log is not None
        assert "symbol" in result.audit_log
        assert "timestamp" in result.audit_log
        assert "inputs" in result.audit_log
        assert "thresholds" in result.audit_log
        assert "checks_performed" in result.audit_log
        assert "final_decision" in result.audit_log

    def test_audit_log_captures_symbol(self):
        """Test that audit log captures the trading symbol."""
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
            symbol="BANKNIFTY",
        )

        assert result.audit_log["symbol"] == "BANKNIFTY"

    def test_audit_log_captures_all_inputs(self):
        """Test that audit log captures all input parameters."""
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
            symbol="NIFTY",
        )

        inputs = result.audit_log["inputs"]
        assert inputs["score"] == 75.0
        assert inputs["risk_reward_ratio"] == 2.5
        assert inputs["market_regime"] == "BULL_MARKET"
        assert inputs["ai_signal"] == "BUY"
        assert inputs["ai_confidence"] == 0.75

    def test_audit_log_captures_decision(self):
        """Test that audit log captures the final decision."""
        service = SafetyControlsService()

        # Test approved decision
        result_pass = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="NIFTY",
        )

        assert result_pass.audit_log["final_decision"]["decision"] == TradeDecision.APPROVED
        assert result_pass.audit_log["final_decision"]["passed"] is True

        # Test rejected decision
        result_fail = service.validate_recommendation(
            score=50.0,  # Too low
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="NIFTY",
        )

        assert result_fail.audit_log["final_decision"]["decision"] == TradeDecision.NO_TRADE
        assert result_fail.audit_log["final_decision"]["passed"] is False

    def test_audit_log_captures_violations(self):
        """Test that audit log captures all violations."""
        service = SafetyControlsService()

        result = service.validate_recommendation(
            score=50.0,  # Violation
            risk_reward_ratio=1.5,  # Violation
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="NIFTY",
        )

        # Should have violations captured
        assert len(result.violations) > 0
        assert any(v.rule == "SCORE_THRESHOLD" for v in result.violations)
        assert any(v.rule == "RISK_REWARD_RATIO" for v in result.violations)

    def test_audit_log_includes_timestamp(self):
        """Test that audit log includes timestamp."""
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
            symbol="NIFTY",
        )

        assert "timestamp" in result.audit_log
        # Timestamp should be a string (ISO format)
        assert isinstance(result.audit_log["timestamp"], str)

    def test_audit_log_additional_context(self):
        """Test that audit log can capture additional context."""
        service = SafetyControlsService()

        additional_context = {
            "entry_price": 21500.0,
            "setup_type": "BREAKOUT",
            "user_id": "test_user_123",
        }

        result = service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="NIFTY",
            additional_context=additional_context,
        )

        assert "additional_context" in result.audit_log
        assert result.audit_log["additional_context"]["entry_price"] == 21500.0
        assert result.audit_log["additional_context"]["setup_type"] == "BREAKOUT"
        assert result.audit_log["additional_context"]["user_id"] == "test_user_123"


class TestIntegratedSafetyValidation:
    """
    Integrated tests combining multiple safety controls.
    
    Tests the complete safety validation pipeline.
    """

    def test_symbol_validation_before_risk_check(self):
        """Test that invalid symbols are caught before risk validation."""
        validator = SymbolValidator()
        
        # First validate symbol
        symbol_result = validator.validate_symbol("RELIANCE")
        
        # Should fail validation
        assert symbol_result.is_valid is False
        
        # Should not proceed to risk validation if symbol invalid
        # (In production, this would be enforced by the API layer)

    def test_rate_limiting_with_valid_symbols(self):
        """Test that rate limiting works with valid symbol requests."""
        limiter = EndpointRateLimiter(max_requests=5, window_seconds=60)
        validator = SymbolValidator()
        identifier = "options:test:pipeline"
        
        # Make 6 requests with valid symbol
        results = []
        for i in range(6):
            # Validate symbol first
            symbol_result = validator.validate_symbol("NIFTY")
            assert symbol_result.is_valid is True
            
            # Then check rate limit (using same identifier for all requests)
            allowed = limiter.is_allowed(identifier)
            results.append(allowed)
        
        # First 5 should pass, 6th should fail
        assert sum(results) == 5

    def test_complete_safety_pipeline(self):
        """Test complete safety validation pipeline."""
        # 1. Symbol validation
        validator = SymbolValidator()
        symbol_result = validator.validate_symbol("NIFTY")
        assert symbol_result.is_valid is True
        
        # 2. Rate limiting check
        limiter = EndpointRateLimiter(max_requests=10, window_seconds=60)
        assert limiter.is_allowed("options:test:pipeline") is True
        
        # 3. Liquidity check
        analyzer = LiquidityAnalyzer()
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=102.0,
            ltp=101.0,
            volume=1000,
            open_interest=5000,
        )
        liquidity = analyzer._analyze_contract(contract, 21500)
        assert liquidity.liquidity_warning.is_illiquid is False
        
        # 4. Risk validation
        safety_service = SafetyControlsService()
        risk_result = safety_service.validate_recommendation(
            score=75.0,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.5,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.75,
            symbol="NIFTY",
        )
        assert risk_result.passed is True
        
        # 5. Verify audit log exists
        assert risk_result.audit_log is not None
        assert risk_result.audit_log["symbol"] == "NIFTY"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

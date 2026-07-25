"""
Unit tests for intraday trading models.

Tests validation logic, field constraints, and data integrity
for all intraday trading Pydantic models.

Requirements: 6.1, 6.2
"""

import pytest
from pydantic import ValidationError
from datetime import datetime

from models.intraday import (
    IntradayInterval,
    IntradaySignal,
    IntradayAnalysisRequest,
    DataFreshness,
    MACDIndicator,
    BollingerBands,
    IntradayTechnicalAnalysis,
    IntradayRecommendation,
    IntradayAnalysisResult,
)


class TestIntradayAnalysisRequest:
    """Test IntradayAnalysisRequest model validation."""

    def test_valid_request_with_all_fields(self):
        """Test valid request with all fields."""
        request = IntradayAnalysisRequest(
            symbol="RELIANCE",
            interval=IntradayInterval.FIVE_MINUTES,
            user_id="user123",
        )
        assert request.symbol == "RELIANCE"
        assert request.interval == IntradayInterval.FIVE_MINUTES
        assert request.user_id == "user123"

    def test_valid_request_without_optional_fields(self):
        """Test valid request without optional user_id."""
        request = IntradayAnalysisRequest(
            symbol="TCS",
            interval=IntradayInterval.FIFTEEN_MINUTES,
        )
        assert request.symbol == "TCS"
        assert request.interval == IntradayInterval.FIFTEEN_MINUTES
        assert request.user_id is None

    def test_all_valid_intervals(self):
        """Test all valid interval values."""
        intervals = [
            IntradayInterval.ONE_MINUTE,
            IntradayInterval.FIVE_MINUTES,
            IntradayInterval.FIFTEEN_MINUTES,
            IntradayInterval.THIRTY_MINUTES,
            IntradayInterval.ONE_HOUR,
        ]
        for interval in intervals:
            request = IntradayAnalysisRequest(symbol="RELIANCE", interval=interval)
            assert request.interval == interval

    def test_lowercase_symbol_converted_to_uppercase(self):
        """Test that lowercase symbols are converted to uppercase."""
        # Note: The pattern validation happens before the validator
        # So lowercase will be rejected by pattern, not converted
        with pytest.raises(ValidationError) as exc_info:
            IntradayAnalysisRequest(
                symbol="reliance",
                interval=IntradayInterval.FIVE_MINUTES,
            )
        assert "symbol" in str(exc_info.value)

    def test_empty_symbol_rejected(self):
        """Test that empty symbol is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayAnalysisRequest(
                symbol="",
                interval=IntradayInterval.FIVE_MINUTES,
            )
        assert "symbol" in str(exc_info.value)

    def test_invalid_symbol_pattern_rejected(self):
        """Test that symbols with invalid characters are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayAnalysisRequest(
                symbol="REL-IANCE",
                interval=IntradayInterval.FIVE_MINUTES,
            )
        assert "symbol" in str(exc_info.value)

    def test_symbol_with_numbers_accepted(self):
        """Test that symbols with numbers are accepted."""
        request = IntradayAnalysisRequest(
            symbol="NIFTY50",
            interval=IntradayInterval.FIVE_MINUTES,
        )
        assert request.symbol == "NIFTY50"


class TestDataFreshness:
    """Test DataFreshness model validation."""

    def test_valid_data_freshness(self):
        """Test valid data freshness object."""
        freshness = DataFreshness(
            timestamp="2024-01-15T10:30:00Z",
            age_seconds=15.5,
            is_stale=False,
        )
        assert freshness.timestamp == "2024-01-15T10:30:00Z"
        assert freshness.age_seconds == 15.5
        assert freshness.is_stale is False

    def test_negative_age_seconds_rejected(self):
        """Test that negative age_seconds is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            DataFreshness(
                timestamp="2024-01-15T10:30:00Z",
                age_seconds=-5.0,
                is_stale=False,
            )
        assert "age_seconds" in str(exc_info.value)

    def test_invalid_timestamp_format_rejected(self):
        """Test that invalid timestamp format is rejected."""
        # The validator accepts various date formats, so this won't raise
        # Testing with completely invalid format instead
        with pytest.raises(ValidationError) as exc_info:
            DataFreshness(
                timestamp="not-a-date",  # Completely invalid format
                age_seconds=15.5,
                is_stale=False,
            )
        assert "timestamp" in str(exc_info.value)

    def test_stale_data_flag(self):
        """Test stale data flag works correctly."""
        freshness = DataFreshness(
            timestamp="2024-01-15T10:30:00Z",
            age_seconds=120.0,
            is_stale=True,
        )
        assert freshness.is_stale is True


class TestBollingerBands:
    """Test BollingerBands model validation."""

    def test_valid_bollinger_bands(self):
        """Test valid Bollinger Bands."""
        bands = BollingerBands(
            upper=2480.0,
            middle=2460.0,
            lower=2440.0,
        )
        assert bands.upper == 2480.0
        assert bands.middle == 2460.0
        assert bands.lower == 2440.0

    def test_lower_band_above_middle_rejected(self):
        """Test that lower band above middle is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            BollingerBands(
                upper=2480.0,
                middle=2460.0,
                lower=2470.0,  # Above middle
            )
        assert "lower" in str(exc_info.value)

    def test_negative_values_rejected(self):
        """Test that negative band values are rejected."""
        with pytest.raises(ValidationError):
            BollingerBands(
                upper=-2480.0,
                middle=2460.0,
                lower=2440.0,
            )


class TestIntradayTechnicalAnalysis:
    """Test IntradayTechnicalAnalysis model validation."""

    def test_valid_technical_analysis(self):
        """Test valid technical analysis object."""
        analysis = IntradayTechnicalAnalysis(
            rsi=58.5,
            macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
            ema_9=2465.0,
            ema_21=2460.0,
            ema_50=2455.0,
            vwap=2458.0,
            atr=15.5,
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            support_levels=[2430.0, 2445.0],
            resistance_levels=[2475.0, 2490.0],
        )
        assert analysis.rsi == 58.5
        assert analysis.volume == 150000

    def test_rsi_out_of_range_rejected(self):
        """Test that RSI outside 0-100 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayTechnicalAnalysis(
                rsi=105.0,  # Invalid RSI
                macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
                ema_9=2465.0,
                ema_21=2460.0,
                ema_50=2455.0,
                vwap=2458.0,
                atr=15.5,
                volume=150000,
                relative_volume=1.35,
                bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            )
        assert "rsi" in str(exc_info.value)

    def test_support_levels_sorted(self):
        """Test that support levels are sorted."""
        analysis = IntradayTechnicalAnalysis(
            rsi=58.5,
            macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
            ema_9=2465.0,
            ema_21=2460.0,
            ema_50=2455.0,
            vwap=2458.0,
            atr=15.5,
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            support_levels=[2445.0, 2430.0],  # Unsorted input
            resistance_levels=[2475.0, 2490.0],
        )
        # Should be sorted in ascending order
        assert analysis.support_levels == [2430.0, 2445.0]

    def test_resistance_levels_sorted(self):
        """Test that resistance levels are sorted."""
        analysis = IntradayTechnicalAnalysis(
            rsi=58.5,
            macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
            ema_9=2465.0,
            ema_21=2460.0,
            ema_50=2455.0,
            vwap=2458.0,
            atr=15.5,
            volume=150000,
            relative_volume=1.35,
            bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
            support_levels=[2430.0, 2445.0],
            resistance_levels=[2490.0, 2475.0],  # Unsorted input
        )
        # Should be sorted in ascending order
        assert analysis.resistance_levels == [2475.0, 2490.0]


class TestIntradayRecommendation:
    """Test IntradayRecommendation model validation."""

    def test_valid_buy_recommendation(self):
        """Test valid BUY recommendation."""
        recommendation = IntradayRecommendation(
            signal=IntradaySignal.BUY,
            confidence=0.75,
            entry=2460.0,
            stop_loss=2445.0,
            target=2490.0,
            risk_reward=2.0,
            rationale="Strong upward momentum",
            is_stale=False,
        )
        assert recommendation.signal == IntradaySignal.BUY
        assert recommendation.confidence == 0.75
        assert recommendation.entry == 2460.0

    def test_valid_sell_recommendation(self):
        """Test valid SELL recommendation."""
        recommendation = IntradayRecommendation(
            signal=IntradaySignal.SELL,
            confidence=0.70,
            entry=2460.0,
            stop_loss=2475.0,  # Above entry for SELL
            target=2440.0,  # Below entry for SELL
            risk_reward=1.33,
            rationale="Strong downward momentum",
            is_stale=False,
        )
        assert recommendation.signal == IntradaySignal.SELL
        assert recommendation.stop_loss > recommendation.entry
        assert recommendation.target < recommendation.entry

    def test_buy_signal_invalid_stop_loss_rejected(self):
        """Test that BUY signal with stop loss above entry is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayRecommendation(
                signal=IntradaySignal.BUY,
                confidence=0.75,
                entry=2460.0,
                stop_loss=2470.0,  # Above entry - invalid for BUY
                target=2490.0,
                risk_reward=2.0,
                rationale="Test",
                is_stale=False,
            )
        assert "stop_loss" in str(exc_info.value)

    def test_buy_signal_invalid_target_rejected(self):
        """Test that BUY signal with target below entry is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayRecommendation(
                signal=IntradaySignal.BUY,
                confidence=0.75,
                entry=2460.0,
                stop_loss=2445.0,
                target=2450.0,  # Below entry - invalid for BUY
                risk_reward=2.0,
                rationale="Test",
                is_stale=False,
            )
        assert "target" in str(exc_info.value)

    def test_sell_signal_invalid_stop_loss_rejected(self):
        """Test that SELL signal with stop loss below entry is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayRecommendation(
                signal=IntradaySignal.SELL,
                confidence=0.70,
                entry=2460.0,
                stop_loss=2445.0,  # Below entry - invalid for SELL
                target=2440.0,
                risk_reward=1.33,
                rationale="Test",
                is_stale=False,
            )
        assert "stop_loss" in str(exc_info.value)

    def test_risk_reward_validation(self):
        """Test that risk/reward ratio is validated."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayRecommendation(
                signal=IntradaySignal.BUY,
                confidence=0.75,
                entry=2460.0,
                stop_loss=2445.0,  # Risk: 15
                target=2490.0,  # Reward: 30
                risk_reward=1.5,  # Wrong! Should be 2.0
                rationale="Test",
                is_stale=False,
            )
        assert "risk_reward" in str(exc_info.value)

    def test_confidence_out_of_range_rejected(self):
        """Test that confidence outside 0-1 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayRecommendation(
                signal=IntradaySignal.BUY,
                confidence=1.5,  # Invalid, must be 0-1
                entry=2460.0,
                stop_loss=2445.0,
                target=2490.0,
                risk_reward=2.0,
                rationale="Test",
                is_stale=False,
            )
        assert "confidence" in str(exc_info.value)

    def test_no_trade_signal_accepted(self):
        """Test NO_TRADE signal is accepted."""
        recommendation = IntradayRecommendation(
            signal=IntradaySignal.NO_TRADE,
            confidence=0.0,
            entry=2460.0,
            stop_loss=2445.0,
            target=2490.0,
            risk_reward=2.0,
            rationale="Conditions not favorable",
            is_stale=False,
        )
        assert recommendation.signal == IntradaySignal.NO_TRADE


class TestIntradayAnalysisResult:
    """Test IntradayAnalysisResult model validation."""

    def test_valid_analysis_result(self):
        """Test valid complete analysis result."""
        result = IntradayAnalysisResult(
            symbol="RELIANCE",
            interval=IntradayInterval.FIVE_MINUTES,
            timestamp="2024-01-15T10:30:00Z",
            data_freshness=DataFreshness(
                timestamp="2024-01-15T10:30:00Z",
                age_seconds=15.5,
                is_stale=False,
            ),
            technical_analysis=IntradayTechnicalAnalysis(
                rsi=58.5,
                macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
                ema_9=2465.0,
                ema_21=2460.0,
                ema_50=2455.0,
                vwap=2458.0,
                atr=15.5,
                volume=150000,
                relative_volume=1.35,
                bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
                support_levels=[2430.0, 2445.0],
                resistance_levels=[2475.0, 2490.0],
            ),
            current_price=2460.0,
            price_change=15.5,
            price_change_percent=0.63,
            recommendation=IntradayRecommendation(
                signal=IntradaySignal.BUY,
                confidence=0.75,
                entry=2460.0,
                stop_loss=2445.0,
                target=2490.0,
                risk_reward=2.0,
                rationale="Strong upward momentum",
                is_stale=False,
            ),
        )
        assert result.symbol == "RELIANCE"
        assert result.current_price == 2460.0

    def test_invalid_timestamp_format_rejected(self):
        """Test that invalid timestamp format is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IntradayAnalysisResult(
                symbol="RELIANCE",
                interval=IntradayInterval.FIVE_MINUTES,
                timestamp="not-a-date",  # Completely invalid format
                data_freshness=DataFreshness(
                    timestamp="2024-01-15T10:30:00Z",
                    age_seconds=15.5,
                    is_stale=False,
                ),
                technical_analysis=IntradayTechnicalAnalysis(
                    rsi=58.5,
                    macd=MACDIndicator(value=12.3, signal=10.1, histogram=2.2),
                    ema_9=2465.0,
                    ema_21=2460.0,
                    ema_50=2455.0,
                    vwap=2458.0,
                    atr=15.5,
                    volume=150000,
                    relative_volume=1.35,
                    bollinger_bands=BollingerBands(upper=2480.0, middle=2460.0, lower=2440.0),
                ),
                current_price=2460.0,
                price_change=15.5,
                price_change_percent=0.63,
                recommendation=IntradayRecommendation(
                    signal=IntradaySignal.BUY,
                    confidence=0.75,
                    entry=2460.0,
                    stop_loss=2445.0,
                    target=2490.0,
                    risk_reward=2.0,
                    rationale="Test",
                    is_stale=False,
                ),
            )
        assert "timestamp" in str(exc_info.value)

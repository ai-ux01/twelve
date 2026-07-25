"""
Unit tests for Swing Candidate Result Models.

Tests the SwingCandidate and ScanResult Pydantic models including:
- Field validations
- Cross-field validations (stop loss, target, risk/reward)
- Sorting validations for ScanResult
- Edge cases and error handling

Requirements: 5.4
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from models.swing import (
    SwingCandidate,
    ScanResult,
    ComponentScoresBreakdown,
    KeyMetricsSummary,
    SetupType,
    Signal,
)


class TestComponentScoresBreakdown:
    """Tests for ComponentScoresBreakdown model."""

    def test_valid_component_scores(self):
        """Test valid component scores creation."""
        scores = ComponentScoresBreakdown(
            trend_score=80.0,
            technical_score=75.0,
            volume_score=70.0,
            relative_strength_score=65.0,
            breakout_score=85.0,
            sector_score=60.0,
            risk_reward_score=72.0,
        )

        assert scores.trend_score == 80.0
        assert scores.technical_score == 75.0
        assert scores.volume_score == 70.0
        assert scores.relative_strength_score == 65.0
        assert scores.breakout_score == 85.0
        assert scores.sector_score == 60.0
        assert scores.risk_reward_score == 72.0

    def test_invalid_score_range(self):
        """Test that scores outside 0-100 range are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ComponentScoresBreakdown(
                trend_score=150.0,  # Invalid: > 100
                technical_score=75.0,
                volume_score=70.0,
                relative_strength_score=65.0,
                breakout_score=85.0,
                sector_score=60.0,
                risk_reward_score=72.0,
            )

        assert "trend_score" in str(exc_info.value)

    def test_negative_score(self):
        """Test that negative scores are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ComponentScoresBreakdown(
                trend_score=80.0,
                technical_score=-5.0,  # Invalid: < 0
                volume_score=70.0,
                relative_strength_score=65.0,
                breakout_score=85.0,
                sector_score=60.0,
                risk_reward_score=72.0,
            )

        assert "technical_score" in str(exc_info.value)


class TestKeyMetricsSummary:
    """Tests for KeyMetricsSummary model."""

    def test_valid_key_metrics(self):
        """Test valid key metrics creation."""
        metrics = KeyMetricsSummary(
            current_price=2460.0,
            volume=1200000,
            trend_direction="UPTREND",
            rsi=58.5,
            adx=32.4,
            relative_volume=1.35,
            distance_from_52w_high=-5.4,
            distance_from_52w_low=11.8,
        )

        assert metrics.current_price == 2460.0
        assert metrics.volume == 1200000
        assert metrics.trend_direction == "UPTREND"
        assert metrics.rsi == 58.5
        assert metrics.adx == 32.4
        assert metrics.relative_volume == 1.35
        assert metrics.distance_from_52w_high == -5.4
        assert metrics.distance_from_52w_low == 11.8

    def test_invalid_price(self):
        """Test that non-positive prices are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            KeyMetricsSummary(
                current_price=0.0,  # Invalid: must be > 0
                volume=1200000,
                trend_direction="UPTREND",
                rsi=58.5,
                adx=32.4,
                relative_volume=1.35,
                distance_from_52w_high=-5.4,
                distance_from_52w_low=11.8,
            )

        assert "current_price" in str(exc_info.value)

    def test_invalid_rsi_range(self):
        """Test that RSI outside 0-100 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            KeyMetricsSummary(
                current_price=2460.0,
                volume=1200000,
                trend_direction="UPTREND",
                rsi=150.0,  # Invalid: > 100
                adx=32.4,
                relative_volume=1.35,
                distance_from_52w_high=-5.4,
                distance_from_52w_low=11.8,
            )

        assert "rsi" in str(exc_info.value)

    def test_negative_volume(self):
        """Test that negative volume is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            KeyMetricsSummary(
                current_price=2460.0,
                volume=-100,  # Invalid: must be >= 0
                trend_direction="UPTREND",
                rsi=58.5,
                adx=32.4,
                relative_volume=1.35,
                distance_from_52w_high=-5.4,
                distance_from_52w_low=11.8,
            )

        assert "volume" in str(exc_info.value)


class TestSwingCandidate:
    """Tests for SwingCandidate model."""

    def test_valid_buy_candidate(self):
        """Test valid BUY candidate creation."""
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
        )

        assert candidate.symbol == "RELIANCE"
        assert candidate.score == 78.5
        assert candidate.signal == Signal.BUY
        assert candidate.entry == 2460.0
        assert candidate.stop_loss == 2430.0
        assert candidate.target == 2520.0
        assert candidate.risk_reward == 2.0

    def test_invalid_stop_loss_for_buy(self):
        """Test that stop loss above entry is rejected for BUY signal."""
        with pytest.raises(ValidationError) as exc_info:
            SwingCandidate(
                symbol="RELIANCE",
                score=78.5,
                sector="Energy",
                signal=Signal.BUY,
                setup_type=SetupType.BREAKOUT,
                entry=2460.0,
                stop_loss=2480.0,  # Invalid: stop loss above entry for BUY
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
            )

        assert "stop_loss" in str(exc_info.value)
        assert "below entry" in str(exc_info.value)

    def test_invalid_target_for_buy(self):
        """Test that target below entry is rejected for BUY signal."""
        with pytest.raises(ValidationError) as exc_info:
            SwingCandidate(
                symbol="RELIANCE",
                score=78.5,
                sector="Energy",
                signal=Signal.BUY,
                setup_type=SetupType.BREAKOUT,
                entry=2460.0,
                stop_loss=2430.0,
                target=2440.0,  # Invalid: target below entry for BUY
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
            )

        assert "target" in str(exc_info.value)
        assert "above entry" in str(exc_info.value)

    def test_invalid_risk_reward_calculation(self):
        """Test that mismatched risk/reward is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SwingCandidate(
                symbol="RELIANCE",
                score=78.5,
                sector="Energy",
                signal=Signal.BUY,
                setup_type=SetupType.BREAKOUT,
                entry=2460.0,
                stop_loss=2430.0,  # Risk: 30
                target=2520.0,  # Reward: 60
                risk_reward=5.0,  # Invalid: should be 2.0 (60/30)
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
            )

        assert "risk_reward" in str(exc_info.value).lower()

    def test_valid_sell_candidate(self):
        """Test valid SELL candidate with correct stop loss and target."""
        candidate = SwingCandidate(
            symbol="SBIN",
            score=72.0,
            sector="Finance",
            signal=Signal.SELL,
            setup_type=SetupType.REVERSAL,
            entry=600.0,
            stop_loss=620.0,  # Stop loss above entry for SELL
            target=560.0,  # Target below entry for SELL
            risk_reward=2.0,  # (600-560) / (620-600) = 40/20 = 2.0
            component_scores=ComponentScoresBreakdown(
                trend_score=70.0,
                technical_score=65.0,
                volume_score=75.0,
                relative_strength_score=60.0,
                breakout_score=55.0,
                sector_score=70.0,
                risk_reward_score=80.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=600.0,
                volume=800000,
                trend_direction="DOWNTREND",
                rsi=35.2,
                adx=28.5,
                relative_volume=1.15,
                distance_from_52w_high=-15.3,
                distance_from_52w_low=5.2,
            ),
        )

        assert candidate.signal == Signal.SELL
        assert candidate.stop_loss > candidate.entry
        assert candidate.target < candidate.entry

    def test_invalid_symbol_length(self):
        """Test that empty symbol is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SwingCandidate(
                symbol="",  # Invalid: empty
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
            )

        assert "symbol" in str(exc_info.value)


class TestScanResult:
    """Tests for ScanResult model."""

    def test_valid_scan_result(self):
        """Test valid scan result creation."""
        candidates = [
            SwingCandidate(
                symbol="RELIANCE",
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
            ),
            SwingCandidate(
                symbol="TCS",
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
            ),
        ]

        scan_result = ScanResult(
            candidates=candidates,
            total_scanned=150,
            filters_applied=["min_score >= 60", "min_volume >= 100000"],
            scan_timestamp="2024-01-15T10:30:00Z",
            market_regime="BULL_MARKET",
        )

        assert len(scan_result.candidates) == 2
        assert scan_result.total_scanned == 150
        assert len(scan_result.filters_applied) == 2
        assert scan_result.market_regime == "BULL_MARKET"

    def test_empty_candidates_list(self):
        """Test scan result with no candidates."""
        scan_result = ScanResult(
            candidates=[],
            total_scanned=150,
            filters_applied=["min_score >= 80"],  # Very strict filter
            scan_timestamp="2024-01-15T10:30:00Z",
        )

        assert len(scan_result.candidates) == 0
        assert scan_result.total_scanned == 150

    def test_unsorted_candidates_rejected(self):
        """Test that unsorted candidates list is rejected."""
        # Create candidates with unsorted scores
        candidates = [
            SwingCandidate(
                symbol="TCS",
                score=72.3,  # Lower score first - invalid
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
            ),
            SwingCandidate(
                symbol="RELIANCE",
                score=78.5,  # Higher score second - invalid
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
            ),
        ]

        with pytest.raises(ValidationError) as exc_info:
            ScanResult(candidates=candidates, total_scanned=150, filters_applied=[])

        assert "sorted" in str(exc_info.value).lower()

    def test_negative_total_scanned(self):
        """Test that negative total_scanned is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ScanResult(
                candidates=[],
                total_scanned=-10,  # Invalid: negative
                filters_applied=[],
            )

        assert "total_scanned" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

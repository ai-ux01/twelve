"""
Unit tests for SwingAnalysisService.

Tests the orchestration of all technical factor calculations for swing trading analysis.
"""

import pytest
from datetime import datetime, timedelta
from models.market_data import OHLCVData, SwingType, SwingPoint
from services.swing_analysis_service import SwingAnalysisService, SwingAnalysisResult


def generate_test_data(num_points: int = 250, base_price: float = 100.0) -> list:
    """
    Generate realistic test OHLCV data for testing.

    Args:
        num_points: Number of data points to generate
        base_price: Starting price

    Returns:
        List of OHLCVData objects
    """
    data = []
    current_price = base_price
    current_time = datetime(2024, 1, 1)

    for i in range(num_points):
        # Simulate price movement with some trend and volatility
        change = (i % 10 - 5) * 0.5  # Creates a wave pattern
        current_price += change

        # Ensure price stays positive
        current_price = max(current_price, base_price * 0.5)

        # Generate OHLCV
        open_price = current_price
        high_price = current_price + abs(change) * 0.5
        low_price = current_price - abs(change) * 0.5
        close_price = current_price + change * 0.2
        volume = 1000000 + (i % 5) * 100000

        data.append(
            OHLCVData(
                timestamp=current_time,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                volume=volume,
            )
        )

        current_time += timedelta(days=1)

    return data


class TestSwingAnalysisService:
    """Test suite for SwingAnalysisService."""

    def test_initialization_default_parameters(self):
        """Test service initialization with default parameters."""
        service = SwingAnalysisService()

        assert service.rsi_period == 14
        assert service.adx_period == 14
        assert service.atr_period == 14
        assert service.macd_fast == 12
        assert service.macd_slow == 26
        assert service.macd_signal == 9
        assert service.volume_period == 20
        assert service.momentum_period == 10
        assert service.lookback_days == 365
        assert service.trendline_lookback == 3

    def test_initialization_custom_parameters(self):
        """Test service initialization with custom parameters."""
        service = SwingAnalysisService(
            rsi_period=20,
            adx_period=20,
            atr_period=20,
            macd_fast=8,
            macd_slow=21,
            macd_signal=5,
            volume_period=30,
            momentum_period=15,
            lookback_days=252,
            trendline_lookback=5,
        )

        assert service.rsi_period == 20
        assert service.adx_period == 20
        assert service.atr_period == 20
        assert service.macd_fast == 8
        assert service.macd_slow == 21
        assert service.macd_signal == 5
        assert service.volume_period == 30
        assert service.momentum_period == 15
        assert service.lookback_days == 252
        assert service.trendline_lookback == 5

    def test_initialization_invalid_rsi_period(self):
        """Test that invalid RSI period raises ValueError."""
        with pytest.raises(ValueError, match="rsi_period must be positive"):
            SwingAnalysisService(rsi_period=0)

        with pytest.raises(ValueError, match="rsi_period must be positive"):
            SwingAnalysisService(rsi_period=-5)

    def test_initialization_invalid_adx_period(self):
        """Test that invalid ADX period raises ValueError."""
        with pytest.raises(ValueError, match="adx_period must be positive"):
            SwingAnalysisService(adx_period=0)

    def test_initialization_invalid_atr_period(self):
        """Test that invalid ATR period raises ValueError."""
        with pytest.raises(ValueError, match="atr_period must be positive"):
            SwingAnalysisService(atr_period=-1)

    def test_initialization_invalid_macd_periods(self):
        """Test that invalid MACD periods raise ValueError."""
        with pytest.raises(ValueError, match="MACD periods must be positive"):
            SwingAnalysisService(macd_fast=0)

        with pytest.raises(
            ValueError, match="MACD fast period must be less than slow period"
        ):
            SwingAnalysisService(macd_fast=26, macd_slow=12)

    def test_initialization_invalid_volume_period(self):
        """Test that invalid volume period raises ValueError."""
        with pytest.raises(ValueError, match="volume_period must be positive"):
            SwingAnalysisService(volume_period=0)

    def test_initialization_invalid_momentum_period(self):
        """Test that invalid momentum period raises ValueError."""
        with pytest.raises(ValueError, match="momentum_period must be positive"):
            SwingAnalysisService(momentum_period=-10)

    def test_initialization_invalid_lookback_days(self):
        """Test that invalid lookback_days raises ValueError."""
        with pytest.raises(ValueError, match="lookback_days must be positive"):
            SwingAnalysisService(lookback_days=0)

    def test_initialization_invalid_trendline_lookback(self):
        """Test that invalid trendline_lookback raises ValueError."""
        with pytest.raises(ValueError, match="trendline_lookback must be positive"):
            SwingAnalysisService(trendline_lookback=-1)

    def test_analyze_empty_data(self):
        """Test that empty data raises ValueError."""
        service = SwingAnalysisService()

        with pytest.raises(ValueError, match="data cannot be empty"):
            service.analyze("TEST", "1d", [])

    def test_analyze_insufficient_data(self):
        """Test that insufficient data raises ValueError."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=50)  # Not enough for 200-period MA

        with pytest.raises(ValueError, match="Insufficient data"):
            service.analyze("TEST", "1d", data)

    def test_analyze_sufficient_data(self):
        """Test successful analysis with sufficient data."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data)

        # Verify result structure
        assert isinstance(result, SwingAnalysisResult)
        assert result.symbol == "TEST"
        assert result.timeframe == "1d"

        # Verify indicators are calculated
        assert result.indicators is not None
        assert 0 <= result.indicators.rsi <= 100
        assert result.indicators.adx >= 0
        assert result.indicators.atr > 0
        assert result.indicators.macd is not None
        assert result.indicators.ema_20 > 0
        assert result.indicators.sma_20 > 0
        assert result.indicators.vwap > 0

        # Verify volume analysis
        assert result.volume_analysis is not None
        assert "volume_ma" in result.volume_analysis
        assert "relative_volume" in result.volume_analysis
        assert "volume_trend" in result.volume_analysis
        assert result.volume_analysis["volume_ma"] > 0
        assert result.volume_analysis["relative_volume"] >= 0

        # Verify price range analysis
        assert result.price_range_analysis is not None
        assert "high_52w" in result.price_range_analysis
        assert "low_52w" in result.price_range_analysis
        assert "current_price" in result.price_range_analysis
        assert "momentum" in result.price_range_analysis
        assert (
            result.price_range_analysis["high_52w"]
            >= result.price_range_analysis["low_52w"]
        )

    def test_analyze_without_trendlines(self):
        """Test analysis without trendline analysis."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data, include_trendlines=False)

        # Verify trendline analysis is None
        assert result.trendline_analysis is None

        # Other components should still be present
        assert result.indicators is not None
        assert result.volume_analysis is not None
        assert result.price_range_analysis is not None

    def test_analyze_with_trendlines(self):
        """Test analysis with trendline analysis."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data, include_trendlines=True)

        # Verify trendline analysis is included
        assert result.trendline_analysis is not None

        # Trendline analysis should have expected keys
        # (may be None if insufficient swing points, but dict should exist)
        if result.trendline_analysis and "error" not in result.trendline_analysis:
            assert "support_trendline" in result.trendline_analysis
            assert "resistance_trendline" in result.trendline_analysis
            assert "breakout" in result.trendline_analysis
            assert "swing_points" in result.trendline_analysis

    def test_ema_ordering(self):
        """Test that EMAs are ordered correctly (shorter periods react faster)."""
        service = SwingAnalysisService()

        # Generate uptrend data
        data = []
        current_time = datetime(2024, 1, 1)

        for i in range(250):
            price = 100.0 + i * 0.5  # Consistent uptrend
            data.append(
                OHLCVData(
                    timestamp=current_time,
                    open=price,
                    high=price + 0.5,
                    low=price - 0.5,
                    close=price,
                    volume=1000000,
                )
            )
            current_time += timedelta(days=1)

        result = service.analyze("TEST", "1d", data)

        # In an uptrend, shorter EMAs should be higher than longer EMAs
        assert result.indicators.ema_5 > result.indicators.ema_15
        assert result.indicators.ema_15 > result.indicators.ema_20
        assert result.indicators.ema_20 > result.indicators.ema_50
        assert result.indicators.ema_50 > result.indicators.ema_200

    def test_rsi_bounds(self):
        """Test that RSI stays within 0-100 bounds."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data)

        assert 0 <= result.indicators.rsi <= 100

    def test_adx_bounds(self):
        """Test that ADX stays within valid bounds."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data)

        assert result.indicators.adx >= 0
        # ADX typically doesn't exceed 100 but can theoretically
        assert result.indicators.adx <= 100

    def test_bollinger_bands_ordering(self):
        """Test that Bollinger Bands are ordered correctly."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data)

        bb = result.indicators.bollinger_bands
        assert bb.upper > bb.middle
        assert bb.middle > bb.lower

    def test_52_week_high_low_relationship(self):
        """Test that 52-week high >= 52-week low."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data)

        assert (
            result.price_range_analysis["high_52w"]
            >= result.price_range_analysis["low_52w"]
        )

    def test_volume_trend_identification(self):
        """Test volume trend identification."""
        service = SwingAnalysisService()

        # Generate data with significantly increasing volume in recent bars
        data = []
        current_time = datetime(2024, 1, 1)

        for i in range(250):
            price = 100.0 + (i % 10 - 5) * 0.5
            # Volume increases more dramatically in last 50 bars
            if i < 200:
                volume = 1000000  # Stable volume
            else:
                volume = 1000000 + (i - 200) * 50000  # Rapid increase

            data.append(
                OHLCVData(
                    timestamp=current_time,
                    open=price,
                    high=price + 0.5,
                    low=price - 0.5,
                    close=price,
                    volume=volume,
                )
            )
            current_time += timedelta(days=1)

        result = service.analyze("TEST", "1d", data)

        # Volume should be identified as increasing
        assert result.volume_analysis["volume_trend"] == "INCREASING"

    def test_multiple_symbols_analysis(self):
        """Test analyzing multiple symbols independently."""
        service = SwingAnalysisService()

        data1 = generate_test_data(num_points=250, base_price=100.0)
        data2 = generate_test_data(num_points=250, base_price=200.0)

        result1 = service.analyze("SYMBOL1", "1d", data1)
        result2 = service.analyze("SYMBOL2", "1d", data2)

        # Verify results are independent
        assert result1.symbol == "SYMBOL1"
        assert result2.symbol == "SYMBOL2"

        # Results should be different due to different base prices
        assert result1.indicators.vwap != result2.indicators.vwap

    def test_support_resistance_extraction(self):
        """Test support and resistance level extraction from swing points."""
        service = SwingAnalysisService()

        # Create mock swing points
        swing_points = [
            SwingPoint(
                timestamp=datetime(2024, 1, 1),
                price=100.0,
                type=SwingType.LOW,
                index=0,
            ),
            SwingPoint(
                timestamp=datetime(2024, 1, 2),
                price=101.0,
                type=SwingType.LOW,
                index=1,
            ),
            SwingPoint(
                timestamp=datetime(2024, 1, 3),
                price=110.0,
                type=SwingType.HIGH,
                index=2,
            ),
            SwingPoint(
                timestamp=datetime(2024, 1, 4),
                price=111.0,
                type=SwingType.HIGH,
                index=3,
            ),
        ]

        levels = service._extract_support_resistance_from_swings(swing_points)

        # Should cluster into 2 levels (around 100 and 110)
        assert len(levels) == 2

        # Check that levels have required attributes
        for level in levels:
            assert level.level > 0
            assert 0 <= level.strength <= 1
            assert level.touches >= 1

    def test_indicator_consistency(self):
        """Test that indicators remain consistent across multiple analyses of same data."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result1 = service.analyze("TEST", "1d", data, include_trendlines=False)
        result2 = service.analyze("TEST", "1d", data, include_trendlines=False)

        # Results should be identical
        assert result1.indicators.rsi == result2.indicators.rsi
        assert result1.indicators.adx == result2.indicators.adx
        assert result1.indicators.atr == result2.indicators.atr
        assert result1.indicators.vwap == result2.indicators.vwap

    def test_macd_histogram_calculation(self):
        """Test that MACD histogram is calculated correctly."""
        service = SwingAnalysisService()
        data = generate_test_data(num_points=250)

        result = service.analyze("TEST", "1d", data)

        macd = result.indicators.macd

        # Histogram should equal MACD value - signal
        # Allow small floating point differences
        calculated_histogram = macd.value - macd.signal
        assert abs(macd.histogram - calculated_histogram) < 0.01

    def test_relative_volume_calculation(self):
        """Test relative volume calculation."""
        service = SwingAnalysisService()

        # Generate data with specific volume pattern
        data = []
        current_time = datetime(2024, 1, 1)

        for i in range(250):
            price = 100.0
            # Last volume is 2x the average
            volume = 1000000 if i < 249 else 2000000

            data.append(
                OHLCVData(
                    timestamp=current_time,
                    open=price,
                    high=price + 0.5,
                    low=price - 0.5,
                    close=price,
                    volume=volume,
                )
            )
            current_time += timedelta(days=1)

        result = service.analyze("TEST", "1d", data)

        # Relative volume should be approximately 2.0
        assert 1.8 <= result.volume_analysis["relative_volume"] <= 2.2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

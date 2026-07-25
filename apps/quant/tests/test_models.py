"""
Unit tests for Pydantic models in the Quant Engine.

Tests validation rules, serialization, and model constraints.
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from models import (
    OHLCVData,
    MarketDataRequest,
    IndicatorResult,
    MACDValues,
    BollingerBands,
    TrendlineResult,
    SupportResistanceLevel,
    AnalysisResult,
    OptionsRequest,
    OptionsGreeks,
    GreeksResult,
    OptionType,
)


class TestOHLCVData:
    """Tests for OHLCVData model."""

    def test_valid_ohlcv_data(self):
        """Test creating valid OHLCV data."""
        data = OHLCVData(
            timestamp=datetime(2024, 1, 15, 9, 15, 0, tzinfo=timezone.utc),
            open=2450.0,
            high=2470.0,
            low=2445.0,
            close=2465.0,
            volume=1000000,
        )
        assert data.open == 2450.0
        assert data.high == 2470.0
        assert data.low == 2445.0
        assert data.close == 2465.0
        assert data.volume == 1000000

    def test_negative_price_rejected(self):
        """Test that negative prices are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15, 0, tzinfo=timezone.utc),
                open=-2450.0,
                high=2470.0,
                low=2445.0,
                close=2465.0,
                volume=1000000,
            )
        assert "open" in str(exc_info.value)

    def test_zero_price_rejected(self):
        """Test that zero prices are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15, 0, tzinfo=timezone.utc),
                open=0,
                high=2470.0,
                low=2445.0,
                close=2465.0,
                volume=1000000,
            )
        assert "open" in str(exc_info.value)

    def test_negative_volume_rejected(self):
        """Test that negative volume is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OHLCVData(
                timestamp=datetime(2024, 1, 15, 9, 15, 0, tzinfo=timezone.utc),
                open=2450.0,
                high=2470.0,
                low=2445.0,
                close=2465.0,
                volume=-1000000,
            )
        assert "volume" in str(exc_info.value)


class TestMarketDataRequest:
    """Tests for MarketDataRequest model."""

    def test_valid_market_data_request(self):
        """Test creating valid market data request."""
        request = MarketDataRequest(
            symbol="RELIANCE",
            timeframe="1d",
            data=[
                OHLCVData(
                    timestamp=datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc),
                    open=2450.0,
                    high=2470.0,
                    low=2445.0,
                    close=2465.0,
                    volume=1000000,
                ),
                OHLCVData(
                    timestamp=datetime(2024, 1, 16, 0, 0, 0, tzinfo=timezone.utc),
                    open=2465.0,
                    high=2480.0,
                    low=2460.0,
                    close=2475.0,
                    volume=1100000,
                ),
            ],
        )
        assert request.symbol == "RELIANCE"
        assert request.timeframe == "1d"
        assert len(request.data) == 2

    def test_invalid_timeframe_rejected(self):
        """Test that invalid timeframe is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MarketDataRequest(
                symbol="RELIANCE",
                timeframe="2h",  # Not in allowed values
                data=[
                    OHLCVData(
                        timestamp=datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc),
                        open=2450.0,
                        high=2470.0,
                        low=2445.0,
                        close=2465.0,
                        volume=1000000,
                    )
                ],
            )
        assert "timeframe" in str(exc_info.value)

    def test_empty_symbol_rejected(self):
        """Test that empty symbol is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MarketDataRequest(
                symbol="",
                timeframe="1d",
                data=[
                    OHLCVData(
                        timestamp=datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc),
                        open=2450.0,
                        high=2470.0,
                        low=2445.0,
                        close=2465.0,
                        volume=1000000,
                    )
                ],
            )
        assert "symbol" in str(exc_info.value)

    def test_empty_data_rejected(self):
        """Test that empty data array is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MarketDataRequest(symbol="RELIANCE", timeframe="1d", data=[])
        assert "data" in str(exc_info.value)


class TestIndicatorResult:
    """Tests for IndicatorResult model."""

    def test_valid_indicator_result(self):
        """Test creating valid indicator result."""
        result = IndicatorResult(
            rsi=45.2,
            macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
            sma_20=2455.0,
            sma_50=2450.0,
            sma_200=2380.0,
            ema_5=2462.5,
            ema_15=2460.0,
            ema_20=2458.0,
            ema_50=2452.0,
            ema_200=2385.0,
            bollinger_bands=BollingerBands(upper=2500.0, middle=2455.0, lower=2410.0),
            adx=25.5,
            atr=45.3,
            vwap=2461.0,
            volume_ma=950000.0,
            relative_volume=1.05,
            week_52_high=2650.0,
            week_52_low=2200.0,
            momentum=15.2,
        )
        assert result.rsi == 45.2
        assert result.macd.value == 12.3
        assert result.sma_20 == 2455.0
        assert result.adx == 25.5
        assert result.atr == 45.3
        assert result.vwap == 2461.0

    def test_rsi_out_of_range_rejected(self):
        """Test that RSI outside 0-100 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=150.0,  # Invalid: > 100
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "rsi" in str(exc_info.value)

    def test_negative_moving_average_rejected(self):
        """Test that negative moving averages are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=-2455.0,  # Invalid: negative
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "sma_20" in str(exc_info.value)

    def test_adx_out_of_range_rejected(self):
        """Test that ADX outside 0-100 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=150.0,  # Invalid: > 100
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "adx" in str(exc_info.value)

    def test_negative_atr_rejected(self):
        """Test that negative ATR is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=-45.3,  # Invalid: negative
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "atr" in str(exc_info.value)

    def test_negative_vwap_rejected(self):
        """Test that negative VWAP is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=-2461.0,  # Invalid: negative
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "vwap" in str(exc_info.value)

    def test_negative_volume_ma_rejected(self):
        """Test that negative volume MA is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=-950000.0,  # Invalid: negative
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "volume_ma" in str(exc_info.value)

    def test_negative_relative_volume_rejected(self):
        """Test that negative relative volume is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=-1.05,  # Invalid: negative
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "relative_volume" in str(exc_info.value)

    def test_negative_week_52_high_rejected(self):
        """Test that negative 52-week high is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=-2650.0,  # Invalid: negative
                week_52_low=2200.0,
                momentum=15.2,
            )
        assert "week_52_high" in str(exc_info.value)

    def test_negative_week_52_low_rejected(self):
        """Test that negative 52-week low is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=-2200.0,  # Invalid: negative
                momentum=15.2,
            )
        assert "week_52_low" in str(exc_info.value)


class TestBollingerBands:
    """Tests for BollingerBands model."""

    def test_valid_bollinger_bands(self):
        """Test creating valid Bollinger Bands."""
        bands = BollingerBands(upper=2500.0, middle=2455.0, lower=2410.0)
        assert bands.upper == 2500.0
        assert bands.middle == 2455.0
        assert bands.lower == 2410.0


class TestTrendlineResult:
    """Tests for TrendlineResult model."""

    def test_valid_trendline(self):
        """Test creating valid trendline result."""
        trendline = TrendlineResult(
            slope=2.5,
            intercept=2350.0,
            r_squared=0.89,
            start_point=(0.0, 2350.0),
            end_point=(30.0, 2425.0),
        )
        assert trendline.slope == 2.5
        assert trendline.r_squared == 0.89

    def test_r_squared_out_of_range_rejected(self):
        """Test that R² outside 0-1 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            TrendlineResult(
                slope=2.5,
                intercept=2350.0,
                r_squared=1.5,  # Invalid: > 1
                start_point=(0.0, 2350.0),
                end_point=(30.0, 2425.0),
            )
        assert "r_squared" in str(exc_info.value)


class TestSupportResistanceLevel:
    """Tests for SupportResistanceLevel model."""

    def test_valid_support_resistance(self):
        """Test creating valid support/resistance level."""
        level = SupportResistanceLevel(level=2400.0, strength=0.85, touches=5)
        assert level.level == 2400.0
        assert level.strength == 0.85
        assert level.touches == 5

    def test_negative_price_rejected(self):
        """Test that negative price level is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SupportResistanceLevel(level=-2400.0, strength=0.85, touches=5)
        assert "level" in str(exc_info.value)

    def test_strength_out_of_range_rejected(self):
        """Test that strength outside 0-1 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SupportResistanceLevel(level=2400.0, strength=1.5, touches=5)
        assert "strength" in str(exc_info.value)

    def test_zero_touches_rejected(self):
        """Test that zero touches is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SupportResistanceLevel(level=2400.0, strength=0.85, touches=0)
        assert "touches" in str(exc_info.value)


class TestAnalysisResult:
    """Tests for AnalysisResult model."""

    def test_valid_analysis_result(self):
        """Test creating valid analysis result."""
        result = AnalysisResult(
            symbol="RELIANCE",
            timeframe="1d",
            indicators=IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            ),
            support_resistance=[
                SupportResistanceLevel(level=2400.0, strength=0.85, touches=5)
            ],
            trendlines=[
                TrendlineResult(
                    slope=2.5,
                    intercept=2350.0,
                    r_squared=0.89,
                    start_point=(0.0, 2350.0),
                    end_point=(30.0, 2425.0),
                )
            ],
        )
        assert result.symbol == "RELIANCE"
        assert result.timeframe == "1d"
        assert len(result.support_resistance) == 1
        assert len(result.trendlines) == 1

    def test_empty_support_resistance_allowed(self):
        """Test that empty support/resistance list is allowed."""
        result = AnalysisResult(
            symbol="RELIANCE",
            timeframe="1d",
            indicators=IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            ),
            support_resistance=[],
            trendlines=[],
        )
        assert len(result.support_resistance) == 0


class TestOptionsRequest:
    """Tests for OptionsRequest model."""

    def test_valid_options_request(self):
        """Test creating valid options request."""
        request = OptionsRequest(
            underlying="NIFTY",
            spot_price=21500.0,
            strike_price=21600.0,
            option_type=OptionType.CALL,
            expiry_date=datetime(2024, 12, 26, 0, 0, 0, tzinfo=timezone.utc),
            volatility=0.15,
            risk_free_rate=0.07,
        )
        assert request.underlying == "NIFTY"
        assert request.spot_price == 21500.0
        assert request.option_type == OptionType.CALL

    def test_negative_spot_price_rejected(self):
        """Test that negative spot price is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OptionsRequest(
                underlying="NIFTY",
                spot_price=-21500.0,
                strike_price=21600.0,
                option_type=OptionType.CALL,
                expiry_date=datetime(2024, 12, 26, 0, 0, 0, tzinfo=timezone.utc),
                volatility=0.15,
                risk_free_rate=0.07,
            )
        assert "spot_price" in str(exc_info.value)

    def test_volatility_out_of_range_rejected(self):
        """Test that volatility outside valid range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OptionsRequest(
                underlying="NIFTY",
                spot_price=21500.0,
                strike_price=21600.0,
                option_type=OptionType.CALL,
                expiry_date=datetime(2024, 12, 26, 0, 0, 0, tzinfo=timezone.utc),
                volatility=2.5,  # Invalid: > 2.0
                risk_free_rate=0.07,
            )
        assert "volatility" in str(exc_info.value)


class TestOptionsGreeks:
    """Tests for OptionsGreeks model."""

    def test_valid_greeks(self):
        """Test creating valid options Greeks."""
        greeks = OptionsGreeks(
            delta=0.52, gamma=0.003, theta=-12.5, vega=45.2, rho=23.4
        )
        assert greeks.delta == 0.52
        assert greeks.gamma == 0.003
        assert greeks.theta == -12.5

    def test_delta_out_of_range_rejected(self):
        """Test that delta outside -1 to 1 range is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OptionsGreeks(delta=1.5, gamma=0.003, theta=-12.5, vega=45.2, rho=23.4)
        assert "delta" in str(exc_info.value)

    def test_negative_gamma_rejected(self):
        """Test that negative gamma is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OptionsGreeks(delta=0.52, gamma=-0.003, theta=-12.5, vega=45.2, rho=23.4)
        assert "gamma" in str(exc_info.value)


class TestGreeksResult:
    """Tests for GreeksResult model."""

    def test_valid_greeks_result(self):
        """Test creating valid Greeks result."""
        result = GreeksResult(
            underlying="NIFTY",
            spot_price=21500.0,
            strike_price=21600.0,
            option_type=OptionType.CALL,
            expiry_date=datetime(2024, 12, 26, 0, 0, 0, tzinfo=timezone.utc),
            greeks=OptionsGreeks(
                delta=0.52, gamma=0.003, theta=-12.5, vega=45.2, rho=23.4
            ),
        )
        assert result.underlying == "NIFTY"
        assert result.greeks.delta == 0.52


class TestSerialization:
    """Tests for JSON serialization and deserialization."""

    def test_analysis_result_serialization_roundtrip(self):
        """Test that AnalysisResult can be serialized and deserialized."""
        original = AnalysisResult(
            symbol="RELIANCE",
            timeframe="1d",
            indicators=IndicatorResult(
                rsi=45.2,
                macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
                sma_20=2455.0,
                sma_50=2450.0,
                sma_200=2380.0,
                ema_5=2462.5,
                ema_15=2460.0,
                ema_20=2458.0,
                ema_50=2452.0,
                ema_200=2385.0,
                bollinger_bands=BollingerBands(
                    upper=2500.0, middle=2455.0, lower=2410.0
                ),
                adx=25.5,
                atr=45.3,
                vwap=2461.0,
                volume_ma=950000.0,
                relative_volume=1.05,
                week_52_high=2650.0,
                week_52_low=2200.0,
                momentum=15.2,
            ),
        )

        # Serialize to JSON
        json_str = original.model_dump_json()

        # Deserialize from JSON
        deserialized = AnalysisResult.model_validate_json(json_str)

        # Verify all fields match
        assert deserialized.symbol == original.symbol
        assert deserialized.timeframe == original.timeframe
        assert deserialized.indicators.rsi == original.indicators.rsi
        assert deserialized.indicators.macd.value == original.indicators.macd.value

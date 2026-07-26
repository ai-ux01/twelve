"""
Unit tests for SignalMapper.map_scalper_signal.

Tests the pure mapping function that converts Options Scalper results
into CreatePaperTradeDto payloads.

Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 6.6
"""

import pytest
from datetime import datetime, date

from scalper.models import (
    ScalperAnalysisResult,
    ScalperSignalType,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
)
from signal_forwarder.mapper import SignalMapper


def _make_scalper_result(
    signal_type: ScalperSignalType = ScalperSignalType.BUY_CE,
    probability: float = 78.5,
    risk_reward_ratio: float = 2.5,
    underlying: str = "NIFTY",
    strike_price: float = 21500.0,
    expiry_date: date = date(2024, 12, 19),
    entry_price: float = 150.0,
    target_price: float = 200.0,
    stop_loss: float = 120.0,
    lot_size: int = 50,
    spot_price: float = 21450.0,
    trend: TrendClassification = TrendClassification.BULLISH,
    rsi: float = 62.5,
    pcr: float = 1.2,
) -> ScalperAnalysisResult:
    """Create a ScalperAnalysisResult for testing."""
    return ScalperAnalysisResult(
        timestamp=datetime(2024, 12, 20, 10, 30, 0),
        underlying=underlying,
        signal_type=signal_type,
        probability=probability,
        risk_reward_ratio=risk_reward_ratio,
        strike_price=strike_price,
        expiry_date=expiry_date,
        entry_price=entry_price,
        target_price=target_price,
        stop_loss=stop_loss,
        lot_size=lot_size,
        spot_price=spot_price,
        trend=trend,
        oi_interpretation=OIInterpretation.BULLISH,
        pcr=pcr,
        trendline_status=TrendlineStatus.BULLISH,
        support_level=21400.0,
        resistance_level=21600.0,
        rsi=rsi,
        macd=15.3,
        macd_signal=12.1,
        vwap=21500.0,
        ema_5=21520.0,
        ema_15=21480.0,
        atr=85.5,
        volume_ratio=1.25,
        call_oi=5000000,
        put_oi=6000000,
        call_oi_change=150000,
        put_oi_change=200000,
        atm_iv=0.18,
        rationale="Strong bullish momentum with positive indicators.",
        hold_reason=None,
    )


class TestMapScalperSignalBuyCE:
    """Tests for BUY CE signal mapping."""

    def test_direction_is_long(self):
        result = _make_scalper_result(signal_type=ScalperSignalType.BUY_CE)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["direction"] == "LONG"

    def test_trade_type_is_options_scalping(self):
        result = _make_scalper_result(signal_type=ScalperSignalType.BUY_CE)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["tradeType"] == "OPTIONS_SCALPING"

    def test_option_type_is_ce(self):
        result = _make_scalper_result(signal_type=ScalperSignalType.BUY_CE)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["optionType"] == "CE"

    def test_quantity_is_lot_size(self):
        result = _make_scalper_result(lot_size=50)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["quantity"] == 50

    def test_price_fields_mapped(self):
        result = _make_scalper_result(entry_price=150.0, stop_loss=120.0, target_price=200.0)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["entryPrice"] == 150.0
        assert payload["stopLoss"] == 120.0
        assert payload["target"] == 200.0

    def test_probability_and_risk_reward(self):
        result = _make_scalper_result(probability=78.5, risk_reward_ratio=2.5)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["probability"] == 78.5
        assert payload["riskRewardRatio"] == 2.5

    def test_agent_id_is_options_scalper(self):
        result = _make_scalper_result()
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["agentId"] == "options_scalper"

    def test_user_id_is_passed(self):
        result = _make_scalper_result()
        payload = SignalMapper.map_scalper_signal(result, "test_user")
        assert payload["userId"] == "test_user"

    def test_symbol_constructed_correctly(self):
        result = _make_scalper_result(
            underlying="NIFTY",
            expiry_date=date(2024, 12, 19),
            strike_price=21500.0,
            signal_type=ScalperSignalType.BUY_CE,
        )
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["symbol"] == "NIFTY24DEC21500CE"

    def test_strike_price_mapped(self):
        result = _make_scalper_result(strike_price=21500.0)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["strikePrice"] == 21500.0

    def test_expiry_date_as_string(self):
        result = _make_scalper_result(expiry_date=date(2024, 12, 19))
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["expiryDate"] == "2024-12-19"

    def test_underlying_mapped(self):
        result = _make_scalper_result(underlying="NIFTY")
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["underlying"] == "NIFTY"


class TestMapScalperSignalBuyPE:
    """Tests for BUY PE signal mapping."""

    def test_direction_is_long(self):
        result = _make_scalper_result(signal_type=ScalperSignalType.BUY_PE)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["direction"] == "LONG"

    def test_option_type_is_pe(self):
        result = _make_scalper_result(signal_type=ScalperSignalType.BUY_PE)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["optionType"] == "PE"

    def test_symbol_has_pe_suffix(self):
        result = _make_scalper_result(
            signal_type=ScalperSignalType.BUY_PE,
            underlying="BANKNIFTY",
            expiry_date=date(2024, 12, 26),
            strike_price=48000.0,
        )
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["symbol"] == "BANKNIFTY24DEC48000PE"


class TestMapScalperSignalIndicators:
    """Tests for the indicators dict in the payload."""

    def test_indicators_contains_spot_price(self):
        result = _make_scalper_result(spot_price=21450.0)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["indicators"]["spot_price"] == 21450.0

    def test_indicators_contains_trend(self):
        result = _make_scalper_result(trend=TrendClassification.BULLISH)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["indicators"]["trend"] == "Bullish"

    def test_indicators_contains_rsi(self):
        result = _make_scalper_result(rsi=62.5)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["indicators"]["rsi"] == 62.5

    def test_indicators_contains_pcr(self):
        result = _make_scalper_result(pcr=1.2)
        payload = SignalMapper.map_scalper_signal(result, "user1")
        assert payload["indicators"]["pcr"] == 1.2


class TestMapScalperSignalHold:
    """Tests for HOLD signal rejection."""

    def test_hold_signal_raises_value_error(self):
        result = _make_scalper_result(signal_type=ScalperSignalType.HOLD)
        with pytest.raises(ValueError, match="Cannot map HOLD signal"):
            SignalMapper.map_scalper_signal(result, "user1")

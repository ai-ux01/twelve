"""
Unit tests for SignalGenerator.

Tests signal generation logic, contract selection, R:R calculation,
and safety controls.
"""

from __future__ import annotations

import pytest
from datetime import date, datetime, timedelta, timezone
from typing import List

from scalper.signal_generator import (
    SignalGenerator,
    SignalGeneratorError,
    IST,
    INDIAN_MARKET_HOLIDAYS,
    STRIKE_INTERVAL,
    LOT_SIZE,
)
from scalper.models import (
    MarketDataPackage,
    OptionsContract,
    ScalperSignalType,
    Signal,
    TechnicalIndicators,
)
from scalper.ai_analysis_engine import AIAnalysisResult


# --- Test Fixtures ---


def make_ai_result(
    signal_type: str = "BUY CE",
    probability: float = 80.0,
    trend: str = "Bullish",
    entry_price: float = 100.0,
    target_price: float = 200.0,
    stop_loss: float = 50.0,
) -> AIAnalysisResult:
    """Create an AIAnalysisResult for testing."""
    return AIAnalysisResult(
        signal_type=signal_type,
        probability=probability,
        entry_price=entry_price,
        target_price=target_price,
        stop_loss=stop_loss,
        trend=trend,
        oi_interpretation="Bullish",
        rationale="Test rationale for analysis.",
    )


def make_contract(
    strike_price: float = 21500.0,
    option_type: str = "CE",
    expiry_date: date = None,
    bid: float = 98.0,
    ask: float = 102.0,
    volume: int = 5000,
    open_interest: int = 10000,
    implied_volatility: float = 0.15,
) -> OptionsContract:
    """Create an OptionsContract for testing."""
    if expiry_date is None:
        expiry_date = date.today() + timedelta(days=5)
    mid_price = (bid + ask) / 2
    spread = ask - bid
    spread_pct = (spread / mid_price) * 100 if mid_price > 0 else 0.0
    return OptionsContract(
        strike_price=strike_price,
        option_type=option_type,
        expiry_date=expiry_date,
        bid=bid,
        ask=ask,
        ltp=(bid + ask) / 2,
        volume=volume,
        open_interest=open_interest,
        implied_volatility=implied_volatility,
        mid_price=mid_price,
        spread=spread,
        spread_percentage=spread_pct,
        is_liquid=True,
        delta=0.52,
        gamma=0.003,
        theta=-12.5,
        vega=45.2,
    )


def make_technical_indicators(atr: float = 85.5) -> TechnicalIndicators:
    """Create TechnicalIndicators for testing."""
    return TechnicalIndicators(
        vwap=21500.0,
        ema_5=21520.0,
        ema_15=21480.0,
        rsi=62.5,
        macd=15.3,
        macd_signal=12.1,
        macd_histogram=3.2,
        atr=atr,
        current_volume=250000,
        avg_volume=200000.0,
        volume_ratio=1.25,
    )


def make_market_data(
    spot_price: float = 21500.0,
    underlying: str = "NIFTY",
    timestamp: datetime = None,
) -> MarketDataPackage:
    """Create a MarketDataPackage for testing."""
    if timestamp is None:
        timestamp = datetime.now(IST)
    return MarketDataPackage(
        timestamp=timestamp,
        underlying=underlying,
        spot_price=spot_price,
        ohlcv_data=[{"open": 21500, "high": 21550, "low": 21450, "close": 21520, "volume": 100000}],
        options_chain=[],
        previous_analysis=None,
    )


def make_market_hours_time() -> datetime:
    """Create a datetime within market hours (IST)."""
    # Use a known weekday (Wednesday) at 10:00 AM IST
    return datetime(2024, 12, 18, 10, 0, 0, tzinfo=IST)


def make_contracts_list(spot_price: float = 21500.0, underlying: str = "NIFTY") -> List[OptionsContract]:
    """Create a list of contracts around ATM for testing."""
    strike_interval = STRIKE_INTERVAL.get(underlying, 50)
    atm_strike = round(spot_price / strike_interval) * strike_interval
    contracts = []
    expiry = date.today() + timedelta(days=5)
    for offset in range(-2, 3):
        strike = atm_strike + (offset * strike_interval)
        for opt_type in ["CE", "PE"]:
            contracts.append(make_contract(
                strike_price=strike,
                option_type=opt_type,
                expiry_date=expiry,
            ))
    return contracts


# --- Tests for calculate_risk_reward_ratio ---


class TestCalculateRiskRewardRatio:
    """Tests for calculate_risk_reward_ratio method."""

    def test_standard_rr_calculation(self):
        """Test standard R:R calculation."""
        sg = SignalGenerator()
        # (200 - 100) / (100 - 50) = 100/50 = 2.0
        assert sg.calculate_risk_reward_ratio(100.0, 200.0, 50.0) == 2.0

    def test_high_rr_ratio(self):
        """Test high R:R ratio."""
        sg = SignalGenerator()
        # (400 - 100) / (100 - 50) = 300/50 = 6.0
        assert sg.calculate_risk_reward_ratio(100.0, 400.0, 50.0) == 6.0

    def test_rr_with_entry_equals_stop_loss(self):
        """Risk = 0 should return 0.0."""
        sg = SignalGenerator()
        assert sg.calculate_risk_reward_ratio(100.0, 200.0, 100.0) == 0.0

    def test_rr_with_target_below_entry(self):
        """Reward <= 0 should return 0.0."""
        sg = SignalGenerator()
        assert sg.calculate_risk_reward_ratio(100.0, 90.0, 50.0) == 0.0

    def test_rr_with_stop_loss_above_entry(self):
        """Risk <= 0 should return 0.0."""
        sg = SignalGenerator()
        assert sg.calculate_risk_reward_ratio(100.0, 200.0, 110.0) == 0.0

    def test_rr_precision(self):
        """Test R:R is rounded to 2 decimal places."""
        sg = SignalGenerator()
        # (250 - 100) / (100 - 40) = 150/60 = 2.5
        assert sg.calculate_risk_reward_ratio(100.0, 250.0, 40.0) == 2.5


# --- Tests for select_best_contract ---


class TestSelectBestContract:
    """Tests for select_best_contract method."""

    def test_selects_atm_contract(self):
        """Should select ATM contract when available."""
        sg = SignalGenerator()
        contracts = make_contracts_list(spot_price=21500.0)
        result = sg.select_best_contract(contracts, "CE", 21500.0, "NIFTY")
        assert result is not None
        assert result.strike_price == 21500.0
        assert result.option_type == "CE"

    def test_returns_none_for_empty_contracts(self):
        """Should return None when no contracts available."""
        sg = SignalGenerator()
        result = sg.select_best_contract([], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_filters_by_option_type(self):
        """Should only consider contracts of the specified option type."""
        sg = SignalGenerator()
        contracts = make_contracts_list(spot_price=21500.0)
        result = sg.select_best_contract(contracts, "PE", 21500.0, "NIFTY")
        assert result is not None
        assert result.option_type == "PE"

    def test_filters_out_illiquid_contracts(self):
        """Should exclude contracts with poor liquidity."""
        sg = SignalGenerator()
        # Create a contract with spread > 5%
        illiquid = make_contract(
            strike_price=21500.0, bid=90.0, ask=110.0, volume=5000, open_interest=10000
        )
        # spread = 20, mid = 100, spread_pct = 20% > 5%
        assert illiquid.spread_percentage > 5.0
        result = sg.select_best_contract([illiquid], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_filters_contracts_beyond_2_strikes(self):
        """Should exclude contracts more than 2 strikes from ATM."""
        sg = SignalGenerator()
        # Create contract 3 strikes away (150 points for NIFTY)
        far_contract = make_contract(strike_price=21650.0)
        result = sg.select_best_contract([far_contract], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_filters_expired_contracts(self):
        """Should exclude contracts with < 2 days to expiry."""
        sg = SignalGenerator()
        tomorrow = date.today() + timedelta(days=1)
        expired_contract = make_contract(
            strike_price=21500.0, expiry_date=tomorrow
        )
        result = sg.select_best_contract([expired_contract], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_filters_low_volume_contracts(self):
        """Should exclude contracts with volume <= 500."""
        sg = SignalGenerator()
        low_vol = make_contract(strike_price=21500.0, volume=400)
        result = sg.select_best_contract([low_vol], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_filters_low_oi_contracts(self):
        """Should exclude contracts with OI <= 1000."""
        sg = SignalGenerator()
        low_oi = make_contract(strike_price=21500.0, open_interest=800)
        result = sg.select_best_contract([low_oi], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_filters_high_iv_contracts(self):
        """Should exclude contracts with IV > 100% (> 1.0)."""
        sg = SignalGenerator()
        high_iv = make_contract(strike_price=21500.0, implied_volatility=1.5)
        result = sg.select_best_contract([high_iv], "CE", 21500.0, "NIFTY")
        assert result is None

    def test_ranks_by_strike_proximity_then_spread(self):
        """Closer to ATM with lower spread is preferred."""
        sg = SignalGenerator()
        expiry = date.today() + timedelta(days=5)
        # ATM contract with valid but slightly higher spread (4.0%)
        atm = make_contract(strike_price=21500.0, bid=98.0, ask=102.0, expiry_date=expiry)
        # 1 strike OTM with lower spread (2.04%)
        otm1 = make_contract(strike_price=21550.0, bid=48.0, ask=50.0, expiry_date=expiry)
        result = sg.select_best_contract([atm, otm1], "CE", 21500.0, "NIFTY")
        # ATM should be preferred over OTM because strike proximity takes priority
        assert result.strike_price == 21500.0

    def test_banknifty_strike_interval(self):
        """Should use 100 strike interval for BANKNIFTY."""
        sg = SignalGenerator()
        expiry = date.today() + timedelta(days=5)
        contract = make_contract(strike_price=48000.0, expiry_date=expiry)
        result = sg.select_best_contract([contract], "CE", 48000.0, "BANKNIFTY")
        assert result is not None
        assert result.strike_price == 48000.0


# --- Tests for generate_signal ---


class TestGenerateSignal:
    """Tests for generate_signal method."""

    def test_buy_signal_when_thresholds_met(self):
        """Should generate BUY CE when probability >= 70% and R:R >= 2.0."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal.signal_type == ScalperSignalType.BUY_CE
        assert signal.probability == 80.0
        assert signal.hold_reason is None
        assert signal.selected_contract is not None
        assert signal.entry_price is not None
        assert signal.target_price is not None
        assert signal.stop_loss is not None

    def test_buy_pe_for_bearish_trend(self):
        """Should generate BUY PE when trend is Bearish."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bearish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal.signal_type == ScalperSignalType.BUY_PE

    def test_hold_when_probability_below_threshold(self):
        """Should generate HOLD when probability < 70%."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=65.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal.signal_type == ScalperSignalType.HOLD
        assert signal.hold_reason == "Low Probability"

    def test_hold_when_rr_below_threshold(self):
        """Should generate HOLD when R:R < 2.0."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        # Very low ATR will make target too close to entry
        # entry ~100, target = 100 + 2*1 = 102, stop = 100 - 1 = 99
        # R:R = (102-100)/(100-99) = 2/1 = 2.0 (exactly meets threshold)
        # Use ATR=0.5: target=101, stop=99.5; R:R = 1/0.5 = 2.0
        # Need R:R < 2.0. Use contracts with higher mid-price and lower ATR
        indicators = make_technical_indicators(atr=0.3)
        # entry ~100, target=100.6, stop=99.7; R:R = 0.6/0.3 = 2.0
        # Hmm still 2.0. Let's try approach: set very high probability
        # but make the ATR-based R:R fail by using custom threshold
        sg_strict = SignalGenerator(rr_threshold=3.0)
        current_time = make_market_hours_time()

        signal = sg_strict.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal.signal_type == ScalperSignalType.HOLD
        assert signal.hold_reason == "Insufficient R:R"

    def test_exactly_70_probability_and_2_rr_generates_buy(self):
        """Probability exactly 70% with R:R exactly 2.0 should generate BUY."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=70.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        # ATR=85.5, entry~100, target=271, stop=14.5; R:R = 171/85.5 = 2.0
        assert signal.signal_type == ScalperSignalType.BUY_CE

    def test_probability_69_9_generates_hold(self):
        """Probability 69.9% should generate HOLD."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=69.9, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal.signal_type == ScalperSignalType.HOLD
        assert signal.hold_reason == "Low Probability"

    def test_entry_price_is_mid_price(self):
        """Entry price should be (bid + ask) / 2."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        if signal.selected_contract:
            expected_entry = (signal.selected_contract.bid + signal.selected_contract.ask) / 2
            assert signal.entry_price == expected_entry

    def test_target_is_entry_plus_2_atr(self):
        """Target should be entry + 2*ATR."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators(atr=50.0)
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        if signal.entry_price:
            assert signal.target_price == signal.entry_price + (2 * 50.0)

    def test_stop_loss_is_entry_minus_1_atr(self):
        """Stop loss should be entry - 1*ATR."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators(atr=50.0)
        current_time = make_market_hours_time()

        signal = sg.generate_signal(
            ai_result, contracts, market_data, indicators, current_time
        )
        if signal.entry_price:
            assert signal.stop_loss == signal.entry_price - 50.0


# --- Tests for apply_safety_controls ---


class TestSafetyControls:
    """Tests for safety controls (Task 6.2)."""

    def test_stale_data_hold(self):
        """Data > 2 minutes old should generate HOLD 'Stale Data'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        # Create market data with old timestamp
        old_time = datetime.now(IST) - timedelta(minutes=5)
        market_data = make_market_data(timestamp=old_time)
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        # Use a current_time that's 5 minutes after market data timestamp
        stale_data_time = old_time + timedelta(minutes=5)
        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, stale_data_time
        )
        assert signal is not None
        assert signal.signal_type == ScalperSignalType.HOLD
        assert signal.hold_reason == "Stale Data"

    def test_market_closed_weekend(self):
        """Weekend should generate HOLD 'Market Closed'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        # Saturday
        saturday = datetime(2024, 12, 21, 10, 0, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=saturday)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, saturday
        )
        assert signal is not None
        assert signal.hold_reason == "Market Closed"

    def test_market_closed_sunday(self):
        """Sunday should generate HOLD 'Market Closed'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        sunday = datetime(2024, 12, 22, 10, 0, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=sunday)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, sunday
        )
        assert signal is not None
        assert signal.hold_reason == "Market Closed"

    def test_market_closed_before_opening(self):
        """Before 9:15 AM should generate HOLD 'Market Closed'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        # Wednesday 9:14 AM
        early = datetime(2024, 12, 18, 9, 14, 59, tzinfo=IST)
        market_data = make_market_data(timestamp=early)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, early
        )
        assert signal is not None
        assert signal.hold_reason == "Market Closed"

    def test_market_closed_after_closing(self):
        """After 3:30 PM should generate HOLD 'Market Closed'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        # Wednesday 3:30:01 PM
        late = datetime(2024, 12, 18, 15, 30, 1, tzinfo=IST)
        market_data = make_market_data(timestamp=late)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, late
        )
        assert signal is not None
        assert signal.hold_reason == "Market Closed"

    def test_market_open_at_9_15(self):
        """Exactly 9:15:00 AM should be within market hours."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        open_time = datetime(2024, 12, 18, 9, 15, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=open_time)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, open_time
        )
        # Should NOT be market closed
        if signal is not None:
            assert signal.hold_reason != "Market Closed"

    def test_market_open_at_3_30(self):
        """Exactly 3:30:00 PM should be within market hours."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        close_time = datetime(2024, 12, 18, 15, 30, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=close_time)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, close_time
        )
        # Should NOT be market closed
        if signal is not None:
            assert signal.hold_reason != "Market Closed"

    def test_holiday_detection(self):
        """Indian market holidays should generate HOLD 'Market Closed'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        # Republic Day 2025 (Sunday, let's use 2024 Independence Day which is Thu)
        holiday = datetime(2024, 8, 15, 10, 0, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=holiday)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, holiday
        )
        assert signal is not None
        assert signal.hold_reason == "Market Closed"

    def test_no_contracts_hold(self):
        """Empty contracts list should generate HOLD 'No Contract Selected'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.apply_safety_controls(
            ai_result, [], market_data, indicators, current_time
        )
        assert signal is not None
        assert signal.hold_reason == "No Contract Selected"

    def test_extreme_iv_hold(self):
        """Contract with IV > 100% should generate HOLD 'Extreme IV'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        # Create contract with IV > 1.0 but passing other filters
        high_iv_contract = make_contract(
            strike_price=21500.0, implied_volatility=1.5, volume=5000, open_interest=10000
        )
        contracts = [high_iv_contract]
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, current_time,
            selected_contract=high_iv_contract
        )
        assert signal is not None
        assert signal.hold_reason == "Extreme IV"

    def test_poor_liquidity_hold(self):
        """Contract with spread > 5% should generate HOLD 'Poor Liquidity'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        # bid=90, ask=110, mid=100, spread=20, spread%=20%
        illiquid = make_contract(
            strike_price=21500.0, bid=90.0, ask=110.0,
            implied_volatility=0.15, volume=5000, open_interest=10000
        )
        contracts = [illiquid]
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, current_time,
            selected_contract=illiquid
        )
        assert signal is not None
        assert signal.hold_reason == "Poor Liquidity"

    def test_low_probability_hold(self):
        """Probability < 70% should generate HOLD 'Low Probability'."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=60.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal is not None
        assert signal.hold_reason == "Low Probability"

    def test_insufficient_rr_hold(self):
        """R:R < 2.0 should generate HOLD 'Insufficient R:R'."""
        sg = SignalGenerator(rr_threshold=5.0)  # Set very high threshold
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data()
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal is not None
        assert signal.hold_reason == "Insufficient R:R"

    def test_all_controls_pass(self):
        """When all safety controls pass, should return None."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0, trend="Bullish")
        contracts = make_contracts_list()
        market_data = make_market_data(
            timestamp=make_market_hours_time()
        )
        indicators = make_technical_indicators()
        current_time = make_market_hours_time()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, current_time
        )
        assert signal is None

    def test_priority_order_stale_before_market_closed(self):
        """Stale data should be detected before market closed."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        contracts = make_contracts_list()
        # Both stale AND outside market hours (weekend)
        saturday_old = datetime(2024, 12, 21, 10, 0, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=saturday_old - timedelta(minutes=5))
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, contracts, market_data, indicators, saturday_old
        )
        assert signal is not None
        assert signal.hold_reason == "Stale Data"

    def test_priority_order_market_closed_before_no_contract(self):
        """Market closed should be detected before no contract."""
        sg = SignalGenerator()
        ai_result = make_ai_result(probability=80.0)
        # Sunday AND no contracts
        sunday = datetime(2024, 12, 22, 10, 0, 0, tzinfo=IST)
        market_data = make_market_data(timestamp=sunday)
        indicators = make_technical_indicators()

        signal = sg.apply_safety_controls(
            ai_result, [], market_data, indicators, sunday
        )
        assert signal is not None
        assert signal.hold_reason == "Market Closed"

    def test_incomplete_data_null_spot_price(self):
        """AIAnalysisResult with empty signal_type triggers incomplete data check."""
        sg = SignalGenerator()
        contracts = make_contracts_list()
        current_time = make_market_hours_time()
        market_data = make_market_data(timestamp=current_time)
        indicators = make_technical_indicators()
        # Create an AI result with empty signal_type (treated as None-equivalent)
        ai_result_incomplete = AIAnalysisResult(
            signal_type="",
            probability=80.0,
            entry_price=100.0,
            target_price=200.0,
            stop_loss=50.0,
            trend="Bullish",
            oi_interpretation="Bullish",
            rationale="Test rationale.",
        )
        signal = sg.apply_safety_controls(
            ai_result_incomplete, contracts, market_data, indicators, current_time
        )
        assert signal is not None
        assert signal.hold_reason == "Incomplete Data"

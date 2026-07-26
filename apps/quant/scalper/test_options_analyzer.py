"""
Unit tests for OptionsAnalyzer class.

Tests OI metrics calculation, PCR, ATM IV extraction,
OI buildup detection, and liquidity validation.

Requirements: 7.1, 7.2, 7.4, 7.5, 7.9, 7.11, 7.12, 7.15, 7.16,
              8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
"""

import pytest
from datetime import date, timedelta

from scalper.options_analyzer import OptionsAnalyzer, OptionsAnalyzerError
from scalper.models import OptionsContract, OIBuildup


@pytest.fixture
def analyzer():
    """Create an OptionsAnalyzer instance."""
    return OptionsAnalyzer()


@pytest.fixture
def today():
    """Return today's date."""
    return date.today()


@pytest.fixture
def nearest_expiry(today):
    """Return a near expiry (3 days from today)."""
    return today + timedelta(days=3)


def make_contract(
    strike_price: float = 21500.0,
    option_type: str = "CE",
    expiry_date: date = None,
    bid: float = 98.0,
    ask: float = 102.0,
    ltp: float = 100.0,
    volume: int = 5000,
    open_interest: int = 10000,
    implied_volatility: float = 0.15,
    delta: float = 0.52,
    gamma: float = 0.003,
    theta: float = -12.5,
    vega: float = 45.2,
) -> OptionsContract:
    """Helper to create an OptionsContract for testing."""
    if expiry_date is None:
        expiry_date = date.today() + timedelta(days=3)

    mid_price = (bid + ask) / 2 if (bid + ask) > 0 else 0.0
    spread = max(ask - bid, 0.0)
    spread_pct = (spread / mid_price * 100) if mid_price > 0 else 0.0
    is_liquid = spread_pct <= 5.0 and volume > 0 and open_interest > 100 and bid > 0 and ask > 0 and bid < ask

    return OptionsContract(
        strike_price=strike_price,
        option_type=option_type,
        expiry_date=expiry_date,
        bid=bid,
        ask=ask,
        ltp=ltp,
        volume=volume,
        open_interest=open_interest,
        implied_volatility=implied_volatility,
        mid_price=mid_price,
        spread=spread,
        spread_percentage=round(spread_pct, 2),
        is_liquid=is_liquid,
        delta=delta,
        gamma=gamma,
        theta=theta,
        vega=vega,
    )


@pytest.fixture
def sample_chain(nearest_expiry):
    """Create a sample options chain with multiple contracts."""
    return [
        make_contract(strike_price=21400.0, option_type="CE", expiry_date=nearest_expiry, open_interest=5000),
        make_contract(strike_price=21400.0, option_type="PE", expiry_date=nearest_expiry, open_interest=6000),
        make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, open_interest=8000),
        make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, open_interest=9000),
        make_contract(strike_price=21600.0, option_type="CE", expiry_date=nearest_expiry, open_interest=4000),
        make_contract(strike_price=21600.0, option_type="PE", expiry_date=nearest_expiry, open_interest=7000),
    ]


# --- analyze_options_chain tests ---


class TestAnalyzeOptionsChain:
    """Tests for analyze_options_chain method."""

    def test_analyze_returns_options_analysis(self, analyzer, sample_chain):
        """analyze_options_chain returns a complete OptionsAnalysis."""
        result = analyzer.analyze_options_chain(
            chain_data=sample_chain,
            spot_price=21500.0,
        )
        assert result.call_oi == 5000 + 8000 + 4000  # 17000
        assert result.put_oi == 6000 + 9000 + 7000  # 22000
        assert result.call_oi_change == 0  # first refresh
        assert result.put_oi_change == 0  # first refresh

    def test_analyze_empty_chain_raises_error(self, analyzer):
        """analyze_options_chain raises error for empty chain."""
        with pytest.raises(OptionsAnalyzerError, match="No options chain data"):
            analyzer.analyze_options_chain(chain_data=[], spot_price=21500.0)

    def test_analyze_invalid_spot_raises_error(self, analyzer, sample_chain):
        """analyze_options_chain raises error for invalid spot price."""
        with pytest.raises(OptionsAnalyzerError, match="Invalid spot price"):
            analyzer.analyze_options_chain(chain_data=sample_chain, spot_price=0)

    def test_analyze_with_previous_data(self, analyzer, nearest_expiry):
        """analyze_options_chain calculates OI changes correctly."""
        previous = [
            make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, open_interest=7000),
            make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, open_interest=8000),
        ]
        current = [
            make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, open_interest=9000),
            make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, open_interest=10000),
        ]
        result = analyzer.analyze_options_chain(
            chain_data=current,
            spot_price=21500.0,
            previous_chain_data=previous,
        )
        assert result.call_oi_change == 2000
        assert result.put_oi_change == 2000


# --- calculate_oi_metrics tests ---


class TestCalculateOIMetrics:
    """Tests for calculate_oi_metrics method."""

    def test_total_oi_calculation(self, analyzer, sample_chain):
        """Total Call/Put OI is summed correctly."""
        call_oi, put_oi, _, _, _, _ = analyzer.calculate_oi_metrics(sample_chain)
        assert call_oi == 17000
        assert put_oi == 22000

    def test_oi_change_first_refresh(self, analyzer, sample_chain):
        """First refresh (no previous data) returns zero changes."""
        _, _, call_change, put_change, call_pct, put_pct = analyzer.calculate_oi_metrics(
            sample_chain, previous_data=None
        )
        assert call_change == 0
        assert put_change == 0
        assert call_pct == 0.0
        assert put_pct == 0.0

    def test_oi_change_with_previous(self, analyzer, nearest_expiry):
        """OI changes are calculated correctly from previous refresh."""
        previous = [
            make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, open_interest=5000),
            make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, open_interest=4000),
        ]
        current = [
            make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, open_interest=6000),
            make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, open_interest=5000),
        ]
        call_oi, put_oi, call_change, put_change, call_pct, put_pct = analyzer.calculate_oi_metrics(
            current, previous
        )
        assert call_oi == 6000
        assert put_oi == 5000
        assert call_change == 1000
        assert put_change == 1000
        assert call_pct == 20.0  # (1000/5000)*100
        assert put_pct == 25.0  # (1000/4000)*100


# --- calculate_pcr tests ---


class TestCalculatePCR:
    """Tests for calculate_pcr method."""

    def test_normal_pcr(self, analyzer):
        """PCR is calculated correctly."""
        pcr = analyzer.calculate_pcr(call_oi=10000, put_oi=12000)
        assert pcr == 1.2

    def test_pcr_zero_call_oi(self, analyzer):
        """PCR returns None when Call OI is 0."""
        pcr = analyzer.calculate_pcr(call_oi=0, put_oi=5000)
        assert pcr is None

    def test_pcr_zero_put_oi(self, analyzer):
        """PCR is 0 when Put OI is 0."""
        pcr = analyzer.calculate_pcr(call_oi=10000, put_oi=0)
        assert pcr == 0.0

    def test_pcr_equal_oi(self, analyzer):
        """PCR is 1.0 when Call and Put OI are equal."""
        pcr = analyzer.calculate_pcr(call_oi=5000, put_oi=5000)
        assert pcr == 1.0


# --- identify_oi_buildup tests ---


class TestIdentifyOIBuildup:
    """Tests for identify_oi_buildup method."""

    def test_top_5_buildup(self, analyzer):
        """Returns top 5 contracts with highest OI increase."""
        oi_changes = [
            {"strike_price": 21000.0, "option_type": "CE", "oi_change": 500, "oi_change_pct": 10.0},
            {"strike_price": 21100.0, "option_type": "CE", "oi_change": 400, "oi_change_pct": 8.0},
            {"strike_price": 21200.0, "option_type": "CE", "oi_change": 300, "oi_change_pct": 6.0},
            {"strike_price": 21300.0, "option_type": "CE", "oi_change": 200, "oi_change_pct": 4.0},
            {"strike_price": 21400.0, "option_type": "CE", "oi_change": 150, "oi_change_pct": 3.0},
            {"strike_price": 21500.0, "option_type": "CE", "oi_change": 120, "oi_change_pct": 2.4},
            {"strike_price": 21600.0, "option_type": "CE", "oi_change": 50, "oi_change_pct": 1.0},  # Below threshold
        ]
        call_buildup, put_buildup = analyzer.identify_oi_buildup(oi_changes)
        assert len(call_buildup) == 5
        assert call_buildup[0].oi_change == 500
        assert call_buildup[4].oi_change == 150
        assert len(put_buildup) == 0

    def test_buildup_threshold_100(self, analyzer):
        """Contracts with OI change < 100 are excluded."""
        oi_changes = [
            {"strike_price": 21500.0, "option_type": "CE", "oi_change": 99, "oi_change_pct": 5.0},
            {"strike_price": 21500.0, "option_type": "PE", "oi_change": 100, "oi_change_pct": 5.0},
        ]
        call_buildup, put_buildup = analyzer.identify_oi_buildup(oi_changes)
        assert len(call_buildup) == 0  # 99 < 100 threshold
        assert len(put_buildup) == 1  # 100 >= 100 threshold

    def test_empty_oi_changes(self, analyzer):
        """Empty oi_changes returns empty lists."""
        call_buildup, put_buildup = analyzer.identify_oi_buildup([])
        assert call_buildup == []
        assert put_buildup == []

    def test_separate_call_and_put_buildup(self, analyzer):
        """Calls and Puts are tracked separately."""
        oi_changes = [
            {"strike_price": 21500.0, "option_type": "CE", "oi_change": 200, "oi_change_pct": 5.0},
            {"strike_price": 21500.0, "option_type": "PE", "oi_change": 300, "oi_change_pct": 7.0},
        ]
        call_buildup, put_buildup = analyzer.identify_oi_buildup(oi_changes)
        assert len(call_buildup) == 1
        assert call_buildup[0].option_type == "CE"
        assert len(put_buildup) == 1
        assert put_buildup[0].option_type == "PE"


# --- ATM IV tests ---


class TestATMIV:
    """Tests for ATM IV extraction."""

    def test_atm_iv_extraction(self, analyzer, nearest_expiry):
        """ATM IV is correctly extracted for nearest expiry."""
        chain = [
            make_contract(strike_price=21400.0, option_type="CE", expiry_date=nearest_expiry, implied_volatility=0.18),
            make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, implied_volatility=0.15),
            make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, implied_volatility=0.17),
            make_contract(strike_price=21600.0, option_type="CE", expiry_date=nearest_expiry, implied_volatility=0.12),
        ]
        result = analyzer.analyze_options_chain(
            chain_data=chain,
            spot_price=21500.0,
        )
        # ATM strike is 21500, nearest expiry
        assert result.atm_call_iv == 0.15
        assert result.atm_put_iv == 0.17

    def test_atm_iv_no_iv_available(self, analyzer, nearest_expiry):
        """Returns None when IV is not available for ATM contracts."""
        chain = [
            make_contract(strike_price=21500.0, option_type="CE", expiry_date=nearest_expiry, implied_volatility=None),
            make_contract(strike_price=21500.0, option_type="PE", expiry_date=nearest_expiry, implied_volatility=None),
        ]
        # Need to set implied_volatility to None - use a workaround
        for c in chain:
            object.__setattr__(c, 'implied_volatility', None)

        result = analyzer.analyze_options_chain(
            chain_data=chain,
            spot_price=21500.0,
        )
        assert result.atm_call_iv is None
        assert result.atm_put_iv is None


# --- validate_contract_liquidity tests ---


class TestValidateContractLiquidity:
    """Tests for validate_contract_liquidity method."""

    def test_valid_liquid_contract(self, analyzer):
        """Contract with good liquidity metrics passes validation."""
        is_valid, spread, mid_price, spread_pct = analyzer.validate_contract_liquidity(
            bid=98.0, ask=102.0, volume=5000, open_interest=10000
        )
        assert is_valid is True
        assert spread == 4.0
        assert mid_price == 100.0
        assert spread_pct == pytest.approx(4.0)

    def test_spread_calculation(self, analyzer):
        """Spread is calculated as ask - bid."""
        _, spread, _, _ = analyzer.validate_contract_liquidity(
            bid=50.0, ask=55.0, volume=1000, open_interest=500
        )
        assert spread == 5.0

    def test_mid_price_calculation(self, analyzer):
        """Mid-price is calculated as (bid + ask) / 2."""
        _, _, mid_price, _ = analyzer.validate_contract_liquidity(
            bid=50.0, ask=60.0, volume=1000, open_interest=500
        )
        assert mid_price == 55.0

    def test_spread_percentage_calculation(self, analyzer):
        """Spread percentage is (spread / mid_price) × 100."""
        _, _, _, spread_pct = analyzer.validate_contract_liquidity(
            bid=50.0, ask=60.0, volume=1000, open_interest=500
        )
        # spread=10, mid_price=55, pct = 10/55*100 = 18.18..
        assert spread_pct == pytest.approx(18.1818, rel=1e-3)

    def test_spread_exceeds_5_percent(self, analyzer):
        """Spread > 5% marks contract as illiquid."""
        is_valid, _, _, spread_pct = analyzer.validate_contract_liquidity(
            bid=90.0, ask=100.0, volume=5000, open_interest=10000
        )
        # spread=10, mid=95, pct=10.526% > 5%
        assert is_valid is False
        assert spread_pct > 5.0

    def test_zero_volume(self, analyzer):
        """Volume = 0 marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=102.0, volume=0, open_interest=10000
        )
        assert is_valid is False

    def test_oi_at_threshold(self, analyzer):
        """OI = 100 (at threshold, ≤ 100) marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=102.0, volume=5000, open_interest=100
        )
        assert is_valid is False

    def test_oi_above_threshold(self, analyzer):
        """OI = 101 (above threshold) allows contract to be liquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=102.0, volume=5000, open_interest=101
        )
        assert is_valid is True

    def test_bid_zero(self, analyzer):
        """Bid = 0 marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=0.0, ask=102.0, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_bid_negative(self, analyzer):
        """Bid < 0 marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=-1.0, ask=102.0, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_ask_zero(self, analyzer):
        """Ask = 0 marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=0.0, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_ask_negative(self, analyzer):
        """Ask < 0 marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=-1.0, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_bid_greater_than_ask(self, analyzer):
        """Bid > Ask (crossed market) marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=105.0, ask=100.0, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_null_bid(self, analyzer):
        """Null bid marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=None, ask=102.0, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_null_ask(self, analyzer):
        """Null ask marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=None, volume=5000, open_interest=10000
        )
        assert is_valid is False

    def test_null_volume(self, analyzer):
        """Null volume marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=102.0, volume=None, open_interest=10000
        )
        assert is_valid is False

    def test_null_oi(self, analyzer):
        """Null open_interest marks contract as illiquid."""
        is_valid, _, _, _ = analyzer.validate_contract_liquidity(
            bid=98.0, ask=102.0, volume=5000, open_interest=None
        )
        assert is_valid is False

    def test_with_contract_object(self, analyzer):
        """validate_contract_liquidity works with an OptionsContract object."""
        contract = make_contract(
            bid=98.0, ask=102.0, volume=5000, open_interest=10000
        )
        is_valid, spread, mid_price, spread_pct = analyzer.validate_contract_liquidity(
            contract=contract
        )
        assert is_valid is True
        assert spread == 4.0
        assert mid_price == 100.0
        assert spread_pct == pytest.approx(4.0)

    def test_exactly_5_percent_spread_is_valid(self, analyzer):
        """Spread exactly at 5% is valid (not > 5%)."""
        # We need bid and ask such that spread/mid * 100 = exactly 5%
        # spread/mid = 0.05 => (ask-bid)/((bid+ask)/2) = 0.05
        # 2*(ask-bid)/(bid+ask) = 0.05
        # Let bid=100, then 2*(ask-100)/(100+ask) = 0.05
        # 2*ask - 200 = 0.05*(100+ask) = 5 + 0.05*ask
        # 1.95*ask = 205
        # ask = 205/1.95 ≈ 105.128
        bid = 100.0
        ask = 205.0 / 1.95  # ≈ 105.128
        is_valid, _, _, spread_pct = analyzer.validate_contract_liquidity(
            bid=bid, ask=ask, volume=5000, open_interest=10000
        )
        assert spread_pct == pytest.approx(5.0, rel=1e-6)
        assert is_valid is True  # exactly 5% is NOT > 5%, so valid

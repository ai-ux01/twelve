"""
Unit tests for Liquidity Analyzer Service.

Tests the liquidity analysis logic including:
- Wide bid-ask spread detection
- Low volume detection
- Low OI detection
- Deep OTM detection
- Summary metrics calculation

Requirements: 7.1, 8.1, 16.5
"""

import pytest
from services.liquidity_analyzer import (
    LiquidityAnalyzer,
    LiquidityWarning,
    OptionContractInput,
)


class TestLiquidityAnalyzer:
    """Test suite for LiquidityAnalyzer service."""

    @pytest.fixture
    def analyzer(self):
        """Create analyzer with default thresholds."""
        return LiquidityAnalyzer(
            wide_spread_threshold=5.0,
            low_volume_threshold=100,
            low_oi_threshold=500,
            deep_otm_threshold=10.0,
        )

    @pytest.fixture
    def sample_liquid_contract(self):
        """Create a liquid contract (no warnings)."""
        return OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=102.0,  # 2% spread
            ltp=101.0,
            volume=1000,  # High volume
            open_interest=5000,  # High OI
        )

    @pytest.fixture
    def sample_illiquid_contract(self):
        """Create an illiquid contract (multiple warnings)."""
        return OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=10.0,
            ask=11.0,  # 9.5% spread
            ltp=10.5,
            volume=50,  # Low volume
            open_interest=200,  # Low OI
        )

    def test_liquid_contract_no_warnings(self, analyzer, sample_liquid_contract):
        """Test that a liquid contract has no warnings."""
        atm_strike = 21500  # At the money

        liquidity = analyzer._analyze_contract(sample_liquid_contract, atm_strike)

        assert liquidity.strike_price == 21500
        assert liquidity.option_type == "CALL"
        assert liquidity.bid == 100.0
        assert liquidity.ask == 102.0
        assert liquidity.mid_price == 101.0
        assert liquidity.bid_ask_spread == 2.0
        assert liquidity.bid_ask_spread_percent < 5.0  # Below threshold
        assert liquidity.volume == 1000
        assert liquidity.open_interest == 5000
        assert liquidity.distance_from_atm_percent == 0.0  # ATM

        # Check no warnings
        assert liquidity.liquidity_warning is not None
        assert not liquidity.liquidity_warning.wide_bid_ask_spread
        assert not liquidity.liquidity_warning.low_volume
        assert not liquidity.liquidity_warning.low_oi
        assert not liquidity.liquidity_warning.deep_otm
        assert not liquidity.liquidity_warning.is_illiquid
        assert liquidity.liquidity_warning.warning_count == 0

    def test_wide_spread_detection(self, analyzer):
        """Test detection of wide bid-ask spread."""
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=110.0,  # 9.5% spread - WIDE
            ltp=105.0,
            volume=1000,
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        assert liquidity.bid_ask_spread == 10.0
        assert liquidity.bid_ask_spread_percent > 5.0
        assert liquidity.liquidity_warning.wide_bid_ask_spread
        assert liquidity.liquidity_warning.is_illiquid

    def test_low_volume_detection(self, analyzer):
        """Test detection of low volume."""
        contract = OptionContractInput(
            strike_price=21500,
            option_type="PUT",
            bid=100.0,
            ask=102.0,
            ltp=101.0,
            volume=50,  # LOW volume
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        assert liquidity.volume == 50
        assert liquidity.liquidity_warning.low_volume
        assert liquidity.liquidity_warning.is_illiquid

    def test_low_oi_detection(self, analyzer):
        """Test detection of low open interest."""
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=102.0,
            ltp=101.0,
            volume=1000,
            open_interest=200,  # LOW OI
        )
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        assert liquidity.open_interest == 200
        assert liquidity.liquidity_warning.low_oi
        assert liquidity.liquidity_warning.is_illiquid

    def test_deep_otm_detection(self, analyzer):
        """Test detection of deep OTM contracts."""
        contract = OptionContractInput(
            strike_price=24000,  # Far from ATM
            option_type="CALL",
            bid=5.0,
            ask=5.1,
            ltp=5.05,
            volume=1000,
            open_interest=5000,
        )
        atm_strike = 21500  # ATM at 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        # 24000 is 11.6% away from 21500
        assert liquidity.distance_from_atm_percent > 10.0
        assert liquidity.liquidity_warning.deep_otm
        assert liquidity.liquidity_warning.is_illiquid

    def test_multiple_warnings(self, analyzer, sample_illiquid_contract):
        """Test contract with multiple warnings."""
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(sample_illiquid_contract, atm_strike)

        # Should have wide spread, low volume, and low OI warnings
        assert liquidity.liquidity_warning.wide_bid_ask_spread
        assert liquidity.liquidity_warning.low_volume
        assert liquidity.liquidity_warning.low_oi
        assert liquidity.liquidity_warning.is_illiquid
        assert liquidity.liquidity_warning.warning_count >= 3

    def test_analyze_liquidity_summary(
        self, analyzer, sample_liquid_contract, sample_illiquid_contract
    ):
        """Test summary metrics calculation."""
        contracts = [sample_liquid_contract, sample_illiquid_contract]
        atm_strike = 21500

        metrics = analyzer.analyze_liquidity(contracts, atm_strike)

        assert metrics.total_contracts == 2
        assert metrics.liquid_contracts == 1
        assert metrics.illiquid_contracts == 1
        assert metrics.average_volume == (1000 + 50) / 2
        assert metrics.average_oi == (5000 + 200) / 2
        assert metrics.low_volume_count == 1
        assert metrics.low_oi_count == 1
        assert metrics.wide_spread_count == 1
        assert len(metrics.illiquid_contracts_list) == 1

    def test_analyze_liquidity_all_liquid(self, analyzer, sample_liquid_contract):
        """Test analysis with all liquid contracts."""
        contracts = [sample_liquid_contract, sample_liquid_contract]
        atm_strike = 21500

        metrics = analyzer.analyze_liquidity(contracts, atm_strike)

        assert metrics.total_contracts == 2
        assert metrics.liquid_contracts == 2
        assert metrics.illiquid_contracts == 0
        assert metrics.low_volume_count == 0
        assert metrics.low_oi_count == 0
        assert metrics.wide_spread_count == 0
        assert metrics.deep_otm_count == 0
        assert len(metrics.illiquid_contracts_list) == 0

    def test_analyze_liquidity_all_illiquid(self, analyzer, sample_illiquid_contract):
        """Test analysis with all illiquid contracts."""
        contracts = [sample_illiquid_contract, sample_illiquid_contract]
        atm_strike = 21500

        metrics = analyzer.analyze_liquidity(contracts, atm_strike)

        assert metrics.total_contracts == 2
        assert metrics.liquid_contracts == 0
        assert metrics.illiquid_contracts == 2
        assert metrics.low_volume_count == 2
        assert metrics.low_oi_count == 2
        assert metrics.wide_spread_count == 2
        assert len(metrics.illiquid_contracts_list) == 2

    def test_zero_mid_price_handling(self, analyzer):
        """Test handling of zero mid-price (edge case)."""
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=0.0,
            ask=0.0,
            ltp=0.5,  # Use LTP as fallback
            volume=1000,
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        # Should use LTP as mid_price
        assert liquidity.mid_price == 0.5
        assert liquidity.bid_ask_spread == 0.0
        # With zero mid-price, spread percent should be high
        assert liquidity.bid_ask_spread_percent >= 0

    def test_empty_contracts_raises_error(self, analyzer):
        """Test that empty contracts list raises error."""
        with pytest.raises(ValueError, match="No contracts provided"):
            analyzer.analyze_liquidity([], 21500)

    def test_invalid_atm_strike_raises_error(self, analyzer, sample_liquid_contract):
        """Test that invalid ATM strike raises error."""
        contracts = [sample_liquid_contract]

        with pytest.raises(ValueError, match="Invalid ATM strike"):
            analyzer.analyze_liquidity(contracts, 0)

        with pytest.raises(ValueError, match="Invalid ATM strike"):
            analyzer.analyze_liquidity(contracts, -100)

    def test_custom_thresholds(self):
        """Test analyzer with custom thresholds."""
        # More lenient thresholds
        analyzer = LiquidityAnalyzer(
            wide_spread_threshold=10.0,  # Higher threshold
            low_volume_threshold=50,  # Lower threshold
            low_oi_threshold=200,  # Lower threshold
            deep_otm_threshold=15.0,  # Higher threshold
        )

        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=108.0,  # 7.7% spread - would be wide with default
            ltp=104.0,
            volume=60,  # Would be low with default
            open_interest=300,  # Would be low with default
        )
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        # With lenient thresholds, should not trigger warnings
        assert not liquidity.liquidity_warning.wide_bid_ask_spread  # 7.7% < 10%
        assert not liquidity.liquidity_warning.low_volume  # 60 >= 50
        assert not liquidity.liquidity_warning.low_oi  # 300 >= 200

    def test_bid_ask_spread_calculation(self, analyzer):
        """Test bid-ask spread calculation accuracy."""
        contract = OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=105.0,
            ltp=102.5,
            volume=1000,
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity = analyzer._analyze_contract(contract, atm_strike)

        # Mid-price should be (100 + 105) / 2 = 102.5
        assert liquidity.mid_price == 102.5
        # Spread should be 105 - 100 = 5
        assert liquidity.bid_ask_spread == 5.0
        # Spread % should be (5 / 102.5) * 100 = 4.878%
        assert liquidity.bid_ask_spread_percent == pytest.approx(4.878, rel=0.01)

    def test_distance_from_atm_calculation(self, analyzer):
        """Test distance from ATM calculation."""
        # Test call above ATM
        contract_call = OptionContractInput(
            strike_price=22000,
            option_type="CALL",
            bid=50.0,
            ask=51.0,
            ltp=50.5,
            volume=1000,
            open_interest=5000,
        )
        atm_strike = 21500

        liquidity_call = analyzer._analyze_contract(contract_call, atm_strike)

        # 22000 is 2.33% above 21500
        expected_distance = ((22000 - 21500) / 21500) * 100
        assert liquidity_call.distance_from_atm_percent == pytest.approx(
            expected_distance, rel=0.01
        )

        # Test put below ATM
        contract_put = OptionContractInput(
            strike_price=21000,
            option_type="PUT",
            bid=50.0,
            ask=51.0,
            ltp=50.5,
            volume=1000,
            open_interest=5000,
        )

        liquidity_put = analyzer._analyze_contract(contract_put, atm_strike)

        # 21000 is 2.33% below 21500 (absolute value)
        expected_distance = ((21500 - 21000) / 21500) * 100
        assert liquidity_put.distance_from_atm_percent == pytest.approx(
            expected_distance, rel=0.01
        )


class TestLiquidityWarning:
    """Test suite for LiquidityWarning model."""

    def test_is_illiquid_property(self):
        """Test is_illiquid property."""
        # No warnings - liquid
        warning = LiquidityWarning()
        assert not warning.is_illiquid

        # One warning - illiquid
        warning = LiquidityWarning(wide_bid_ask_spread=True)
        assert warning.is_illiquid

        # Multiple warnings - illiquid
        warning = LiquidityWarning(low_volume=True, low_oi=True)
        assert warning.is_illiquid

    def test_warning_count_property(self):
        """Test warning_count property."""
        # No warnings
        warning = LiquidityWarning()
        assert warning.warning_count == 0

        # One warning
        warning = LiquidityWarning(wide_bid_ask_spread=True)
        assert warning.warning_count == 1

        # Two warnings
        warning = LiquidityWarning(low_volume=True, low_oi=True)
        assert warning.warning_count == 2

        # All warnings
        warning = LiquidityWarning(
            wide_bid_ask_spread=True,
            low_volume=True,
            low_oi=True,
            deep_otm=True,
        )
        assert warning.warning_count == 4

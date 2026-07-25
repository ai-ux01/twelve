"""
Unit tests for Options Infrastructure - Task 66.4

Comprehensive tests for:
- Options chain data parsing and validation
- PCR calculation with various OI scenarios (edge cases)
- ATM strike identification in different market conditions
- OI buildup/unwinding detection logic
- Support/resistance zone identification

Requirements: 7.1, 16.5
"""

import pytest
from datetime import datetime
from services.options_analysis_service import (
    OptionsAnalysisService,
    OptionContractData,
    OptionType,
    BuildupType,
)


class TestOptionsChainDataParsing:
    """Test options chain data parsing and validation."""
    
    def test_valid_contract_data_parsing(self):
        """Test parsing of valid option contract data."""
        contract = OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.CALL,
            ltp=100.0,
            open_interest=10000,
            change_in_oi=500,
            volume=5000,
        )
        
        assert contract.strike_price == 21500.0
        assert contract.option_type == OptionType.CALL
        assert contract.ltp == 100.0
        assert contract.open_interest == 10000
        assert contract.change_in_oi == 500
        assert contract.volume == 5000
    
    def test_invalid_negative_strike_price(self):
        """Test that negative strike price raises validation error."""
        with pytest.raises(Exception):  # Pydantic validation error
            OptionContractData(
                strike_price=-21500.0,  # Invalid: negative
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=500,
                volume=5000,
            )
    
    def test_invalid_negative_ltp(self):
        """Test that negative LTP raises validation error."""
        with pytest.raises(Exception):  # Pydantic validation error
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=-100.0,  # Invalid: negative
                open_interest=10000,
                change_in_oi=500,
                volume=5000,
            )
    
    def test_invalid_negative_oi(self):
        """Test that negative OI raises validation error."""
        with pytest.raises(Exception):  # Pydantic validation error
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=-10000,  # Invalid: negative
                change_in_oi=500,
                volume=5000,
            )
    
    def test_valid_zero_oi(self):
        """Test that zero OI is valid (new contract)."""
        contract = OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.PUT,
            ltp=0.0,  # Valid for far OTM options
            open_interest=0,  # Valid: new contract
            change_in_oi=0,
            volume=0,  # Valid: no trading yet
        )
        
        assert contract.open_interest == 0
        assert contract.volume == 0
    
    def test_negative_oi_change_allowed(self):
        """Test that negative OI change is valid (unwinding)."""
        contract = OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.CALL,
            ltp=100.0,
            open_interest=5000,
            change_in_oi=-2000,  # Valid: unwinding
            volume=3000,
        )
        
        assert contract.change_in_oi == -2000
    
    def test_option_type_enum(self):
        """Test option type enum values."""
        call_contract = OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.CALL,
            ltp=100.0,
            open_interest=10000,
            change_in_oi=0,
            volume=5000,
        )
        
        put_contract = OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.PUT,
            ltp=90.0,
            open_interest=10000,
            change_in_oi=0,
            volume=5000,
        )
        
        assert call_contract.option_type == OptionType.CALL
        assert put_contract.option_type == OptionType.PUT
        assert call_contract.option_type != put_contract.option_type


class TestPCREdgeCases:
    """Test PCR calculation with edge cases and various OI scenarios."""
    
    def test_pcr_extreme_bullish(self):
        """Test PCR with extreme bullish scenario (PCR = 0.3)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=100000,  # Very high call OI
                change_in_oi=5000,
                volume=50000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=30000,  # Low put OI
                change_in_oi=1000,
                volume=15000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR = 30000 / 100000 = 0.3 (extremely bullish)
        assert pcr.pcr_by_oi == 0.3
        assert pcr.sentiment == "BULLISH"
    
    def test_pcr_extreme_bearish(self):
        """Test PCR with extreme bearish scenario (PCR = 3.0)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=20000,  # Low call OI
                change_in_oi=-1000,
                volume=10000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=60000,  # Very high put OI
                change_in_oi=8000,
                volume=30000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR = 60000 / 20000 = 3.0 (extremely bearish)
        assert pcr.pcr_by_oi == 3.0
        assert pcr.sentiment == "BEARISH"
    
    def test_pcr_boundary_bullish_threshold(self):
        """Test PCR at exact bullish threshold (0.8)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=8000,  # PCR = 8000/10000 = 0.8
                change_in_oi=0,
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR = 0.8 is on the threshold, should be neutral
        assert pcr.pcr_by_oi == 0.8
        assert pcr.sentiment == "NEUTRAL"  # At threshold, not below
    
    def test_pcr_boundary_bearish_threshold(self):
        """Test PCR at exact bearish threshold (1.2)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=12000,  # PCR = 12000/10000 = 1.2
                change_in_oi=0,
                volume=6000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR = 1.2 is on the threshold, should be neutral
        assert pcr.pcr_by_oi == 1.2
        assert pcr.sentiment == "NEUTRAL"  # At threshold, not above
    
    def test_pcr_all_calls_no_puts(self):
        """Test PCR when there are only calls (no puts)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=500,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=8000,
                change_in_oi=300,
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21450.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR = 0 / 18000 = 0 (no puts)
        assert pcr.total_put_oi == 0
        assert pcr.pcr_by_oi == 0.0
        assert pcr.sentiment == "BULLISH"  # 0 < 0.8
    
    def test_pcr_mixed_strikes(self):
        """Test PCR calculation with multiple strikes."""
        service = OptionsAnalysisService()
        
        contracts = [
            # Strike 21400
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=120.0,
                open_interest=8000,
                change_in_oi=200,
                volume=3000,
            ),
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.PUT,
                ltp=80.0,
                open_interest=12000,
                change_in_oi=400,
                volume=4000,
            ),
            # Strike 21500
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=300,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=11000,
                change_in_oi=350,
                volume=4500,
            ),
            # Strike 21600
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=7000,
                change_in_oi=100,
                volume=2500,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.PUT,
                ltp=110.0,
                open_interest=9000,
                change_in_oi=250,
                volume=3500,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        pcr = result.pcr_analysis
        
        # Total call OI: 8000 + 10000 + 7000 = 25000
        # Total put OI: 12000 + 11000 + 9000 = 32000
        # PCR = 32000 / 25000 = 1.28
        assert pcr.total_call_oi == 25000
        assert pcr.total_put_oi == 32000
        assert pcr.pcr_by_oi == 1.28
        assert pcr.sentiment == "BEARISH"  # 1.28 > 1.2
        
        # Total call volume: 3000 + 5000 + 2500 = 10500
        # Total put volume: 4000 + 4500 + 3500 = 12000
        # PCR by volume = 12000 / 10500 = 1.143
        assert pcr.total_call_volume == 10500
        assert pcr.total_put_volume == 12000
        assert abs(pcr.pcr_by_volume - 1.143) < 0.01


class TestATMIdentificationEdgeCases:
    """Test ATM strike identification in various market conditions."""
    
    def test_atm_spot_far_from_any_strike(self):
        """Test ATM identification when spot is far from strikes."""
        service = OptionsAnalysisService()
        
        spot_price = 21575.0  # Far from strikes
        contracts = [
            OptionContractData(
                strike_price=21000.0,
                option_type=OptionType.CALL,
                ltp=600.0,
                open_interest=2000,
                change_in_oi=0,
                volume=500,
            ),
            OptionContractData(
                strike_price=22000.0,
                option_type=OptionType.CALL,
                ltp=50.0,
                open_interest=3000,
                change_in_oi=0,
                volume=800,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # Should pick 22000 as closer to 21575
        assert atm.atm_strike == 22000.0
        assert atm.spot_price == spot_price
    
    def test_atm_with_irregular_strike_intervals(self):
        """Test ATM with irregular strike intervals."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        # Irregular intervals: 50, 100, 200
        strikes = [21400.0, 21450.0, 21550.0, 21750.0]
        
        contracts = []
        for strike in strikes:
            contracts.append(
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.CALL,
                    ltp=100.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                )
            )
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # Should pick 21450 or 21550 (closest to 21500)
        assert atm.atm_strike in [21450.0, 21550.0]
        # Strike interval should be calculated from first two strikes
        assert atm.strike_interval == 50.0
    
    def test_atm_with_wide_strike_intervals(self):
        """Test ATM with BANKNIFTY-style wide intervals (100)."""
        service = OptionsAnalysisService()
        
        spot_price = 45050.0  # BANKNIFTY typical price
        strikes = [44800.0, 44900.0, 45000.0, 45100.0, 45200.0]
        
        contracts = []
        for strike in strikes:
            contracts.extend([
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.CALL,
                    ltp=100.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                ),
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.PUT,
                    ltp=90.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                ),
            ])
        
        result = service.analyze("BANKNIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # Should pick 45000 or 45100 (both equidistant from 45050)
        assert atm.atm_strike in [45000.0, 45100.0]
        assert atm.strike_interval == 100.0
        
        # Near ATM should include ±3 strikes (100 interval)
        # That's 44800, 44900, 45000, 45100, 45200 (all 5 strikes)
        assert len(atm.near_atm_strikes) == 5
    
    def test_atm_near_strikes_at_boundaries(self):
        """Test near ATM strikes when ATM is at edge of chain."""
        service = OptionsAnalysisService()
        
        spot_price = 21300.0  # Near bottom of chain
        strikes = [21300.0, 21350.0, 21400.0, 21450.0, 21500.0]
        
        contracts = []
        for strike in strikes:
            contracts.append(
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.CALL,
                    ltp=100.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                )
            )
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # ATM should be 21300
        assert atm.atm_strike == 21300.0
        
        # Near ATM should be limited by available strikes
        # Can't go 3 strikes below (not available), but can go up
        assert len(atm.near_atm_strikes) <= 5
        near_strikes = [s.strike for s in atm.near_atm_strikes]
        assert 21300.0 in near_strikes
    
    def test_atm_near_strikes_distance_calculation(self):
        """Test distance from spot calculation for near ATM strikes."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        strikes = [21400.0, 21500.0, 21600.0]
        
        contracts = []
        for strike in strikes:
            contracts.extend([
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.CALL,
                    ltp=100.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                ),
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.PUT,
                    ltp=90.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                ),
            ])
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # Check distance calculations
        for near_strike in atm.near_atm_strikes:
            expected_distance = ((near_strike.strike - spot_price) / spot_price) * 100
            assert abs(near_strike.distance_from_spot - expected_distance) < 0.01
            
            # 21400: -0.465%, 21500: 0%, 21600: +0.465%
            if near_strike.strike == 21400.0:
                assert near_strike.distance_from_spot < 0
            elif near_strike.strike == 21500.0:
                assert near_strike.distance_from_spot == 0
            elif near_strike.strike == 21600.0:
                assert near_strike.distance_from_spot > 0


class TestOIBuildupDetectionLogic:
    """Test OI buildup/unwinding detection logic in various scenarios."""
    
    def test_strong_long_buildup(self):
        """Test strong long buildup with high call OI increase."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=15000,
                change_in_oi=5000,  # Large increase
                volume=8000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=8000,
                change_in_oi=500,  # Small increase
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.LONG_BUILDUP
        assert "bullish" in oi.explanation.lower()
    
    def test_strong_short_buildup(self):
        """Test strong short buildup with high put OI increase."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=8000,
                change_in_oi=300,  # Small increase
                volume=3000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=15000,
                change_in_oi=6000,  # Large increase
                volume=8000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.SHORT_BUILDUP
        assert "bearish" in oi.explanation.lower()
    
    def test_balanced_oi_increase(self):
        """Test balanced OI increase (both call and put increasing equally)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=12000,
                change_in_oi=3000,  # Equal increase
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=12000,
                change_in_oi=3000,  # Equal increase
                volume=5000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        # When both increase equally, pick based on which is slightly higher
        # In this case they're exactly equal, so implementation choice
        assert oi.buildup_type in [BuildupType.LONG_BUILDUP, BuildupType.SHORT_BUILDUP]
    
    def test_strong_long_unwinding(self):
        """Test strong long unwinding with high put OI decrease."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=-500,  # Small decrease
                volume=4000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=6000,
                change_in_oi=-4000,  # Large decrease
                volume=2000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.LONG_UNWINDING
        assert "bearish" in oi.explanation.lower()
    
    def test_strong_short_unwinding(self):
        """Test strong short unwinding with high call OI decrease."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=6000,
                change_in_oi=-5000,  # Large decrease
                volume=2000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=10000,
                change_in_oi=-800,  # Small decrease
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.SHORT_UNWINDING
        assert "bullish" in oi.explanation.lower()
    
    def test_mixed_oi_changes_neutral(self):
        """Test mixed OI changes (one up, one down) resulting in neutral."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=2000,  # Increasing
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=8000,
                change_in_oi=-1500,  # Decreasing
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        # Mixed changes should result in neutral
        assert oi.buildup_type == BuildupType.NEUTRAL
    
    def test_max_oi_strike_identification(self):
        """Test identification of strikes with maximum OI."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=120.0,
                open_interest=8000,
                change_in_oi=0,
                volume=3000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=15000,  # Max call OI
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=10000,
                change_in_oi=0,
                volume=4000,
            ),
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.PUT,
                ltp=80.0,
                open_interest=18000,  # Max put OI
                change_in_oi=0,
                volume=6000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=12000,
                change_in_oi=0,
                volume=4500,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        oi = result.oi_analysis
        
        assert oi.max_call_oi_strike == 21500.0
        assert oi.max_put_oi_strike == 21400.0


class TestSupportResistanceZones:
    """Test support/resistance zone identification from OI."""
    
    def test_multiple_support_levels(self):
        """Test identification of multiple support levels."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        
        contracts = [
            # Support level 1: 21400 (highest put OI)
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.PUT,
                ltp=100.0,
                open_interest=20000,  # Highest
                change_in_oi=0,
                volume=5000,
            ),
            # Support level 2: 21450 (high put OI)
            OptionContractData(
                strike_price=21450.0,
                option_type=OptionType.PUT,
                ltp=80.0,
                open_interest=15000,  # High
                change_in_oi=0,
                volume=4000,
            ),
            # Support level 3: 21350 (moderate put OI)
            OptionContractData(
                strike_price=21350.0,
                option_type=OptionType.PUT,
                ltp=120.0,
                open_interest=12000,  # Moderate
                change_in_oi=0,
                volume=3000,
            ),
            # Low put OI - should not be support
            OptionContractData(
                strike_price=21300.0,
                option_type=OptionType.PUT,
                ltp=140.0,
                open_interest=5000,  # Low
                change_in_oi=0,
                volume=1000,
            ),
            # Call contracts (for analysis)
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=90.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        oi = result.oi_analysis
        
        # Should identify top 3 support levels
        assert len(oi.support_levels) == 3
        support_strikes = [level.strike for level in oi.support_levels]
        
        # All should be below spot
        for level in oi.support_levels:
            assert level.strike < spot_price
        
        # Should be sorted by strength (OI)
        assert oi.support_levels[0].strike == 21400.0  # Highest OI
        assert oi.support_levels[1].strike == 21450.0  # Second highest
        assert oi.support_levels[2].strike == 21350.0  # Third highest
        
        # Should not include 21300 (too low OI)
        assert 21300.0 not in support_strikes
    
    def test_multiple_resistance_levels(self):
        """Test identification of multiple resistance levels."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        
        contracts = [
            # Resistance level 1: 21600 (highest call OI)
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=18000,  # Highest
                change_in_oi=0,
                volume=6000,
            ),
            # Resistance level 2: 21650 (high call OI)
            OptionContractData(
                strike_price=21650.0,
                option_type=OptionType.CALL,
                ltp=60.0,
                open_interest=14000,  # High
                change_in_oi=0,
                volume=5000,
            ),
            # Resistance level 3: 21550 (moderate call OI)
            OptionContractData(
                strike_price=21550.0,
                option_type=OptionType.CALL,
                ltp=90.0,
                open_interest=11000,  # Moderate
                change_in_oi=0,
                volume=4000,
            ),
            # Low call OI - should not be resistance
            OptionContractData(
                strike_price=21700.0,
                option_type=OptionType.CALL,
                ltp=50.0,
                open_interest=4000,  # Low
                change_in_oi=0,
                volume=1000,
            ),
            # Put contracts (for analysis)
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        oi = result.oi_analysis
        
        # Should identify top 3 resistance levels
        assert len(oi.resistance_levels) == 3
        resistance_strikes = [level.strike for level in oi.resistance_levels]
        
        # All should be above spot
        for level in oi.resistance_levels:
            assert level.strike > spot_price
        
        # Should be sorted by strength (OI)
        assert oi.resistance_levels[0].strike == 21600.0  # Highest OI
        assert oi.resistance_levels[1].strike == 21650.0  # Second highest
        assert oi.resistance_levels[2].strike == 21550.0  # Third highest
        
        # Should not include 21700 (too low OI)
        assert 21700.0 not in resistance_strikes
    
    def test_support_resistance_strength_calculation(self):
        """Test strength calculation for support/resistance levels."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        max_put_oi = 20000
        
        contracts = [
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.PUT,
                ltp=100.0,
                open_interest=max_put_oi,  # 100% strength
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21450.0,
                option_type=OptionType.PUT,
                ltp=80.0,
                open_interest=10000,  # 50% strength
                change_in_oi=0,
                volume=3000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=90.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        oi = result.oi_analysis
        
        # Check strength calculations
        for level in oi.support_levels:
            if level.strike == 21400.0:
                assert level.strength == 1.0  # max_put_oi / max_put_oi
            elif level.strike == 21450.0:
                assert level.strength == 0.5  # 10000 / 20000
    
    def test_no_support_when_all_puts_above_spot(self):
        """Test no support levels when all put OI is above spot."""
        service = OptionsAnalysisService()
        
        spot_price = 21300.0  # Spot below all strikes
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=200.0,
                open_interest=15000,
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.PUT,
                ltp=300.0,
                open_interest=12000,
                change_in_oi=0,
                volume=4000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=10.0,
                open_interest=10000,
                change_in_oi=0,
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        oi = result.oi_analysis
        
        # No support levels (all puts above spot)
        assert len(oi.support_levels) == 0
    
    def test_no_resistance_when_all_calls_below_spot(self):
        """Test no resistance levels when all call OI is below spot."""
        service = OptionsAnalysisService()
        
        spot_price = 21700.0  # Spot above all strikes
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=200.0,
                open_interest=15000,
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=12000,
                change_in_oi=0,
                volume=4000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=10.0,
                open_interest=10000,
                change_in_oi=0,
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        oi = result.oi_analysis
        
        # No resistance levels (all calls below spot)
        assert len(oi.resistance_levels) == 0
    
    def test_significant_oi_change_threshold(self):
        """Test OI change analysis respects threshold."""
        service = OptionsAnalysisService(significant_oi_change_threshold=2000)
        
        contracts = [
            # Above threshold
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=15000,
                change_in_oi=3000,  # Above threshold
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=12000,
                change_in_oi=2500,  # Above threshold
                volume=4000,
            ),
            # Below threshold
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=10000,
                change_in_oi=1000,  # Below threshold
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        oi = result.oi_analysis
        
        # Should only include 21500 (above threshold)
        assert len(oi.oi_change_analysis) >= 1
        change_strikes = [change.strike for change in oi.oi_change_analysis]
        assert 21500.0 in change_strikes
        assert 21600.0 not in change_strikes

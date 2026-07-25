"""
Unit tests for Options Analysis Service.

Tests PCR calculation, ATM strike identification, OI buildup/unwinding detection,
and support/resistance level identification.

Requirements: 7.1
"""

import pytest
from datetime import datetime
from services.options_analysis_service import (
    OptionsAnalysisService,
    OptionContractData,
    OptionType,
    BuildupType,
)


class TestPCRCalculation:
    """Test PCR (Put-Call Ratio) calculation."""
    
    def test_pcr_bullish_scenario(self):
        """Test PCR calculation in bullish scenario (more calls than puts)."""
        service = OptionsAnalysisService()
        
        contracts = [
            # Calls with higher OI and volume
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=500,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=8000,
                change_in_oi=300,
                volume=4000,
            ),
            # Puts with lower OI and volume
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=6000,
                change_in_oi=200,
                volume=3000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.PUT,
                ltp=110.0,
                open_interest=5000,
                change_in_oi=100,
                volume=2500,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        pcr = result.pcr_analysis
        
        # Total call OI: 18000, Total put OI: 11000
        # PCR by OI = 11000 / 18000 = 0.611 (< 0.8, bullish)
        assert pcr.total_call_oi == 18000
        assert pcr.total_put_oi == 11000
        assert abs(pcr.pcr_by_oi - 0.611) < 0.01
        assert pcr.sentiment == "BULLISH"
        
        # Total call volume: 9000, Total put volume: 5500
        # PCR by volume = 5500 / 9000 = 0.611
        assert pcr.total_call_volume == 9000
        assert pcr.total_put_volume == 5500
        assert abs(pcr.pcr_by_volume - 0.611) < 0.01
    
    def test_pcr_bearish_scenario(self):
        """Test PCR calculation in bearish scenario (more puts than calls)."""
        service = OptionsAnalysisService()
        
        contracts = [
            # Calls with lower OI
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=5000,
                change_in_oi=-200,
                volume=2000,
            ),
            # Puts with higher OI
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=12000,
                change_in_oi=800,
                volume=6000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR by OI = 12000 / 5000 = 2.4 (> 1.2, bearish)
        assert pcr.pcr_by_oi == 2.4
        assert pcr.sentiment == "BEARISH"
    
    def test_pcr_neutral_scenario(self):
        """Test PCR calculation in neutral scenario."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=100,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=10500,
                change_in_oi=150,
                volume=5200,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR by OI = 10500 / 10000 = 1.05 (between 0.8 and 1.2, neutral)
        assert pcr.pcr_by_oi == 1.05
        assert pcr.sentiment == "NEUTRAL"


class TestATMIdentification:
    """Test ATM strike identification."""
    
    def test_atm_strike_exact_match(self):
        """Test ATM identification when spot equals a strike."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        contracts = [
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=120.0,
                open_interest=5000,
                change_in_oi=0,
                volume=1000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=8000,
                change_in_oi=0,
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        assert atm.atm_strike == 21500.0
        assert atm.spot_price == spot_price
        assert atm.strike_interval == 100.0
    
    def test_atm_strike_between_strikes(self):
        """Test ATM identification when spot is between strikes."""
        service = OptionsAnalysisService()
        
        spot_price = 21550.0  # Between 21500 and 21600
        contracts = [
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=150.0,
                open_interest=5000,
                change_in_oi=0,
                volume=1000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=8000,
                change_in_oi=0,
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # Should pick 21500 or 21600 (closest)
        assert atm.atm_strike in [21500.0, 21600.0]
        # 21550 is equidistant, implementation picks first in sorted order
        assert atm.atm_strike == 21500.0
    
    def test_near_atm_strikes(self):
        """Test near ATM strikes (±3 strikes) identification."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        strikes = [21300.0, 21350.0, 21400.0, 21450.0, 21500.0, 21550.0, 21600.0, 21650.0, 21700.0]
        
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
            contracts.append(
                OptionContractData(
                    strike_price=strike,
                    option_type=OptionType.PUT,
                    ltp=90.0,
                    open_interest=5000,
                    change_in_oi=0,
                    volume=1000,
                )
            )
        
        result = service.analyze("NIFTY", spot_price, contracts)
        atm = result.atm_analysis
        
        # ATM is 21500, so near ATM should be 21500 ± 3 strikes (50 interval)
        # That's 21350, 21400, 21450, 21500, 21550, 21600, 21650
        assert atm.atm_strike == 21500.0
        assert len(atm.near_atm_strikes) == 7
        
        near_strikes = [s.strike for s in atm.near_atm_strikes]
        assert 21350.0 in near_strikes
        assert 21500.0 in near_strikes
        assert 21650.0 in near_strikes


class TestOIAnalysis:
    """Test OI buildup/unwinding detection."""
    
    def test_long_buildup(self):
        """Test long buildup detection (call OI increasing more than put OI)."""
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
                change_in_oi=500,  # Increasing but less
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.LONG_BUILDUP
        assert "bullish" in oi.explanation.lower()
    
    def test_short_buildup(self):
        """Test short buildup detection (put OI increasing more than call OI)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=8000,
                change_in_oi=500,  # Increasing but less
                volume=3000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=10000,
                change_in_oi=2000,  # Increasing more
                volume=5000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.SHORT_BUILDUP
        assert "bearish" in oi.explanation.lower()
    
    def test_short_unwinding(self):
        """Test short unwinding detection (call OI decreasing more than put OI)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=8000,
                change_in_oi=-2000,  # Decreasing more
                volume=3000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=9000,
                change_in_oi=-500,  # Decreasing less
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.SHORT_UNWINDING
        assert "bullish" in oi.explanation.lower()
    
    def test_long_unwinding(self):
        """Test long unwinding detection (put OI decreasing more than call OI)."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=9000,
                change_in_oi=-500,  # Decreasing less
                volume=4000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=8000,
                change_in_oi=-2000,  # Decreasing more
                volume=3000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        oi = result.oi_analysis
        
        assert oi.buildup_type == BuildupType.LONG_UNWINDING
        assert "bearish" in oi.explanation.lower()


class TestSupportResistanceIdentification:
    """Test support/resistance level identification from OI."""
    
    def test_support_levels_from_put_oi(self):
        """Test support level identification from high put OI below spot."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        
        contracts = [
            # High put OI below spot (support)
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.PUT,
                ltp=100.0,
                open_interest=15000,  # High OI
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21450.0,
                option_type=OptionType.PUT,
                ltp=80.0,
                open_interest=12000,  # High OI
                change_in_oi=0,
                volume=4000,
            ),
            # Low put OI below spot
            OptionContractData(
                strike_price=21350.0,
                option_type=OptionType.PUT,
                ltp=120.0,
                open_interest=3000,  # Low OI
                change_in_oi=0,
                volume=1000,
            ),
            # Put OI above spot (not support)
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.PUT,
                ltp=60.0,
                open_interest=10000,
                change_in_oi=0,
                volume=3000,
            ),
            # Call contracts (for completeness)
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
        
        # Should identify 21400 and 21450 as support (high put OI below spot)
        assert len(oi.support_levels) >= 2
        support_strikes = [level.strike for level in oi.support_levels]
        assert 21400.0 in support_strikes
        assert 21450.0 in support_strikes
        
        # Should not include 21350 (too low OI) or 21600 (above spot)
        assert 21350.0 not in support_strikes
        assert 21600.0 not in support_strikes
    
    def test_resistance_levels_from_call_oi(self):
        """Test resistance level identification from high call OI above spot."""
        service = OptionsAnalysisService()
        
        spot_price = 21500.0
        
        contracts = [
            # High call OI above spot (resistance)
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=15000,  # High OI
                change_in_oi=0,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21650.0,
                option_type=OptionType.CALL,
                ltp=60.0,
                open_interest=12000,  # High OI
                change_in_oi=0,
                volume=4000,
            ),
            # Low call OI above spot
            OptionContractData(
                strike_price=21700.0,
                option_type=OptionType.CALL,
                ltp=50.0,
                open_interest=3000,  # Low OI
                change_in_oi=0,
                volume=1000,
            ),
            # Call OI below spot (not resistance)
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=120.0,
                open_interest=10000,
                change_in_oi=0,
                volume=3000,
            ),
            # Put contracts (for completeness)
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
        
        # Should identify 21600 and 21650 as resistance (high call OI above spot)
        assert len(oi.resistance_levels) >= 2
        resistance_strikes = [level.strike for level in oi.resistance_levels]
        assert 21600.0 in resistance_strikes
        assert 21650.0 in resistance_strikes
        
        # Should not include 21700 (too low OI) or 21400 (below spot)
        assert 21700.0 not in resistance_strikes
        assert 21400.0 not in resistance_strikes


class TestOIChangeAnalysis:
    """Test significant OI change detection."""
    
    def test_significant_oi_changes(self):
        """Test detection of significant OI changes."""
        service = OptionsAnalysisService(significant_oi_change_threshold=1000)
        
        contracts = [
            # Strike with significant call OI increase
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=2000,  # Significant increase
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=8000,
                change_in_oi=200,  # Small change
                volume=3000,
            ),
            # Strike with significant put OI decrease
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.CALL,
                ltp=80.0,
                open_interest=9000,
                change_in_oi=-300,  # Small change
                volume=4000,
            ),
            OptionContractData(
                strike_price=21600.0,
                option_type=OptionType.PUT,
                ltp=110.0,
                open_interest=7000,
                change_in_oi=-1500,  # Significant decrease
                volume=2500,
            ),
            # Strike with no significant changes
            OptionContractData(
                strike_price=21400.0,
                option_type=OptionType.CALL,
                ltp=120.0,
                open_interest=6000,
                change_in_oi=100,  # Small change
                volume=2000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21550.0, contracts)
        oi = result.oi_analysis
        
        # Should detect significant changes at 21500 and 21600
        assert len(oi.oi_change_analysis) >= 2
        
        change_strikes = [change.strike for change in oi.oi_change_analysis]
        assert 21500.0 in change_strikes
        assert 21600.0 in change_strikes
        
        # Should not include 21400 (changes too small)
        assert 21400.0 not in change_strikes


class TestEdgeCases:
    """Test edge cases and error handling."""
    
    def test_empty_contracts_list(self):
        """Test error handling for empty contracts list."""
        service = OptionsAnalysisService()
        
        with pytest.raises(ValueError, match="No option contracts provided"):
            service.analyze("NIFTY", 21500.0, [])
    
    def test_single_strike(self):
        """Test analysis with only one strike."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.CALL,
                ltp=100.0,
                open_interest=10000,
                change_in_oi=500,
                volume=5000,
            ),
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=8000,
                change_in_oi=300,
                volume=4000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        
        # Should still calculate PCR and ATM
        assert result.pcr_analysis.pcr_by_oi > 0
        assert result.atm_analysis.atm_strike == 21500.0
    
    def test_zero_call_oi(self):
        """Test PCR calculation when call OI is zero."""
        service = OptionsAnalysisService()
        
        contracts = [
            OptionContractData(
                strike_price=21500.0,
                option_type=OptionType.PUT,
                ltp=90.0,
                open_interest=10000,
                change_in_oi=500,
                volume=5000,
            ),
        ]
        
        result = service.analyze("NIFTY", 21500.0, contracts)
        pcr = result.pcr_analysis
        
        # PCR should be 0 when call OI is 0
        assert pcr.pcr_by_oi == 0.0
        assert pcr.total_call_oi == 0


class TestResultStructure:
    """Test the structure and completeness of analysis results."""
    
    def test_complete_result_structure(self):
        """Test that result contains all required fields."""
        service = OptionsAnalysisService()
        
        contracts = [
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
                open_interest=10000,
                change_in_oi=500,
                volume=4000,
            ),
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
                open_interest=9000,
                change_in_oi=400,
                volume=4500,
            ),
        ]
        
        result = service.analyze("NIFTY", 21450.0, contracts)
        
        # Check main structure
        assert result.symbol == "NIFTY"
        assert isinstance(result.timestamp, datetime)
        
        # Check PCR analysis
        assert result.pcr_analysis.pcr_by_oi >= 0
        assert result.pcr_analysis.pcr_by_volume >= 0
        assert result.pcr_analysis.sentiment in ["BULLISH", "BEARISH", "NEUTRAL"]
        
        # Check ATM analysis
        assert result.atm_analysis.atm_strike > 0
        assert result.atm_analysis.spot_price == 21450.0
        assert len(result.atm_analysis.near_atm_strikes) > 0
        
        # Check OI analysis
        assert result.oi_analysis.buildup_type in [
            BuildupType.LONG_BUILDUP,
            BuildupType.SHORT_BUILDUP,
            BuildupType.LONG_UNWINDING,
            BuildupType.SHORT_UNWINDING,
            BuildupType.NEUTRAL,
        ]
        assert len(result.oi_analysis.explanation) > 0
        assert result.oi_analysis.max_call_oi_strike > 0
        assert result.oi_analysis.max_put_oi_strike > 0

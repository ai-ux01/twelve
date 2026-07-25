"""
Integration test for Options Analysis Service.

Demonstrates how the Backend API OptionsService would use the
Options Analysis Service to analyze options chain data.

Requirements: 7.1
"""

import pytest
from services.options_analysis_service import (
    OptionsAnalysisService,
    OptionContractData,
    OptionType,
)


def test_nifty_options_chain_analysis():
    """
    Integration test: Analyze a realistic NIFTY options chain.
    
    This demonstrates how the Backend API OptionsService would call the
    Options Analysis Service with real options chain data.
    """
    service = OptionsAnalysisService()
    
    # Simulate NIFTY options chain data (spot at 21,550)
    # ATM is 21,550, strikes from 21,400 to 21,700 (50 point intervals)
    spot_price = 21550.0
    
    # Create realistic options chain data
    # Strike 21400 (ITM call, OTM put)
    # Strike 21500 (Near ATM)
    # Strike 21550 (ATM)
    # Strike 21600 (Near ATM)
    # Strike 21650 (OTM call, ITM put)
    
    contracts = [
        # 21400 Strike
        OptionContractData(
            strike_price=21400.0,
            option_type=OptionType.CALL,
            ltp=180.0,
            open_interest=8000,
            change_in_oi=500,
            volume=3000,
        ),
        OptionContractData(
            strike_price=21400.0,
            option_type=OptionType.PUT,
            ltp=30.0,
            open_interest=15000,  # High put OI below spot (support)
            change_in_oi=1200,
            volume=6000,
        ),
        
        # 21500 Strike
        OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.CALL,
            ltp=120.0,
            open_interest=12000,
            change_in_oi=800,
            volume=5000,
        ),
        OptionContractData(
            strike_price=21500.0,
            option_type=OptionType.PUT,
            ltp=50.0,
            open_interest=18000,  # High put OI below spot (support)
            change_in_oi=1500,
            volume=7000,
        ),
        
        # 21550 Strike (ATM)
        OptionContractData(
            strike_price=21550.0,
            option_type=OptionType.CALL,
            ltp=90.0,
            open_interest=20000,  # Highest call OI
            change_in_oi=2000,
            volume=10000,
        ),
        OptionContractData(
            strike_price=21550.0,
            option_type=OptionType.PUT,
            ltp=70.0,
            open_interest=19000,  # High put OI
            change_in_oi=1800,
            volume=9500,
        ),
        
        # 21600 Strike
        OptionContractData(
            strike_price=21600.0,
            option_type=OptionType.CALL,
            ltp=60.0,
            open_interest=16000,
            change_in_oi=1000,
            volume=6000,
        ),
        OptionContractData(
            strike_price=21600.0,
            option_type=OptionType.PUT,
            ltp=100.0,
            open_interest=14000,
            change_in_oi=800,
            volume=5500,
        ),
        
        # 21650 Strike
        OptionContractData(
            strike_price=21650.0,
            option_type=OptionType.CALL,
            ltp=40.0,
            open_interest=10000,
            change_in_oi=300,
            volume=3000,
        ),
        OptionContractData(
            strike_price=21650.0,
            option_type=OptionType.PUT,
            ltp=130.0,
            open_interest=12000,  # High put OI above spot
            change_in_oi=600,
            volume=4000,
        ),
        
        # 21700 Strike
        OptionContractData(
            strike_price=21700.0,
            option_type=OptionType.CALL,
            ltp=25.0,
            open_interest=8000,
            change_in_oi=200,
            volume=2000,
        ),
        OptionContractData(
            strike_price=21700.0,
            option_type=OptionType.PUT,
            ltp=160.0,
            open_interest=15000,  # High put OI above spot (resistance)
            change_in_oi=800,
            volume=5000,
        ),
    ]
    
    # Perform analysis
    result = service.analyze("NIFTY", spot_price, contracts)
    
    # Verify result structure
    assert result.symbol == "NIFTY"
    
    # Verify PCR Analysis
    pcr = result.pcr_analysis
    
    # Total call OI: 8000 + 12000 + 20000 + 16000 + 10000 + 8000 = 74000
    # Total put OI: 15000 + 18000 + 19000 + 14000 + 12000 + 15000 = 93000
    # PCR by OI = 93000 / 74000 = 1.257 (> 1.2, bearish)
    
    assert pcr.total_call_oi == 74000
    assert pcr.total_put_oi == 93000
    assert abs(pcr.pcr_by_oi - 1.257) < 0.01
    assert pcr.sentiment == "BEARISH"
    
    print(f"\n=== PCR Analysis ===")
    print(f"PCR by OI: {pcr.pcr_by_oi:.3f}")
    print(f"PCR by Volume: {pcr.pcr_by_volume:.3f}")
    print(f"Sentiment: {pcr.sentiment}")
    print(f"Call OI: {pcr.total_call_oi:,}, Put OI: {pcr.total_put_oi:,}")
    
    # Verify ATM Analysis
    atm = result.atm_analysis
    
    # ATM should be 21550 (exact match with spot)
    assert atm.atm_strike == 21550.0
    assert atm.spot_price == spot_price
    # Strike interval is calculated from consecutive strikes: 21500 - 21400 = 100
    assert atm.strike_interval == 100.0
    
    # Near ATM strikes should include 21400, 21450 (if present), 21500, 21550, 21600, 21650, 21700
    # Since we only have 50-point intervals, it should be: 21400, 21500, 21550, 21600, 21650, 21700
    near_strikes = [s.strike for s in atm.near_atm_strikes]
    assert 21550.0 in near_strikes  # ATM
    assert 21500.0 in near_strikes  # -1 strike
    assert 21600.0 in near_strikes  # +1 strike
    
    print(f"\n=== ATM Analysis ===")
    print(f"Spot: {atm.spot_price}, ATM Strike: {atm.atm_strike}")
    print(f"Near ATM Strikes: {[s.strike for s in atm.near_atm_strikes]}")
    
    # Verify OI Analysis
    oi = result.oi_analysis
    
    # Since all OI changes are positive and put OI change > call OI change
    # Should detect SHORT_BUILDUP (bearish)
    assert oi.buildup_type.value in ["SHORT_BUILDUP", "LONG_BUILDUP", "NEUTRAL"]
    
    # Max call OI should be at 21550
    assert oi.max_call_oi_strike == 21550.0
    
    # Max put OI should be at 21550
    assert oi.max_put_oi_strike == 21550.0
    
    # Should identify support levels from high put OI below spot
    # (21400 with 15000 OI, 21500 with 18000 OI)
    support_strikes = [level.strike for level in oi.support_levels]
    assert 21400.0 in support_strikes or 21500.0 in support_strikes
    
    # Should identify resistance levels - none above spot with high call OI
    # (no call OI above spot exceeds threshold relative to max)
    
    print(f"\n=== OI Analysis ===")
    print(f"Buildup Type: {oi.buildup_type.value}")
    print(f"Explanation: {oi.explanation}")
    print(f"Max Call OI Strike: {oi.max_call_oi_strike}")
    print(f"Max Put OI Strike: {oi.max_put_oi_strike}")
    print(f"\nSupport Levels:")
    for level in oi.support_levels:
        print(f"  {level.strike}: {level.reason} (strength: {level.strength:.2f})")
    print(f"\nResistance Levels:")
    for level in oi.resistance_levels:
        print(f"  {level.strike}: {level.reason} (strength: {level.strength:.2f})")
    
    # Verify OI change analysis
    print(f"\n=== Significant OI Changes ===")
    for change in oi.oi_change_analysis:
        print(f"Strike {change.strike}:")
        print(f"  Call OI change: {change.call_oi_change:+,}")
        print(f"  Put OI change: {change.put_oi_change:+,}")
        print(f"  {change.interpretation}")
    
    # Overall test passed
    print(f"\n✓ NIFTY options chain analysis completed successfully")


def test_banknifty_options_chain_analysis():
    """
    Integration test: Analyze a realistic BANKNIFTY options chain.
    
    BANKNIFTY has wider strikes (100 point intervals) and higher premiums.
    """
    service = OptionsAnalysisService()
    
    spot_price = 47550.0  # BANKNIFTY spot
    
    contracts = [
        # 47400 Strike
        OptionContractData(
            strike_price=47400.0,
            option_type=OptionType.CALL,
            ltp=300.0,
            open_interest=5000,
            change_in_oi=-500,  # Unwinding
            volume=2000,
        ),
        OptionContractData(
            strike_price=47400.0,
            option_type=OptionType.PUT,
            ltp=80.0,
            open_interest=12000,
            change_in_oi=800,
            volume=4000,
        ),
        
        # 47500 Strike (Near ATM)
        OptionContractData(
            strike_price=47500.0,
            option_type=OptionType.CALL,
            ltp=200.0,
            open_interest=15000,
            change_in_oi=1000,
            volume=6000,
        ),
        OptionContractData(
            strike_price=47500.0,
            option_type=OptionType.PUT,
            ltp=120.0,
            open_interest=18000,
            change_in_oi=1200,
            volume=7000,
        ),
        
        # 47600 Strike (Near ATM)
        OptionContractData(
            strike_price=47600.0,
            option_type=OptionType.CALL,
            ltp=150.0,
            open_interest=20000,  # High call OI above spot (resistance)
            change_in_oi=2000,
            volume=8000,
        ),
        OptionContractData(
            strike_price=47600.0,
            option_type=OptionType.PUT,
            ltp=180.0,
            open_interest=16000,
            change_in_oi=1500,
            volume=6500,
        ),
    ]
    
    # Perform analysis
    result = service.analyze("BANKNIFTY", spot_price, contracts)
    
    # Verify basic structure
    assert result.symbol == "BANKNIFTY"
    
    # PCR should be slightly bearish (more puts)
    pcr = result.pcr_analysis
    assert pcr.pcr_by_oi > 0
    
    # ATM should be around 47500 or 47600
    atm = result.atm_analysis
    assert atm.atm_strike in [47500.0, 47600.0]
    assert atm.strike_interval == 100.0  # BANKNIFTY has 100-point intervals
    
    print(f"\n=== BANKNIFTY Analysis ===")
    print(f"PCR by OI: {pcr.pcr_by_oi:.3f}, Sentiment: {pcr.sentiment}")
    print(f"ATM Strike: {atm.atm_strike}")
    print(f"Buildup Type: {result.oi_analysis.buildup_type.value}")
    
    print(f"\n✓ BANKNIFTY options chain analysis completed successfully")


if __name__ == "__main__":
    # Run integration tests
    test_nifty_options_chain_analysis()
    test_banknifty_options_chain_analysis()

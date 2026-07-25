"""
Demo script for SectorAnalysisService.

This script demonstrates how to use the sector analysis service to:
1. Calculate sector strength scores
2. Analyze stock performance relative to sector
3. Rank all sectors by strength
4. Identify leading and lagging sectors
"""

from services.sector_analysis_service import SectorAnalysisService


def main():
    """Run sector analysis demo."""
    print("=" * 80)
    print("SECTOR ANALYSIS SERVICE DEMO")
    print("=" * 80)
    print()

    # Initialize service
    service = SectorAnalysisService(
        lookback_period=20,
        leading_threshold=65.0,
    )

    print("Service initialized:")
    print(f"  Lookback period: {service.lookback_period}")
    print(f"  Leading threshold: {service.leading_threshold}")
    print()

    # Demo 1: Get sector for symbols
    print("-" * 80)
    print("DEMO 1: Sector Mapping")
    print("-" * 80)

    symbols = ["RELIANCE", "HDFCBANK", "TCS", "MARUTI", "SUNPHARMA", "ITC"]

    for symbol in symbols:
        sector = service.get_sector(symbol)
        print(f"  {symbol:15} -> {sector}")
    print()

    # Demo 2: Calculate stock returns
    print("-" * 80)
    print("DEMO 2: Stock Return Calculation")
    print("-" * 80)

    # Simulate price data
    reliance_prices = [
        2400,
        2420,
        2450,
        2480,
        2500,
        2520,
        2540,
        2560,
        2580,
        2600,
        2620,
        2640,
        2660,
        2680,
        2700,
        2720,
        2740,
        2760,
        2780,
        2800,
        2820,
    ]

    reliance_return = service.calculate_stock_return(reliance_prices)
    print(f"  RELIANCE prices: {reliance_prices[0]} -> {reliance_prices[-1]}")
    print(f"  Return over {service.lookback_period} periods: {reliance_return:.2f}%")
    print()

    # Demo 3: Calculate sector strength score
    print("-" * 80)
    print("DEMO 3: Sector Strength Score Calculation")
    print("-" * 80)

    test_cases = [
        (10.0, 5.0, "Outperforming (+5%)"),
        (5.0, 5.0, "Equal to market"),
        (2.0, 5.0, "Underperforming (-3%)"),
        (15.0, 5.0, "Strong outperformance (+10%)"),
        (-5.0, 5.0, "Strong underperformance (-10%)"),
    ]

    for sector_return, market_return, description in test_cases:
        score = service.calculate_sector_strength_score(sector_return, market_return)
        print(f"  {description:30} -> Score: {score:.1f}")
    print()

    # Demo 4: Analyze stock sector performance
    print("-" * 80)
    print("DEMO 4: Stock Sector Performance Analysis")
    print("-" * 80)

    # Simulate price data for RELIANCE and other ENERGY stocks
    reliance_prices_full = [
        2400,
        2420,
        2450,
        2480,
        2500,
        2520,
        2540,
        2560,
        2580,
        2600,
        2620,
        2640,
        2660,
        2680,
        2700,
        2720,
        2740,
        2760,
        2780,
        2800,
        2820,
    ]

    ongc_prices = [
        180,
        182,
        184,
        186,
        188,
        190,
        192,
        194,
        196,
        198,
        200,
        202,
        204,
        206,
        208,
        210,
        212,
        214,
        216,
        218,
        220,
    ]

    bpcl_prices = [
        450,
        455,
        460,
        465,
        470,
        475,
        480,
        485,
        490,
        495,
        500,
        505,
        510,
        515,
        520,
        525,
        530,
        535,
        540,
        545,
        549,
    ]

    sector_stocks = {
        "RELIANCE": reliance_prices_full,
        "ONGC": ongc_prices,
        "BPCL": bpcl_prices,
    }

    # Market benchmark (NIFTY50)
    nifty_prices = [
        21000,
        21100,
        21200,
        21300,
        21400,
        21500,
        21600,
        21700,
        21800,
        21900,
        22000,
        22100,
        22200,
        22300,
        22400,
        22500,
        22600,
        22700,
        22800,
        22900,
        23000,
    ]

    result = service.analyze_stock_sector_performance(
        "RELIANCE", reliance_prices_full, sector_stocks, nifty_prices
    )

    print(f"  Symbol: {result.symbol}")
    print(f"  Sector: {result.sector}")
    print(f"  Stock return: {result.stock_return:.2f}%")
    print(f"  Sector return: {result.sector_return:.2f}%")
    print(f"  Relative strength: {result.relative_strength:.2f}%")
    print(f"  Sector strength score: {result.sector_strength_score:.1f}/100")
    print(f"  Outperforming sector: {result.outperforming_sector}")
    print()

    # Demo 5: Analyze all sectors
    print("-" * 80)
    print("DEMO 5: All Sectors Analysis and Ranking")
    print("-" * 80)

    # Simulate multi-sector price data
    all_sector_stocks = {
        # IT sector (strong performance)
        "TCS": [
            3600,
            3650,
            3700,
            3750,
            3800,
            3850,
            3900,
            3950,
            4000,
            4050,
            4100,
            4150,
            4200,
            4250,
            4300,
            4350,
            4400,
            4450,
            4500,
            4550,
            4600,
        ],
        "INFY": [
            1500,
            1520,
            1540,
            1560,
            1580,
            1600,
            1620,
            1640,
            1660,
            1680,
            1700,
            1720,
            1740,
            1760,
            1780,
            1800,
            1820,
            1840,
            1860,
            1880,
            1900,
        ],
        # BANKING sector (moderate performance)
        "HDFCBANK": [
            1600,
            1610,
            1620,
            1630,
            1640,
            1650,
            1660,
            1670,
            1680,
            1690,
            1700,
            1710,
            1720,
            1730,
            1740,
            1750,
            1760,
            1770,
            1780,
            1790,
            1800,
        ],
        "ICICIBANK": [
            950,
            955,
            960,
            965,
            970,
            975,
            980,
            985,
            990,
            995,
            1000,
            1005,
            1010,
            1015,
            1020,
            1025,
            1030,
            1035,
            1040,
            1045,
            1050,
        ],
        # ENERGY sector (weak performance)
        "RELIANCE": [
            2400,
            2410,
            2420,
            2430,
            2440,
            2450,
            2460,
            2470,
            2480,
            2490,
            2500,
            2510,
            2520,
            2530,
            2540,
            2550,
            2560,
            2570,
            2580,
            2590,
            2600,
        ],
        "ONGC": [
            180,
            181,
            182,
            183,
            184,
            185,
            186,
            187,
            188,
            189,
            190,
            191,
            192,
            193,
            194,
            195,
            196,
            197,
            198,
            199,
            200,
        ],
    }

    sector_results = service.analyze_all_sectors(all_sector_stocks, nifty_prices)

    print(f"  Total sectors analyzed: {len(sector_results)}")
    print()
    print(
        f"  {'Rank':<6} {'Sector':<20} {'Score':<10} {'Rel. Perf.':<12} {'Status':<10}"
    )
    print(f"  {'-'*6} {'-'*20} {'-'*10} {'-'*12} {'-'*10}")

    for sector in sector_results:
        status = "LEADING" if sector.is_leading else "LAGGING"
        print(
            f"  {sector.rank:<6} {sector.sector:<20} {sector.strength_score:<10.1f} "
            f"{sector.relative_performance:>+11.2f}% {status:<10}"
        )
    print()

    # Demo 6: Leading and lagging sectors
    print("-" * 80)
    print("DEMO 6: Leading and Lagging Sectors")
    print("-" * 80)

    leading_sectors = service.get_leading_sectors(sector_results)
    lagging_sectors = service.get_lagging_sectors(sector_results)

    print(f"  Leading sectors (score >= {service.leading_threshold}):")
    for sector in leading_sectors:
        print(f"    - {sector}")
    print()

    print(f"  Lagging sectors (score < {service.leading_threshold}):")
    for sector in lagging_sectors:
        print(f"    - {sector}")
    print()

    print("=" * 80)
    print("DEMO COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()

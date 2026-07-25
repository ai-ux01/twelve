"""
Demo script for Liquidity Analyzer Service.

Shows how to use the LiquidityAnalyzer to identify illiquid options contracts.
"""

from services.liquidity_analyzer import (
    LiquidityAnalyzer,
    OptionContractInput,
)


def main():
    """Demo liquidity analysis."""
    print("=" * 80)
    print("Liquidity Analyzer Demo")
    print("=" * 80)
    print()

    # Create analyzer with default thresholds
    analyzer = LiquidityAnalyzer(
        wide_spread_threshold=5.0,  # 5% spread threshold
        low_volume_threshold=100,  # Volume < 100
        low_oi_threshold=500,  # OI < 500
        deep_otm_threshold=10.0,  # > 10% away from ATM
    )

    print("Analyzer Configuration:")
    print(f"  Wide Spread Threshold: {analyzer.wide_spread_threshold}%")
    print(f"  Low Volume Threshold: {analyzer.low_volume_threshold}")
    print(f"  Low OI Threshold: {analyzer.low_oi_threshold}")
    print(f"  Deep OTM Threshold: {analyzer.deep_otm_threshold}%")
    print()

    # Create sample contracts (mix of liquid and illiquid)
    contracts = [
        # Liquid ATM call
        OptionContractInput(
            strike_price=21500,
            option_type="CALL",
            bid=100.0,
            ask=102.0,  # 2% spread
            ltp=101.0,
            volume=5000,
            open_interest=15000,
        ),
        # Liquid ATM put
        OptionContractInput(
            strike_price=21500,
            option_type="PUT",
            bid=98.0,
            ask=100.0,  # 2% spread
            ltp=99.0,
            volume=4500,
            open_interest=12000,
        ),
        # Illiquid call (wide spread, low volume, low OI)
        OptionContractInput(
            strike_price=22000,
            option_type="CALL",
            bid=10.0,
            ask=11.5,  # 13.6% spread - WIDE
            ltp=10.75,
            volume=50,  # LOW volume
            open_interest=200,  # LOW OI
        ),
        # Deep OTM put (far from ATM)
        OptionContractInput(
            strike_price=19000,  # 11.6% below ATM
            option_type="PUT",
            bid=5.0,
            ask=5.5,  # 9.5% spread
            ltp=5.25,
            volume=150,
            open_interest=800,
        ),
        # Another liquid near-ATM call
        OptionContractInput(
            strike_price=21600,
            option_type="CALL",
            bid=90.0,
            ask=92.0,  # 2.2% spread
            ltp=91.0,
            volume=3000,
            open_interest=10000,
        ),
    ]

    atm_strike = 21500

    print(f"Analyzing {len(contracts)} contracts with ATM strike at {atm_strike}")
    print()

    # Analyze liquidity
    metrics = analyzer.analyze_liquidity(contracts, atm_strike)

    print("=" * 80)
    print("Liquidity Metrics Summary")
    print("=" * 80)
    print(f"Total Contracts: {metrics.total_contracts}")
    print(f"Liquid Contracts: {metrics.liquid_contracts}")
    print(f"Illiquid Contracts: {metrics.illiquid_contracts}")
    print()
    print(f"Average Volume: {metrics.average_volume:.0f}")
    print(f"Average OI: {metrics.average_oi:.0f}")
    print(f"Average Bid-Ask Spread: {metrics.average_bid_ask_spread:.2f}%")
    print()
    print("Warning Counts:")
    print(f"  Wide Spreads: {metrics.wide_spread_count}")
    print(f"  Low Volume: {metrics.low_volume_count}")
    print(f"  Low OI: {metrics.low_oi_count}")
    print(f"  Deep OTM: {metrics.deep_otm_count}")
    print()

    if metrics.illiquid_contracts_list:
        print("=" * 80)
        print("Illiquid Contracts Details")
        print("=" * 80)
        for i, contract in enumerate(metrics.illiquid_contracts_list, 1):
            print(f"\nContract {i}:")
            print(f"  Strike: {contract.strike_price} {contract.option_type}")
            print(f"  Bid/Ask: {contract.bid}/{contract.ask}")
            print(f"  LTP: {contract.ltp}")
            print(f"  Mid-Price: {contract.mid_price:.2f}")
            print(
                f"  Bid-Ask Spread: {contract.bid_ask_spread:.2f} ({contract.bid_ask_spread_percent:.2f}%)"
            )
            print(f"  Volume: {contract.volume}")
            print(f"  OI: {contract.open_interest}")
            print(f"  Distance from ATM: {contract.distance_from_atm_percent:.2f}%")

            if contract.liquidity_warning:
                warnings = []
                if contract.liquidity_warning.wide_bid_ask_spread:
                    warnings.append("WIDE SPREAD")
                if contract.liquidity_warning.low_volume:
                    warnings.append("LOW VOLUME")
                if contract.liquidity_warning.low_oi:
                    warnings.append("LOW OI")
                if contract.liquidity_warning.deep_otm:
                    warnings.append("DEEP OTM")

                print(f"  Warnings: {', '.join(warnings)}")
                print(f"  Warning Count: {contract.liquidity_warning.warning_count}")
    else:
        print("\nNo illiquid contracts found! All contracts are liquid.")

    print()
    print("=" * 80)


if __name__ == "__main__":
    main()

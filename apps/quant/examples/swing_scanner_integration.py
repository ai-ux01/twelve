"""
Example: Swing Scanner Integration with Candidate Result Models

This example demonstrates how the SwingCandidate and ScanResult models
will be used by the Swing Scanner service (Task 46.1) to return
structured results.

Requirements: 5.4
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from typing import List
from models.swing import (
    SwingCandidate,
    ScanResult,
    ComponentScoresBreakdown,
    KeyMetricsSummary,
    SetupType,
    Signal,
)


# Mock data for demonstration
MOCK_STOCK_UNIVERSE = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Limited", "sector": "Energy"},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "sector": "Technology"},
    {"symbol": "INFY", "name": "Infosys Limited", "sector": "Technology"},
    {"symbol": "HDFC", "name": "HDFC Bank", "sector": "Finance"},
    {"symbol": "ICICI", "name": "ICICI Bank", "sector": "Finance"},
]


def mock_analyze_stock(symbol: str, name: str, sector: str) -> SwingCandidate:
    """
    Mock function simulating swing analysis for a single stock.

    In the real implementation (Task 46.1), this would:
    1. Fetch market data
    2. Call SwingAnalysisService for technical analysis
    3. Call SwingScoringService to calculate scores
    4. Build SwingCandidate with all analysis results
    """
    # Simulated analysis results
    if symbol == "RELIANCE":
        return SwingCandidate(
            symbol=symbol,
            name=name,
            score=78.5,
            sector=sector,
            signal=Signal.BUY,
            setup_type=SetupType.BREAKOUT,
            entry=2460.0,
            stop_loss=2430.0,
            target=2520.0,
            risk_reward=2.0,
            component_scores=ComponentScoresBreakdown(
                trend_score=85.0,
                technical_score=75.0,
                volume_score=80.0,
                relative_strength_score=70.0,
                breakout_score=90.0,
                sector_score=65.0,
                risk_reward_score=75.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=2460.0,
                volume=1200000,
                trend_direction="UPTREND",
                rsi=58.5,
                adx=32.4,
                relative_volume=1.35,
                distance_from_52w_high=-5.4,
                distance_from_52w_low=11.8,
            ),
            rationale="Strong uptrend breakout with volume confirmation",
        )
    elif symbol == "TCS":
        return SwingCandidate(
            symbol=symbol,
            name=name,
            score=72.3,
            sector=sector,
            signal=Signal.BUY,
            setup_type=SetupType.RETEST,
            entry=3500.0,
            stop_loss=3450.0,
            target=3600.0,
            risk_reward=2.0,
            component_scores=ComponentScoresBreakdown(
                trend_score=75.0,
                technical_score=70.0,
                volume_score=65.0,
                relative_strength_score=80.0,
                breakout_score=60.0,
                sector_score=85.0,
                risk_reward_score=70.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=3500.0,
                volume=800000,
                trend_direction="UPTREND",
                rsi=52.1,
                adx=28.7,
                relative_volume=1.15,
                distance_from_52w_high=-8.2,
                distance_from_52w_low=15.3,
            ),
            rationale="Successful retest with sector strength",
        )
    else:
        # Lower score candidate (would be filtered out)
        return SwingCandidate(
            symbol=symbol,
            name=name,
            score=55.2,
            sector=sector,
            signal=Signal.HOLD,
            setup_type=SetupType.CONSOLIDATION_BREAKOUT,
            entry=1000.0,
            stop_loss=980.0,
            target=1040.0,
            risk_reward=2.0,
            component_scores=ComponentScoresBreakdown(
                trend_score=50.0,
                technical_score=55.0,
                volume_score=50.0,
                relative_strength_score=52.0,
                breakout_score=45.0,
                sector_score=60.0,
                risk_reward_score=75.0,
            ),
            key_metrics=KeyMetricsSummary(
                current_price=1000.0,
                volume=500000,
                trend_direction="SIDEWAYS",
                rsi=48.5,
                adx=18.2,
                relative_volume=0.95,
                distance_from_52w_high=-15.5,
                distance_from_52w_low=8.2,
            ),
        )


def scan_universe(
    universe: List[dict],
    min_score: float = 60.0,
    min_volume: int = 100000,
    top_n: int = 10,
) -> ScanResult:
    """
    Mock swing scanner function.

    This demonstrates how the real scanner (Task 46.1) will:
    1. Iterate through the stock universe
    2. Analyze each stock
    3. Filter by minimum criteria
    4. Sort by score
    5. Return top N candidates in ScanResult

    Args:
        universe: List of stock dictionaries with symbol, name, sector
        min_score: Minimum score threshold (default: 60.0)
        min_volume: Minimum volume threshold (default: 100000)
        top_n: Maximum number of candidates to return (default: 10)

    Returns:
        ScanResult: Complete scan result with candidates and metadata
    """
    print(f"\n{'='*70}")
    print("SWING SCANNER - Starting Universe Scan")
    print(f"{'='*70}")
    print(f"Universe Size: {len(universe)} stocks")
    print(f"Filters: score >= {min_score}, volume >= {min_volume}")
    print(f"Returning Top: {top_n} candidates")
    print()

    candidates = []
    filters_applied = [
        f"min_score >= {min_score}",
        f"min_volume >= {min_volume}",
        "active_stocks_only",
    ]

    # Analyze each stock in universe
    for stock in universe:
        print(f"  Analyzing {stock['symbol']}...", end=" ")

        # Get analysis (in real implementation, this calls services)
        candidate = mock_analyze_stock(
            symbol=stock["symbol"], name=stock["name"], sector=stock["sector"]
        )

        # Apply filters
        if candidate.score >= min_score and candidate.key_metrics.volume >= min_volume:
            candidates.append(candidate)
            print(f"✓ Score: {candidate.score:.1f} - QUALIFIED")
        else:
            print(f"✗ Score: {candidate.score:.1f} - FILTERED OUT")

    # Sort by score (descending)
    candidates.sort(key=lambda c: c.score, reverse=True)

    # Take top N
    candidates = candidates[:top_n]

    # Create scan result
    scan_result = ScanResult(
        candidates=candidates,
        total_scanned=len(universe),
        filters_applied=filters_applied,
        scan_timestamp="2024-01-15T10:30:00Z",
        market_regime="BULL_MARKET",
    )

    print()
    print(f"{'='*70}")
    print("SCAN COMPLETE")
    print(f"{'='*70}")
    print(f"Qualified Candidates: {len(scan_result.candidates)}")
    print()

    return scan_result


def display_scan_results(scan_result: ScanResult):
    """Display scan results in a formatted table."""
    print(f"\n{'='*70}")
    print("TOP SWING CANDIDATES")
    print(f"{'='*70}")
    print(f"Total Scanned: {scan_result.total_scanned}")
    print(f"Market Regime: {scan_result.market_regime}")
    print(f"Timestamp: {scan_result.scan_timestamp}")
    print()

    if not scan_result.candidates:
        print("No candidates found matching criteria.")
        return

    # Table header
    print(
        f"{'Rank':<5} {'Symbol':<10} {'Score':<8} {'Signal':<8} {'Setup':<15} {'R:R':<6} {'Entry':<10}"
    )
    print("-" * 70)

    # Table rows
    for i, candidate in enumerate(scan_result.candidates, 1):
        print(
            f"{i:<5} "
            f"{candidate.symbol:<10} "
            f"{candidate.score:<8.1f} "
            f"{candidate.signal.value:<8} "
            f"{candidate.setup_type.value:<15} "
            f"{candidate.risk_reward:<6.1f} "
            f"₹{candidate.entry:<9.2f}"
        )

    print()

    # Detailed view of top candidate
    if scan_result.candidates:
        top = scan_result.candidates[0]
        print(f"{'='*70}")
        print(f"TOP CANDIDATE DETAILS: {top.symbol}")
        print(f"{'='*70}")
        print(f"Company: {top.name}")
        print(f"Sector: {top.sector}")
        print(f"Overall Score: {top.score:.1f}/100")
        print()
        print("Component Scores:")
        print(f"  Trend:            {top.component_scores.trend_score:.1f}/100")
        print(f"  Technical:        {top.component_scores.technical_score:.1f}/100")
        print(f"  Volume:           {top.component_scores.volume_score:.1f}/100")
        print(
            f"  Relative Strength:{top.component_scores.relative_strength_score:.1f}/100"
        )
        print(f"  Breakout:         {top.component_scores.breakout_score:.1f}/100")
        print(f"  Sector:           {top.component_scores.sector_score:.1f}/100")
        print(f"  Risk/Reward:      {top.component_scores.risk_reward_score:.1f}/100")
        print()
        print("Trade Setup:")
        print(f"  Signal:     {top.signal.value}")
        print(f"  Setup Type: {top.setup_type.value}")
        print(f"  Entry:      ₹{top.entry:.2f}")
        print(f"  Stop Loss:  ₹{top.stop_loss:.2f}")
        print(f"  Target:     ₹{top.target:.2f}")
        print(f"  Risk/Reward: {top.risk_reward:.1f}:1")
        print()
        print("Key Metrics:")
        print(f"  Current Price:  ₹{top.key_metrics.current_price:.2f}")
        print(f"  Volume:         {top.key_metrics.volume:,}")
        print(f"  Trend:          {top.key_metrics.trend_direction}")
        print(f"  RSI:            {top.key_metrics.rsi:.1f}")
        print(f"  ADX:            {top.key_metrics.adx:.1f}")
        print(f"  Relative Vol:   {top.key_metrics.relative_volume:.2f}x")
        print(f"  From 52w High:  {top.key_metrics.distance_from_52w_high:.1f}%")
        print()
        print(f"Rationale: {top.rationale}")
        print()


def main():
    """Run the swing scanner integration example."""
    print("\n" + "*" * 70)
    print("SWING SCANNER INTEGRATION EXAMPLE")
    print("Requirements: 5.4")
    print("*" * 70)

    # Run scanner
    scan_result = scan_universe(
        universe=MOCK_STOCK_UNIVERSE, min_score=60.0, min_volume=100000, top_n=10
    )

    # Display results
    display_scan_results(scan_result)

    # Show JSON export capability
    print(f"{'='*70}")
    print("JSON EXPORT CAPABILITY")
    print(f"{'='*70}")
    print("\nThe scan result can be serialized to JSON for API responses:")
    json_preview = scan_result.model_dump_json(indent=2)[:300]
    print(json_preview + "...")
    print(f"\nTotal JSON size: {len(scan_result.model_dump_json())} bytes")
    print()

    print("*" * 70)
    print("✅ Integration example completed successfully!")
    print("*" * 70)
    print("\nThis demonstrates how Task 46.1 (Swing Scanner) will use")
    print("the candidate result models to return structured results.")
    print()


if __name__ == "__main__":
    main()

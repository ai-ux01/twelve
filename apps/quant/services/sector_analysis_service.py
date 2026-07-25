"""
Sector Analysis Service for calculating sector strength and relative performance.

This service calculates sector-relative performance to identify leading and lagging
sectors, which helps in swing trading analysis by confirming sector momentum.

Requirements: 5.2
"""

from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SectorStrengthResult(BaseModel):
    """
    Result of sector strength analysis.

    Attributes:
        sector: Sector name
        strength_score: Sector strength score (0-100, higher is stronger)
        relative_performance: Performance relative to market benchmark (percentage)
        is_leading: Whether this is a leading sector
        rank: Sector rank (1 is strongest)
    """

    sector: str = Field(..., description="Sector name")
    strength_score: float = Field(
        ..., ge=0, le=100, description="Sector strength score (0-100)"
    )
    relative_performance: float = Field(
        ..., description="Performance relative to market benchmark (percentage)"
    )
    is_leading: bool = Field(..., description="Whether this is a leading sector")
    rank: int = Field(..., gt=0, description="Sector rank (1 is strongest)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "sector": "BANKING",
                    "strength_score": 75.5,
                    "relative_performance": 5.2,
                    "is_leading": True,
                    "rank": 1,
                }
            ]
        }
    }


class StockSectorPerformance(BaseModel):
    """
    Result of stock's performance relative to its sector.

    Attributes:
        symbol: Stock symbol
        sector: Sector the stock belongs to
        stock_return: Stock's return over the analysis period (percentage)
        sector_return: Sector's average return (percentage)
        relative_strength: Stock return minus sector return (percentage)
        sector_strength_score: Sector's overall strength score (0-100)
        outperforming_sector: Whether stock is outperforming its sector
    """

    symbol: str = Field(..., description="Stock symbol")
    sector: str = Field(..., description="Sector the stock belongs to")
    stock_return: float = Field(
        ..., description="Stock's return over analysis period (percentage)"
    )
    sector_return: float = Field(
        ..., description="Sector's average return (percentage)"
    )
    relative_strength: float = Field(
        ..., description="Stock return minus sector return (percentage)"
    )
    sector_strength_score: float = Field(
        ..., ge=0, le=100, description="Sector's overall strength score (0-100)"
    )
    outperforming_sector: bool = Field(
        ..., description="Whether stock is outperforming its sector"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "sector": "ENERGY",
                    "stock_return": 8.5,
                    "sector_return": 6.2,
                    "relative_strength": 2.3,
                    "sector_strength_score": 72.0,
                    "outperforming_sector": True,
                }
            ]
        }
    }


# Common NSE sector mappings
# In production, this would come from a database or external API
NSE_SECTOR_MAPPING = {
    # Banking & Financial Services
    "HDFCBANK": "BANKING",
    "ICICIBANK": "BANKING",
    "KOTAKBANK": "BANKING",
    "AXISBANK": "BANKING",
    "SBIN": "BANKING",
    "INDUSINDBK": "BANKING",
    "BANKBARODA": "BANKING",
    "PNB": "BANKING",
    "BAJFINANCE": "FINANCIAL_SERVICES",
    "BAJAJFINSV": "FINANCIAL_SERVICES",
    "HDFCLIFE": "FINANCIAL_SERVICES",
    "SBILIFE": "FINANCIAL_SERVICES",
    "ICICIGI": "FINANCIAL_SERVICES",
    # IT
    "TCS": "IT",
    "INFY": "IT",
    "WIPRO": "IT",
    "HCLTECH": "IT",
    "TECHM": "IT",
    "LTIM": "IT",
    "PERSISTENT": "IT",
    "COFORGE": "IT",
    # Energy & Oil & Gas
    "RELIANCE": "ENERGY",
    "ONGC": "ENERGY",
    "BPCL": "ENERGY",
    "IOC": "ENERGY",
    "GAIL": "ENERGY",
    "NTPC": "ENERGY",
    "POWERGRID": "ENERGY",
    "ADANIGREEN": "ENERGY",
    # Automotive
    "MARUTI": "AUTO",
    "M&M": "AUTO",
    "TATAMOTORS": "AUTO",
    "BAJAJ-AUTO": "AUTO",
    "HEROMOTOCO": "AUTO",
    "EICHERMOT": "AUTO",
    "TVSMOTOR": "AUTO",
    "ASHOKLEY": "AUTO",
    # Pharma
    "SUNPHARMA": "PHARMA",
    "DRREDDY": "PHARMA",
    "CIPLA": "PHARMA",
    "DIVISLAB": "PHARMA",
    "BIOCON": "PHARMA",
    "TORNTPHARM": "PHARMA",
    "AUROPHARMA": "PHARMA",
    "LUPIN": "PHARMA",
    # FMCG
    "HINDUNILVR": "FMCG",
    "ITC": "FMCG",
    "NESTLEIND": "FMCG",
    "BRITANNIA": "FMCG",
    "DABUR": "FMCG",
    "GODREJCP": "FMCG",
    "MARICO": "FMCG",
    "COLPAL": "FMCG",
    # Metals & Mining
    "TATASTEEL": "METALS",
    "HINDALCO": "METALS",
    "JSWSTEEL": "METALS",
    "VEDL": "METALS",
    "COALINDIA": "METALS",
    "HINDZINC": "METALS",
    "NMDC": "METALS",
    "SAIL": "METALS",
    # Cement
    "ULTRACEMCO": "CEMENT",
    "GRASIM": "CEMENT",
    "SHREECEM": "CEMENT",
    "AMBUJACEM": "CEMENT",
    "ACC": "CEMENT",
    "JKCEMENT": "CEMENT",
    # Telecom
    "BHARTIARTL": "TELECOM",
    "IDEA": "TELECOM",
    # Realty
    "DLF": "REALTY",
    "GODREJPROP": "REALTY",
    "OBEROIRLTY": "REALTY",
    "PHOENIXLTD": "REALTY",
    # Consumer Durables
    "TITAN": "CONSUMER_DURABLES",
    "HAVELLS": "CONSUMER_DURABLES",
    "VOLTAS": "CONSUMER_DURABLES",
    "WHIRLPOOL": "CONSUMER_DURABLES",
}


class SectorAnalysisService:
    """
    Service for analyzing sector strength and calculating relative performance.

    This service provides methods to:
    1. Calculate sector strength scores (0-100) based on average returns
    2. Identify leading and lagging sectors
    3. Calculate stock performance relative to its sector
    4. Rank sectors by strength

    The sector strength score is calculated using:
    - Sector average return (normalized to 0-100 scale)
    - Relative performance vs market benchmark
    - Momentum (rate of change in sector performance)

    Higher scores indicate stronger sectors.
    """

    def __init__(
        self,
        lookback_period: int = 20,
        leading_threshold: float = 65.0,
    ):
        """
        Initialize the sector analysis service.

        Args:
            lookback_period: Number of periods to analyze for returns (default: 20)
            leading_threshold: Score threshold to classify sector as leading (default: 65.0)

        Raises:
            ValueError: If parameters are invalid
        """
        if lookback_period <= 0:
            raise ValueError("lookback_period must be positive")
        if not 0 <= leading_threshold <= 100:
            raise ValueError("leading_threshold must be between 0 and 100")

        self.lookback_period = lookback_period
        self.leading_threshold = leading_threshold

    def get_sector(self, symbol: str) -> str:
        """
        Get the sector for a given stock symbol.

        Args:
            symbol: Stock symbol (e.g., "RELIANCE")

        Returns:
            Sector name (e.g., "ENERGY"), or "UNKNOWN" if not found
        """
        return NSE_SECTOR_MAPPING.get(symbol.upper(), "UNKNOWN")

    def calculate_stock_return(
        self,
        prices: List[float],
        period: Optional[int] = None,
    ) -> float:
        """
        Calculate the percentage return for a stock over a given period.

        Args:
            prices: List of prices (most recent last)
            period: Lookback period (default: uses self.lookback_period)

        Returns:
            Percentage return over the period

        Raises:
            ValueError: If insufficient price data
        """
        if not prices:
            raise ValueError("prices cannot be empty")

        if period is None:
            period = self.lookback_period

        if len(prices) < period + 1:
            raise ValueError(
                f"Insufficient price data: need at least {period + 1} prices, "
                f"got {len(prices)}"
            )

        start_price = prices[-(period + 1)]
        end_price = prices[-1]

        if start_price <= 0:
            raise ValueError("start_price must be positive")

        return ((end_price - start_price) / start_price) * 100.0

    def calculate_sector_strength_score(
        self,
        sector_return: float,
        market_return: float,
    ) -> float:
        """
        Calculate sector strength score (0-100) based on returns.

        The score is calculated as:
        1. Calculate relative performance: sector_return - market_return
        2. Normalize to 0-100 scale:
           - Relative performance of +10% or more = 100
           - Relative performance of -10% or less = 0
           - Linear interpolation in between
           - Base score of 50 when equal to market

        Args:
            sector_return: Sector's average return (percentage)
            market_return: Market benchmark return (percentage)

        Returns:
            Sector strength score (0-100)
        """
        # Calculate relative performance
        relative_performance = sector_return - market_return

        # Normalize to 0-100 scale
        # +10% relative = 100, -10% relative = 0, 0% relative = 50
        # This gives a range of -10% to +10% mapped to 0-100
        score = 50.0 + (relative_performance * 5.0)

        # Clamp to 0-100 range
        score = max(0.0, min(100.0, score))

        return score

    def analyze_stock_sector_performance(
        self,
        symbol: str,
        stock_prices: List[float],
        sector_stocks_prices: Dict[str, List[float]],
        market_prices: List[float],
    ) -> StockSectorPerformance:
        """
        Analyze a stock's performance relative to its sector.

        Args:
            symbol: Stock symbol
            stock_prices: List of stock prices (most recent last)
            sector_stocks_prices: Dictionary mapping sector stock symbols to their prices
            market_prices: List of market benchmark prices (e.g., NIFTY50)

        Returns:
            StockSectorPerformance with detailed analysis

        Raises:
            ValueError: If insufficient data or sector not found
        """
        # Get stock's sector
        sector = self.get_sector(symbol)

        if sector == "UNKNOWN":
            raise ValueError(f"Sector not found for symbol: {symbol}")

        # Calculate stock return
        stock_return = self.calculate_stock_return(stock_prices)

        # Calculate sector return (average of all stocks in sector)
        sector_returns = []
        for sec_symbol, sec_prices in sector_stocks_prices.items():
            if self.get_sector(sec_symbol) == sector:
                try:
                    sec_return = self.calculate_stock_return(sec_prices)
                    sector_returns.append(sec_return)
                except ValueError:
                    # Skip stocks with insufficient data
                    continue

        if not sector_returns:
            raise ValueError(f"No valid sector data found for sector: {sector}")

        sector_return = sum(sector_returns) / len(sector_returns)

        # Calculate market return
        market_return = self.calculate_stock_return(market_prices)

        # Calculate sector strength score
        sector_strength_score = self.calculate_sector_strength_score(
            sector_return, market_return
        )

        # Calculate relative strength
        relative_strength = stock_return - sector_return

        # Determine if outperforming sector
        outperforming_sector = relative_strength > 0

        return StockSectorPerformance(
            symbol=symbol,
            sector=sector,
            stock_return=round(stock_return, 2),
            sector_return=round(sector_return, 2),
            relative_strength=round(relative_strength, 2),
            sector_strength_score=round(sector_strength_score, 1),
            outperforming_sector=outperforming_sector,
        )

    def analyze_all_sectors(
        self,
        sector_stocks_prices: Dict[str, List[float]],
        market_prices: List[float],
    ) -> List[SectorStrengthResult]:
        """
        Analyze strength of all sectors and rank them.

        Args:
            sector_stocks_prices: Dictionary mapping stock symbols to their prices
            market_prices: List of market benchmark prices (e.g., NIFTY50)

        Returns:
            List of SectorStrengthResult sorted by strength (strongest first)

        Raises:
            ValueError: If insufficient data
        """
        # Group stocks by sector and calculate sector returns
        sector_returns_map: Dict[str, List[float]] = {}

        for symbol, prices in sector_stocks_prices.items():
            sector = self.get_sector(symbol)

            if sector == "UNKNOWN":
                continue

            try:
                stock_return = self.calculate_stock_return(prices)

                if sector not in sector_returns_map:
                    sector_returns_map[sector] = []

                sector_returns_map[sector].append(stock_return)
            except ValueError:
                # Skip stocks with insufficient data
                continue

        if not sector_returns_map:
            raise ValueError("No valid sector data found")

        # Calculate market return
        market_return = self.calculate_stock_return(market_prices)

        # Calculate sector strength scores
        sector_strengths = []

        for sector, returns in sector_returns_map.items():
            sector_return = sum(returns) / len(returns)
            relative_performance = sector_return - market_return

            strength_score = self.calculate_sector_strength_score(
                sector_return, market_return
            )

            is_leading = strength_score >= self.leading_threshold

            sector_strengths.append(
                {
                    "sector": sector,
                    "strength_score": strength_score,
                    "relative_performance": relative_performance,
                    "is_leading": is_leading,
                }
            )

        # Sort by strength score (descending)
        sector_strengths.sort(key=lambda x: x["strength_score"], reverse=True)

        # Add rank
        results = []
        for rank, sector_data in enumerate(sector_strengths, start=1):
            results.append(
                SectorStrengthResult(
                    sector=sector_data["sector"],
                    strength_score=round(sector_data["strength_score"], 1),
                    relative_performance=round(sector_data["relative_performance"], 2),
                    is_leading=sector_data["is_leading"],
                    rank=rank,
                )
            )

        return results

    def get_leading_sectors(
        self,
        sector_strengths: List[SectorStrengthResult],
    ) -> List[str]:
        """
        Get list of leading sector names.

        Args:
            sector_strengths: List of sector strength results

        Returns:
            List of sector names that are classified as leading
        """
        return [s.sector for s in sector_strengths if s.is_leading]

    def get_lagging_sectors(
        self,
        sector_strengths: List[SectorStrengthResult],
    ) -> List[str]:
        """
        Get list of lagging sector names.

        Args:
            sector_strengths: List of sector strength results

        Returns:
            List of sector names that are classified as lagging (not leading)
        """
        return [s.sector for s in sector_strengths if not s.is_leading]

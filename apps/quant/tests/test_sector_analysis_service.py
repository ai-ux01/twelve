"""
Unit tests for SectorAnalysisService.

Tests sector strength calculation, relative performance analysis, and sector ranking.

Requirements: 5.2
"""

import pytest
from services.sector_analysis_service import (
    SectorAnalysisService,
    SectorStrengthResult,
    StockSectorPerformance,
    NSE_SECTOR_MAPPING,
)


class TestSectorAnalysisService:
    """Test suite for SectorAnalysisService."""

    def test_initialization_valid_parameters(self):
        """Test service initialization with valid parameters."""
        service = SectorAnalysisService(lookback_period=20, leading_threshold=65.0)

        assert service.lookback_period == 20
        assert service.leading_threshold == 65.0

    def test_initialization_invalid_lookback(self):
        """Test initialization fails with invalid lookback period."""
        with pytest.raises(ValueError, match="lookback_period must be positive"):
            SectorAnalysisService(lookback_period=0)

        with pytest.raises(ValueError, match="lookback_period must be positive"):
            SectorAnalysisService(lookback_period=-5)

    def test_initialization_invalid_threshold(self):
        """Test initialization fails with invalid leading threshold."""
        with pytest.raises(
            ValueError, match="leading_threshold must be between 0 and 100"
        ):
            SectorAnalysisService(leading_threshold=-1)

        with pytest.raises(
            ValueError, match="leading_threshold must be between 0 and 100"
        ):
            SectorAnalysisService(leading_threshold=101)

    def test_get_sector_known_symbol(self):
        """Test getting sector for known stock symbols."""
        service = SectorAnalysisService()

        assert service.get_sector("RELIANCE") == "ENERGY"
        assert service.get_sector("HDFCBANK") == "BANKING"
        assert service.get_sector("TCS") == "IT"
        assert service.get_sector("MARUTI") == "AUTO"
        assert service.get_sector("SUNPHARMA") == "PHARMA"

    def test_get_sector_unknown_symbol(self):
        """Test getting sector for unknown stock symbol returns UNKNOWN."""
        service = SectorAnalysisService()

        assert service.get_sector("UNKNOWN_STOCK") == "UNKNOWN"
        assert service.get_sector("FAKE_SYMBOL") == "UNKNOWN"

    def test_get_sector_case_insensitive(self):
        """Test that sector lookup is case-insensitive."""
        service = SectorAnalysisService()

        assert service.get_sector("reliance") == "ENERGY"
        assert service.get_sector("Reliance") == "ENERGY"
        assert service.get_sector("RELIANCE") == "ENERGY"

    def test_calculate_stock_return_simple(self):
        """Test basic stock return calculation."""
        service = SectorAnalysisService(lookback_period=5)

        # Price increases from 100 to 110 = 10% return
        prices = [100, 102, 105, 107, 108, 110]

        result = service.calculate_stock_return(prices)

        assert result == pytest.approx(10.0, rel=1e-6)

    def test_calculate_stock_return_negative(self):
        """Test stock return calculation with negative returns."""
        service = SectorAnalysisService(lookback_period=5)

        # Price decreases from 100 to 90 = -10% return
        prices = [100, 98, 95, 93, 92, 90]

        result = service.calculate_stock_return(prices)

        assert result == pytest.approx(-10.0, rel=1e-6)

    def test_calculate_stock_return_custom_period(self):
        """Test stock return calculation with custom period."""
        service = SectorAnalysisService(lookback_period=5)

        prices = [100, 110, 120, 130, 140, 150]

        # Use period of 3 instead of default 5
        result = service.calculate_stock_return(prices, period=3)

        # Return from 120 to 150 = 25%
        assert result == pytest.approx(25.0, rel=1e-6)

    def test_calculate_stock_return_insufficient_data(self):
        """Test that insufficient data raises error."""
        service = SectorAnalysisService(lookback_period=20)

        prices = [100, 105, 110]  # Only 3 prices, need 21

        with pytest.raises(ValueError, match="Insufficient price data"):
            service.calculate_stock_return(prices)

    def test_calculate_stock_return_empty_prices(self):
        """Test that empty prices list raises error."""
        service = SectorAnalysisService()

        with pytest.raises(ValueError, match="prices cannot be empty"):
            service.calculate_stock_return([])

    def test_calculate_stock_return_zero_start_price(self):
        """Test that zero start price raises error."""
        service = SectorAnalysisService(lookback_period=2)

        prices = [0, 10, 20]

        with pytest.raises(ValueError, match="start_price must be positive"):
            service.calculate_stock_return(prices)

    def test_calculate_sector_strength_score_equal_to_market(self):
        """Test sector strength score when equal to market."""
        service = SectorAnalysisService()

        # Sector return equals market return = score of 50
        score = service.calculate_sector_strength_score(5.0, 5.0)

        assert score == pytest.approx(50.0, rel=1e-6)

    def test_calculate_sector_strength_score_outperforming(self):
        """Test sector strength score when outperforming market."""
        service = SectorAnalysisService()

        # Sector return 10% above market = +5 points per % = +50 points = 100
        score = service.calculate_sector_strength_score(15.0, 5.0)

        assert score == pytest.approx(100.0, rel=1e-6)

    def test_calculate_sector_strength_score_underperforming(self):
        """Test sector strength score when underperforming market."""
        service = SectorAnalysisService()

        # Sector return 10% below market = -5 points per % = -50 points = 0
        score = service.calculate_sector_strength_score(-5.0, 5.0)

        assert score == pytest.approx(0.0, rel=1e-6)

    def test_calculate_sector_strength_score_moderate_outperformance(self):
        """Test sector strength score with moderate outperformance."""
        service = SectorAnalysisService()

        # Sector return 2% above market = +2 * 5 = +10 points = 60
        score = service.calculate_sector_strength_score(7.0, 5.0)

        assert score == pytest.approx(60.0, rel=1e-6)

    def test_calculate_sector_strength_score_clamping_high(self):
        """Test that sector strength score is clamped at 100."""
        service = SectorAnalysisService()

        # Extreme outperformance should clamp at 100
        score = service.calculate_sector_strength_score(50.0, 5.0)

        assert score == 100.0

    def test_calculate_sector_strength_score_clamping_low(self):
        """Test that sector strength score is clamped at 0."""
        service = SectorAnalysisService()

        # Extreme underperformance should clamp at 0
        score = service.calculate_sector_strength_score(-50.0, 5.0)

        assert score == 0.0

    def test_analyze_stock_sector_performance_outperforming(self):
        """Test analyzing stock that outperforms its sector."""
        service = SectorAnalysisService(lookback_period=5)

        # Stock prices: 100 -> 120 = 20% return
        stock_prices = [100, 105, 110, 115, 118, 120]

        # Sector stocks (ENERGY sector)
        sector_stocks = {
            "RELIANCE": stock_prices,  # Same as target stock
            "ONGC": [100, 102, 104, 106, 108, 110],  # 10% return
            "BPCL": [100, 103, 106, 109, 112, 115],  # 15% return
        }
        # Sector average: (20 + 10 + 15) / 3 = 15%

        # Market prices: 100 -> 112 = 12% return
        market_prices = [100, 102, 105, 108, 110, 112]

        result = service.analyze_stock_sector_performance(
            "RELIANCE", stock_prices, sector_stocks, market_prices
        )

        assert result.symbol == "RELIANCE"
        assert result.sector == "ENERGY"
        assert result.stock_return == pytest.approx(20.0, rel=1e-1)
        assert result.sector_return == pytest.approx(15.0, rel=1e-1)
        assert result.relative_strength == pytest.approx(5.0, rel=1e-1)
        assert result.outperforming_sector is True
        # Sector return 15%, market return 12%, relative +3% = 50 + (3 * 5) = 65
        assert result.sector_strength_score == pytest.approx(65.0, rel=1.0)

    def test_analyze_stock_sector_performance_underperforming(self):
        """Test analyzing stock that underperforms its sector."""
        service = SectorAnalysisService(lookback_period=5)

        # Stock prices: 100 -> 105 = 5% return
        stock_prices = [100, 101, 102, 103, 104, 105]

        # Sector stocks (IT sector)
        sector_stocks = {
            "TCS": stock_prices,
            "INFY": [100, 105, 110, 115, 118, 120],  # 20% return
            "WIPRO": [100, 103, 107, 111, 114, 117],  # 17% return
        }
        # Sector average: (5 + 20 + 17) / 3 = 14%

        # Market prices: 100 -> 110 = 10% return
        market_prices = [100, 102, 104, 106, 108, 110]

        result = service.analyze_stock_sector_performance(
            "TCS", stock_prices, sector_stocks, market_prices
        )

        assert result.symbol == "TCS"
        assert result.sector == "IT"
        assert result.stock_return == pytest.approx(5.0, rel=1e-1)
        assert result.sector_return == pytest.approx(14.0, rel=1e-1)
        assert result.relative_strength == pytest.approx(-9.0, rel=1e-1)
        assert result.outperforming_sector is False

    def test_analyze_stock_sector_performance_unknown_sector(self):
        """Test that unknown sector raises error."""
        service = SectorAnalysisService(lookback_period=5)

        stock_prices = [100, 105, 110, 115, 120, 125]
        sector_stocks = {}
        market_prices = [100, 102, 104, 106, 108, 110]

        with pytest.raises(ValueError, match="Sector not found"):
            service.analyze_stock_sector_performance(
                "UNKNOWN_STOCK", stock_prices, sector_stocks, market_prices
            )

    def test_analyze_stock_sector_performance_no_sector_data(self):
        """Test that missing sector data raises error."""
        service = SectorAnalysisService(lookback_period=5)

        stock_prices = [100, 105, 110, 115, 120, 125]
        sector_stocks = {
            "HDFCBANK": [100, 105, 110, 115, 120, 125],  # Banking sector
        }
        market_prices = [100, 102, 104, 106, 108, 110]

        # RELIANCE is ENERGY sector, but no ENERGY stocks in sector_stocks
        with pytest.raises(ValueError, match="No valid sector data found"):
            service.analyze_stock_sector_performance(
                "RELIANCE", stock_prices, sector_stocks, market_prices
            )

    def test_analyze_all_sectors(self):
        """Test analyzing all sectors and ranking them."""
        service = SectorAnalysisService(lookback_period=5, leading_threshold=60.0)

        # Sector stocks with varying performance
        sector_stocks = {
            # IT sector: avg 15% return
            "TCS": [100, 105, 110, 113, 116, 120],  # 20%
            "INFY": [100, 103, 106, 108, 109, 110],  # 10%
            # BANKING sector: avg 10% return
            "HDFCBANK": [100, 102, 105, 107, 109, 110],  # 10%
            "ICICIBANK": [100, 103, 106, 108, 109, 110],  # 10%
            # ENERGY sector: avg 5% return
            "RELIANCE": [100, 101, 102, 103, 104, 105],  # 5%
            "ONGC": [100, 101, 102, 103, 104, 105],  # 5%
        }

        # Market: 100 -> 110 = 10% return
        market_prices = [100, 102, 104, 106, 108, 110]

        results = service.analyze_all_sectors(sector_stocks, market_prices)

        # Should have 3 sectors
        assert len(results) == 3

        # Results should be sorted by strength (IT > BANKING > ENERGY)
        assert results[0].sector == "IT"
        assert results[1].sector == "BANKING"
        assert results[2].sector == "ENERGY"

        # Ranks should be 1, 2, 3
        assert results[0].rank == 1
        assert results[1].rank == 2
        assert results[2].rank == 3

        # IT sector: 15% vs market 10% = +5% relative = 50 + (5*5) = 75 (leading)
        assert results[0].strength_score == pytest.approx(75.0, rel=1.0)
        assert results[0].relative_performance == pytest.approx(5.0, rel=1e-1)
        assert results[0].is_leading is True

        # BANKING sector: 10% vs market 10% = 0% relative = 50 (not leading)
        assert results[1].strength_score == pytest.approx(50.0, rel=1.0)
        assert results[1].relative_performance == pytest.approx(0.0, rel=1e-1)
        assert results[1].is_leading is False

        # ENERGY sector: 5% vs market 10% = -5% relative = 50 + (-5*5) = 25 (not leading)
        assert results[2].strength_score == pytest.approx(25.0, rel=1.0)
        assert results[2].relative_performance == pytest.approx(-5.0, rel=1e-1)
        assert results[2].is_leading is False

    def test_analyze_all_sectors_empty_data(self):
        """Test that empty sector data raises error."""
        service = SectorAnalysisService(lookback_period=5)

        sector_stocks = {}
        market_prices = [100, 102, 104, 106, 108, 110]

        with pytest.raises(ValueError, match="No valid sector data found"):
            service.analyze_all_sectors(sector_stocks, market_prices)

    def test_get_leading_sectors(self):
        """Test getting list of leading sectors."""
        service = SectorAnalysisService(leading_threshold=60.0)

        sector_strengths = [
            SectorStrengthResult(
                sector="IT",
                strength_score=75.0,
                relative_performance=5.0,
                is_leading=True,
                rank=1,
            ),
            SectorStrengthResult(
                sector="BANKING",
                strength_score=65.0,
                relative_performance=3.0,
                is_leading=True,
                rank=2,
            ),
            SectorStrengthResult(
                sector="ENERGY",
                strength_score=45.0,
                relative_performance=-1.0,
                is_leading=False,
                rank=3,
            ),
        ]

        leading = service.get_leading_sectors(sector_strengths)

        assert len(leading) == 2
        assert "IT" in leading
        assert "BANKING" in leading
        assert "ENERGY" not in leading

    def test_get_lagging_sectors(self):
        """Test getting list of lagging sectors."""
        service = SectorAnalysisService(leading_threshold=60.0)

        sector_strengths = [
            SectorStrengthResult(
                sector="IT",
                strength_score=75.0,
                relative_performance=5.0,
                is_leading=True,
                rank=1,
            ),
            SectorStrengthResult(
                sector="BANKING",
                strength_score=50.0,
                relative_performance=0.0,
                is_leading=False,
                rank=2,
            ),
            SectorStrengthResult(
                sector="ENERGY",
                strength_score=30.0,
                relative_performance=-4.0,
                is_leading=False,
                rank=3,
            ),
        ]

        lagging = service.get_lagging_sectors(sector_strengths)

        assert len(lagging) == 2
        assert "BANKING" in lagging
        assert "ENERGY" in lagging
        assert "IT" not in lagging

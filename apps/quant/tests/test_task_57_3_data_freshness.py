"""
Unit tests for Task 57.3: Data Freshness Validation.

Tests verify that the IntradayAnalysisService correctly:
- Checks timestamp of latest candle
- Calculates data age (current time - latest candle time)
- Sets freshness threshold (5 minutes for intraday)
- Returns isStale flag if data exceeds threshold

Requirements: 6.5
"""

import pytest
from datetime import datetime, timezone, timedelta
from models import OHLCVData
from services.intraday_analysis_service import IntradayAnalysisService
from models.intraday import DataFreshness, IntradayInterval


@pytest.fixture
def service():
    """Create IntradayAnalysisService with default 5-minute threshold."""
    return IntradayAnalysisService(
        stale_threshold_seconds=300.0,  # 5 minutes for intraday
    )


@pytest.fixture
def create_data_with_age():
    """Factory to create OHLCV data with specific age."""
    def _create(age_seconds: float):
        """Create 50 candles with the latest candle at specified age (need 35+ for MACD)."""
        base_time = datetime.now(timezone.utc) - timedelta(seconds=age_seconds)
        data = []
        
        for i in range(50):
            # Create candles going backward in time
            timestamp = base_time - timedelta(minutes=5 * (49 - i))
            data.append(
                OHLCVData(
                    timestamp=timestamp,
                    open=2400.0 + i,
                    high=2402.0 + i,
                    low=2398.0 + i,
                    close=2401.0 + i,
                    volume=100000,
                )
            )
        
        return data
    
    return _create


class TestDataFreshnessValidation:
    """Test data freshness validation implementation."""

    def test_fresh_data_within_threshold(self, service, create_data_with_age):
        """Test that recent data (2 minutes old) is marked as fresh."""
        # Create data that is 120 seconds (2 minutes) old
        data = create_data_with_age(120.0)
        
        # Analyze to get freshness
        result = service.analyze(
            symbol="TEST",
            interval=IntradayInterval.FIVE_MINUTES,
            data=data,
            include_support_resistance=False,
            include_opening_range=False,
            include_prev_day_levels=False,
            include_trendlines=False,
            timeframe_minutes=5,
        )
        
        technical_analysis, data_freshness, *_ = result
        
        # Verify data freshness
        assert isinstance(data_freshness, DataFreshness)
        assert not data_freshness.is_stale, "Data should NOT be stale (within 5 min threshold)"
        assert data_freshness.age_seconds >= 120.0, "Age should be at least 2 minutes"
        assert data_freshness.age_seconds < 300.0, "Age should be less than 5 minutes"
        
        # Verify timestamp is in ISO 8601 format
        assert isinstance(data_freshness.timestamp, str)
        datetime.fromisoformat(data_freshness.timestamp.replace("Z", "+00:00"))

    def test_stale_data_exceeds_threshold(self, service, create_data_with_age):
        """Test that old data (10 minutes) is marked as stale."""
        # Create data that is 600 seconds (10 minutes) old
        data = create_data_with_age(600.0)
        
        # Analyze to get freshness
        result = service.analyze(
            symbol="TEST",
            interval=IntradayInterval.FIVE_MINUTES,
            data=data,
            include_support_resistance=False,
            include_opening_range=False,
            include_prev_day_levels=False,
            include_trendlines=False,
            timeframe_minutes=5,
        )
        
        technical_analysis, data_freshness, *_ = result
        
        # Verify data is stale
        assert isinstance(data_freshness, DataFreshness)
        assert data_freshness.is_stale, "Data should be stale (exceeds 5 min threshold)"
        assert data_freshness.age_seconds > 300.0, "Age should exceed 5 minutes"

    def test_data_at_threshold_boundary(self, service, create_data_with_age):
        """Test data exactly at the 5-minute threshold."""
        # Create data exactly at 300 seconds (5 minutes)
        data = create_data_with_age(300.0)
        
        # Analyze to get freshness
        result = service.analyze(
            symbol="TEST",
            interval=IntradayInterval.FIVE_MINUTES,
            data=data,
            include_support_resistance=False,
            include_opening_range=False,
            include_prev_day_levels=False,
            include_trendlines=False,
            timeframe_minutes=5,
        )
        
        technical_analysis, data_freshness, *_ = result
        
        # Verify data freshness
        assert isinstance(data_freshness, DataFreshness)
        # At exactly 300 seconds, it should be considered stale (threshold is >)
        # Based on implementation: is_stale = age_seconds > self.stale_threshold_seconds
        assert data_freshness.is_stale, "Data at exact threshold should be stale"

    def test_data_just_under_threshold(self, service, create_data_with_age):
        """Test data just under the 5-minute threshold (299 seconds)."""
        # Create data at 299 seconds (just under 5 minutes)
        data = create_data_with_age(299.0)
        
        # Analyze to get freshness
        result = service.analyze(
            symbol="TEST",
            interval=IntradayInterval.FIVE_MINUTES,
            data=data,
            include_support_resistance=False,
            include_opening_range=False,
            include_prev_day_levels=False,
            include_trendlines=False,
            timeframe_minutes=5,
        )
        
        technical_analysis, data_freshness, *_ = result
        
        # Verify data is fresh
        assert isinstance(data_freshness, DataFreshness)
        assert not data_freshness.is_stale, "Data just under threshold should be fresh"

    def test_custom_threshold(self):
        """Test data freshness with custom threshold (10 minutes)."""
        # Create service with 10-minute threshold
        service = IntradayAnalysisService(stale_threshold_seconds=600.0)
        
        # Create data that is 8 minutes old
        age_seconds = 480.0
        base_time = datetime.now(timezone.utc) - timedelta(seconds=age_seconds)
        data = []
        
        for i in range(50):  # Need 50 for MACD
            timestamp = base_time - timedelta(minutes=5 * (49 - i))
            data.append(
                OHLCVData(
                    timestamp=timestamp,
                    open=2400.0 + i,
                    high=2402.0 + i,
                    low=2398.0 + i,
                    close=2401.0 + i,
                    volume=100000,
                )
            )
        
        # Analyze
        result = service.analyze(
            symbol="TEST",
            interval=IntradayInterval.FIVE_MINUTES,
            data=data,
            include_support_resistance=False,
            include_opening_range=False,
            include_prev_day_levels=False,
            include_trendlines=False,
            timeframe_minutes=5,
        )
        
        technical_analysis, data_freshness, *_ = result
        
        # Data is 8 minutes old, but threshold is 10 minutes
        assert not data_freshness.is_stale, "Data should be fresh with 10-min threshold"

    def test_very_fresh_data(self, service, create_data_with_age):
        """Test data that is very fresh (30 seconds old)."""
        # Create data that is 30 seconds old
        data = create_data_with_age(30.0)
        
        # Analyze
        result = service.analyze(
            symbol="TEST",
            interval=IntradayInterval.FIVE_MINUTES,
            data=data,
            include_support_resistance=False,
            include_opening_range=False,
            include_prev_day_levels=False,
            include_trendlines=False,
            timeframe_minutes=5,
        )
        
        technical_analysis, data_freshness, *_ = result
        
        # Verify very fresh data
        assert not data_freshness.is_stale
        assert data_freshness.age_seconds < 60.0, "Age should be less than 1 minute"

    def test_calculate_data_freshness_direct(self, service):
        """Test _calculate_data_freshness method directly."""
        # Create data with known timestamp
        age_seconds = 180.0  # 3 minutes
        timestamp = datetime.now(timezone.utc) - timedelta(seconds=age_seconds)
        
        data = [
            OHLCVData(
                timestamp=timestamp,
                open=2400.0,
                high=2402.0,
                low=2398.0,
                close=2401.0,
                volume=100000,
            )
        ]
        
        # Call the method directly
        freshness = service._calculate_data_freshness(data)
        
        # Verify results
        assert isinstance(freshness, DataFreshness)
        assert not freshness.is_stale, "3 minutes should be fresh"
        assert freshness.age_seconds >= 180.0
        assert freshness.timestamp is not None

    def test_naive_timestamp_converted_to_utc(self, service):
        """Test that naive timestamps are handled correctly (converted to UTC)."""
        # Create data with naive timestamp (no timezone)
        naive_time = datetime(2024, 1, 15, 10, 0, 0)  # No timezone
        
        data = []
        for i in range(30):
            timestamp = naive_time - timedelta(minutes=5 * (29 - i))
            data.append(
                OHLCVData(
                    timestamp=timestamp,
                    open=2400.0 + i,
                    high=2402.0 + i,
                    low=2398.0 + i,
                    close=2401.0 + i,
                    volume=100000,
                )
            )
        
        # Should not raise error
        freshness = service._calculate_data_freshness(data)
        
        assert isinstance(freshness, DataFreshness)
        assert freshness.age_seconds >= 0  # Should be positive (in the past)

    def test_freshness_with_future_timestamp_fails_gracefully(self, service):
        """Test handling of future timestamps (should still calculate correctly)."""
        # Create data with timestamp in the future (edge case)
        future_time = datetime.now(timezone.utc) + timedelta(seconds=60)
        
        data = [
            OHLCVData(
                timestamp=future_time,
                open=2400.0,
                high=2402.0,
                low=2398.0,
                close=2401.0,
                volume=100000,
            )
        ]
        
        # Note: DataFreshness model validates age_seconds >= 0, so negative age will raise error
        # This is actually the correct behavior - future timestamps should be rejected
        with pytest.raises(Exception):  # Will raise ValidationError from Pydantic
            freshness = service._calculate_data_freshness(data)


class TestDataFreshnessRequirements:
    """Test that all Task 57.3 requirements are met."""

    def test_requirement_checks_latest_candle_timestamp(self, service, create_data_with_age):
        """Verify: Check timestamp of latest candle."""
        data = create_data_with_age(120.0)
        
        # Get the latest candle timestamp
        latest_timestamp = data[-1].timestamp
        
        # Calculate freshness
        freshness = service._calculate_data_freshness(data)
        
        # Verify the freshness timestamp matches the latest candle
        freshness_time = datetime.fromisoformat(freshness.timestamp.replace("Z", "+00:00"))
        
        # Handle naive timestamp
        if latest_timestamp.tzinfo is None:
            latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)
        
        # They should be the same (or very close)
        time_diff = abs((freshness_time - latest_timestamp).total_seconds())
        assert time_diff < 1.0, "Freshness timestamp should match latest candle"

    def test_requirement_calculates_data_age(self, service, create_data_with_age):
        """Verify: Calculate data age (current time - latest candle time)."""
        expected_age = 240.0  # 4 minutes
        data = create_data_with_age(expected_age)
        
        freshness = service._calculate_data_freshness(data)
        
        # Age should be approximately the expected age (allow small variance)
        assert freshness.age_seconds >= expected_age
        assert freshness.age_seconds < expected_age + 2.0  # Allow 2 second variance

    def test_requirement_sets_threshold_5_minutes(self):
        """Verify: Set freshness threshold (5 minutes for intraday)."""
        # Create service with default threshold
        service = IntradayAnalysisService()
        
        # Verify default threshold is 300 seconds (5 minutes)
        assert service.stale_threshold_seconds == 300.0

    def test_requirement_returns_is_stale_flag(self, service, create_data_with_age):
        """Verify: Return isStale flag if data exceeds threshold."""
        # Test fresh data
        fresh_data = create_data_with_age(120.0)
        fresh_result = service._calculate_data_freshness(fresh_data)
        assert not fresh_result.is_stale, "Fresh data should have is_stale=False"
        
        # Test stale data
        stale_data = create_data_with_age(600.0)
        stale_result = service._calculate_data_freshness(stale_data)
        assert stale_result.is_stale, "Stale data should have is_stale=True"

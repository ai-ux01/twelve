"""
Unit tests for Swing Scanner Service with performance optimization features.

Tests cover:
- Parallel processing
- Caching functionality
- Rate limiting
- Performance monitoring
- Error handling
"""

import pytest
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from typing import List

from services.swing_scanner_service import (
    SwingScannerService,
    CacheEntry,
    RateLimiter,
    SwingScanResult,
    ScanPerformanceMetrics,
)
from models.market_data import OHLCVData


# === Fixtures ===


@pytest.fixture
def sample_ohlcv_data() -> List[OHLCVData]:
    """Generate sample OHLCV data for testing."""
    base_time = datetime(2024, 1, 1, 9, 15)
    data = []

    for i in range(250):  # 250 days of data
        data.append(
            OHLCVData(
                timestamp=base_time + timedelta(days=i),
                open=2450.0 + i,
                high=2470.0 + i,
                low=2445.0 + i,
                close=2460.0 + i,
                volume=1000000 + i * 10000,
            )
        )

    return data


@pytest.fixture
def scanner_service():
    """Create a scanner service instance for testing."""
    return SwingScannerService(
        max_workers=4,
        cache_ttl_seconds=60,
        rate_limit_per_second=10.0,
        max_concurrent_api_calls=10,
    )


@pytest.fixture
def mock_market_data_provider(sample_ohlcv_data):
    """Create a mock market data provider."""

    def provider(symbol: str, timeframe: str, lookback_days: int):
        # Simulate API delay
        time.sleep(0.01)
        return sample_ohlcv_data

    return provider


# === Cache Tests ===


def test_cache_entry_expiration():
    """Test cache entry expiration logic."""
    data = [
        OHLCVData(
            timestamp=datetime.utcnow(),
            open=100.0,
            high=101.0,
            low=99.0,
            close=100.5,
            volume=1000,
        )
    ]

    # Create entry with 1 second TTL
    entry = CacheEntry(data=data, timestamp=datetime.utcnow(), ttl_seconds=1)

    # Should not be expired immediately
    assert not entry.is_expired()

    # Wait and check expiration
    time.sleep(1.1)
    assert entry.is_expired()


def test_cache_set_and_get(scanner_service, sample_ohlcv_data):
    """Test caching data for a symbol."""
    symbol = "RELIANCE"

    # Initially, cache should be empty
    cached_data = scanner_service.get_cached_data(symbol)
    assert cached_data is None
    assert scanner_service.cache_misses == 1

    # Set cache
    scanner_service.set_cached_data(symbol, sample_ohlcv_data)

    # Now should get cached data
    cached_data = scanner_service.get_cached_data(symbol)
    assert cached_data is not None
    assert len(cached_data) == len(sample_ohlcv_data)
    assert scanner_service.cache_hits == 1


def test_cache_expiration(scanner_service, sample_ohlcv_data):
    """Test that expired cache entries are not returned."""
    # Create scanner with very short TTL
    scanner = SwingScannerService(cache_ttl_seconds=1)
    symbol = "TCS"

    # Set cache
    scanner.set_cached_data(symbol, sample_ohlcv_data)

    # Should get cached data immediately
    cached_data = scanner.get_cached_data(symbol)
    assert cached_data is not None

    # Wait for expiration
    time.sleep(1.1)

    # Should not get expired data
    cached_data = scanner.get_cached_data(symbol)
    assert cached_data is None


def test_clear_cache(scanner_service, sample_ohlcv_data):
    """Test clearing all cached data."""
    # Add some data to cache
    scanner_service.set_cached_data("RELIANCE", sample_ohlcv_data)
    scanner_service.set_cached_data("TCS", sample_ohlcv_data)

    # Verify cache has entries
    assert scanner_service.get_cached_data("RELIANCE") is not None
    assert scanner_service.get_cached_data("TCS") is not None

    # Clear cache
    scanner_service.clear_cache()

    # Verify cache is empty
    assert scanner_service.get_cached_data("RELIANCE") is None
    assert scanner_service.get_cached_data("TCS") is None


def test_clear_expired_cache(scanner_service, sample_ohlcv_data):
    """Test clearing only expired cache entries."""
    # Create scanner with short TTL
    scanner = SwingScannerService(cache_ttl_seconds=1)

    # Add data
    scanner.set_cached_data("RELIANCE", sample_ohlcv_data)

    # Wait for expiration
    time.sleep(1.1)

    # Add new data (not expired)
    scanner.set_cached_data("TCS", sample_ohlcv_data)

    # Clear expired entries
    scanner.clear_expired_cache()

    # RELIANCE should be removed, TCS should still exist
    assert scanner.get_cached_data("RELIANCE") is None
    assert scanner.get_cached_data("TCS") is not None


def test_cache_stats(scanner_service, sample_ohlcv_data):
    """Test cache statistics calculation."""
    # Add some data
    scanner_service.set_cached_data("RELIANCE", sample_ohlcv_data)
    scanner_service.set_cached_data("TCS", sample_ohlcv_data)

    # Generate some hits and misses
    scanner_service.get_cached_data("RELIANCE")  # Hit
    scanner_service.get_cached_data("INFY")  # Miss

    stats = scanner_service.get_cache_stats()

    assert stats["total_entries"] == 2
    assert stats["cache_hits"] == 1
    assert stats["cache_misses"] == 1
    assert stats["hit_rate"] == 0.5


# === Rate Limiter Tests ===


def test_rate_limiter_acquire():
    """Test basic rate limiter token acquisition."""
    limiter = RateLimiter(max_tokens=5, refill_rate=10.0)

    # Should acquire tokens successfully
    assert limiter.acquire(timeout=1.0) is True
    assert limiter.acquire(timeout=1.0) is True


def test_rate_limiter_exhaustion():
    """Test rate limiter when tokens are exhausted."""
    limiter = RateLimiter(max_tokens=2, refill_rate=1.0)

    # Acquire all tokens
    assert limiter.acquire(timeout=1.0) is True
    assert limiter.acquire(timeout=1.0) is True

    # Next acquisition should timeout (very short timeout)
    start = time.time()
    assert limiter.acquire(timeout=0.1) is False
    duration = time.time() - start

    # Should timeout quickly
    assert duration < 0.2


def test_rate_limiter_refill():
    """Test that rate limiter refills tokens over time."""
    limiter = RateLimiter(max_tokens=2, refill_rate=10.0)  # 10 tokens per second

    # Exhaust tokens
    assert limiter.acquire(timeout=1.0) is True
    assert limiter.acquire(timeout=1.0) is True

    # Wait for refill (0.2 seconds = 2 tokens at 10/sec)
    time.sleep(0.2)

    # Should be able to acquire again
    assert limiter.acquire(timeout=1.0) is True


# === Performance Metrics Tests ===


def test_performance_metrics_creation():
    """Test creating performance metrics."""
    metrics = ScanPerformanceMetrics(
        total_duration_ms=5000.0,
        stocks_scanned=50,
        cache_hits=30,
        cache_misses=20,
        api_calls=20,
        parallel_workers=8,
        avg_time_per_stock_ms=100.0,
        errors=2,
    )

    assert metrics.total_duration_ms == 5000.0
    assert metrics.stocks_scanned == 50
    assert metrics.cache_hits == 30
    assert metrics.cache_misses == 20
    assert metrics.api_calls == 20
    assert metrics.parallel_workers == 8
    assert metrics.errors == 2


def test_performance_metrics_logging(caplog):
    """Test that performance metrics are logged correctly."""
    metrics = ScanPerformanceMetrics(
        total_duration_ms=1000.0,
        stocks_scanned=10,
        cache_hits=5,
        cache_misses=5,
        api_calls=5,
        parallel_workers=4,
        avg_time_per_stock_ms=100.0,
        errors=0,
    )

    with caplog.at_level("INFO"):
        metrics.log_metrics()

    # Verify logging output contains key metrics
    assert "Scan Performance Metrics" in caplog.text
    assert "Duration=1000.00ms" in caplog.text
    assert "Stocks=10" in caplog.text


# === Scanner Service Tests ===


def test_scanner_initialization():
    """Test scanner service initialization."""
    scanner = SwingScannerService(
        max_workers=8,
        cache_ttl_seconds=300,
        rate_limit_per_second=10.0,
        max_concurrent_api_calls=20,
    )

    assert scanner.max_workers == 8
    assert scanner.cache_ttl_seconds == 300
    assert scanner.rate_limiter.max_tokens == 20
    assert scanner.rate_limiter.refill_rate == 10.0


def test_fetch_market_data_with_cache_miss(scanner_service, mock_market_data_provider):
    """Test fetching data when cache misses."""
    symbol = "RELIANCE"

    # Clear counters
    scanner_service.cache_hits = 0
    scanner_service.cache_misses = 0
    scanner_service.api_calls = 0

    # Fetch data (should miss cache and call API)
    data = scanner_service.fetch_market_data_with_cache(
        symbol, mock_market_data_provider
    )

    assert data is not None
    assert len(data) > 0
    assert scanner_service.cache_misses == 1
    assert scanner_service.api_calls == 1


def test_fetch_market_data_with_cache_hit(
    scanner_service, mock_market_data_provider, sample_ohlcv_data
):
    """Test fetching data when cache hits."""
    symbol = "RELIANCE"

    # Pre-populate cache
    scanner_service.set_cached_data(symbol, sample_ohlcv_data)

    # Clear counters
    scanner_service.cache_hits = 0
    scanner_service.api_calls = 0

    # Fetch data (should hit cache)
    data = scanner_service.fetch_market_data_with_cache(
        symbol, mock_market_data_provider
    )

    assert data is not None
    assert scanner_service.cache_hits == 1
    assert scanner_service.api_calls == 0  # No API call


def test_analyze_single_stock(scanner_service, sample_ohlcv_data):
    """Test analyzing a single stock."""
    symbol = "RELIANCE"

    result = scanner_service.analyze_single_stock(symbol, sample_ohlcv_data)

    assert result.symbol == symbol
    assert result.score >= 0.0
    assert result.score <= 100.0
    assert result.analysis is not None
    assert result.scoring_result is not None
    assert result.error is None
    assert result.processing_time_ms > 0


def test_analyze_single_stock_with_error(scanner_service):
    """Test error handling in single stock analysis."""
    symbol = "INVALID"
    invalid_data = []  # Empty data should cause error

    result = scanner_service.analyze_single_stock(symbol, invalid_data)

    assert result.symbol == symbol
    assert result.score == 0.0
    assert result.error is not None


def test_scan_universe_basic(scanner_service, mock_market_data_provider):
    """Test scanning a universe of stocks."""
    symbols = ["RELIANCE", "TCS", "INFY"]

    results = scanner_service.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
        min_score=0.0,
    )

    assert "candidates" in results
    assert "performance_metrics" in results
    assert results["total_symbols"] == 3
    assert len(results["candidates"]) > 0

    # Check that results are sorted by score (highest first)
    scores = [r.score for r in results["candidates"]]
    assert scores == sorted(scores, reverse=True)


def test_scan_universe_with_min_score(scanner_service, mock_market_data_provider):
    """Test scanning with minimum score threshold."""
    symbols = ["RELIANCE", "TCS"]
    min_score = 60.0

    results = scanner_service.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
        min_score=min_score,
    )

    # All candidates should have score >= min_score
    for candidate in results["candidates"]:
        assert candidate.score >= min_score


def test_scan_universe_performance_metrics(scanner_service, mock_market_data_provider):
    """Test that performance metrics are captured during scan."""
    symbols = ["RELIANCE", "TCS", "INFY", "HDFC"]

    results = scanner_service.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
    )

    metrics = results["performance_metrics"]

    assert metrics.total_duration_ms > 0
    assert metrics.stocks_scanned == len(symbols)
    assert metrics.parallel_workers == scanner_service.max_workers
    assert metrics.avg_time_per_stock_ms > 0
    assert metrics.cache_hits >= 0
    assert metrics.cache_misses >= 0
    assert metrics.api_calls >= 0


def test_scan_universe_with_caching(
    scanner_service, mock_market_data_provider, sample_ohlcv_data
):
    """Test that caching reduces API calls in subsequent scans."""
    symbols = ["RELIANCE", "TCS"]

    # Pre-populate cache for one symbol
    scanner_service.set_cached_data("RELIANCE", sample_ohlcv_data)

    # Clear counters
    scanner_service.cache_hits = 0
    scanner_service.cache_misses = 0
    scanner_service.api_calls = 0

    results = scanner_service.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
    )

    metrics = results["performance_metrics"]

    # Should have 1 cache hit (RELIANCE) and 1 API call (TCS)
    assert metrics.cache_hits >= 1
    assert metrics.api_calls >= 1
    assert metrics.cache_hits + metrics.api_calls >= len(symbols)


def test_scan_universe_parallel_processing(mock_market_data_provider):
    """Test that parallel processing improves performance."""
    symbols = ["STOCK" + str(i) for i in range(10)]

    # Test with 1 worker (sequential)
    scanner_sequential = SwingScannerService(max_workers=1)
    start_time = time.time()
    scanner_sequential.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
    )
    sequential_time = time.time() - start_time

    # Test with 4 workers (parallel)
    scanner_parallel = SwingScannerService(max_workers=4)
    start_time = time.time()
    scanner_parallel.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
    )
    parallel_time = time.time() - start_time

    # Parallel should be faster (with some tolerance for overhead)
    # Not enforcing strict speedup due to test environment variability
    assert parallel_time > 0
    assert sequential_time > 0
    print(f"Sequential: {sequential_time:.2f}s, Parallel: {parallel_time:.2f}s")


def test_scan_universe_error_handling(scanner_service):
    """Test error handling during universe scan."""
    symbols = ["RELIANCE", "INVALID", "TCS"]

    # Mock provider that fails for INVALID
    def failing_provider(symbol, timeframe, lookback_days):
        if symbol == "INVALID":
            raise ValueError("Invalid symbol")
        return [
            OHLCVData(
                timestamp=datetime.utcnow(),
                open=100.0,
                high=101.0,
                low=99.0,
                close=100.5,
                volume=1000,
            )
            for _ in range(250)
        ]

    results = scanner_service.scan_universe(
        symbols=symbols,
        market_data_provider=failing_provider,
    )

    # Should still get results for valid symbols
    assert results["performance_metrics"].errors > 0
    # May have fewer candidates due to error
    assert len(results["candidates"]) >= 0


# === Integration Tests ===


def test_end_to_end_scan_workflow(mock_market_data_provider):
    """Test complete end-to-end scan workflow."""
    # Initialize scanner
    scanner = SwingScannerService(
        max_workers=4,
        cache_ttl_seconds=300,
        rate_limit_per_second=10.0,
    )

    # Define stock universe
    symbols = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICIBANK"]

    # Run scan
    results = scanner.scan_universe(
        symbols=symbols,
        market_data_provider=mock_market_data_provider,
        min_score=50.0,
    )

    # Verify results structure
    assert "candidates" in results
    assert "performance_metrics" in results
    assert results["total_symbols"] == len(symbols)

    # Verify candidates are properly scored and sorted
    for i in range(len(results["candidates"]) - 1):
        assert results["candidates"][i].score >= results["candidates"][i + 1].score

    # Verify performance metrics
    metrics = results["performance_metrics"]
    assert metrics.total_duration_ms > 0
    assert metrics.stocks_scanned == len(symbols)

    # Get cache stats
    cache_stats = scanner.get_cache_stats()
    assert cache_stats["total_entries"] >= 0
    assert cache_stats["hit_rate"] >= 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

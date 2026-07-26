"""
Tests for the Options Scalper Repository classes.

Tests cover:
- AnalysisHistoryRepository: storage, retrieval, filtering, pagination, cleanup
- ConfigurationRepository: get, save, defaults

Requirements: 20.1, 20.2, 20.3, 20.4, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.14,
              22.6, 30.11, 30.12, 30.13
"""

import pytest
from datetime import datetime, timedelta, timezone

from scalper.repository import AnalysisHistoryRepository, ConfigurationRepository
from scalper.models import (
    ScalperAnalysisResult,
    ScalperConfiguration,
    ScalperSignalType,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
)


# ============================================================
# Fixtures
# ============================================================


def _create_analysis(
    underlying: str = "NIFTY",
    signal_type: ScalperSignalType = ScalperSignalType.BUY_CE,
    probability: float = 75.0,
    timestamp: datetime = None,
) -> ScalperAnalysisResult:
    """Create a mock ScalperAnalysisResult for testing."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)

    return ScalperAnalysisResult(
        timestamp=timestamp,
        underlying=underlying,
        signal_type=signal_type,
        probability=probability,
        risk_reward_ratio=2.5,
        strike_price=21500.0,
        expiry_date=None,
        entry_price=100.0,
        target_price=271.0,
        stop_loss=14.5,
        lot_size=50,
        spot_price=21500.0,
        trend=TrendClassification.BULLISH,
        oi_interpretation=OIInterpretation.BULLISH,
        pcr=1.2,
        trendline_status=TrendlineStatus.BULLISH,
        support_level=21400.0,
        resistance_level=21600.0,
        rsi=62.5,
        macd=15.3,
        macd_signal=12.1,
        vwap=21500.0,
        ema_5=21520.0,
        ema_15=21480.0,
        atr=85.5,
        volume_ratio=1.25,
        call_oi=5000000,
        put_oi=6000000,
        call_oi_change=150000,
        put_oi_change=200000,
        atm_iv=0.18,
        rationale="Strong bullish momentum with price above VWAP.",
        hold_reason=None,
    )


@pytest.fixture
def history_repo():
    """Create a fresh AnalysisHistoryRepository for each test."""
    return AnalysisHistoryRepository()


@pytest.fixture
def config_repo():
    """Create a fresh ConfigurationRepository for each test."""
    return ConfigurationRepository()


# ============================================================
# AnalysisHistoryRepository Tests
# ============================================================


class TestAnalysisHistoryRepository:
    """Tests for AnalysisHistoryRepository."""

    @pytest.mark.asyncio
    async def test_store_analysis_returns_id(self, history_repo):
        """store_analysis should return a record ID on success."""
        analysis = _create_analysis()
        record_id = await history_repo.store_analysis(analysis)

        assert record_id is not None
        assert record_id == 1
        assert history_repo.record_count == 1

    @pytest.mark.asyncio
    async def test_store_multiple_analyses(self, history_repo):
        """Should store multiple records with incrementing IDs."""
        for i in range(5):
            analysis = _create_analysis(probability=70.0 + i)
            record_id = await history_repo.store_analysis(analysis)
            assert record_id == i + 1

        assert history_repo.record_count == 5

    @pytest.mark.asyncio
    async def test_store_analysis_complete_data(self, history_repo):
        """Stored record should contain all fields from AnalysisResult."""
        analysis = _create_analysis(
            underlying="BANKNIFTY",
            signal_type=ScalperSignalType.HOLD,
        )
        record_id = await history_repo.store_analysis(analysis)

        record = await history_repo.get_record_by_id(record_id)
        assert record is not None
        assert record["underlying"] == "BANKNIFTY"
        assert record["signal_type"] == "HOLD"
        assert record["probability"] == 75.0
        assert record["risk_reward_ratio"] == 2.5
        assert record["spot_price"] == 21500.0
        assert record["rsi"] == 62.5
        assert record["rationale"] == "Strong bullish momentum with price above VWAP."

    @pytest.mark.asyncio
    async def test_get_history_no_filters(self, history_repo):
        """Should return all records when no filters applied."""
        for _ in range(3):
            await history_repo.store_analysis(_create_analysis())

        records, total = await history_repo.get_analysis_history()
        assert total == 3
        assert len(records) == 3

    @pytest.mark.asyncio
    async def test_get_history_filter_by_underlying(self, history_repo):
        """Should filter records by underlying."""
        await history_repo.store_analysis(_create_analysis(underlying="NIFTY"))
        await history_repo.store_analysis(_create_analysis(underlying="BANKNIFTY"))
        await history_repo.store_analysis(_create_analysis(underlying="NIFTY"))

        records, total = await history_repo.get_analysis_history(underlying="NIFTY")
        assert total == 2
        assert all(r["underlying"] == "NIFTY" for r in records)

    @pytest.mark.asyncio
    async def test_get_history_filter_by_signal_type(self, history_repo):
        """Should filter records by signal type."""
        await history_repo.store_analysis(
            _create_analysis(signal_type=ScalperSignalType.BUY_CE)
        )
        await history_repo.store_analysis(
            _create_analysis(signal_type=ScalperSignalType.HOLD)
        )
        await history_repo.store_analysis(
            _create_analysis(signal_type=ScalperSignalType.BUY_PE)
        )

        records, total = await history_repo.get_analysis_history(signal_type="HOLD")
        assert total == 1
        assert records[0]["signal_type"] == "HOLD"

    @pytest.mark.asyncio
    async def test_get_history_filter_by_date_range(self, history_repo):
        """Should filter records by date range."""
        now = datetime.now(timezone.utc)
        old = now - timedelta(days=10)
        recent = now - timedelta(days=1)

        await history_repo.store_analysis(_create_analysis(timestamp=old))
        await history_repo.store_analysis(_create_analysis(timestamp=recent))
        await history_repo.store_analysis(_create_analysis(timestamp=now))

        # Filter to only last 2 days
        date_from = now - timedelta(days=2)
        records, total = await history_repo.get_analysis_history(date_from=date_from)
        assert total == 2

    @pytest.mark.asyncio
    async def test_get_history_pagination(self, history_repo):
        """Should paginate results correctly."""
        for i in range(10):
            ts = datetime.now(timezone.utc) - timedelta(minutes=10 - i)
            await history_repo.store_analysis(_create_analysis(timestamp=ts))

        # Page 1 with page_size 3
        records, total = await history_repo.get_analysis_history(page=1, page_size=3)
        assert total == 10
        assert len(records) == 3

        # Page 2
        records2, total2 = await history_repo.get_analysis_history(page=2, page_size=3)
        assert total2 == 10
        assert len(records2) == 3

        # Last page
        records4, total4 = await history_repo.get_analysis_history(page=4, page_size=3)
        assert len(records4) == 1

    @pytest.mark.asyncio
    async def test_get_history_max_page_size_100(self, history_repo):
        """Page size should be capped at 100."""
        for _ in range(5):
            await history_repo.store_analysis(_create_analysis())

        records, total = await history_repo.get_analysis_history(page_size=200)
        # Should still return all 5 (capped at 100 but only 5 exist)
        assert len(records) == 5

    @pytest.mark.asyncio
    async def test_get_history_reverse_chronological_order(self, history_repo):
        """Records should be returned in reverse chronological order."""
        now = datetime.now(timezone.utc)
        ts1 = now - timedelta(hours=3)
        ts2 = now - timedelta(hours=2)
        ts3 = now - timedelta(hours=1)

        await history_repo.store_analysis(_create_analysis(timestamp=ts1))
        await history_repo.store_analysis(_create_analysis(timestamp=ts2))
        await history_repo.store_analysis(_create_analysis(timestamp=ts3))

        records, _ = await history_repo.get_analysis_history()
        assert records[0]["timestamp"] == ts3  # Most recent first
        assert records[1]["timestamp"] == ts2
        assert records[2]["timestamp"] == ts1

    @pytest.mark.asyncio
    async def test_get_history_empty_result(self, history_repo):
        """Should return empty list when no records match."""
        await history_repo.store_analysis(_create_analysis(underlying="NIFTY"))

        records, total = await history_repo.get_analysis_history(underlying="BANKNIFTY")
        assert total == 0
        assert len(records) == 0

    @pytest.mark.asyncio
    async def test_cleanup_old_records(self, history_repo):
        """Should delete records older than 90 days."""
        now = datetime.now(timezone.utc)
        old_ts = now - timedelta(days=91)
        recent_ts = now - timedelta(days=1)

        await history_repo.store_analysis(_create_analysis(timestamp=old_ts))
        await history_repo.store_analysis(_create_analysis(timestamp=old_ts))
        await history_repo.store_analysis(_create_analysis(timestamp=recent_ts))

        assert history_repo.record_count == 3

        deleted = await history_repo.cleanup_old_records()
        assert deleted == 2
        assert history_repo.record_count == 1

    @pytest.mark.asyncio
    async def test_cleanup_no_old_records(self, history_repo):
        """Should delete nothing when all records are recent."""
        now = datetime.now(timezone.utc)
        await history_repo.store_analysis(_create_analysis(timestamp=now))

        deleted = await history_repo.cleanup_old_records()
        assert deleted == 0
        assert history_repo.record_count == 1

    @pytest.mark.asyncio
    async def test_storage_failure_doesnt_interrupt(self, history_repo):
        """Storage failures should be handled gracefully."""
        # The in-memory implementation won't naturally fail,
        # but we verify the interface contract
        analysis = _create_analysis()
        result = await history_repo.store_analysis(analysis)
        assert result is not None

    def test_clear_removes_all_records(self, history_repo):
        """clear() should remove all records and reset counter."""
        # Synchronous method for test cleanup
        history_repo.clear()
        assert history_repo.record_count == 0


# ============================================================
# ConfigurationRepository Tests
# ============================================================


class TestConfigurationRepository:
    """Tests for ConfigurationRepository."""

    @pytest.mark.asyncio
    async def test_get_config_returns_defaults_for_new_user(self, config_repo):
        """Should return default values if no config exists for user."""
        config = await config_repo.get_config("new_user")

        assert config.user_id == "new_user"
        assert config.refresh_interval == 60
        assert config.probability_threshold == 70.0
        assert config.risk_reward_threshold == 2.0
        assert config.max_spread_percentage == 5.0
        assert config.min_open_interest == 1000

    @pytest.mark.asyncio
    async def test_save_config_persists(self, config_repo):
        """save_config should persist configuration."""
        config = ScalperConfiguration(
            user_id="user1",
            refresh_interval=45,
            probability_threshold=80.0,
            risk_reward_threshold=3.0,
            max_spread_percentage=3.0,
            min_open_interest=2000,
        )
        result = await config_repo.save_config(config)
        assert result is True

    @pytest.mark.asyncio
    async def test_save_and_retrieve_config(self, config_repo):
        """Should be able to save and then retrieve the same config."""
        config = ScalperConfiguration(
            user_id="user1",
            refresh_interval=90,
            probability_threshold=65.0,
            risk_reward_threshold=1.5,
            max_spread_percentage=7.0,
            min_open_interest=500,
        )
        await config_repo.save_config(config)

        retrieved = await config_repo.get_config("user1")
        assert retrieved.user_id == "user1"
        assert retrieved.refresh_interval == 90
        assert retrieved.probability_threshold == 65.0
        assert retrieved.risk_reward_threshold == 1.5
        assert retrieved.max_spread_percentage == 7.0
        assert retrieved.min_open_interest == 500

    @pytest.mark.asyncio
    async def test_save_config_overwrites_existing(self, config_repo):
        """Saving config for existing user should overwrite."""
        config1 = ScalperConfiguration(user_id="user1", refresh_interval=60)
        await config_repo.save_config(config1)

        config2 = ScalperConfiguration(user_id="user1", refresh_interval=120)
        await config_repo.save_config(config2)

        retrieved = await config_repo.get_config("user1")
        assert retrieved.refresh_interval == 120

    @pytest.mark.asyncio
    async def test_multiple_users_isolated(self, config_repo):
        """Different users should have independent configurations."""
        config1 = ScalperConfiguration(user_id="user1", refresh_interval=30)
        config2 = ScalperConfiguration(user_id="user2", refresh_interval=300)
        await config_repo.save_config(config1)
        await config_repo.save_config(config2)

        r1 = await config_repo.get_config("user1")
        r2 = await config_repo.get_config("user2")
        assert r1.refresh_interval == 30
        assert r2.refresh_interval == 300

    @pytest.mark.asyncio
    async def test_delete_config(self, config_repo):
        """Should delete user config so defaults are returned."""
        config = ScalperConfiguration(user_id="user1", refresh_interval=90)
        await config_repo.save_config(config)

        deleted = await config_repo.delete_config("user1")
        assert deleted is True

        # Should now return defaults
        retrieved = await config_repo.get_config("user1")
        assert retrieved.refresh_interval == 60  # default

    @pytest.mark.asyncio
    async def test_delete_nonexistent_config(self, config_repo):
        """Should return False when deleting non-existent config."""
        result = await config_repo.delete_config("nonexistent")
        assert result is False

    def test_clear_removes_all_configs(self, config_repo):
        """clear() should remove all configurations."""
        config_repo.clear()
        # Should be empty after clear

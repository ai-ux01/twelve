"""
Tests for the Auto Refresh Orchestrator.

Tests cover Task 8.1 (timer management, WebSocket client tracking,
cycle overlap prevention) and Task 8.2 (error handling, retry logic,
graceful degradation).

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
              22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.8, 22.9, 22.10, 22.11,
              27.1, 27.2, 27.3, 27.8
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone, date
from typing import Any, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scalper.auto_refresh_orchestrator import (
    AutoRefreshOrchestrator,
    AutoRefreshOrchestratorError,
    OrchestratorState,
    FetchFailureError,
    AIAnalysisFailureError,
)
from scalper.models import (
    MarketDataPackage,
    OptionsContract,
    ScalperAnalysisResult,
    ScalperSignalType,
    Signal,
    TechnicalIndicators,
    OptionsAnalysis,
    SupportResistance,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
)
from scalper.ai_analysis_engine import AIAnalysisResult


# --- Test Fixtures and Helpers ---


def make_technical_indicators() -> TechnicalIndicators:
    """Create valid TechnicalIndicators for testing."""
    return TechnicalIndicators(
        vwap=21500.0,
        ema_5=21520.0,
        ema_15=21480.0,
        rsi=62.5,
        macd=15.3,
        macd_signal=12.1,
        macd_histogram=3.2,
        atr=85.5,
        current_volume=250000,
        avg_volume=200000.0,
        volume_ratio=1.25,
    )


def make_options_analysis() -> OptionsAnalysis:
    """Create valid OptionsAnalysis for testing."""
    return OptionsAnalysis(
        call_oi=5000000,
        put_oi=6000000,
        call_oi_change=150000,
        put_oi_change=200000,
        call_oi_change_pct=3.1,
        put_oi_change_pct=3.4,
        pcr=1.2,
        atm_call_iv=0.18,
        atm_put_iv=0.20,
        top_call_oi_buildup=[],
        top_put_oi_buildup=[],
    )


def make_support_resistance() -> SupportResistance:
    """Create valid SupportResistance for testing."""
    return SupportResistance(
        support_level=21400.0,
        resistance_level=21600.0,
        distance_to_support_pct=0.47,
        distance_to_resistance_pct=0.47,
    )


def make_market_data(underlying: str = "NIFTY") -> MarketDataPackage:
    """Create valid MarketDataPackage for testing."""
    return MarketDataPackage(
        timestamp=datetime.now(timezone.utc),
        underlying=underlying,
        spot_price=21500.0,
        ohlcv_data=[
            {"open": 21490, "high": 21520, "low": 21480, "close": 21510, "volume": 1000}
            for _ in range(30)
        ],
        options_chain=[
            OptionsContract(
                strike_price=21500.0,
                option_type="CE",
                expiry_date=date(2025, 1, 30),
                bid=98.0,
                ask=102.0,
                ltp=100.0,
                volume=5000,
                open_interest=10000,
                implied_volatility=0.15,
                mid_price=100.0,
                spread=4.0,
                spread_percentage=4.0,
                is_liquid=True,
                delta=0.52,
                gamma=0.003,
                theta=-12.5,
                vega=45.2,
            )
        ],
        previous_analysis=None,
    )


def make_ai_result() -> AIAnalysisResult:
    """Create valid AIAnalysisResult for testing."""
    return AIAnalysisResult(
        signal_type="BUY CE",
        probability=75.0,
        entry_price=100.0,
        target_price=271.0,
        stop_loss=14.5,
        trend="Bullish",
        oi_interpretation="Bullish",
        rationale="Strong bullish momentum. " * 20,
    )


def make_signal() -> Signal:
    """Create valid Signal for testing."""
    return Signal(
        signal_type=ScalperSignalType.BUY_CE,
        probability=75.0,
        risk_reward_ratio=2.5,
        selected_contract=OptionsContract(
            strike_price=21500.0,
            option_type="CE",
            expiry_date=date(2025, 1, 30),
            bid=98.0,
            ask=102.0,
            ltp=100.0,
            volume=5000,
            open_interest=10000,
            implied_volatility=0.15,
            mid_price=100.0,
            spread=4.0,
            spread_percentage=4.0,
            is_liquid=True,
            delta=0.52,
            gamma=0.003,
            theta=-12.5,
            vega=45.2,
        ),
        entry_price=100.0,
        target_price=271.0,
        stop_loss=14.5,
        hold_reason=None,
    )


def create_mock_orchestrator(
    fetch_side_effect=None,
    analyze_side_effect=None,
    options_side_effect=None,
    ai_side_effect=None,
    signal_side_effect=None,
    storage_callback=None,
    on_alert=None,
    refresh_interval: float = 60.0,
) -> AutoRefreshOrchestrator:
    """Create an orchestrator with mocked dependencies."""
    market_data_fetcher = AsyncMock()
    if fetch_side_effect:
        market_data_fetcher.fetch_all.side_effect = fetch_side_effect
    else:
        market_data_fetcher.fetch_all.return_value = make_market_data()

    technical_analyzer = MagicMock()
    if analyze_side_effect:
        technical_analyzer.analyze_technical_indicators.side_effect = analyze_side_effect
    else:
        technical_analyzer.analyze_technical_indicators.return_value = (
            make_technical_indicators()
        )
    technical_analyzer.identify_support_resistance.return_value = (
        make_support_resistance()
    )
    technical_analyzer.detect_trendlines.return_value = TrendlineStatus.BULLISH
    technical_analyzer.classify_trend.return_value = TrendClassification.BULLISH

    options_analyzer = MagicMock()
    if options_side_effect:
        options_analyzer.analyze_options_chain.side_effect = options_side_effect
    else:
        options_analyzer.analyze_options_chain.return_value = make_options_analysis()

    ai_analysis_engine = MagicMock()
    if ai_side_effect:
        ai_analysis_engine.analyze_market_data.side_effect = ai_side_effect
    else:
        ai_analysis_engine.analyze_market_data.return_value = make_ai_result()

    signal_generator = MagicMock()
    if signal_side_effect:
        signal_generator.generate_signal.side_effect = signal_side_effect
    else:
        signal_generator.generate_signal.return_value = make_signal()

    return AutoRefreshOrchestrator(
        market_data_fetcher=market_data_fetcher,
        technical_analyzer=technical_analyzer,
        options_analyzer=options_analyzer,
        ai_analysis_engine=ai_analysis_engine,
        signal_generator=signal_generator,
        storage_callback=storage_callback,
        refresh_interval=refresh_interval,
        on_alert=on_alert,
    )


# --- Task 8.1 Tests: Timer Management and WebSocket Client Tracking ---


class TestStartRefreshCycle:
    """Tests for start_refresh_cycle(underlying)."""

    @pytest.mark.asyncio
    async def test_start_initiates_running_state(self):
        """Start sets state to RUNNING."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        assert orch.state == OrchestratorState.RUNNING
        assert orch.underlying == "NIFTY"
        await orch.stop()

    @pytest.mark.asyncio
    async def test_start_rejects_invalid_underlying(self):
        """Start raises ValueError for unsupported symbol."""
        orch = create_mock_orchestrator()
        with pytest.raises(ValueError, match="Unsupported underlying"):
            await orch.start_refresh_cycle("INVALID")

    @pytest.mark.asyncio
    async def test_start_triggers_immediate_refresh(self):
        """Start triggers first refresh cycle immediately."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("BANKNIFTY")
        # Give the task a moment to execute
        await asyncio.sleep(0.1)
        # Verify the fetcher was called
        orch._market_data_fetcher.fetch_all.assert_called_with("BANKNIFTY")
        await orch.stop()

    @pytest.mark.asyncio
    async def test_start_within_1_second(self):
        """Timer must start within 1 second."""
        orch = create_mock_orchestrator()
        start_time = time.time()
        await orch.start_refresh_cycle("NIFTY")
        elapsed = time.time() - start_time
        assert elapsed < 1.0
        assert orch.state == OrchestratorState.RUNNING
        await orch.stop()

    @pytest.mark.asyncio
    async def test_start_resets_consecutive_failures(self):
        """Start resets the failure counter."""
        orch = create_mock_orchestrator()
        orch._consecutive_failures = 5
        await orch.start_refresh_cycle("NIFTY")
        assert orch.consecutive_failures == 0
        await orch.stop()


class TestPauseRefreshCycle:
    """Tests for pause_refresh_cycle()."""

    @pytest.mark.asyncio
    async def test_pause_sets_paused_state(self):
        """Pause sets state to PAUSED."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.pause_refresh_cycle()
        assert orch.state == OrchestratorState.PAUSED
        await orch.stop()

    @pytest.mark.asyncio
    async def test_pause_within_1_second(self):
        """Timer must stop within 1 second."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        start_time = time.time()
        await orch.pause_refresh_cycle()
        elapsed = time.time() - start_time
        assert elapsed < 1.0
        assert orch.state == OrchestratorState.PAUSED
        await orch.stop()

    @pytest.mark.asyncio
    async def test_pause_does_nothing_when_not_running(self):
        """Pause has no effect if not in RUNNING state."""
        orch = create_mock_orchestrator()
        assert orch.state == OrchestratorState.IDLE
        await orch.pause_refresh_cycle()
        assert orch.state == OrchestratorState.IDLE


class TestResumeRefreshCycle:
    """Tests for resume_refresh_cycle()."""

    @pytest.mark.asyncio
    async def test_resume_sets_running_state(self):
        """Resume sets state back to RUNNING."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.pause_refresh_cycle()
        assert orch.state == OrchestratorState.PAUSED
        await orch.resume_refresh_cycle()
        assert orch.state == OrchestratorState.RUNNING
        await orch.stop()

    @pytest.mark.asyncio
    async def test_resume_within_2_seconds(self):
        """Timer must restart within 2 seconds."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.pause_refresh_cycle()
        start_time = time.time()
        await orch.resume_refresh_cycle()
        elapsed = time.time() - start_time
        assert elapsed < 2.0
        assert orch.state == OrchestratorState.RUNNING
        await orch.stop()

    @pytest.mark.asyncio
    async def test_resume_triggers_immediate_refresh(self):
        """Resume triggers immediate refresh on restart."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        # Reset mock call counts
        orch._market_data_fetcher.fetch_all.reset_mock()
        await orch.pause_refresh_cycle()
        await orch.resume_refresh_cycle()
        await asyncio.sleep(0.1)
        # Verify fetch was called again after resume
        orch._market_data_fetcher.fetch_all.assert_called()
        await orch.stop()

    @pytest.mark.asyncio
    async def test_resume_does_nothing_when_not_paused(self):
        """Resume has no effect if not in PAUSED state."""
        orch = create_mock_orchestrator()
        assert orch.state == OrchestratorState.IDLE
        await orch.resume_refresh_cycle()
        assert orch.state == OrchestratorState.IDLE


class TestPageVisibilityChange:
    """Tests for handle_page_visibility_change(visible)."""

    @pytest.mark.asyncio
    async def test_visibility_hidden_pauses_running(self):
        """Hidden page pauses running refresh cycle."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.handle_page_visibility_change(visible=False)
        assert orch.state == OrchestratorState.PAUSED
        await orch.stop()

    @pytest.mark.asyncio
    async def test_visibility_visible_resumes_paused(self):
        """Visible page resumes paused refresh cycle."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.handle_page_visibility_change(visible=False)
        assert orch.state == OrchestratorState.PAUSED
        await orch.handle_page_visibility_change(visible=True)
        assert orch.state == OrchestratorState.RUNNING
        await orch.stop()

    @pytest.mark.asyncio
    async def test_visibility_hidden_no_effect_when_paused(self):
        """Hidden on already paused has no effect."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.pause_refresh_cycle()
        await orch.handle_page_visibility_change(visible=False)
        assert orch.state == OrchestratorState.PAUSED
        await orch.stop()


class TestWebSocketClientTracking:
    """Tests for WebSocket client management."""

    def test_add_client(self):
        """Adding a client increases the client count."""
        orch = create_mock_orchestrator()
        mock_client = MagicMock()
        orch.add_client(mock_client)
        assert orch.connected_clients == 1

    def test_remove_client(self):
        """Removing a client decreases the client count."""
        orch = create_mock_orchestrator()
        mock_client = MagicMock()
        orch.add_client(mock_client)
        orch.remove_client(mock_client)
        assert orch.connected_clients == 0

    def test_remove_nonexistent_client(self):
        """Removing a non-existent client doesn't raise."""
        orch = create_mock_orchestrator()
        mock_client = MagicMock()
        orch.remove_client(mock_client)  # Should not raise
        assert orch.connected_clients == 0

    def test_multiple_clients(self):
        """Multiple clients can be tracked."""
        orch = create_mock_orchestrator()
        clients = [MagicMock() for _ in range(5)]
        for c in clients:
            orch.add_client(c)
        assert orch.connected_clients == 5

    def test_get_clients_returns_copy(self):
        """get_clients returns a copy, not the internal set."""
        orch = create_mock_orchestrator()
        mock_client = MagicMock()
        orch.add_client(mock_client)
        clients = orch.get_clients()
        clients.clear()
        assert orch.connected_clients == 1  # Internal set unchanged


class TestCycleOverlapPrevention:
    """Tests for cycle overlap prevention."""

    @pytest.mark.asyncio
    async def test_skip_when_previous_cycle_running(self):
        """Execute returns None if previous cycle is still running."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        # Simulate cycle already running
        orch._cycle_running = True
        result = await orch.execute_refresh_cycle()
        assert result is None

    @pytest.mark.asyncio
    async def test_cycle_flag_reset_after_completion(self):
        """Cycle running flag resets after completion."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        await orch.execute_refresh_cycle()
        assert orch._cycle_running is False


class TestExecuteRefreshCycle:
    """Tests for execute_refresh_cycle() orchestration."""

    @pytest.mark.asyncio
    async def test_successful_cycle_returns_result(self):
        """Successful cycle returns ScalperAnalysisResult."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        result = await orch.execute_refresh_cycle()
        assert result is not None
        assert isinstance(result, ScalperAnalysisResult)
        assert result.underlying == "NIFTY"

    @pytest.mark.asyncio
    async def test_successful_cycle_caches_result(self):
        """Successful cycle caches the result."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        result = await orch.execute_refresh_cycle()
        assert orch.last_successful_analysis is result

    @pytest.mark.asyncio
    async def test_successful_cycle_resets_failures(self):
        """Successful cycle resets consecutive failure counter."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        orch._consecutive_failures = 2
        await orch.execute_refresh_cycle()
        assert orch.consecutive_failures == 0

    @pytest.mark.asyncio
    async def test_successful_cycle_broadcasts(self):
        """Successful cycle broadcasts to WebSocket clients."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        mock_client = AsyncMock()
        mock_client.send_text = AsyncMock()
        orch.add_client(mock_client)
        await orch.execute_refresh_cycle()
        mock_client.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_successful_cycle_calls_storage(self):
        """Successful cycle invokes storage callback."""
        storage_mock = AsyncMock()
        orch = create_mock_orchestrator(storage_callback=storage_mock)
        orch._underlying = "NIFTY"
        await orch.execute_refresh_cycle()
        storage_mock.assert_called_once()


# --- Task 8.2 Tests: Error Handling and Retry Logic ---


class TestFetchFailureHandling:
    """Tests for fetch failure error handling."""

    @pytest.mark.asyncio
    async def test_fetch_failure_increments_counter(self):
        """Fetch failure increments consecutive failure counter."""
        orch = create_mock_orchestrator(
            fetch_side_effect=Exception("API unavailable")
        )
        orch._underlying = "NIFTY"
        await orch.execute_refresh_cycle()
        assert orch.consecutive_failures == 1

    @pytest.mark.asyncio
    async def test_fetch_failure_returns_cached_analysis(self):
        """Fetch failure returns last successful analysis for graceful degradation."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        # First successful cycle
        result = await orch.execute_refresh_cycle()
        assert result is not None

        # Make subsequent cycles fail
        orch._market_data_fetcher.fetch_all.side_effect = Exception("Network error")
        failed_result = await orch.execute_refresh_cycle()
        # Should return cached analysis
        assert failed_result is result

    @pytest.mark.asyncio
    async def test_three_consecutive_failures_pauses_and_alerts(self):
        """After 3 consecutive failures, pauses auto-refresh and alerts user."""
        alert_mock = MagicMock()
        orch = create_mock_orchestrator(
            fetch_side_effect=Exception("API down"),
            on_alert=alert_mock,
        )
        orch._underlying = "NIFTY"

        # Trigger 3 consecutive failures
        for _ in range(3):
            await orch.execute_refresh_cycle()

        assert orch.consecutive_failures == 3
        assert orch.state == OrchestratorState.ERROR
        alert_mock.assert_called_once()
        # Alert message should mention the failures
        alert_msg = alert_mock.call_args[0][0]
        assert "3" in alert_msg

    @pytest.mark.asyncio
    async def test_two_failures_does_not_pause(self):
        """2 consecutive failures does not pause."""
        orch = create_mock_orchestrator(
            fetch_side_effect=Exception("Timeout")
        )
        orch._underlying = "NIFTY"

        await orch.execute_refresh_cycle()
        await orch.execute_refresh_cycle()

        assert orch.consecutive_failures == 2
        assert orch.state != OrchestratorState.ERROR


class TestAIAnalysisFailure:
    """Tests for AI analysis failure handling."""

    @pytest.mark.asyncio
    async def test_ai_failure_generates_hold_with_analysis_error(self):
        """AI failure generates HOLD signal with 'Analysis Error' reason."""
        orch = create_mock_orchestrator(
            ai_side_effect=Exception("LLM timeout")
        )
        orch._underlying = "NIFTY"
        result = await orch.execute_refresh_cycle()
        assert result is not None
        assert result.signal_type == ScalperSignalType.HOLD
        assert result.hold_reason == "Analysis Error"

    @pytest.mark.asyncio
    async def test_ai_failure_does_not_increment_fetch_failures(self):
        """AI failure doesn't count as fetch failure."""
        orch = create_mock_orchestrator(
            ai_side_effect=Exception("LLM error")
        )
        orch._underlying = "NIFTY"
        await orch.execute_refresh_cycle()
        # AI failures are handled differently from fetch failures
        assert orch.consecutive_failures == 0

    @pytest.mark.asyncio
    async def test_ai_failure_uses_cached_market_data(self):
        """AI failure result uses cached market data when available."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        # First successful cycle
        first_result = await orch.execute_refresh_cycle()
        assert first_result is not None

        # Now AI fails
        orch._ai_analysis_engine.analyze_market_data.side_effect = Exception("LLM timeout")
        result = await orch.execute_refresh_cycle()
        assert result.hold_reason == "Analysis Error"
        # Uses cached data for market metrics
        assert result.spot_price == first_result.spot_price


class TestDatabaseStorageFailure:
    """Tests for database storage failure handling."""

    @pytest.mark.asyncio
    async def test_storage_failure_logs_but_continues(self):
        """Storage failure logs error but operation continues."""
        storage_mock = AsyncMock(side_effect=Exception("DB connection failed"))
        orch = create_mock_orchestrator(storage_callback=storage_mock)
        orch._underlying = "NIFTY"

        # Should not raise, operation continues
        result = await orch.execute_refresh_cycle()
        assert result is not None
        assert isinstance(result, ScalperAnalysisResult)
        # Storage was attempted
        storage_mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_storage_failure_does_not_affect_broadcast(self):
        """Storage failure doesn't prevent WebSocket broadcast."""
        storage_mock = AsyncMock(side_effect=Exception("DB error"))
        orch = create_mock_orchestrator(storage_callback=storage_mock)
        orch._underlying = "NIFTY"
        mock_client = AsyncMock()
        mock_client.send_text = AsyncMock()
        orch.add_client(mock_client)

        await orch.execute_refresh_cycle()
        # Broadcast should still happen
        mock_client.send_text.assert_called_once()


class TestWorkflowTimeout:
    """Tests for 10-second workflow timeout."""

    @pytest.mark.asyncio
    async def test_timeout_generates_hold_signal(self):
        """Workflow timeout generates HOLD with 'Workflow Timeout' reason."""
        # Make fetch_all hang for longer than timeout
        async def slow_fetch(*args, **kwargs):
            await asyncio.sleep(15)  # Longer than 10s timeout
            return make_market_data()

        orch = create_mock_orchestrator()
        orch._market_data_fetcher.fetch_all = slow_fetch
        orch._underlying = "NIFTY"
        # Reduce timeout for faster test
        orch.WORKFLOW_TIMEOUT = 0.1

        result = await orch.execute_refresh_cycle()
        assert result is not None
        assert result.signal_type == ScalperSignalType.HOLD
        assert result.hold_reason == "Workflow Timeout"

    @pytest.mark.asyncio
    async def test_timeout_with_cached_data_includes_previous_metrics(self):
        """Timeout result uses cached market data when available."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        # First successful cycle
        first_result = await orch.execute_refresh_cycle()

        # Now timeout
        async def slow_fetch(*args, **kwargs):
            await asyncio.sleep(15)
            return make_market_data()

        orch._market_data_fetcher.fetch_all = slow_fetch
        orch.WORKFLOW_TIMEOUT = 0.1

        result = await orch.execute_refresh_cycle()
        assert result.hold_reason == "Workflow Timeout"
        assert result.spot_price == first_result.spot_price


class TestGracefulDegradation:
    """Tests for caching and graceful degradation."""

    @pytest.mark.asyncio
    async def test_cache_last_successful_analysis(self):
        """Last successful analysis is cached."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        result = await orch.execute_refresh_cycle()
        assert orch.last_successful_analysis is result

    @pytest.mark.asyncio
    async def test_cached_analysis_served_on_failure(self):
        """Cached analysis is returned when fetch fails."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"
        # First success
        success_result = await orch.execute_refresh_cycle()

        # Subsequent failure
        orch._market_data_fetcher.fetch_all.side_effect = Exception("fail")
        failed_result = await orch.execute_refresh_cycle()
        assert failed_result is success_result

    @pytest.mark.asyncio
    async def test_no_cache_returns_none_on_first_failure(self):
        """With no cache, first failure returns None."""
        orch = create_mock_orchestrator(
            fetch_side_effect=Exception("No network")
        )
        orch._underlying = "NIFTY"
        result = await orch.execute_refresh_cycle()
        # No cached result, returns None (the cached value which is None)
        assert result is None


class TestBroadcastFailedClients:
    """Tests for WebSocket broadcast failure handling."""

    @pytest.mark.asyncio
    async def test_failed_client_removed_from_list(self):
        """Client that fails during broadcast is removed from list."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"

        # Create a client that fails on send
        failing_client = AsyncMock()
        failing_client.send_text = AsyncMock(
            side_effect=Exception("Connection lost")
        )
        orch.add_client(failing_client)
        assert orch.connected_clients == 1

        await orch.execute_refresh_cycle()
        # Failed client should be removed
        assert orch.connected_clients == 0

    @pytest.mark.asyncio
    async def test_good_clients_survive_bad_client(self):
        """Good clients continue receiving after a bad client is removed."""
        orch = create_mock_orchestrator()
        orch._underlying = "NIFTY"

        good_client = AsyncMock()
        good_client.send_text = AsyncMock()
        bad_client = AsyncMock()
        bad_client.send_text = AsyncMock(
            side_effect=Exception("Broken pipe")
        )

        orch.add_client(good_client)
        orch.add_client(bad_client)
        assert orch.connected_clients == 2

        await orch.execute_refresh_cycle()
        # Good client received message
        good_client.send_text.assert_called_once()
        # Bad client was removed
        assert orch.connected_clients == 1


class TestStop:
    """Tests for stop/cleanup."""

    @pytest.mark.asyncio
    async def test_stop_sets_idle_state(self):
        """Stop sets state to IDLE."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.stop()
        assert orch.state == OrchestratorState.IDLE

    @pytest.mark.asyncio
    async def test_stop_clears_clients(self):
        """Stop clears all WebSocket clients."""
        orch = create_mock_orchestrator()
        orch.add_client(MagicMock())
        orch.add_client(MagicMock())
        await orch.stop()
        assert orch.connected_clients == 0

    @pytest.mark.asyncio
    async def test_stop_clears_underlying(self):
        """Stop clears the underlying."""
        orch = create_mock_orchestrator()
        await orch.start_refresh_cycle("NIFTY")
        await asyncio.sleep(0.05)
        await orch.stop()
        assert orch.underlying is None

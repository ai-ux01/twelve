"""
Auto Refresh Orchestrator for the Options Scalping Agent.

This module manages the 60-second refresh cycle, WebSocket client connections,
error recovery, and graceful degradation. It ties together all core analysis
components (MarketDataFetcher, TechnicalAnalyzer, OptionsAnalyzer,
AIAnalysisEngine, SignalGenerator) into a cohesive automated workflow.

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
              22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.8, 22.9, 22.10, 22.11,
              27.1, 27.2, 27.3, 27.8
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

from scalper.models import (
    MarketDataPackage,
    ScalperAnalysisResult,
    ScalperSignalType,
    Signal,
    TechnicalIndicators,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
    WebSocketMessage,
)

logger = logging.getLogger(__name__)


class OrchestratorState(str, Enum):
    """State of the auto-refresh orchestrator."""

    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


class AutoRefreshOrchestratorError(Exception):
    """Raised when the orchestrator encounters an unrecoverable error."""

    pass


class AutoRefreshOrchestrator:
    """
    Auto Refresh Orchestrator for the Options Scalping Agent.

    Manages the 60-second refresh cycle, WebSocket client connections,
    error recovery with retry logic, and graceful degradation. Orchestrates
    the complete analysis workflow:
        fetch data → analyze → generate signal → broadcast → store

    Features:
    - 60-second configurable refresh timer
    - Cycle overlap prevention (skip if previous cycle still running)
    - WebSocket client management for broadcasting
    - Error handling with retry after 30 seconds
    - Consecutive failure tracking (3 failures → pause + alert)
    - 10-second workflow timeout
    - Last successful analysis caching for graceful degradation
    - Page visibility change handling (pause/resume)

    Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
                  22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.8, 22.9, 22.10, 22.11,
                  27.1, 27.2, 27.3, 27.8
    """

    # Configuration constants
    DEFAULT_REFRESH_INTERVAL: float = 60.0  # seconds
    RETRY_DELAY: float = 30.0  # seconds after fetch failure
    MAX_CONSECUTIVE_FAILURES: int = 3
    WORKFLOW_TIMEOUT: float = 10.0  # seconds for complete workflow
    START_TIMEOUT: float = 1.0  # timer must start within 1 second
    PAUSE_TIMEOUT: float = 1.0  # timer must stop within 1 second
    RESUME_TIMEOUT: float = 2.0  # timer must restart within 2 seconds

    def __init__(
        self,
        market_data_fetcher: Any = None,
        technical_analyzer: Any = None,
        options_analyzer: Any = None,
        ai_analysis_engine: Any = None,
        signal_generator: Any = None,
        storage_callback: Optional[Callable] = None,
        refresh_interval: float = DEFAULT_REFRESH_INTERVAL,
        on_alert: Optional[Callable[[str], Any]] = None,
    ):
        """
        Initialize the Auto Refresh Orchestrator.

        Args:
            market_data_fetcher: MarketDataFetcher instance for data retrieval.
            technical_analyzer: TechnicalAnalyzer instance for indicator calc.
            options_analyzer: OptionsAnalyzer instance for options analysis.
            ai_analysis_engine: AIAnalysisEngine instance for AI analysis.
            signal_generator: SignalGenerator instance for signal generation.
            storage_callback: Async callable to store analysis results.
            refresh_interval: Refresh interval in seconds (default 60).
            on_alert: Callback for user alerts (e.g., after 3 failures).
        """
        self._market_data_fetcher = market_data_fetcher
        self._technical_analyzer = technical_analyzer
        self._options_analyzer = options_analyzer
        self._ai_analysis_engine = ai_analysis_engine
        self._signal_generator = signal_generator
        self._storage_callback = storage_callback
        self._refresh_interval = refresh_interval
        self._on_alert = on_alert

        # State management
        self._state: OrchestratorState = OrchestratorState.IDLE
        self._underlying: Optional[str] = None
        self._timer_task: Optional[asyncio.Task] = None
        self._cycle_running: bool = False
        self._cycle_lock: asyncio.Lock = asyncio.Lock()

        # Error tracking
        self._consecutive_failures: int = 0
        self._last_error: Optional[str] = None

        # Caching for graceful degradation
        self._last_successful_analysis: Optional[ScalperAnalysisResult] = None

        # WebSocket client tracking
        self._ws_clients: Set[Any] = set()

        # Timing
        self._last_refresh_time: Optional[float] = None
        self._next_refresh_time: Optional[float] = None

    @property
    def state(self) -> OrchestratorState:
        """Current orchestrator state."""
        return self._state

    @property
    def is_running(self) -> bool:
        """Whether the refresh cycle is actively running."""
        return self._state == OrchestratorState.RUNNING

    @property
    def is_paused(self) -> bool:
        """Whether the refresh cycle is paused."""
        return self._state == OrchestratorState.PAUSED

    @property
    def consecutive_failures(self) -> int:
        """Number of consecutive refresh failures."""
        return self._consecutive_failures

    @property
    def last_successful_analysis(self) -> Optional[ScalperAnalysisResult]:
        """Last successfully completed analysis result (cached)."""
        return self._last_successful_analysis

    @property
    def connected_clients(self) -> int:
        """Number of connected WebSocket clients."""
        return len(self._ws_clients)

    @property
    def underlying(self) -> Optional[str]:
        """Currently active underlying symbol."""
        return self._underlying

    # --- WebSocket Client Management ---

    def add_client(self, client: Any) -> None:
        """
        Add a WebSocket client to the broadcast list.

        Args:
            client: WebSocket connection object.
        """
        self._ws_clients.add(client)
        logger.info(
            f"WebSocket client added. Total clients: {len(self._ws_clients)}"
        )

    def remove_client(self, client: Any) -> None:
        """
        Remove a WebSocket client from the broadcast list.

        Args:
            client: WebSocket connection object.
        """
        self._ws_clients.discard(client)
        logger.info(
            f"WebSocket client removed. Total clients: {len(self._ws_clients)}"
        )

    def get_clients(self) -> Set[Any]:
        """Return the current set of WebSocket clients."""
        return self._ws_clients.copy()

    # --- Refresh Cycle Management ---

    async def start_refresh_cycle(self, underlying: str) -> None:
        """
        Initiate the auto-refresh cycle for the given underlying.

        Starts the 60-second timer within 1 second and triggers an
        immediate first refresh.

        Args:
            underlying: Trading symbol ("NIFTY" or "BANKNIFTY").

        Raises:
            ValueError: If underlying is not supported.

        Requirements: 1.1, 1.2, 27.1
        """
        if underlying not in ("NIFTY", "BANKNIFTY"):
            raise ValueError(
                f"Unsupported underlying: {underlying}. "
                "Must be 'NIFTY' or 'BANKNIFTY'."
            )

        # Stop existing cycle if running
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
            try:
                await self._timer_task
            except asyncio.CancelledError:
                pass

        self._underlying = underlying
        self._state = OrchestratorState.RUNNING
        self._consecutive_failures = 0
        self._last_error = None

        # Start the timer loop (must begin within 1 second)
        self._timer_task = asyncio.create_task(self._refresh_loop())
        logger.info(
            f"Auto-refresh cycle started for {underlying} "
            f"with {self._refresh_interval}s interval"
        )

    async def pause_refresh_cycle(self) -> None:
        """
        Pause the auto-refresh cycle within 1 second.

        Stops the timer but retains state so it can be resumed.

        Requirements: 1.4, 27.2
        """
        if self._state != OrchestratorState.RUNNING:
            return

        self._state = OrchestratorState.PAUSED

        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
            try:
                await self._timer_task
            except asyncio.CancelledError:
                pass
            self._timer_task = None

        logger.info("Auto-refresh cycle paused")

    async def resume_refresh_cycle(self) -> None:
        """
        Resume the auto-refresh cycle within 2 seconds.

        Restarts the timer and triggers an immediate refresh.

        Requirements: 1.5, 27.3
        """
        if self._state != OrchestratorState.PAUSED:
            return

        if self._underlying is None:
            logger.warning("Cannot resume: no underlying set")
            return

        self._state = OrchestratorState.RUNNING
        self._consecutive_failures = 0

        # Start the timer loop (triggers immediate refresh)
        self._timer_task = asyncio.create_task(self._refresh_loop())
        logger.info(
            f"Auto-refresh cycle resumed for {self._underlying}"
        )

    async def handle_page_visibility_change(self, visible: bool) -> None:
        """
        Handle Page Visibility API changes.

        Pauses refresh when page becomes hidden, resumes when visible.

        Args:
            visible: True if page is visible, False if hidden.

        Requirements: 1.4, 1.5, 27.1, 27.2, 27.3
        """
        if visible:
            if self._state == OrchestratorState.PAUSED:
                await self.resume_refresh_cycle()
        else:
            if self._state == OrchestratorState.RUNNING:
                await self.pause_refresh_cycle()

    async def stop(self) -> None:
        """
        Stop the orchestrator completely and clean up resources.

        Requirements: 27.8
        """
        self._state = OrchestratorState.IDLE

        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
            try:
                await self._timer_task
            except asyncio.CancelledError:
                pass
            self._timer_task = None

        self._ws_clients.clear()
        self._underlying = None
        logger.info("Auto-refresh orchestrator stopped")

    # --- Core Refresh Logic ---

    async def _refresh_loop(self) -> None:
        """
        Internal loop that runs the refresh cycle on the configured interval.

        Triggers an immediate refresh on start, then waits for the interval.
        """
        try:
            # Trigger immediate refresh on start/resume
            await self.execute_refresh_cycle()

            # Loop with interval
            while self._state == OrchestratorState.RUNNING:
                self._next_refresh_time = time.time() + self._refresh_interval
                await asyncio.sleep(self._refresh_interval)

                if self._state != OrchestratorState.RUNNING:
                    break

                await self.execute_refresh_cycle()

        except asyncio.CancelledError:
            # Normal cancellation on pause/stop
            raise
        except Exception as e:
            logger.error(f"Refresh loop error: {e}", exc_info=True)
            self._state = OrchestratorState.ERROR
            self._last_error = str(e)

    async def execute_refresh_cycle(self) -> Optional[ScalperAnalysisResult]:
        """
        Execute a single refresh cycle: fetch → analyze → signal → broadcast → store.

        Implements cycle overlap prevention (skip if previous cycle running)
        and a 10-second timeout for the complete workflow.

        Returns:
            ScalperAnalysisResult on success, None on skip or failure.

        Requirements: 1.2, 1.3, 1.9, 22.8, 22.9, 22.10, 22.11
        """
        # Cycle overlap prevention: skip if previous cycle still running
        if self._cycle_running:
            logger.warning(
                "Skipping refresh cycle: previous cycle still running"
            )
            return None

        async with self._cycle_lock:
            self._cycle_running = True
            cycle_start = time.time()

            try:
                # Apply 10-second timeout for complete workflow
                result = await asyncio.wait_for(
                    self._execute_workflow(),
                    timeout=self.WORKFLOW_TIMEOUT,
                )

                # Success: reset failure counter and cache result
                self._consecutive_failures = 0
                self._last_error = None
                self._last_successful_analysis = result
                self._last_refresh_time = time.time()

                # Broadcast to WebSocket clients
                await self._broadcast_result(result)

                # Store in database
                await self._store_result(result)

                cycle_duration = time.time() - cycle_start
                logger.info(
                    f"Refresh cycle completed in {cycle_duration:.2f}s "
                    f"for {self._underlying}"
                )
                return result

            except asyncio.TimeoutError:
                # 10-second timeout exceeded: generate HOLD signal
                logger.error(
                    f"Refresh cycle timed out after "
                    f"{self.WORKFLOW_TIMEOUT}s for {self._underlying}"
                )
                hold_result = self._create_timeout_hold_result()
                await self._handle_failure("Workflow timeout exceeded")
                await self._broadcast_result(hold_result)
                return hold_result

            except FetchFailureError as e:
                # Data fetch failure: handle with retry logic
                logger.error(f"Fetch failure: {e}")
                await self._handle_failure(str(e))
                return self._last_successful_analysis

            except AIAnalysisFailureError as e:
                # AI analysis failure: generate HOLD with "Analysis Error"
                logger.error(f"AI analysis failure: {e}")
                hold_result = self._create_analysis_error_hold_result()
                self._last_refresh_time = time.time()
                await self._broadcast_result(hold_result)
                return hold_result

            except Exception as e:
                logger.error(
                    f"Unexpected error in refresh cycle: {e}", exc_info=True
                )
                await self._handle_failure(str(e))
                return self._last_successful_analysis

            finally:
                self._cycle_running = False

    async def _execute_workflow(self) -> ScalperAnalysisResult:
        """
        Execute the complete analysis workflow.

        Steps:
        1. Fetch market data
        2. Analyze technical indicators
        3. Analyze options chain
        4. Run AI analysis
        5. Generate signal

        Returns:
            ScalperAnalysisResult with complete analysis.

        Raises:
            FetchFailureError: If market data fetch fails.
            AIAnalysisFailureError: If AI analysis fails.
        """
        underlying = self._underlying
        if not underlying:
            raise AutoRefreshOrchestratorError("No underlying set")

        # Step 1: Fetch market data
        try:
            market_data = await self._market_data_fetcher.fetch_all(underlying)
        except Exception as e:
            raise FetchFailureError(f"Market data fetch failed: {e}") from e

        # Step 2: Analyze technical indicators
        try:
            technical_indicators = (
                self._technical_analyzer.analyze_technical_indicators(
                    market_data.ohlcv_data
                )
            )
            support_resistance = (
                self._technical_analyzer.identify_support_resistance(
                    market_data.ohlcv_data
                )
            )
            trendline_status = self._technical_analyzer.detect_trendlines(
                market_data.ohlcv_data
            )
            trend = self._technical_analyzer.classify_trend(
                technical_indicators
            )
        except Exception as e:
            logger.warning(f"Technical analysis error: {e}")
            raise FetchFailureError(
                f"Technical analysis failed: {e}"
            ) from e

        # Step 3: Analyze options chain
        try:
            options_analysis = self._options_analyzer.analyze_options_chain(
                market_data.options_chain
            )
        except Exception as e:
            logger.warning(f"Options analysis error: {e}")
            raise FetchFailureError(
                f"Options analysis failed: {e}"
            ) from e

        # Step 4: Run AI analysis
        try:
            ai_result = self._ai_analysis_engine.analyze_market_data(
                data_package=market_data,
                technical_indicators=technical_indicators,
                options_analysis=options_analysis,
                support_resistance=support_resistance,
                trendline_status=trendline_status.value
                if hasattr(trendline_status, "value")
                else str(trendline_status),
            )
        except Exception as e:
            raise AIAnalysisFailureError(
                f"AI analysis failed: {e}"
            ) from e

        # Step 5: Generate signal
        signal = self._signal_generator.generate_signal(
            ai_result=ai_result,
            contracts=market_data.options_chain,
            market_data=market_data,
            technical_indicators=technical_indicators,
        )

        # Build complete analysis result
        return self._build_analysis_result(
            market_data=market_data,
            technical_indicators=technical_indicators,
            options_analysis=options_analysis,
            support_resistance=support_resistance,
            trendline_status=trendline_status,
            trend=trend,
            signal=signal,
            ai_result=ai_result,
        )

    # --- Error Handling and Retry Logic ---

    async def _handle_failure(self, error_message: str) -> None:
        """
        Handle a refresh cycle failure.

        - Increments consecutive failure counter
        - After 3 consecutive failures: pause auto-refresh and alert user
        - Otherwise: schedule retry after 30 seconds

        Args:
            error_message: Description of the failure.

        Requirements: 1.6, 1.7, 22.3, 22.4
        """
        self._consecutive_failures += 1
        self._last_error = error_message

        logger.warning(
            f"Refresh failure #{self._consecutive_failures}: {error_message}"
        )

        if self._consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
            # Pause auto-refresh and alert user
            self._state = OrchestratorState.ERROR
            if self._timer_task and not self._timer_task.done():
                self._timer_task.cancel()
                try:
                    await self._timer_task
                except asyncio.CancelledError:
                    pass
                self._timer_task = None

            alert_msg = (
                f"Auto-refresh paused after {self.MAX_CONSECUTIVE_FAILURES} "
                f"consecutive failures. Last error: {error_message}"
            )
            logger.error(alert_msg)

            if self._on_alert:
                try:
                    result = self._on_alert(alert_msg)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as e:
                    logger.warning(f"Alert callback failed: {e}")
        else:
            # Schedule retry after 30 seconds
            logger.info(
                f"Will retry after {self.RETRY_DELAY}s "
                f"(failure {self._consecutive_failures}/"
                f"{self.MAX_CONSECUTIVE_FAILURES})"
            )

    # --- Broadcasting ---

    async def _broadcast_result(
        self, result: ScalperAnalysisResult
    ) -> None:
        """
        Broadcast analysis result to all connected WebSocket clients.

        Removes failed clients from the broadcast list.

        Args:
            result: Analysis result to broadcast.

        Requirements: 27.8
        """
        if not self._ws_clients:
            return

        message = WebSocketMessage(
            message_type="analysis_update",
            timestamp=datetime.now(timezone.utc),
            underlying=self._underlying,
            signal_data=result,
            market_data=None,
            error=None,
        )

        message_json = message.model_dump_json()
        failed_clients: List[Any] = []

        for client in self._ws_clients.copy():
            try:
                if hasattr(client, "send_text"):
                    await client.send_text(message_json)
                elif hasattr(client, "send"):
                    await client.send(message_json)
                else:
                    # Assume callable
                    result_send = client(message_json)
                    if asyncio.iscoroutine(result_send):
                        await result_send
            except Exception as e:
                logger.warning(
                    f"Failed to broadcast to client: {e}"
                )
                failed_clients.append(client)

        # Remove failed clients
        for client in failed_clients:
            self._ws_clients.discard(client)
            logger.info("Removed failed WebSocket client from broadcast list")

    # --- Storage ---

    async def _store_result(self, result: ScalperAnalysisResult) -> None:
        """
        Store analysis result via the storage callback.

        On failure: logs error but continues operation (non-blocking).

        Args:
            result: Analysis result to store.

        Requirements: 22.6
        """
        if self._storage_callback is None:
            return

        try:
            store_result = self._storage_callback(result)
            if asyncio.iscoroutine(store_result):
                await store_result
        except Exception as e:
            # Log error but continue operation
            logger.error(
                f"Database storage failed: {e}. "
                "Continuing operation without storage.",
                exc_info=True,
            )

    # --- Result Building Helpers ---

    def _build_analysis_result(
        self,
        market_data: MarketDataPackage,
        technical_indicators: TechnicalIndicators,
        options_analysis: Any,
        support_resistance: Any,
        trendline_status: Any,
        trend: Any,
        signal: Signal,
        ai_result: Any,
    ) -> ScalperAnalysisResult:
        """Build a ScalperAnalysisResult from all component outputs."""
        # Extract enum values safely
        trend_value = (
            trend.value if hasattr(trend, "value") else str(trend)
        )
        trendline_value = (
            trendline_status.value
            if hasattr(trendline_status, "value")
            else str(trendline_status)
        )

        # Map OI interpretation from AI result
        oi_interp_str = getattr(ai_result, "oi_interpretation", "Neutral")
        try:
            oi_interp = OIInterpretation(oi_interp_str)
        except ValueError:
            oi_interp = OIInterpretation.NEUTRAL

        # Map trend classification
        try:
            trend_class = TrendClassification(trend_value)
        except ValueError:
            trend_class = TrendClassification.NEUTRAL

        # Map trendline status
        try:
            tl_status = TrendlineStatus(trendline_value)
        except ValueError:
            tl_status = TrendlineStatus.NEUTRAL

        # Lot size based on underlying
        lot_size = 50 if market_data.underlying == "NIFTY" else 25

        return ScalperAnalysisResult(
            timestamp=datetime.now(timezone.utc),
            underlying=market_data.underlying,
            signal_type=signal.signal_type,
            probability=signal.probability,
            risk_reward_ratio=signal.risk_reward_ratio,
            strike_price=(
                signal.selected_contract.strike_price
                if signal.selected_contract
                else None
            ),
            expiry_date=(
                signal.selected_contract.expiry_date
                if signal.selected_contract
                else None
            ),
            entry_price=signal.entry_price,
            target_price=signal.target_price,
            stop_loss=signal.stop_loss,
            lot_size=lot_size if signal.signal_type != ScalperSignalType.HOLD else None,
            spot_price=market_data.spot_price,
            trend=trend_class,
            oi_interpretation=oi_interp,
            pcr=options_analysis.pcr,
            trendline_status=tl_status,
            support_level=getattr(support_resistance, "support_level", None),
            resistance_level=getattr(support_resistance, "resistance_level", None),
            rsi=technical_indicators.rsi,
            macd=technical_indicators.macd,
            macd_signal=technical_indicators.macd_signal,
            vwap=technical_indicators.vwap,
            ema_5=technical_indicators.ema_5,
            ema_15=technical_indicators.ema_15,
            atr=technical_indicators.atr,
            volume_ratio=technical_indicators.volume_ratio,
            call_oi=options_analysis.call_oi,
            put_oi=options_analysis.put_oi,
            call_oi_change=options_analysis.call_oi_change,
            put_oi_change=options_analysis.put_oi_change,
            atm_iv=options_analysis.atm_call_iv,
            rationale=getattr(ai_result, "rationale", ""),
            hold_reason=signal.hold_reason,
        )

    def _create_timeout_hold_result(self) -> ScalperAnalysisResult:
        """
        Create a HOLD result for workflow timeout.

        Requirements: 22.8, 22.9, 22.10, 22.11
        """
        # Use cached analysis data if available for graceful degradation
        cached = self._last_successful_analysis
        now = datetime.now(timezone.utc)

        if cached:
            return ScalperAnalysisResult(
                timestamp=now,
                underlying=cached.underlying,
                signal_type=ScalperSignalType.HOLD,
                probability=0.0,
                risk_reward_ratio=0.0,
                strike_price=None,
                expiry_date=None,
                entry_price=None,
                target_price=None,
                stop_loss=None,
                lot_size=None,
                spot_price=cached.spot_price,
                trend=cached.trend,
                oi_interpretation=cached.oi_interpretation,
                pcr=cached.pcr,
                trendline_status=cached.trendline_status,
                support_level=cached.support_level,
                resistance_level=cached.resistance_level,
                rsi=cached.rsi,
                macd=cached.macd,
                macd_signal=cached.macd_signal,
                vwap=cached.vwap,
                ema_5=cached.ema_5,
                ema_15=cached.ema_15,
                atr=cached.atr,
                volume_ratio=cached.volume_ratio,
                call_oi=cached.call_oi,
                put_oi=cached.put_oi,
                call_oi_change=cached.call_oi_change,
                put_oi_change=cached.put_oi_change,
                atm_iv=cached.atm_iv,
                rationale=(
                    "Analysis timed out. The complete workflow exceeded the "
                    "10-second timeout limit. Generating HOLD signal for safety. "
                    "Previous analysis data shown for reference. "
                    "The system will retry in the next refresh cycle."
                ),
                hold_reason="Workflow Timeout",
            )

        # No cached data available - use minimal defaults
        underlying = self._underlying or "NIFTY"
        return ScalperAnalysisResult(
            timestamp=now,
            underlying=underlying,
            signal_type=ScalperSignalType.HOLD,
            probability=0.0,
            risk_reward_ratio=0.0,
            strike_price=None,
            expiry_date=None,
            entry_price=None,
            target_price=None,
            stop_loss=None,
            lot_size=None,
            spot_price=1.0,  # Placeholder
            trend=TrendClassification.NEUTRAL,
            oi_interpretation=OIInterpretation.NEUTRAL,
            pcr=1.0,
            trendline_status=TrendlineStatus.NEUTRAL,
            support_level=None,
            resistance_level=None,
            rsi=50.0,
            macd=0.0,
            macd_signal=0.0,
            vwap=1.0,
            ema_5=1.0,
            ema_15=1.0,
            atr=1.0,
            volume_ratio=1.0,
            call_oi=0,
            put_oi=0,
            call_oi_change=0,
            put_oi_change=0,
            atm_iv=None,
            rationale=(
                "Analysis timed out. The complete workflow exceeded the "
                "10-second timeout limit. Generating HOLD signal for safety. "
                "No previous analysis data available. "
                "The system will retry in the next refresh cycle."
            ),
            hold_reason="Workflow Timeout",
        )

    def _create_analysis_error_hold_result(self) -> ScalperAnalysisResult:
        """
        Create a HOLD result when AI analysis fails.

        Requirements: 22.5
        """
        cached = self._last_successful_analysis
        now = datetime.now(timezone.utc)

        if cached:
            return ScalperAnalysisResult(
                timestamp=now,
                underlying=cached.underlying,
                signal_type=ScalperSignalType.HOLD,
                probability=0.0,
                risk_reward_ratio=0.0,
                strike_price=None,
                expiry_date=None,
                entry_price=None,
                target_price=None,
                stop_loss=None,
                lot_size=None,
                spot_price=cached.spot_price,
                trend=cached.trend,
                oi_interpretation=cached.oi_interpretation,
                pcr=cached.pcr,
                trendline_status=cached.trendline_status,
                support_level=cached.support_level,
                resistance_level=cached.resistance_level,
                rsi=cached.rsi,
                macd=cached.macd,
                macd_signal=cached.macd_signal,
                vwap=cached.vwap,
                ema_5=cached.ema_5,
                ema_15=cached.ema_15,
                atr=cached.atr,
                volume_ratio=cached.volume_ratio,
                call_oi=cached.call_oi,
                put_oi=cached.put_oi,
                call_oi_change=cached.call_oi_change,
                put_oi_change=cached.put_oi_change,
                atm_iv=cached.atm_iv,
                rationale=(
                    "AI analysis failed. Generating HOLD signal for safety. "
                    "Previous analysis data shown for reference. "
                    "The system will retry in the next refresh cycle."
                ),
                hold_reason="Analysis Error",
            )

        # No cached data available
        underlying = self._underlying or "NIFTY"
        return ScalperAnalysisResult(
            timestamp=now,
            underlying=underlying,
            signal_type=ScalperSignalType.HOLD,
            probability=0.0,
            risk_reward_ratio=0.0,
            strike_price=None,
            expiry_date=None,
            entry_price=None,
            target_price=None,
            stop_loss=None,
            lot_size=None,
            spot_price=1.0,
            trend=TrendClassification.NEUTRAL,
            oi_interpretation=OIInterpretation.NEUTRAL,
            pcr=1.0,
            trendline_status=TrendlineStatus.NEUTRAL,
            support_level=None,
            resistance_level=None,
            rsi=50.0,
            macd=0.0,
            macd_signal=0.0,
            vwap=1.0,
            ema_5=1.0,
            ema_15=1.0,
            atr=1.0,
            volume_ratio=1.0,
            call_oi=0,
            put_oi=0,
            call_oi_change=0,
            put_oi_change=0,
            atm_iv=None,
            rationale=(
                "AI analysis failed. Generating HOLD signal for safety. "
                "No previous analysis data available. "
                "The system will retry in the next refresh cycle."
            ),
            hold_reason="Analysis Error",
        )


class FetchFailureError(Exception):
    """Raised when market data fetch fails."""

    pass


class AIAnalysisFailureError(Exception):
    """Raised when AI analysis fails."""

    pass

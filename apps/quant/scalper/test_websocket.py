"""
Tests for the Options Scalper WebSocket endpoint.

Tests cover:
- WebSocket connection and initial analysis delivery
- Broadcast to multiple clients
- Connection limit enforcement (max 100)
- Graceful disconnect and resource cleanup
- Failed client removal from broadcast list

Requirements: 21.1-21.11
"""

import pytest
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketState

from main import app
from scalper.websocket import (
    WebSocketConnectionManager,
    connection_manager,
    MAX_CONNECTIONS,
    HEARTBEAT_INTERVAL,
    MAX_MISSED_PONGS,
)
from scalper.models import (
    ScalperAnalysisResult,
    ScalperSignalType,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
    WebSocketMessage,
)


# ============================================================
# Fixtures
# ============================================================


def _create_mock_analysis() -> ScalperAnalysisResult:
    """Create a mock ScalperAnalysisResult for testing."""
    return ScalperAnalysisResult(
        timestamp=datetime.now(timezone.utc),
        underlying="NIFTY",
        signal_type=ScalperSignalType.BUY_CE,
        probability=75.5,
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
        rationale="Strong bullish momentum with price above VWAP and EMA crossover.",
        hold_reason=None,
    )


@pytest.fixture
def manager():
    """Create a fresh WebSocketConnectionManager for each test."""
    return WebSocketConnectionManager(max_connections=MAX_CONNECTIONS)


@pytest.fixture
def small_manager():
    """Create a manager with small capacity for limit testing."""
    return WebSocketConnectionManager(max_connections=3)


@pytest.fixture
def mock_analysis():
    """Provide a mock analysis result."""
    return _create_mock_analysis()


@pytest.fixture
def client():
    """Create a test client for WebSocket testing."""
    return TestClient(app)


# ============================================================
# Connection Manager Unit Tests
# ============================================================


class TestWebSocketConnectionManager:
    """Tests for WebSocketConnectionManager."""

    def test_initial_state(self, manager):
        """Manager starts with no connections."""
        assert manager.active_connections_count == 0
        assert manager.last_analysis is None
        assert not manager.is_at_capacity()

    def test_is_at_capacity_false_when_empty(self, manager):
        """Not at capacity when no connections."""
        assert not manager.is_at_capacity()

    def test_last_analysis_getter_setter(self, manager, mock_analysis):
        """Can set and get last analysis."""
        manager.last_analysis = mock_analysis
        assert manager.last_analysis is not None
        assert manager.last_analysis.underlying == "NIFTY"

    @pytest.mark.asyncio
    async def test_connect_accepts_websocket(self, manager):
        """Should accept a WebSocket connection when under capacity."""
        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED

        result = await manager.connect(ws)

        assert result is True
        assert manager.active_connections_count == 1
        ws.accept.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_connect_rejects_at_capacity(self, small_manager):
        """Should reject connection when at max capacity with code 1008."""
        # Fill to capacity
        for _ in range(3):
            ws = AsyncMock()
            ws.client_state = WebSocketState.CONNECTED
            await small_manager.connect(ws)

        assert small_manager.is_at_capacity()

        # Try one more
        excess_ws = AsyncMock()
        excess_ws.client_state = WebSocketState.CONNECTED
        result = await small_manager.connect(excess_ws)

        assert result is False
        excess_ws.close.assert_awaited_once_with(
            code=1008,
            reason="Server at maximum capacity (100 connections)"
        )

    @pytest.mark.asyncio
    async def test_disconnect_removes_client(self, manager):
        """Disconnect should remove client and clean up resources."""
        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED
        await manager.connect(ws)
        assert manager.active_connections_count == 1

        await manager.disconnect(ws)
        assert manager.active_connections_count == 0

    @pytest.mark.asyncio
    async def test_send_initial_analysis_when_available(self, manager, mock_analysis):
        """Should send last analysis to newly connected client."""
        manager.last_analysis = mock_analysis

        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED
        await manager.connect(ws)
        await manager.send_initial_analysis(ws)

        ws.send_text.assert_awaited()
        sent_text = ws.send_text.call_args[0][0]
        assert "analysis_update" in sent_text
        assert "NIFTY" in sent_text

    @pytest.mark.asyncio
    async def test_send_initial_analysis_no_op_when_none(self, manager):
        """Should not send anything if no analysis is available."""
        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED
        await manager.connect(ws)
        await manager.send_initial_analysis(ws)

        # send_text should not be called (accept is from connect)
        ws.send_text.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_broadcast_analysis_to_all_clients(self, manager, mock_analysis):
        """Should broadcast analysis update to all connected clients."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        ws2 = AsyncMock()
        ws2.client_state = WebSocketState.CONNECTED

        await manager.connect(ws1)
        await manager.connect(ws2)

        await manager.broadcast_analysis(mock_analysis)

        ws1.send_text.assert_awaited()
        ws2.send_text.assert_awaited()

        # Check content
        sent1 = ws1.send_text.call_args[0][0]
        sent2 = ws2.send_text.call_args[0][0]
        assert "analysis_update" in sent1
        assert "analysis_update" in sent2

    @pytest.mark.asyncio
    async def test_broadcast_removes_failed_clients(self, manager, mock_analysis):
        """Should remove clients that fail during broadcast."""
        ws_good = AsyncMock()
        ws_good.client_state = WebSocketState.CONNECTED
        ws_bad = AsyncMock()
        ws_bad.client_state = WebSocketState.CONNECTED
        ws_bad.send_text.side_effect = Exception("Connection lost")

        await manager.connect(ws_good)
        await manager.connect(ws_bad)
        assert manager.active_connections_count == 2

        await manager.broadcast_analysis(mock_analysis)

        # Bad client should be removed
        assert manager.active_connections_count == 1

    @pytest.mark.asyncio
    async def test_broadcast_caches_last_analysis(self, manager, mock_analysis):
        """Broadcast should cache the last analysis for new connections."""
        await manager.broadcast_analysis(mock_analysis)
        assert manager.last_analysis is not None
        assert manager.last_analysis.underlying == "NIFTY"

    @pytest.mark.asyncio
    async def test_broadcast_error_to_clients(self, manager):
        """Should broadcast error message to all clients."""
        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED
        await manager.connect(ws)

        await manager.broadcast_error("Test error message")

        ws.send_text.assert_awaited()
        sent = ws.send_text.call_args[0][0]
        assert "error" in sent
        assert "Test error message" in sent

    @pytest.mark.asyncio
    async def test_close_all_disconnects_all(self, manager):
        """close_all should disconnect all active connections."""
        for _ in range(5):
            ws = AsyncMock()
            ws.client_state = WebSocketState.CONNECTED
            await manager.connect(ws)

        assert manager.active_connections_count == 5
        await manager.close_all()
        assert manager.active_connections_count == 0


# ============================================================
# WebSocket Endpoint Integration Tests
# ============================================================


class TestWebSocketEndpoint:
    """Integration tests for the WebSocket endpoint at /ws/options-scalper."""

    def test_websocket_connection(self, client):
        """Client can connect to the WebSocket endpoint."""
        with client.websocket_connect("/ws/options-scalper") as websocket:
            # Connection successful - just verify it doesn't raise
            pass

    def test_websocket_receives_heartbeat_format(self, client):
        """Verify the WebSocket JSON message format."""
        # Store an analysis so new connections receive it
        analysis = _create_mock_analysis()
        connection_manager.last_analysis = analysis

        with client.websocket_connect("/ws/options-scalper") as websocket:
            # Should receive initial analysis
            data = websocket.receive_json()
            assert data["message_type"] == "analysis_update"
            assert "timestamp" in data
            assert data["underlying"] == "NIFTY"
            assert data["signal_data"] is not None

        # Clean up
        connection_manager.last_analysis = None

    def test_websocket_json_message_format(self, client):
        """Messages should follow the specified JSON format."""
        analysis = _create_mock_analysis()
        connection_manager.last_analysis = analysis

        with client.websocket_connect("/ws/options-scalper") as websocket:
            data = websocket.receive_json()

            # Verify required fields
            assert "message_type" in data
            assert "timestamp" in data
            assert "underlying" in data
            assert "signal_data" in data
            assert "market_data" in data
            assert "error" in data

        connection_manager.last_analysis = None

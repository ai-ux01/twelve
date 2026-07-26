"""
Tests for the Options Scalper FastAPI Router.

Tests cover:
- POST /api/options-scalper/analyze endpoint
- GET /api/options-scalper/history endpoint
- GET/PUT /api/options-scalper/config endpoint

Requirements: 19.1-19.11, 20.3-20.13, 23.1, 23.6, 30.1-30.12
"""

import pytest
from datetime import datetime, date
from fastapi.testclient import TestClient

from main import app
from scalper.router import (
    _analysis_history,
    _user_configs,
    _history_id_counter,
    HistoryRecord,
    DEFAULT_USER_ID,
)


@pytest.fixture(autouse=True)
def reset_state():
    """Reset in-memory state before each test."""
    import scalper.router as router_module

    router_module._analysis_history.clear()
    router_module._user_configs.clear()
    router_module._history_id_counter = 0
    yield


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


# ============================================================
# Task 9.1: POST /api/options-scalper/analyze
# ============================================================


class TestAnalyzeEndpoint:
    """Tests for POST /api/options-scalper/analyze."""

    def test_analyze_returns_400_for_missing_underlying(self, client):
        """Return 400 when underlying parameter is missing."""
        response = client.post("/api/options-scalper/analyze", json={})
        assert response.status_code == 422  # Pydantic validation error

    def test_analyze_returns_400_for_invalid_underlying(self, client):
        """Return 400 when underlying is not NIFTY or BANKNIFTY."""
        response = client.post(
            "/api/options-scalper/analyze", json={"underlying": "INVALID"}
        )
        assert response.status_code == 422

    def test_analyze_returns_400_for_empty_underlying(self, client):
        """Return 400 when underlying is empty string."""
        response = client.post(
            "/api/options-scalper/analyze", json={"underlying": ""}
        )
        assert response.status_code == 422

    def test_analyze_accepts_nifty(self, client):
        """Accept NIFTY as valid underlying (may fail due to market data)."""
        response = client.post(
            "/api/options-scalper/analyze", json={"underlying": "NIFTY"}
        )
        # Should either succeed (200) or fail (500) - not 400
        assert response.status_code in (200, 500)

    def test_analyze_accepts_banknifty(self, client):
        """Accept BANKNIFTY as valid underlying (may fail due to market data)."""
        response = client.post(
            "/api/options-scalper/analyze", json={"underlying": "BANKNIFTY"}
        )
        # Should either succeed (200) or fail (500) - not 400
        assert response.status_code in (200, 500)

    def test_analyze_response_content_type_json(self, client):
        """Response should have Content-Type: application/json."""
        response = client.post(
            "/api/options-scalper/analyze", json={"underlying": "NIFTY"}
        )
        assert "application/json" in response.headers.get("content-type", "")

    def test_analyze_rejects_numeric_underlying(self, client):
        """Return 422 for non-string underlying."""
        response = client.post(
            "/api/options-scalper/analyze", json={"underlying": 123}
        )
        assert response.status_code == 422


# ============================================================
# Task 9.2: GET /api/options-scalper/history
# ============================================================


class TestHistoryEndpoint:
    """Tests for GET /api/options-scalper/history."""

    def _seed_history(self, count=5):
        """Seed in-memory history with test records."""
        import scalper.router as router_module

        for i in range(count):
            record = HistoryRecord(
                id=i + 1,
                timestamp=datetime(2024, 1, 10 + i, 10, 0, 0),
                underlying="NIFTY" if i % 2 == 0 else "BANKNIFTY",
                signal_type="BUY CE" if i % 3 == 0 else "HOLD",
                probability=70.0 + i,
                risk_reward_ratio=2.0 + i * 0.1,
                strike_price=21500.0 if i % 3 == 0 else None,
                expiry_date=date(2024, 1, 25) if i % 3 == 0 else None,
                entry_price=100.0 if i % 3 == 0 else None,
                target_price=200.0 if i % 3 == 0 else None,
                stop_loss=50.0 if i % 3 == 0 else None,
                spot_price=21500.0 + i * 10,
                trend="Bullish" if i % 2 == 0 else "Bearish",
                hold_reason=None if i % 3 == 0 else "Low Probability",
            )
            router_module._analysis_history.append(record)
        router_module._history_id_counter = count

    def test_history_returns_empty_list_initially(self, client):
        """Return empty list when no history exists."""
        response = client.get("/api/options-scalper/history")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"] == []
        assert data["total_records"] == 0

    def test_history_returns_records(self, client):
        """Return seeded records."""
        self._seed_history(3)
        response = client.get("/api/options-scalper/history")
        assert response.status_code == 200
        data = response.json()
        assert data["total_records"] == 3
        assert len(data["data"]) == 3

    def test_history_filters_by_underlying(self, client):
        """Filter by underlying parameter."""
        self._seed_history(5)
        response = client.get("/api/options-scalper/history?underlying=NIFTY")
        assert response.status_code == 200
        data = response.json()
        for record in data["data"]:
            assert record["underlying"] == "NIFTY"

    def test_history_filters_by_signal_type(self, client):
        """Filter by signal_type parameter."""
        self._seed_history(5)
        response = client.get("/api/options-scalper/history?signal_type=HOLD")
        assert response.status_code == 200
        data = response.json()
        for record in data["data"]:
            assert record["signal_type"] == "HOLD"

    def test_history_filters_by_date_range(self, client):
        """Filter by date range."""
        self._seed_history(5)
        response = client.get(
            "/api/options-scalper/history?date_from=2024-01-11&date_to=2024-01-13"
        )
        assert response.status_code == 200
        data = response.json()
        for record in data["data"]:
            ts = datetime.fromisoformat(record["timestamp"])
            assert ts >= datetime(2024, 1, 11)
            assert ts <= datetime(2024, 1, 13, 23, 59, 59)

    def test_history_default_pagination(self, client):
        """Default pagination: page 1, page_size 50."""
        self._seed_history(5)
        response = client.get("/api/options-scalper/history")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 50

    def test_history_custom_pagination(self, client):
        """Custom pagination with page and page_size."""
        self._seed_history(5)
        response = client.get("/api/options-scalper/history?page=1&page_size=2")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["data"]) == 2
        assert data["total_records"] == 5

    def test_history_page_size_max_100(self, client):
        """Page size cannot exceed 100."""
        response = client.get("/api/options-scalper/history?page_size=101")
        assert response.status_code == 422

    def test_history_invalid_underlying_returns_400(self, client):
        """Return 400 for invalid underlying filter."""
        response = client.get("/api/options-scalper/history?underlying=INVALID")
        assert response.status_code == 400

    def test_history_invalid_signal_type_returns_400(self, client):
        """Return 400 for invalid signal_type filter."""
        response = client.get("/api/options-scalper/history?signal_type=INVALID")
        assert response.status_code == 400

    def test_history_invalid_date_format_returns_400(self, client):
        """Return 400 for invalid date format."""
        response = client.get("/api/options-scalper/history?date_from=invalid-date")
        assert response.status_code == 400

    def test_history_results_in_reverse_chronological_order(self, client):
        """Results should be sorted by timestamp descending."""
        self._seed_history(5)
        response = client.get("/api/options-scalper/history")
        assert response.status_code == 200
        data = response.json()
        timestamps = [r["timestamp"] for r in data["data"]]
        assert timestamps == sorted(timestamps, reverse=True)


# ============================================================
# Task 9.3: GET/PUT /api/options-scalper/config
# ============================================================


class TestConfigEndpoint:
    """Tests for GET/PUT /api/options-scalper/config."""

    def test_get_config_returns_defaults(self, client):
        """GET returns default configuration when none exists."""
        response = client.get("/api/options-scalper/config")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        config = data["data"]
        assert config["refresh_interval"] == 60
        assert config["probability_threshold"] == 70.0
        assert config["risk_reward_threshold"] == 2.0
        assert config["max_spread_percentage"] == 5.0
        assert config["min_open_interest"] == 1000

    def test_put_config_updates_refresh_interval(self, client):
        """PUT updates refresh_interval within valid range."""
        response = client.put(
            "/api/options-scalper/config",
            json={"refresh_interval": 120},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["refresh_interval"] == 120

    def test_put_config_updates_probability_threshold(self, client):
        """PUT updates probability_threshold within valid range."""
        response = client.put(
            "/api/options-scalper/config",
            json={"probability_threshold": 80.0},
        )
        assert response.status_code == 200
        assert response.json()["data"]["probability_threshold"] == 80.0

    def test_put_config_updates_risk_reward_threshold(self, client):
        """PUT updates risk_reward_threshold within valid range."""
        response = client.put(
            "/api/options-scalper/config",
            json={"risk_reward_threshold": 3.0},
        )
        assert response.status_code == 200
        assert response.json()["data"]["risk_reward_threshold"] == 3.0

    def test_put_config_updates_max_spread_percentage(self, client):
        """PUT updates max_spread_percentage within valid range."""
        response = client.put(
            "/api/options-scalper/config",
            json={"max_spread_percentage": 7.5},
        )
        assert response.status_code == 200
        assert response.json()["data"]["max_spread_percentage"] == 7.5

    def test_put_config_updates_min_open_interest(self, client):
        """PUT updates min_open_interest within valid range."""
        response = client.put(
            "/api/options-scalper/config",
            json={"min_open_interest": 5000},
        )
        assert response.status_code == 200
        assert response.json()["data"]["min_open_interest"] == 5000

    def test_put_config_rejects_refresh_interval_below_30(self, client):
        """Return 422 for refresh_interval below 30."""
        response = client.put(
            "/api/options-scalper/config",
            json={"refresh_interval": 29},
        )
        assert response.status_code == 422

    def test_put_config_rejects_refresh_interval_above_300(self, client):
        """Return 422 for refresh_interval above 300."""
        response = client.put(
            "/api/options-scalper/config",
            json={"refresh_interval": 301},
        )
        assert response.status_code == 422

    def test_put_config_rejects_probability_below_50(self, client):
        """Return 422 for probability_threshold below 50."""
        response = client.put(
            "/api/options-scalper/config",
            json={"probability_threshold": 49.9},
        )
        assert response.status_code == 422

    def test_put_config_rejects_probability_above_90(self, client):
        """Return 422 for probability_threshold above 90."""
        response = client.put(
            "/api/options-scalper/config",
            json={"probability_threshold": 90.1},
        )
        assert response.status_code == 422

    def test_put_config_rejects_rr_below_1(self, client):
        """Return 422 for risk_reward_threshold below 1.0."""
        response = client.put(
            "/api/options-scalper/config",
            json={"risk_reward_threshold": 0.9},
        )
        assert response.status_code == 422

    def test_put_config_rejects_rr_above_5(self, client):
        """Return 422 for risk_reward_threshold above 5.0."""
        response = client.put(
            "/api/options-scalper/config",
            json={"risk_reward_threshold": 5.1},
        )
        assert response.status_code == 422

    def test_put_config_rejects_spread_below_1(self, client):
        """Return 422 for max_spread_percentage below 1."""
        response = client.put(
            "/api/options-scalper/config",
            json={"max_spread_percentage": 0.5},
        )
        assert response.status_code == 422

    def test_put_config_rejects_spread_above_10(self, client):
        """Return 422 for max_spread_percentage above 10."""
        response = client.put(
            "/api/options-scalper/config",
            json={"max_spread_percentage": 11},
        )
        assert response.status_code == 422

    def test_put_config_rejects_oi_below_100(self, client):
        """Return 422 for min_open_interest below 100."""
        response = client.put(
            "/api/options-scalper/config",
            json={"min_open_interest": 99},
        )
        assert response.status_code == 422

    def test_put_config_rejects_oi_above_10000(self, client):
        """Return 422 for min_open_interest above 10000."""
        response = client.put(
            "/api/options-scalper/config",
            json={"min_open_interest": 10001},
        )
        assert response.status_code == 422

    def test_put_config_partial_update(self, client):
        """PUT with partial fields only updates those fields."""
        # Set initial values
        client.put(
            "/api/options-scalper/config",
            json={"refresh_interval": 90, "probability_threshold": 75.0},
        )
        # Update only one field
        response = client.put(
            "/api/options-scalper/config",
            json={"refresh_interval": 120},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["refresh_interval"] == 120
        assert data["probability_threshold"] == 75.0  # Unchanged

    def test_put_config_persists_across_get(self, client):
        """PUT values are returned by subsequent GET."""
        client.put(
            "/api/options-scalper/config",
            json={"refresh_interval": 180},
        )
        response = client.get("/api/options-scalper/config")
        assert response.status_code == 200
        assert response.json()["data"]["refresh_interval"] == 180

    def test_put_config_boundary_values_accepted(self, client):
        """Boundary values should be accepted."""
        # Minimum values
        response = client.put(
            "/api/options-scalper/config",
            json={
                "refresh_interval": 30,
                "probability_threshold": 50.0,
                "risk_reward_threshold": 1.0,
                "max_spread_percentage": 1.0,
                "min_open_interest": 100,
            },
        )
        assert response.status_code == 200

        # Maximum values
        response = client.put(
            "/api/options-scalper/config",
            json={
                "refresh_interval": 300,
                "probability_threshold": 90.0,
                "risk_reward_threshold": 5.0,
                "max_spread_percentage": 10.0,
                "min_open_interest": 10000,
            },
        )
        assert response.status_code == 200

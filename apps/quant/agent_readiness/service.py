"""
Agent Readiness Service.

Core service managing readiness state, gate validation,
stage advancement, and health/metrics updates.

All storage is in-memory using a Python dictionary keyed by agent_id,
with JSON file persistence.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List

from fastapi import HTTPException

from .models import (
    AgentReadiness,
    AdvanceRequest,
    DataHealthStatus,
    HealthIndicators,
    PerformanceMetrics,
    ProbabilityCalibration,
    ReadinessStage,
    StageAdvancement,
    UpdateHealthRequest,
    UpdateMetricsRequest,
    ValidationStatuses,
    ValidationStatus,
    PaperTradingStatus,
    ShadowModeStatus,
    QuantEngineHealthStatus,
    AIHealthStatus,
    STAGE_ORDER,
)

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)


class AgentReadinessService:
    """Service managing agent readiness progression with gated advancement and persistence."""

    def __init__(self, agent_service):
        """
        Initialize with a reference to the AgentService for agent validation.

        Args:
            agent_service: The AgentService instance to validate agent existence.
        """
        self.agent_service = agent_service
        self._store = JsonFileStore("agent_readiness")
        self.readiness_records: Dict[str, AgentReadiness] = {}
        self._load()

    def _load(self) -> None:
        """Load persisted readiness records from JSON file."""
        raw_data = self._store.get_all()
        if not raw_data:
            return

        for agent_id, rdata in raw_data.items():
            try:
                self.readiness_records[agent_id] = AgentReadiness(**rdata)
            except Exception as e:
                logger.warning(f"Failed to load readiness for {agent_id}: {e}")

    def _save(self) -> None:
        """Persist all readiness records to JSON file."""
        data: Dict[str, Any] = {
            agent_id: record.model_dump(mode="python")
            for agent_id, record in self.readiness_records.items()
        }
        self._store.set_all(data)

    def get_readiness(self, agent_id: str) -> AgentReadiness:
        """
        Get readiness record for an agent, auto-initializing at DRAFT if needed.

        Validates agent exists in the agent architecture service.
        Raises HTTP 404 if agent does not exist.
        """
        # Validate agent exists (raises 404 if not found)
        self.agent_service.get_agent(agent_id)

        # Auto-initialize at DRAFT if no record exists
        if agent_id not in self.readiness_records:
            readiness = AgentReadiness(agent_id=agent_id)
            self.readiness_records[agent_id] = readiness
            self._save()

        record = self.readiness_records[agent_id]
        # Compute is_validated
        stage_index = STAGE_ORDER.index(record.current_stage)
        backtest_index = STAGE_ORDER.index(ReadinessStage.BACKTEST_VALIDATED)
        record.is_validated = stage_index >= backtest_index
        return record

    def list_readiness(self) -> List[AgentReadiness]:
        """Return all readiness records."""
        results = []
        for record in self.readiness_records.values():
            stage_index = STAGE_ORDER.index(record.current_stage)
            backtest_index = STAGE_ORDER.index(ReadinessStage.BACKTEST_VALIDATED)
            record.is_validated = stage_index >= backtest_index
            results.append(record)
        return results

    def advance_stage(self, agent_id: str, request: AdvanceRequest) -> AgentReadiness:
        """
        Advance agent to the next readiness stage.

        Validates:
        - Agent exists
        - Next stage is exactly current + 1
        - Target is not AUTONOMOUS (always blocked, HTTP 403)
        - All gate criteria for the target stage are met

        Raises:
        - HTTPException 403 if target is AUTONOMOUS
        - HTTPException 409 if gate criteria are not met
        """
        readiness = self.get_readiness(agent_id)

        current_index = STAGE_ORDER.index(readiness.current_stage)
        next_index = current_index + 1

        # Check if already at max (CONTROLLED_LIVE is the last reachable)
        if next_index >= len(STAGE_ORDER):
            raise HTTPException(
                status_code=403,
                detail="Cannot advance beyond the last stage",
            )

        target_stage = STAGE_ORDER[next_index]

        # AUTONOMOUS is always blocked
        if target_stage == ReadinessStage.AUTONOMOUS:
            raise HTTPException(
                status_code=403,
                detail="AUTONOMOUS stage is disabled in V1",
            )

        # Validate gate criteria
        gate_results = self.validate_gate(readiness, target_stage)
        unmet = [criteria for criteria, met in gate_results.items() if not met]

        if unmet:
            raise HTTPException(
                status_code=409,
                detail={
                    "detail": "Gate criteria not met",
                    "unmet_criteria": unmet,
                    "gate_results": gate_results,
                },
            )

        # Advance stage
        readiness.current_stage = target_stage
        advancement = StageAdvancement(
            stage=target_stage,
            timestamp=datetime.utcnow(),
            gate_results=gate_results,
        )
        readiness.stage_history.append(advancement)
        readiness.updated_at = datetime.utcnow()

        # Update is_validated
        stage_index = STAGE_ORDER.index(readiness.current_stage)
        backtest_index = STAGE_ORDER.index(ReadinessStage.BACKTEST_VALIDATED)
        readiness.is_validated = stage_index >= backtest_index

        self._save()
        return readiness

    def validate_gate(self, readiness: AgentReadiness, target_stage: ReadinessStage) -> Dict[str, bool]:
        """
        Validate gate criteria for advancing to target_stage.

        Returns a dict of criteria names to bool (True = met, False = unmet).
        AUTONOMOUS always returns all criteria as unmet.
        """
        if target_stage == ReadinessStage.AUTONOMOUS:
            return {"autonomous_blocked": False}

        if target_stage == ReadinessStage.KNOWLEDGE_READY:
            return {
                "data_health_connected": readiness.health.data_health == DataHealthStatus.CONNECTED,
                "quant_engine_running": readiness.health.quant_engine_health == QuantEngineHealthStatus.RUNNING,
            }

        if target_stage == ReadinessStage.BACKTEST_VALIDATED:
            return {
                "backtest_passed": readiness.validations.backtest_status == ValidationStatus.PASSED,
                "profit_factor_above_1": readiness.metrics.profit_factor > 1.0,
            }

        if target_stage == ReadinessStage.OUT_OF_SAMPLE_VALIDATED:
            return {
                "out_of_sample_passed": readiness.validations.out_of_sample_status == ValidationStatus.PASSED,
                "profit_factor_above_1": readiness.metrics.profit_factor > 1.0,
                "win_rate_above_40pct": readiness.metrics.win_rate > 0.4,
            }

        if target_stage == ReadinessStage.WALK_FORWARD_VALIDATED:
            return {
                "walk_forward_passed": readiness.validations.walk_forward_status == ValidationStatus.PASSED,
                "expectancy_positive": readiness.metrics.expectancy > 0,
            }

        if target_stage == ReadinessStage.PAPER_TRADING:
            return {
                "ai_health_connected": readiness.health.ai_health == AIHealthStatus.CONNECTED,
                "data_health_connected": readiness.health.data_health == DataHealthStatus.CONNECTED,
                "quant_engine_running": readiness.health.quant_engine_health == QuantEngineHealthStatus.RUNNING,
                "walk_forward_passed": readiness.validations.walk_forward_status == ValidationStatus.PASSED,
            }

        if target_stage == ReadinessStage.SHADOW_MODE:
            return {
                "paper_trading_running": readiness.validations.paper_trading_status == PaperTradingStatus.RUNNING,
                "trade_count_gte_20": readiness.metrics.trade_count >= 20,
                "profit_factor_above_1": readiness.metrics.profit_factor > 1.0,
            }

        if target_stage == ReadinessStage.CONTROLLED_LIVE:
            calibration_error = abs(
                readiness.calibration.expected_probability - readiness.calibration.actual_probability
            )
            return {
                "shadow_mode_passed": readiness.validations.shadow_mode_status == ShadowModeStatus.PASSED,
                "calibration_error_below_20pct": calibration_error < 0.2,
            }

        # Fallback (should not happen)
        return {}

    def update_health(self, agent_id: str, request: UpdateHealthRequest) -> AgentReadiness:
        """
        Update health indicators with partial data (only set provided fields).

        Validates agent exists. Preserves unset fields.
        """
        readiness = self.get_readiness(agent_id)

        if request.data_health is not None:
            readiness.health.data_health = request.data_health
        if request.quant_engine_health is not None:
            readiness.health.quant_engine_health = request.quant_engine_health
        if request.ai_health is not None:
            readiness.health.ai_health = request.ai_health
        if request.risk_engine_health is not None:
            readiness.health.risk_engine_health = request.risk_engine_health

        readiness.health.last_updated = datetime.utcnow()
        readiness.updated_at = datetime.utcnow()
        self._save()
        return readiness

    def update_metrics(self, agent_id: str, request: UpdateMetricsRequest) -> AgentReadiness:
        """
        Update performance metrics, validations, and calibration with partial data.

        Validates agent exists. Preserves unset fields.
        Pydantic handles bounds validation on the request model.
        """
        readiness = self.get_readiness(agent_id)

        # Update metrics
        if request.trade_count is not None:
            readiness.metrics.trade_count = request.trade_count
        if request.win_rate is not None:
            readiness.metrics.win_rate = request.win_rate
        if request.profit_factor is not None:
            readiness.metrics.profit_factor = request.profit_factor
        if request.expectancy is not None:
            readiness.metrics.expectancy = request.expectancy
        if request.max_drawdown is not None:
            readiness.metrics.max_drawdown = request.max_drawdown

        # Update validations
        if request.backtest_status is not None:
            readiness.validations.backtest_status = request.backtest_status
        if request.out_of_sample_status is not None:
            readiness.validations.out_of_sample_status = request.out_of_sample_status
        if request.walk_forward_status is not None:
            readiness.validations.walk_forward_status = request.walk_forward_status
        if request.paper_trading_status is not None:
            readiness.validations.paper_trading_status = request.paper_trading_status
        if request.shadow_mode_status is not None:
            readiness.validations.shadow_mode_status = request.shadow_mode_status

        # Update calibration
        if request.expected_probability is not None:
            readiness.calibration.expected_probability = request.expected_probability
        if request.actual_probability is not None:
            readiness.calibration.actual_probability = request.actual_probability

        readiness.updated_at = datetime.utcnow()
        self._save()
        return readiness

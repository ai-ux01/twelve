"""
Agent Readiness Data Models.

Defines all enums, entity models, and request models for the
nine-stage gated readiness progression system.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# === Enums ===


class ReadinessStage(str, Enum):
    """Nine-stage readiness progression for agents."""
    DRAFT = "DRAFT"
    KNOWLEDGE_READY = "KNOWLEDGE_READY"
    BACKTEST_VALIDATED = "BACKTEST_VALIDATED"
    OUT_OF_SAMPLE_VALIDATED = "OUT_OF_SAMPLE_VALIDATED"
    WALK_FORWARD_VALIDATED = "WALK_FORWARD_VALIDATED"
    PAPER_TRADING = "PAPER_TRADING"
    SHADOW_MODE = "SHADOW_MODE"
    CONTROLLED_LIVE = "CONTROLLED_LIVE"
    AUTONOMOUS = "AUTONOMOUS"


# Ordered list for stage comparison
STAGE_ORDER: List[ReadinessStage] = [
    ReadinessStage.DRAFT,
    ReadinessStage.KNOWLEDGE_READY,
    ReadinessStage.BACKTEST_VALIDATED,
    ReadinessStage.OUT_OF_SAMPLE_VALIDATED,
    ReadinessStage.WALK_FORWARD_VALIDATED,
    ReadinessStage.PAPER_TRADING,
    ReadinessStage.SHADOW_MODE,
    ReadinessStage.CONTROLLED_LIVE,
    ReadinessStage.AUTONOMOUS,
]


class DataHealthStatus(str, Enum):
    """Data feed health status."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    DEGRADED = "degraded"


class QuantEngineHealthStatus(str, Enum):
    """Quant engine health status."""
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


class AIHealthStatus(str, Enum):
    """AI service health status."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class RiskEngineHealthStatus(str, Enum):
    """Risk engine health status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class ValidationStatus(str, Enum):
    """Validation test status."""
    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"


class PaperTradingStatus(str, Enum):
    """Paper trading operational status."""
    RUNNING = "running"
    STOPPED = "stopped"
    NOT_STARTED = "not_started"


class ShadowModeStatus(str, Enum):
    """Shadow mode operational status."""
    PASSED = "passed"
    FAILED = "failed"
    RUNNING = "running"
    NOT_STARTED = "not_started"


# === Entity Models ===


class HealthIndicators(BaseModel):
    """Health status indicators for all system components."""
    data_health: DataHealthStatus = DataHealthStatus.DISCONNECTED
    quant_engine_health: QuantEngineHealthStatus = QuantEngineHealthStatus.STOPPED
    ai_health: AIHealthStatus = AIHealthStatus.DISCONNECTED
    risk_engine_health: RiskEngineHealthStatus = RiskEngineHealthStatus.INACTIVE
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class PerformanceMetrics(BaseModel):
    """Performance metrics for agent trading validation."""
    trade_count: int = Field(default=0, ge=0)
    win_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    profit_factor: float = Field(default=0.0, ge=0.0)
    expectancy: float = 0.0
    max_drawdown: float = Field(default=0.0, ge=0.0, le=1.0)


class ProbabilityCalibration(BaseModel):
    """Probability calibration data for shadow mode validation."""
    expected_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    actual_probability: float = Field(default=0.0, ge=0.0, le=1.0)


class ValidationStatuses(BaseModel):
    """Validation statuses for each testing phase."""
    backtest_status: ValidationStatus = ValidationStatus.PENDING
    out_of_sample_status: ValidationStatus = ValidationStatus.PENDING
    walk_forward_status: ValidationStatus = ValidationStatus.PENDING
    paper_trading_status: PaperTradingStatus = PaperTradingStatus.NOT_STARTED
    shadow_mode_status: ShadowModeStatus = ShadowModeStatus.NOT_STARTED


class StageAdvancement(BaseModel):
    """Record of a stage advancement event."""
    stage: ReadinessStage
    timestamp: datetime
    gate_results: Dict[str, bool]


class AgentReadiness(BaseModel):
    """Full readiness state for an agent."""
    agent_id: str
    current_stage: ReadinessStage = ReadinessStage.DRAFT
    health: HealthIndicators = Field(default_factory=HealthIndicators)
    metrics: PerformanceMetrics = Field(default_factory=PerformanceMetrics)
    calibration: ProbabilityCalibration = Field(default_factory=ProbabilityCalibration)
    validations: ValidationStatuses = Field(default_factory=ValidationStatuses)
    stage_history: List[StageAdvancement] = Field(default_factory=list)
    is_validated: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# === Request Models ===


class AdvanceRequest(BaseModel):
    """Request to advance an agent to the next readiness stage."""
    reason: str = Field(..., min_length=1)


class UpdateHealthRequest(BaseModel):
    """Request to update health indicators (partial update)."""
    data_health: Optional[DataHealthStatus] = None
    quant_engine_health: Optional[QuantEngineHealthStatus] = None
    ai_health: Optional[AIHealthStatus] = None
    risk_engine_health: Optional[RiskEngineHealthStatus] = None


class UpdateMetricsRequest(BaseModel):
    """Request to update performance metrics, validations, and calibration (partial update)."""
    trade_count: Optional[int] = Field(None, ge=0)
    win_rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    profit_factor: Optional[float] = Field(None, ge=0.0)
    expectancy: Optional[float] = None
    max_drawdown: Optional[float] = Field(None, ge=0.0, le=1.0)
    backtest_status: Optional[ValidationStatus] = None
    out_of_sample_status: Optional[ValidationStatus] = None
    walk_forward_status: Optional[ValidationStatus] = None
    paper_trading_status: Optional[PaperTradingStatus] = None
    shadow_mode_status: Optional[ShadowModeStatus] = None
    expected_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    actual_probability: Optional[float] = Field(None, ge=0.0, le=1.0)

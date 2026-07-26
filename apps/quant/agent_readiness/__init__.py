"""
Agent Readiness Dashboard Module.

Provides a nine-stage gated progression system for agent readiness,
with gate validation, health monitoring, and performance metrics tracking.
"""

from .models import (
    ReadinessStage,
    DataHealthStatus,
    QuantEngineHealthStatus,
    AIHealthStatus,
    RiskEngineHealthStatus,
    ValidationStatus,
    PaperTradingStatus,
    ShadowModeStatus,
    HealthIndicators,
    PerformanceMetrics,
    ProbabilityCalibration,
    ValidationStatuses,
    StageAdvancement,
    AgentReadiness,
    AdvanceRequest,
    UpdateHealthRequest,
    UpdateMetricsRequest,
    STAGE_ORDER,
)
from .service import AgentReadinessService
from .router import router

__all__ = [
    "ReadinessStage",
    "DataHealthStatus",
    "QuantEngineHealthStatus",
    "AIHealthStatus",
    "RiskEngineHealthStatus",
    "ValidationStatus",
    "PaperTradingStatus",
    "ShadowModeStatus",
    "HealthIndicators",
    "PerformanceMetrics",
    "ProbabilityCalibration",
    "ValidationStatuses",
    "StageAdvancement",
    "AgentReadiness",
    "AdvanceRequest",
    "UpdateHealthRequest",
    "UpdateMetricsRequest",
    "STAGE_ORDER",
    "AgentReadinessService",
    "router",
]

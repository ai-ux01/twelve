"""
Agent Readiness FastAPI Router.

Provides REST endpoints for readiness state retrieval,
stage advancement, health updates, and metrics updates.
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter

from .models import (
    AgentReadiness,
    AdvanceRequest,
    UpdateHealthRequest,
    UpdateMetricsRequest,
)
from .service import AgentReadinessService
from agents.service import AgentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent-readiness", tags=["agent-readiness"])

# Module-level singleton service, referencing the agents service
from agents.router import get_service as get_agent_service

_service = AgentReadinessService(agent_service=get_agent_service())


def get_service() -> AgentReadinessService:
    """Get the shared AgentReadinessService instance."""
    return _service


def set_service(service: AgentReadinessService) -> None:
    """Set the service instance (useful for testing)."""
    global _service
    _service = service


# === Endpoints ===


@router.get("", response_model=List[AgentReadiness])
async def list_readiness() -> List[AgentReadiness]:
    """List all agent readiness records."""
    service = get_service()
    return service.list_readiness()


@router.get("/{agent_id}", response_model=AgentReadiness)
async def get_readiness(agent_id: str) -> AgentReadiness:
    """Get full readiness state for an agent (auto-initializes at DRAFT if needed)."""
    service = get_service()
    return service.get_readiness(agent_id)


@router.post("/{agent_id}/advance", response_model=AgentReadiness)
async def advance_stage(agent_id: str, request: AdvanceRequest) -> AgentReadiness:
    """
    Advance agent to the next readiness stage.

    Returns 403 if target is AUTONOMOUS.
    Returns 409 if gate criteria are not met.
    """
    service = get_service()
    return service.advance_stage(agent_id, request)


@router.put("/{agent_id}/health", response_model=AgentReadiness)
async def update_health(agent_id: str, request: UpdateHealthRequest) -> AgentReadiness:
    """Update health indicators (partial update — only provided fields are changed)."""
    service = get_service()
    return service.update_health(agent_id, request)


@router.put("/{agent_id}/metrics", response_model=AgentReadiness)
async def update_metrics(agent_id: str, request: UpdateMetricsRequest) -> AgentReadiness:
    """Update performance metrics, validations, and calibration (partial update)."""
    service = get_service()
    return service.update_metrics(agent_id, request)

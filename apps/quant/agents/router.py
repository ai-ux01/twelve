"""
Agent Architecture FastAPI Router.

Provides REST endpoints for agent CRUD, lifecycle management,
task/policy/memory management, decision pipeline, and supervisor actions.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from .models import (
    Agent,
    AgentAction,
    AgentDecision,
    AgentExecution,
    AgentMemory,
    AgentObservation,
    AgentOutcome,
    AgentPolicy,
    AgentStatus,
    AgentTask,
    AgentType,
    AuditTrail,
    CreateActionRequest,
    CreateAgentRequest,
    CreateDecisionRequest,
    CreateExecutionRequest,
    CreateMemoryRequest,
    CreateObservationRequest,
    CreateOutcomeRequest,
    CreatePolicyRequest,
    CreateTaskRequest,
    MemoryType,
    ObservationType,
    TaskStatus,
    TogglePolicyRequest,
    UpdateAgentRequest,
    UpdateTaskRequest,
)
from .service import AgentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agents"])

# Module-level singleton service
_service = AgentService()


def get_service() -> AgentService:
    """Get the shared AgentService instance."""
    return _service


def set_service(service: AgentService) -> None:
    """Set the service instance (useful for testing)."""
    global _service
    _service = service


# === Agent CRUD Endpoints ===


@router.post("", response_model=Agent)
async def create_agent(request: CreateAgentRequest) -> Agent:
    """Create a new agent with DRAFT status."""
    service = get_service()
    return service.create_agent(request)


@router.get("", response_model=List[Agent])
async def list_agents(
    agent_type: Optional[AgentType] = Query(None, description="Filter by agent type"),
    status: Optional[AgentStatus] = Query(None, description="Filter by status"),
) -> List[Agent]:
    """List all agents with optional type and status filters."""
    service = get_service()
    return service.list_agents(agent_type=agent_type, status=status)


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str) -> Agent:
    """Get a single agent by ID."""
    service = get_service()
    return service.get_agent(agent_id)


@router.patch("/{agent_id}", response_model=Agent)
async def update_agent(agent_id: str, request: UpdateAgentRequest) -> Agent:
    """Update agent config, name, or status."""
    service = get_service()
    return service.update_agent(agent_id, request)


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str) -> dict:
    """Delete agent and all associated data."""
    service = get_service()
    service.delete_agent(agent_id)
    return {"detail": "Agent deleted", "agent_id": agent_id}


# === Task Endpoints ===


@router.post("/{agent_id}/tasks", response_model=AgentTask)
async def create_task(agent_id: str, request: CreateTaskRequest) -> AgentTask:
    """Create a task for an agent."""
    service = get_service()
    return service.create_task(agent_id, request)


@router.get("/{agent_id}/tasks", response_model=List[AgentTask])
async def list_tasks(
    agent_id: str,
    status: Optional[TaskStatus] = Query(None, description="Filter by task status"),
) -> List[AgentTask]:
    """List tasks for an agent with optional status filter."""
    service = get_service()
    return service.list_tasks(agent_id, status=status)


@router.patch("/{agent_id}/tasks/{task_id}", response_model=AgentTask)
async def update_task(agent_id: str, task_id: str, request: UpdateTaskRequest) -> AgentTask:
    """Update a task's status or metadata."""
    service = get_service()
    # Validate task belongs to agent
    task = service.tasks.get(task_id)
    if task is None or task.agent_id != agent_id:
        raise HTTPException(status_code=404, detail={"detail": "Task not found", "task_id": task_id})
    return service.update_task(task_id, request)


# === Policy Endpoints ===


@router.post("/{agent_id}/policies", response_model=AgentPolicy)
async def create_policy(agent_id: str, request: CreatePolicyRequest) -> AgentPolicy:
    """Create a policy for an agent."""
    service = get_service()
    return service.create_policy(agent_id, request)


@router.get("/{agent_id}/policies", response_model=List[AgentPolicy])
async def list_policies(agent_id: str) -> List[AgentPolicy]:
    """List all policies for an agent."""
    service = get_service()
    return service.list_policies(agent_id)


@router.patch("/{agent_id}/policies/{policy_id}", response_model=AgentPolicy)
async def toggle_policy(agent_id: str, policy_id: str, request: TogglePolicyRequest) -> AgentPolicy:
    """Enable or disable a policy."""
    service = get_service()
    # Validate policy belongs to agent
    policy = service.policies.get(policy_id)
    if policy is None or policy.agent_id != agent_id:
        raise HTTPException(status_code=404, detail={"detail": "Policy not found", "policy_id": policy_id})
    return service.toggle_policy(policy_id, request.enabled)


# === Observation Endpoints ===


@router.post("/{agent_id}/observations", response_model=AgentObservation)
async def create_observation(agent_id: str, request: CreateObservationRequest) -> AgentObservation:
    """Record an observation for an agent."""
    service = get_service()
    return service.create_observation(agent_id, request)


@router.get("/{agent_id}/observations", response_model=List[AgentObservation])
async def list_observations(
    agent_id: str,
    observation_type: Optional[ObservationType] = Query(None, description="Filter by observation type"),
) -> List[AgentObservation]:
    """List observations for an agent."""
    service = get_service()
    return service.list_observations(agent_id, obs_type=observation_type)


# === Decision Endpoints ===


@router.post("/{agent_id}/decisions", response_model=AgentDecision)
async def create_decision(agent_id: str, request: CreateDecisionRequest) -> AgentDecision:
    """Record a decision for an agent."""
    service = get_service()
    return service.create_decision(agent_id, request)


@router.get("/{agent_id}/decisions", response_model=List[AgentDecision])
async def list_decisions(
    agent_id: str,
    decision_type: Optional[str] = Query(None, description="Filter by decision type"),
) -> List[AgentDecision]:
    """List decisions for an agent."""
    service = get_service()
    return service.list_decisions(agent_id, decision_type=decision_type)


@router.get("/{agent_id}/decisions/{decision_id}/audit-trail", response_model=AuditTrail)
async def get_audit_trail(agent_id: str, decision_id: str) -> AuditTrail:
    """Get full audit trail for a decision."""
    service = get_service()
    # Validate agent exists
    service.get_agent(agent_id)
    return service.get_audit_trail(decision_id)


# === Action Endpoints ===


@router.post("/{agent_id}/actions", response_model=AgentAction)
async def create_action(agent_id: str, request: CreateActionRequest) -> AgentAction:
    """Record an action for an agent."""
    service = get_service()
    return service.create_action(agent_id, request)


# === Execution Endpoints ===


@router.post("/{agent_id}/executions", response_model=AgentExecution)
async def create_execution(agent_id: str, request: CreateExecutionRequest) -> AgentExecution:
    """Record an execution for an agent."""
    service = get_service()
    return service.create_execution(agent_id, request)


# === Outcome Endpoints ===


@router.post("/{agent_id}/outcomes", response_model=AgentOutcome)
async def create_outcome(agent_id: str, request: CreateOutcomeRequest) -> AgentOutcome:
    """Record an outcome for an agent."""
    service = get_service()
    return service.create_outcome(agent_id, request)


# === Memory Endpoints ===


@router.post("/{agent_id}/memory", response_model=AgentMemory)
async def create_memory(agent_id: str, request: CreateMemoryRequest) -> AgentMemory:
    """Create a memory entry for an agent."""
    service = get_service()
    return service.create_memory(agent_id, request)


@router.get("/{agent_id}/memory", response_model=List[AgentMemory])
async def list_memory(
    agent_id: str,
    memory_type: Optional[MemoryType] = Query(None, description="Filter by memory type"),
) -> List[AgentMemory]:
    """List memory entries for an agent."""
    service = get_service()
    return service.list_memory(agent_id, memory_type=memory_type)


@router.delete("/{agent_id}/memory/{memory_id}")
async def delete_memory(agent_id: str, memory_id: str) -> dict:
    """Delete a memory entry."""
    service = get_service()
    # Validate memory belongs to agent
    memory_entry = service.memory.get(memory_id)
    if memory_entry is None or memory_entry.agent_id != agent_id:
        raise HTTPException(status_code=404, detail={"detail": "Memory entry not found", "memory_id": memory_id})
    service.delete_memory(memory_id)
    return {"detail": "Memory entry deleted", "memory_id": memory_id}

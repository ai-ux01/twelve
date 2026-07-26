"""
Agent Architecture Data Models.

Defines all enums, entity models, request models, and the
valid lifecycle transition map for the agent system.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# === Enums ===


class AgentType(str, Enum):
    """Types of agents in the system."""
    SWING = "SWING"
    INTRADAY_STOCK = "INTRADAY_STOCK"
    OPTIONS_SCALPING = "OPTIONS_SCALPING"
    RISK = "RISK"
    TRADE_COACH = "TRADE_COACH"
    RESEARCH = "RESEARCH"
    PORTFOLIO = "PORTFOLIO"
    SUPERVISOR = "SUPERVISOR"


class AgentStatus(str, Enum):
    """Agent lifecycle statuses."""
    DRAFT = "DRAFT"
    TESTING = "TESTING"
    PAPER = "PAPER"
    SHADOW = "SHADOW"
    CONTROLLED_LIVE = "CONTROLLED_LIVE"
    PAUSED = "PAUSED"
    DISABLED = "DISABLED"


class TaskStatus(str, Enum):
    """Task completion statuses."""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PolicyType(str, Enum):
    """Types of agent policies."""
    RISK_LIMIT = "RISK_LIMIT"
    POSITION_LIMIT = "POSITION_LIMIT"
    TRADING_HOURS = "TRADING_HOURS"
    INSTRUMENT_RESTRICTION = "INSTRUMENT_RESTRICTION"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"


class ObservationType(str, Enum):
    """Types of observations agents can record."""
    MARKET_DATA = "MARKET_DATA"
    PORTFOLIO_STATE = "PORTFOLIO_STATE"
    SIGNAL = "SIGNAL"
    NEWS = "NEWS"
    USER_INPUT = "USER_INPUT"


class DecisionType(str, Enum):
    """Types of decisions agents can make."""
    TRADE_RECOMMENDATION = "TRADE_RECOMMENDATION"
    RISK_ALERT = "RISK_ALERT"
    PORTFOLIO_ADJUSTMENT = "PORTFOLIO_ADJUSTMENT"
    COACHING_INSIGHT = "COACHING_INSIGHT"
    RESEARCH_FINDING = "RESEARCH_FINDING"


class ActionType(str, Enum):
    """
    Allowed action types for agents.

    Safety invariant: No broker execution types are permitted.
    Only paper trading, recommendations, alerts, rebalancing suggestions,
    coaching, and research reports are allowed.
    """
    PAPER_TRADE = "PAPER_TRADE"
    RECOMMEND = "RECOMMEND"
    ALERT = "ALERT"
    REBALANCE = "REBALANCE"
    COACH = "COACH"
    RESEARCH_REPORT = "RESEARCH_REPORT"


class ExecutionStatus(str, Enum):
    """Execution statuses."""
    PENDING = "PENDING"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"


class OutcomeStatus(str, Enum):
    """Outcome statuses."""
    SUCCESS = "SUCCESS"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    FAILURE = "FAILURE"


class MemoryType(str, Enum):
    """Types of agent memory entries."""
    TRADE_HISTORY = "TRADE_HISTORY"
    PATTERN = "PATTERN"
    PREFERENCE = "PREFERENCE"
    CONTEXT = "CONTEXT"
    LESSON_LEARNED = "LESSON_LEARNED"


# === Valid Lifecycle Transitions ===

VALID_TRANSITIONS: Dict[AgentStatus, List[AgentStatus]] = {
    AgentStatus.DRAFT: [AgentStatus.TESTING, AgentStatus.DISABLED],
    AgentStatus.TESTING: [AgentStatus.PAPER, AgentStatus.DRAFT, AgentStatus.DISABLED],
    AgentStatus.PAPER: [AgentStatus.SHADOW, AgentStatus.TESTING, AgentStatus.DISABLED],
    AgentStatus.SHADOW: [AgentStatus.CONTROLLED_LIVE, AgentStatus.PAPER, AgentStatus.DISABLED],
    AgentStatus.CONTROLLED_LIVE: [AgentStatus.PAUSED, AgentStatus.SHADOW, AgentStatus.DISABLED],
    AgentStatus.PAUSED: [AgentStatus.CONTROLLED_LIVE, AgentStatus.DISABLED],
    AgentStatus.DISABLED: [],  # Terminal state
}

# Trading agent types that require RISK_LIMIT policy before PAPER+
TRADING_AGENT_TYPES = {AgentType.SWING, AgentType.INTRADAY_STOCK, AgentType.OPTIONS_SCALPING}

# Statuses that require risk policy check (PAPER and beyond)
RISK_POLICY_REQUIRED_STATUSES = {
    AgentStatus.PAPER,
    AgentStatus.SHADOW,
    AgentStatus.CONTROLLED_LIVE,
}


# === Entity Models ===


class Agent(BaseModel):
    """Core agent entity."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1, max_length=100)
    agent_type: AgentType
    status: AgentStatus = AgentStatus.DRAFT
    config: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AgentTask(BaseModel):
    """Task assigned to an agent."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    description: str = Field(..., min_length=1)
    priority: int = Field(..., ge=1, le=5)
    status: TaskStatus = TaskStatus.PENDING
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class AgentPolicy(BaseModel):
    """Policy governing agent behavior."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    name: str = Field(..., min_length=1)
    policy_type: PolicyType
    rules: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AgentObservation(BaseModel):
    """Observation recorded by an agent."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    observation_type: ObservationType
    data: Dict[str, Any] = Field(default_factory=dict)
    source: str = Field(..., min_length=1)
    data_version: str = Field(default="1.0")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentDecision(BaseModel):
    """Decision made by an agent based on observations."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    observation_ids: List[str] = Field(default_factory=list)
    decision_type: DecisionType
    reasoning: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentAction(BaseModel):
    """Action taken based on a decision."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    decision_id: str
    agent_id: str
    action_type: ActionType
    parameters: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentExecution(BaseModel):
    """Execution record for an action."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    action_id: str
    agent_id: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    context: Dict[str, Any] = Field(default_factory=dict)
    requires_approval: bool = False
    approved_by: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AgentOutcome(BaseModel):
    """Outcome of an execution."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    execution_id: str
    agent_id: str
    outcome_status: OutcomeStatus
    result_data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentMemory(BaseModel):
    """Memory entry for an agent."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    memory_type: MemoryType
    content: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusTransition(BaseModel):
    """Record of a status transition."""
    agent_id: str
    previous_status: AgentStatus
    new_status: AgentStatus
    reason: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AuditTrail(BaseModel):
    """Full audit trail for a decision."""
    decision: AgentDecision
    observations: List[AgentObservation]
    actions: List[AgentAction]
    executions: List[AgentExecution]
    outcomes: List[AgentOutcome]


# === Request Models ===


class CreateAgentRequest(BaseModel):
    """Request to create a new agent."""
    name: str = Field(..., min_length=1, max_length=100)
    agent_type: AgentType
    config: Dict[str, Any] = Field(default_factory=dict)


class UpdateAgentRequest(BaseModel):
    """Request to update an agent."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    config: Optional[Dict[str, Any]] = None
    status: Optional[AgentStatus] = None
    status_reason: Optional[str] = None


class CreateTaskRequest(BaseModel):
    """Request to create a task for an agent."""
    description: str = Field(..., min_length=1)
    priority: int = Field(..., ge=1, le=5)


class UpdateTaskRequest(BaseModel):
    """Request to update a task."""
    status: Optional[TaskStatus] = None
    metadata: Optional[Dict[str, Any]] = None


class CreatePolicyRequest(BaseModel):
    """Request to create a policy for an agent."""
    name: str = Field(..., min_length=1)
    policy_type: PolicyType
    rules: Dict[str, Any] = Field(default_factory=dict)


class CreateObservationRequest(BaseModel):
    """Request to record an observation."""
    observation_type: ObservationType
    data: Dict[str, Any] = Field(default_factory=dict)
    source: str = Field(..., min_length=1)
    data_version: str = Field(default="1.0")


class CreateDecisionRequest(BaseModel):
    """Request to record a decision."""
    observation_ids: List[str] = Field(..., min_length=1)
    decision_type: DecisionType
    reasoning: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)


class CreateActionRequest(BaseModel):
    """Request to record an action."""
    decision_id: str
    action_type: ActionType
    parameters: Dict[str, Any] = Field(default_factory=dict)


class CreateExecutionRequest(BaseModel):
    """Request to record an execution."""
    action_id: str
    context: Dict[str, Any] = Field(default_factory=dict)


class CreateOutcomeRequest(BaseModel):
    """Request to record an outcome."""
    execution_id: str
    outcome_status: OutcomeStatus
    result_data: Dict[str, Any] = Field(default_factory=dict)


class CreateMemoryRequest(BaseModel):
    """Request to create a memory entry."""
    memory_type: MemoryType
    content: Dict[str, Any] = Field(default_factory=dict)


class TogglePolicyRequest(BaseModel):
    """Request to toggle a policy's enabled state."""
    enabled: bool

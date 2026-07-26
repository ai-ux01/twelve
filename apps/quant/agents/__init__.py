"""
AI Agent Architecture Module.

Provides agent lifecycle management, decision audit pipeline,
policy enforcement, memory management, and supervisor oversight.

All agents operate under the safety invariant that they cannot
directly execute broker orders.
"""

from .models import (
    AgentType,
    AgentStatus,
    TaskStatus,
    PolicyType,
    ObservationType,
    DecisionType,
    ActionType,
    ExecutionStatus,
    OutcomeStatus,
    MemoryType,
    Agent,
    AgentTask,
    AgentPolicy,
    AgentObservation,
    AgentDecision,
    AgentAction,
    AgentExecution,
    AgentOutcome,
    AgentMemory,
    StatusTransition,
    AuditTrail,
    VALID_TRANSITIONS,
)
from .service import AgentService
from .router import router

__all__ = [
    "AgentType",
    "AgentStatus",
    "TaskStatus",
    "PolicyType",
    "ObservationType",
    "DecisionType",
    "ActionType",
    "ExecutionStatus",
    "OutcomeStatus",
    "MemoryType",
    "Agent",
    "AgentTask",
    "AgentPolicy",
    "AgentObservation",
    "AgentDecision",
    "AgentAction",
    "AgentExecution",
    "AgentOutcome",
    "AgentMemory",
    "StatusTransition",
    "AuditTrail",
    "VALID_TRANSITIONS",
    "AgentService",
    "router",
]

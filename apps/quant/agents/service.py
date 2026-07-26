"""
Agent Service.

Core service managing agent CRUD, lifecycle transitions, task management,
policy enforcement, decision pipeline, memory, and supervisor capabilities.

All storage is in-memory using Python dictionaries with JSON file persistence.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from .models import (
    Agent,
    AgentAction,
    AgentDecision,
    AgentExecution,
    AgentMemory,
    AgentObservation,
    AgentOutcome,
    AgentPolicy,
    AgentTask,
    AgentStatus,
    AgentType,
    ActionType,
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
    ExecutionStatus,
    MemoryType,
    ObservationType,
    PolicyType,
    StatusTransition,
    TaskStatus,
    UpdateAgentRequest,
    UpdateTaskRequest,
    VALID_TRANSITIONS,
    TRADING_AGENT_TYPES,
    RISK_POLICY_REQUIRED_STATUSES,
)

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)

MEMORY_LIMIT = 1000


class AgentService:
    """Core service managing agent CRUD, lifecycle, and decision pipeline with persistence."""

    def __init__(self):
        self._store = JsonFileStore("agents")
        self.agents: Dict[str, Agent] = {}
        self.tasks: Dict[str, AgentTask] = {}
        self.policies: Dict[str, AgentPolicy] = {}
        self.observations: Dict[str, AgentObservation] = {}
        self.decisions: Dict[str, AgentDecision] = {}
        self.actions: Dict[str, AgentAction] = {}
        self.executions: Dict[str, AgentExecution] = {}
        self.outcomes: Dict[str, AgentOutcome] = {}
        self.memory: Dict[str, AgentMemory] = {}
        self.status_transitions: List[StatusTransition] = []
        self._load()

    def _load(self) -> None:
        """Load persisted data from JSON file."""
        raw_data = self._store.get_all()
        if not raw_data:
            return

        # Load agents
        for agent_id, adata in raw_data.get("agents", {}).items():
            self.agents[agent_id] = Agent(**adata)

        # Load tasks
        for task_id, tdata in raw_data.get("tasks", {}).items():
            self.tasks[task_id] = AgentTask(**tdata)

        # Load policies
        for policy_id, pdata in raw_data.get("policies", {}).items():
            self.policies[policy_id] = AgentPolicy(**pdata)

        # Load observations
        for obs_id, odata in raw_data.get("observations", {}).items():
            self.observations[obs_id] = AgentObservation(**odata)

        # Load decisions
        for dec_id, ddata in raw_data.get("decisions", {}).items():
            self.decisions[dec_id] = AgentDecision(**ddata)

        # Load actions
        for act_id, adata in raw_data.get("actions", {}).items():
            self.actions[act_id] = AgentAction(**adata)

        # Load executions
        for exec_id, edata in raw_data.get("executions", {}).items():
            self.executions[exec_id] = AgentExecution(**edata)

        # Load outcomes
        for out_id, odata in raw_data.get("outcomes", {}).items():
            self.outcomes[out_id] = AgentOutcome(**odata)

        # Load memory
        for mem_id, mdata in raw_data.get("memory", {}).items():
            self.memory[mem_id] = AgentMemory(**mdata)

        # Load status transitions
        for tdata in raw_data.get("status_transitions", []):
            self.status_transitions.append(StatusTransition(**tdata))

    def _save(self) -> None:
        """Persist all data to JSON file."""
        data: Dict[str, Any] = {
            "agents": {k: v.model_dump(mode="python") for k, v in self.agents.items()},
            "tasks": {k: v.model_dump(mode="python") for k, v in self.tasks.items()},
            "policies": {k: v.model_dump(mode="python") for k, v in self.policies.items()},
            "observations": {k: v.model_dump(mode="python") for k, v in self.observations.items()},
            "decisions": {k: v.model_dump(mode="python") for k, v in self.decisions.items()},
            "actions": {k: v.model_dump(mode="python") for k, v in self.actions.items()},
            "executions": {k: v.model_dump(mode="python") for k, v in self.executions.items()},
            "outcomes": {k: v.model_dump(mode="python") for k, v in self.outcomes.items()},
            "memory": {k: v.model_dump(mode="python") for k, v in self.memory.items()},
            "status_transitions": [t.model_dump(mode="python") for t in self.status_transitions],
        }
        self._store.set_all(data)

    # === Agent CRUD ===

    def create_agent(self, request: CreateAgentRequest) -> Agent:
        """Create a new agent with DRAFT status."""
        agent = Agent(
            name=request.name,
            agent_type=request.agent_type,
            config=request.config,
        )
        self.agents[agent.id] = agent
        self._save()
        return agent

    def get_agent(self, agent_id: str) -> Agent:
        """Get agent by ID. Raises 404 if not found."""
        agent = self.agents.get(agent_id)
        if agent is None:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Agent not found", "agent_id": agent_id},
            )
        return agent

    def list_agents(
        self,
        agent_type: Optional[AgentType] = None,
        status: Optional[AgentStatus] = None,
    ) -> List[Agent]:
        """List agents with optional type and status filters."""
        agents = list(self.agents.values())
        if agent_type is not None:
            agents = [a for a in agents if a.agent_type == agent_type]
        if status is not None:
            agents = [a for a in agents if a.status == status]
        return agents

    def update_agent(self, agent_id: str, request: UpdateAgentRequest) -> Agent:
        """Update agent fields. Handles status transition if status is provided."""
        agent = self.get_agent(agent_id)

        if request.name is not None:
            agent.name = request.name
        if request.config is not None:
            agent.config = request.config

        # Handle status transition
        if request.status is not None and request.status != agent.status:
            reason = request.status_reason or "Status updated via API"
            self.transition_status(agent_id, request.status, reason)
            # Re-fetch after transition
            agent = self.agents[agent_id]

        agent.updated_at = datetime.utcnow()
        self._save()
        return agent

    def delete_agent(self, agent_id: str) -> None:
        """Delete agent and cascade delete all associated records."""
        self.get_agent(agent_id)  # Validate exists

        # Cascade delete all associated records
        self.tasks = {k: v for k, v in self.tasks.items() if v.agent_id != agent_id}
        self.policies = {k: v for k, v in self.policies.items() if v.agent_id != agent_id}
        self.observations = {k: v for k, v in self.observations.items() if v.agent_id != agent_id}
        self.decisions = {k: v for k, v in self.decisions.items() if v.agent_id != agent_id}
        self.actions = {k: v for k, v in self.actions.items() if v.agent_id != agent_id}
        self.executions = {k: v for k, v in self.executions.items() if v.agent_id != agent_id}
        self.outcomes = {k: v for k, v in self.outcomes.items() if v.agent_id != agent_id}
        self.memory = {k: v for k, v in self.memory.items() if v.agent_id != agent_id}
        self.status_transitions = [t for t in self.status_transitions if t.agent_id != agent_id]

        del self.agents[agent_id]
        self._save()

    # === Lifecycle ===

    def validate_transition(self, current: AgentStatus, target: AgentStatus) -> bool:
        """Check if a transition from current to target status is valid."""
        return target in VALID_TRANSITIONS.get(current, [])

    def transition_status(self, agent_id: str, new_status: AgentStatus, reason: str) -> Agent:
        """
        Transition agent to a new status.

        Validates the transition is allowed, checks risk policy requirements
        for trading agents, and records the transition.
        """
        agent = self.get_agent(agent_id)
        current_status = agent.status

        # Validate transition
        if not self.validate_transition(current_status, new_status):
            allowed = [s.value for s in VALID_TRANSITIONS.get(current_status, [])]
            raise HTTPException(
                status_code=409,
                detail={
                    "detail": "Invalid transition",
                    "current_status": current_status.value,
                    "requested_status": new_status.value,
                    "allowed_transitions": allowed,
                },
            )

        # Check risk policy for trading agents advancing to PAPER+
        if (
            agent.agent_type in TRADING_AGENT_TYPES
            and new_status in RISK_POLICY_REQUIRED_STATUSES
            and not self.has_risk_limit_policy(agent_id)
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "detail": "Agent requires at least one RISK_LIMIT policy before transitioning to PAPER",
                    "agent_id": agent_id,
                },
            )

        # Record transition
        transition = StatusTransition(
            agent_id=agent_id,
            previous_status=current_status,
            new_status=new_status,
            reason=reason,
        )
        self.status_transitions.append(transition)

        # Update agent status
        agent.status = new_status
        agent.updated_at = datetime.utcnow()

        self._save()
        return agent

    # === Task Management ===

    def create_task(self, agent_id: str, request: CreateTaskRequest) -> AgentTask:
        """Create a task for an agent. Rejects if agent is DISABLED."""
        agent = self.get_agent(agent_id)
        if agent.status == AgentStatus.DISABLED:
            raise HTTPException(
                status_code=409,
                detail={"detail": "Cannot assign task to disabled agent"},
            )

        task = AgentTask(
            agent_id=agent_id,
            description=request.description,
            priority=request.priority,
        )
        self.tasks[task.id] = task
        self._save()
        return task

    def list_tasks(self, agent_id: str, status: Optional[TaskStatus] = None) -> List[AgentTask]:
        """List tasks for an agent with optional status filter."""
        self.get_agent(agent_id)  # Validate agent exists
        tasks = [t for t in self.tasks.values() if t.agent_id == agent_id]
        if status is not None:
            tasks = [t for t in tasks if t.status == status]
        return tasks

    def update_task(self, task_id: str, request: UpdateTaskRequest) -> AgentTask:
        """Update a task's status and metadata."""
        task = self.tasks.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail={"detail": "Task not found", "task_id": task_id})

        if request.status is not None:
            task.status = request.status
            if request.status == TaskStatus.COMPLETED:
                task.completed_at = datetime.utcnow()
        if request.metadata is not None:
            task.metadata = request.metadata

        self._save()
        return task

    def get_active_task_count(self, agent_id: str) -> int:
        """Count tasks with PENDING or IN_PROGRESS status for an agent."""
        return sum(
            1 for t in self.tasks.values()
            if t.agent_id == agent_id and t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS)
        )

    # === Policy Management ===

    def create_policy(self, agent_id: str, request: CreatePolicyRequest) -> AgentPolicy:
        """Create a policy for an agent."""
        self.get_agent(agent_id)  # Validate agent exists

        policy = AgentPolicy(
            agent_id=agent_id,
            name=request.name,
            policy_type=request.policy_type,
            rules=request.rules,
        )
        self.policies[policy.id] = policy
        self._save()
        return policy

    def list_policies(self, agent_id: str) -> List[AgentPolicy]:
        """List all policies for an agent."""
        self.get_agent(agent_id)  # Validate agent exists
        return [p for p in self.policies.values() if p.agent_id == agent_id]

    def toggle_policy(self, policy_id: str, enabled: bool) -> AgentPolicy:
        """Enable or disable a policy."""
        policy = self.policies.get(policy_id)
        if policy is None:
            raise HTTPException(status_code=404, detail={"detail": "Policy not found", "policy_id": policy_id})
        policy.enabled = enabled
        self._save()
        return policy

    def has_risk_limit_policy(self, agent_id: str) -> bool:
        """Check if agent has at least one enabled RISK_LIMIT policy."""
        return any(
            p.policy_type == PolicyType.RISK_LIMIT and p.enabled
            for p in self.policies.values()
            if p.agent_id == agent_id
        )

    # === Observation and Decision Recording ===

    def create_observation(self, agent_id: str, request: CreateObservationRequest) -> AgentObservation:
        """Record an observation for an agent."""
        self.get_agent(agent_id)  # Validate agent exists

        observation = AgentObservation(
            agent_id=agent_id,
            observation_type=request.observation_type,
            data=request.data,
            source=request.source,
            data_version=request.data_version,
        )
        self.observations[observation.id] = observation
        self._save()
        return observation

    def list_observations(
        self,
        agent_id: str,
        obs_type: Optional[ObservationType] = None,
    ) -> List[AgentObservation]:
        """List observations for an agent with optional type filter."""
        self.get_agent(agent_id)  # Validate agent exists
        observations = [o for o in self.observations.values() if o.agent_id == agent_id]
        if obs_type is not None:
            observations = [o for o in observations if o.observation_type == obs_type]
        return observations

    def create_decision(self, agent_id: str, request: CreateDecisionRequest) -> AgentDecision:
        """
        Record a decision for an agent.

        Validates agent is not PAUSED/DISABLED and all observation_ids
        exist and belong to the same agent.
        """
        agent = self.get_agent(agent_id)

        # Block decisions for paused agents
        if agent.status == AgentStatus.PAUSED:
            raise HTTPException(
                status_code=409,
                detail={"detail": "Cannot create decision for paused agent"},
            )

        # Block decisions for disabled agents
        if agent.status == AgentStatus.DISABLED:
            raise HTTPException(
                status_code=409,
                detail={"detail": "Cannot create decision for disabled agent"},
            )

        # Validate observation references
        invalid_ids = []
        for obs_id in request.observation_ids:
            obs = self.observations.get(obs_id)
            if obs is None or obs.agent_id != agent_id:
                invalid_ids.append(obs_id)

        if invalid_ids:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": "Observation not found or belongs to different agent",
                    "invalid_ids": invalid_ids,
                },
            )

        decision = AgentDecision(
            agent_id=agent_id,
            observation_ids=request.observation_ids,
            decision_type=request.decision_type,
            reasoning=request.reasoning,
            confidence=request.confidence,
        )
        self.decisions[decision.id] = decision
        self._save()
        return decision

    def list_decisions(
        self,
        agent_id: str,
        decision_type: Optional[str] = None,
    ) -> List[AgentDecision]:
        """List decisions for an agent with optional type filter."""
        self.get_agent(agent_id)  # Validate agent exists
        decisions = [d for d in self.decisions.values() if d.agent_id == agent_id]
        if decision_type is not None:
            decisions = [d for d in decisions if d.decision_type.value == decision_type]
        return decisions

    # === Action, Execution, and Outcome Recording ===

    def create_action(self, agent_id: str, request: CreateActionRequest) -> AgentAction:
        """
        Record an action for an agent.

        Validates the decision exists and action_type is in the safe ActionType enum.
        """
        self.get_agent(agent_id)  # Validate agent exists

        # Validate decision exists
        decision = self.decisions.get(request.decision_id)
        if decision is None:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Decision not found", "decision_id": request.decision_id},
            )

        # ActionType enum validation is handled by Pydantic
        # Any attempt to use a non-enum value will be rejected at the request level

        action = AgentAction(
            decision_id=request.decision_id,
            agent_id=agent_id,
            action_type=request.action_type,
            parameters=request.parameters,
        )
        self.actions[action.id] = action
        self._save()
        return action

    def create_execution(self, agent_id: str, request: CreateExecutionRequest) -> AgentExecution:
        """
        Record an execution for an agent.

        If agent is CONTROLLED_LIVE and action is PAPER_TRADE or REBALANCE,
        sets requires_approval=True.
        """
        agent = self.get_agent(agent_id)

        # Validate action exists
        action = self.actions.get(request.action_id)
        if action is None:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Action not found", "action_id": request.action_id},
            )

        # Determine if approval is required
        requires_approval = False
        if agent.status == AgentStatus.CONTROLLED_LIVE and action.action_type in (
            ActionType.PAPER_TRADE,
            ActionType.REBALANCE,
        ):
            requires_approval = True

        execution = AgentExecution(
            action_id=request.action_id,
            agent_id=agent_id,
            context=request.context,
            requires_approval=requires_approval,
        )
        self.executions[execution.id] = execution
        self._save()
        return execution

    def create_outcome(self, agent_id: str, request: CreateOutcomeRequest) -> AgentOutcome:
        """Record an outcome for an execution."""
        self.get_agent(agent_id)  # Validate agent exists

        # Validate execution exists
        execution = self.executions.get(request.execution_id)
        if execution is None:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Execution not found", "execution_id": request.execution_id},
            )

        outcome = AgentOutcome(
            execution_id=request.execution_id,
            agent_id=agent_id,
            outcome_status=request.outcome_status,
            result_data=request.result_data,
        )
        self.outcomes[outcome.id] = outcome
        self._save()
        return outcome

    # === Audit Trail ===

    def get_audit_trail(self, decision_id: str) -> AuditTrail:
        """
        Get full audit trail for a decision.

        Returns the decision, all referenced observations, all actions
        referencing the decision, all executions referencing those actions,
        and all outcomes referencing those executions.
        """
        decision = self.decisions.get(decision_id)
        if decision is None:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Decision not found", "decision_id": decision_id},
            )

        # Get observations referenced by the decision
        observations = [
            self.observations[obs_id]
            for obs_id in decision.observation_ids
            if obs_id in self.observations
        ]

        # Get all actions for this decision
        actions = [a for a in self.actions.values() if a.decision_id == decision_id]

        # Get all executions for those actions
        action_ids = {a.id for a in actions}
        executions = [e for e in self.executions.values() if e.action_id in action_ids]

        # Get all outcomes for those executions
        execution_ids = {e.id for e in executions}
        outcomes = [o for o in self.outcomes.values() if o.execution_id in execution_ids]

        return AuditTrail(
            decision=decision,
            observations=observations,
            actions=actions,
            executions=executions,
            outcomes=outcomes,
        )

    # === Memory Management ===

    def create_memory(self, agent_id: str, request: CreateMemoryRequest) -> AgentMemory:
        """Create a memory entry, enforcing the per-agent limit."""
        self.get_agent(agent_id)  # Validate agent exists

        # Enforce memory limit before adding
        self.enforce_memory_limit(agent_id)

        memory_entry = AgentMemory(
            agent_id=agent_id,
            memory_type=request.memory_type,
            content=request.content,
        )
        self.memory[memory_entry.id] = memory_entry
        self._save()
        return memory_entry

    def list_memory(
        self,
        agent_id: str,
        memory_type: Optional[MemoryType] = None,
    ) -> List[AgentMemory]:
        """List memory entries for an agent with optional type filter."""
        self.get_agent(agent_id)  # Validate agent exists
        entries = [m for m in self.memory.values() if m.agent_id == agent_id]
        if memory_type is not None:
            entries = [m for m in entries if m.memory_type == memory_type]
        return entries

    def delete_memory(self, memory_id: str) -> None:
        """Delete a specific memory entry."""
        if memory_id not in self.memory:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Memory entry not found", "memory_id": memory_id},
            )
        del self.memory[memory_id]
        self._save()

    def enforce_memory_limit(self, agent_id: str) -> None:
        """
        Enforce 1000-entry memory limit per agent.

        If agent has >= 1000 entries, remove oldest by timestamp until at 999.
        """
        agent_memories = [m for m in self.memory.values() if m.agent_id == agent_id]

        if len(agent_memories) >= MEMORY_LIMIT:
            # Sort by timestamp ascending (oldest first)
            agent_memories.sort(key=lambda m: m.timestamp)
            # Remove oldest entries until we have 999 (room for new entry)
            entries_to_remove = len(agent_memories) - MEMORY_LIMIT + 1
            for i in range(entries_to_remove):
                entry_id = agent_memories[i].id
                del self.memory[entry_id]
                logger.info(f"Memory eviction: removed entry {entry_id} for agent {agent_id}")
            self._save()

    # === Supervisor Capabilities ===

    def supervisor_pause_agent(self, supervisor_id: str, target_id: str, reason: str) -> Agent:
        """
        Supervisor pauses a target agent.

        Validates supervisor is SUPERVISOR type and is not targeting itself.
        Records an observation on the supervisor.
        """
        supervisor = self.get_agent(supervisor_id)

        # Validate supervisor type
        if supervisor.agent_type != AgentType.SUPERVISOR:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Only SUPERVISOR agents can pause other agents"},
            )

        # Prevent self-pause
        if supervisor_id == target_id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Supervisor cannot pause or disable itself"},
            )

        # Transition target to PAUSED
        target = self.transition_status(target_id, AgentStatus.PAUSED, reason)

        # Record observation on supervisor
        self.observations[f"sup_obs_{supervisor_id}_{target_id}_pause"] = AgentObservation(
            id=f"sup_obs_{supervisor_id}_{target_id}_pause",
            agent_id=supervisor_id,
            observation_type=ObservationType.USER_INPUT,
            data={"action": "pause", "target_id": target_id, "reason": reason},
            source="supervisor_action",
        )

        self._save()
        return target

    def supervisor_disable_agent(self, supervisor_id: str, target_id: str, reason: str) -> Agent:
        """
        Supervisor disables a target agent.

        Validates supervisor is SUPERVISOR type and is not targeting itself.
        Records an observation on the supervisor.
        """
        supervisor = self.get_agent(supervisor_id)

        # Validate supervisor type
        if supervisor.agent_type != AgentType.SUPERVISOR:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Only SUPERVISOR agents can disable other agents"},
            )

        # Prevent self-disable
        if supervisor_id == target_id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Supervisor cannot pause or disable itself"},
            )

        # Transition target to DISABLED
        target = self.transition_status(target_id, AgentStatus.DISABLED, reason)

        # Record observation on supervisor
        self.observations[f"sup_obs_{supervisor_id}_{target_id}_disable"] = AgentObservation(
            id=f"sup_obs_{supervisor_id}_{target_id}_disable",
            agent_id=supervisor_id,
            observation_type=ObservationType.USER_INPUT,
            data={"action": "disable", "target_id": target_id, "reason": reason},
            source="supervisor_action",
        )

        self._save()
        return target

# Implementation Plan: AI Agent Architecture

## Overview

This implementation plan builds the AI Agent Architecture System as a new Python module in the quant engine (`apps/quant/agents/`) and a new frontend dashboard page at `/agents`. The approach: define data models and enums first, implement the core service layer with lifecycle and pipeline logic, expose REST endpoints via FastAPI router, then build the frontend dashboard. All storage is in-memory following existing project patterns.

## Tasks

- [ ] 1. Create agents module structure and data models
  - [ ] 1.1 Create module directory and enum definitions
    - Create `apps/quant/agents/__init__.py` with module docstring and exports
    - Create `apps/quant/agents/models.py` with all Pydantic v2 enums: AgentType, AgentStatus, TaskStatus, PolicyType, ObservationType, DecisionType, ActionType, ExecutionStatus, OutcomeStatus, MemoryType
    - Define VALID_TRANSITIONS dict mapping AgentStatus to list of allowed target statuses
    - Follow existing patterns from `apps/quant/trade_coach/models.py`
    - _Requirements: 1.3, 2.1_

  - [ ] 1.2 Create entity models
    - In `apps/quant/agents/models.py`, define Pydantic v2 models: Agent, AgentTask, AgentPolicy, AgentObservation, AgentDecision, AgentAction, AgentExecution, AgentOutcome, AgentMemory, StatusTransition, AuditTrail
    - Each model with auto-generated UUID id field, timestamps, and proper Field validators
    - Agent model: id, name (1-100 chars), agent_type, status (default DRAFT), config (dict), created_at, updated_at
    - AgentDecision model: confidence (0.0-1.0), observation_ids list, reasoning, decision_type
    - AgentAction model: action_type restricted to ActionType enum (no broker execution)
    - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1, 7.1, 7.2, 7.3, 9.1_

  - [ ] 1.3 Create request/response models
    - In `apps/quant/agents/models.py`, define: CreateAgentRequest, UpdateAgentRequest, CreateTaskRequest, UpdateTaskRequest, CreatePolicyRequest, CreateObservationRequest, CreateDecisionRequest, CreateActionRequest, CreateExecutionRequest, CreateOutcomeRequest, CreateMemoryRequest
    - Each request model with proper validation (min_length, ge/le constraints)
    - UpdateAgentRequest: optional name, config, status, status_reason fields
    - _Requirements: 12.1, 12.6, 12.9_

- [ ] 2. Implement Agent Service — CRUD and Lifecycle
  - [ ] 2.1 Implement agent CRUD operations
    - Create `apps/quant/agents/service.py` with AgentService class
    - Implement `create_agent(request)`: assign UUID, set status=DRAFT, store in memory
    - Implement `get_agent(agent_id)`: lookup by ID, raise 404 if not found
    - Implement `list_agents(agent_type, status)`: filter in-memory dict by optional type/status
    - Implement `update_agent(agent_id, request)`: update name/config, handle status change via transition logic
    - Implement `delete_agent(agent_id)`: remove agent and cascade delete all associated tasks, policies, observations, decisions, actions, executions, outcomes, memory
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ] 2.2 Implement lifecycle transition logic
    - Implement `transition_status(agent_id, new_status, reason)`: validate transition against VALID_TRANSITIONS map, update agent status, record StatusTransition with timestamp/previous/new/reason
    - Implement `validate_transition(current, target)`: check if target is in VALID_TRANSITIONS[current]
    - For trading agents (SWING, INTRADAY_STOCK, OPTIONS_SCALPING): verify at least one enabled RISK_LIMIT policy exists before allowing transition to PAPER or beyond
    - Return 409 with current status and allowed transitions if invalid
    - _Requirements: 2.1, 2.2, 2.3, 4.5_

  - [ ] 2.3 Implement task management
    - Implement `create_task(agent_id, request)`: validate agent exists and is not DISABLED, create AgentTask with PENDING status
    - Implement `list_tasks(agent_id, status)`: filter tasks by agent_id and optional status
    - Implement `update_task(task_id, request)`: update status and completion metadata
    - Implement `get_active_task_count(agent_id)`: count tasks with PENDING or IN_PROGRESS status
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 2.4 Implement policy management
    - Implement `create_policy(agent_id, request)`: validate agent exists, create AgentPolicy with enabled=True
    - Implement `list_policies(agent_id)`: return all policies for agent
    - Implement `toggle_policy(policy_id, enabled)`: enable/disable without deletion
    - Implement `has_risk_limit_policy(agent_id)`: check if agent has at least one enabled RISK_LIMIT policy
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ] 3. Implement Agent Service — Decision Pipeline and Safety
  - [ ] 3.1 Implement observation and decision recording
    - Implement `create_observation(agent_id, request)`: validate agent exists, create AgentObservation with source and data_version
    - Implement `list_observations(agent_id, obs_type, time_range)`: filter observations by optional type and time range
    - Implement `create_decision(agent_id, request)`: validate agent is not PAUSED/DISABLED, validate all observation_ids exist and belong to same agent, store AgentDecision
    - Implement `list_decisions(agent_id, decision_type, time_range)`: filter decisions
    - _Requirements: 2.4, 2.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.2 Implement action, execution, and outcome recording
    - Implement `create_action(agent_id, request)`: validate decision_id exists, validate action_type is in ActionType enum (safety check), reject any broker-execution type, store AgentAction
    - Implement `create_execution(agent_id, request)`: validate action_id exists, check if agent is CONTROLLED_LIVE and action is PAPER_TRADE/REBALANCE → set requires_approval=True, store AgentExecution
    - Implement `create_outcome(agent_id, request)`: validate execution_id exists, store AgentOutcome
    - Log rejected broker execution attempts with agent_id, action, and timestamp
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_

  - [ ] 3.3 Implement audit trail query
    - Implement `get_audit_trail(decision_id)`: retrieve the decision, gather all observations referenced by observation_ids, all actions referencing the decision, all executions referencing those actions, all outcomes referencing those executions
    - Return AuditTrail model with full chain
    - _Requirements: 7.5_

  - [ ] 3.4 Implement memory management
    - Implement `create_memory(agent_id, request)`: validate agent exists, call enforce_memory_limit, store AgentMemory
    - Implement `list_memory(agent_id, memory_type, time_range)`: filter by type and time range
    - Implement `delete_memory(memory_id)`: remove specific entry
    - Implement `enforce_memory_limit(agent_id)`: if agent has >= 1000 entries, remove oldest by timestamp until at 999 (making room for new entry)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 3.5 Implement supervisor capabilities
    - Implement `supervisor_pause_agent(supervisor_id, target_id, reason)`: validate supervisor is SUPERVISOR type, validate target is not the supervisor itself (return 403), transition target to PAUSED, record observation on supervisor
    - Implement `supervisor_disable_agent(supervisor_id, target_id, reason)`: same validation, transition target to DISABLED, record observation on supervisor
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 4. Implement FastAPI Router and Register in Main
  - [ ] 4.1 Create agents FastAPI router with CRUD endpoints
    - Create `apps/quant/agents/router.py`
    - POST `/api/agents` — create agent
    - GET `/api/agents` — list agents with optional `agent_type` and `status` query params
    - GET `/api/agents/{agent_id}` — get single agent
    - PATCH `/api/agents/{agent_id}` — update agent (config, status with reason)
    - DELETE `/api/agents/{agent_id}` — delete agent and all associated data
    - Instantiate AgentService as module-level singleton
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 4.2 Create task, policy, and memory endpoints
    - POST `/api/agents/{agent_id}/tasks` — create task
    - GET `/api/agents/{agent_id}/tasks` — list tasks with optional status filter
    - PATCH `/api/agents/{agent_id}/tasks/{task_id}` — update task status
    - POST `/api/agents/{agent_id}/policies` — create policy
    - GET `/api/agents/{agent_id}/policies` — list policies
    - PATCH `/api/agents/{agent_id}/policies/{policy_id}` — toggle enabled
    - POST `/api/agents/{agent_id}/memory` — create memory entry
    - GET `/api/agents/{agent_id}/memory` — list memory (optional type filter)
    - DELETE `/api/agents/{agent_id}/memory/{memory_id}` — delete memory entry
    - _Requirements: 12.6, 12.7_

  - [ ] 4.3 Create decision pipeline endpoints
    - POST `/api/agents/{agent_id}/observations` — record observation
    - GET `/api/agents/{agent_id}/observations` — list observations
    - POST `/api/agents/{agent_id}/decisions` — record decision
    - GET `/api/agents/{agent_id}/decisions` — list decisions
    - GET `/api/agents/{agent_id}/decisions/{decision_id}/audit-trail` — full audit trail
    - POST `/api/agents/{agent_id}/actions` — record action
    - POST `/api/agents/{agent_id}/executions` — record execution
    - POST `/api/agents/{agent_id}/outcomes` — record outcome
    - _Requirements: 12.6, 12.7, 12.8_

  - [ ] 4.4 Register agents router in main.py
    - Import router from `agents.router`
    - Add `app.include_router(agents_router)` in `apps/quant/main.py` following existing patterns (after trade_coach router)
    - _Requirements: 12.1_

- [ ] 5. Checkpoint — Backend service and router complete
  - Verify all endpoints respond correctly with manual testing or curl
  - Ensure import structure works with existing main.py
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Write property-based tests for Agent Service
  - [ ]* 6.1 Write property test for agent creation round-trip (Hypothesis)
    - **Property 1: Agent creation round-trip preserves all fields**
    - Generate random valid names (1-100 chars), agent types, and config dicts
    - Verify create → get returns matching fields and status=DRAFT
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 6.2 Write property test for lifecycle transition validity (Hypothesis)
    - **Property 2: Lifecycle transition validity**
    - For any agent status and any target status, verify transition succeeds iff target is in VALID_TRANSITIONS[current]
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 6.3 Write property test for lifecycle transition recording (Hypothesis)
    - **Property 3: Lifecycle transition recording**
    - For any valid transition, verify StatusTransition record has correct prev/new/reason/timestamp
    - **Validates: Requirements 2.3**

  - [ ]* 6.4 Write property test for disabled agent blocks tasks (Hypothesis)
    - **Property 4: Disabled agent cannot receive tasks**
    - Create agent, disable it, verify task creation rejected; non-disabled agents accept tasks
    - **Validates: Requirements 2.4, 3.4**

  - [ ]* 6.5 Write property test for paused agent blocks decisions (Hypothesis)
    - **Property 5: Paused agent blocks decisions but retains tasks**
    - Create agent with tasks, pause it, verify decision creation rejected but tasks remain
    - **Validates: Requirements 2.5**

  - [ ]* 6.6 Write property test for decision observation reference integrity (Hypothesis)
    - **Property 6: Decision observation reference integrity**
    - Verify decisions are rejected when observation_ids don't exist or belong to different agent
    - **Validates: Requirements 6.2**

  - [ ]* 6.7 Write property test for action type safety (Hypothesis)
    - **Property 7: Action type safety — no broker execution**
    - Verify only ActionType enum values are accepted; invalid values rejected
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 6.8 Write property test for audit trail completeness (Hypothesis)
    - **Property 8: Audit trail completeness**
    - Create full pipeline (observations → decision → actions → executions → outcomes), verify trail returns all records
    - **Validates: Requirements 7.5**

  - [ ]* 6.9 Write property test for memory limit enforcement (Hypothesis)
    - **Property 9: Memory limit enforcement**
    - Add > 1000 memory entries, verify count never exceeds 1000 and oldest are evicted
    - **Validates: Requirements 9.4**

  - [ ]* 6.10 Write property test for supervisor self-pause prevention (Hypothesis)
    - **Property 10: Supervisor cannot self-pause**
    - Verify supervisor can pause/disable others but not itself
    - **Validates: Requirements 10.5**

  - [ ]* 6.11 Write property test for risk policy requirement (Hypothesis)
    - **Property 11: Risk policy requirement for trading agents**
    - Verify trading agents without RISK_LIMIT policy cannot transition to PAPER+
    - **Validates: Requirements 4.5**

  - [ ]* 6.12 Write property test for deletion cascade (Hypothesis)
    - **Property 12: Agent deletion cascades**
    - Create agent with tasks/policies/observations/decisions/etc, delete agent, verify all removed
    - **Validates: Requirements 1.7**

- [ ] 7. Write unit tests for Agent Service
  - [ ]* 7.1 Write unit tests for agent CRUD and lifecycle
    - Test create agent for each AgentType verifies DRAFT status
    - Test get non-existent agent returns 404
    - Test list agents with type/status filters
    - Test valid transitions: DRAFT→TESTING, TESTING→PAPER, etc.
    - Test invalid transitions return 409 with allowed list
    - Test DISABLED is terminal (no transitions out)
    - Test delete agent removes all associated records
    - _Requirements: 1.1-1.8, 2.1-2.3_

  - [ ]* 7.2 Write unit tests for task, policy, and memory management
    - Test create task on DISABLED agent returns 409
    - Test create task on active agent succeeds
    - Test list tasks with status filter
    - Test active task count
    - Test create policy and toggle enabled
    - Test trading agent without risk policy cannot advance to PAPER
    - Test memory creation and listing
    - Test memory limit enforces 1000 max
    - _Requirements: 2.4, 3.1-3.5, 4.1-4.5, 9.1-9.4_

  - [ ]* 7.3 Write unit tests for decision pipeline and safety
    - Test create observation stores with source and version
    - Test create decision with valid observation refs
    - Test create decision with invalid observation refs returns 422
    - Test create decision on PAUSED agent returns 409
    - Test create action with valid ActionType
    - Test action type validation rejects invalid types
    - Test execution sets requires_approval for CONTROLLED_LIVE + PAPER_TRADE/REBALANCE
    - Test audit trail returns complete chain
    - Test supervisor pause target agent
    - Test supervisor self-pause returns 403
    - _Requirements: 5.1-5.3, 6.1-6.4, 7.1-7.5, 8.1-8.4, 10.1-10.5_

- [ ] 8. Checkpoint — All backend tests pass
  - Run pytest on `apps/quant/tests/test_agents*.py`
  - Ensure all property and unit tests pass, ask the user if questions arise.

- [ ] 9. Implement Agent Dashboard — Page and Data Fetching
  - [ ] 9.1 Create agents page with layout and TypeScript types
    - Create `apps/web/app/agents/page.tsx` with Next.js App Router page component
    - Create `apps/web/components/agents/types.ts` with TypeScript interfaces matching Python models: Agent, AgentTask, AgentPolicy, AgentObservation, AgentDecision, AgentAction, AgentExecution, AgentOutcome, AuditTrail, plus all enum types
    - Set up page layout with: agent list panel, agent detail panel (when selected)
    - _Requirements: 11.1, 11.2_

  - [ ] 9.2 Create data fetching hooks
    - Create `apps/web/components/agents/use-agents.ts` custom hook
    - Fetch agents from GET `/api/agents` with optional type/status filters
    - Fetch agent detail from GET `/api/agents/{id}`
    - Fetch tasks from GET `/api/agents/{id}/tasks`
    - Fetch policies from GET `/api/agents/{id}/policies`
    - Fetch decisions from GET `/api/agents/{id}/decisions`
    - Fetch audit trail from GET `/api/agents/{id}/decisions/{did}/audit-trail`
    - Create mutation hooks for create agent, update status, create task
    - _Requirements: 11.1, 11.2, 12.2, 12.3_

- [ ] 10. Implement Agent Dashboard — UI Components
  - [ ] 10.1 Create AgentListView component
    - Create `apps/web/components/agents/agent-list-view.tsx`
    - Display table: name, type, status (color-coded badge), active tasks count, last activity
    - Status badge colors: green (TESTING/PAPER/SHADOW/CONTROLLED_LIVE), yellow (PAUSED), gray (DRAFT), red (DISABLED)
    - Click row to select agent and show detail view
    - Add filter controls for type and status
    - _Requirements: 11.1, 11.6_

  - [ ] 10.2 Create AgentDetailView component
    - Create `apps/web/components/agents/agent-detail-view.tsx`
    - Display: agent name, type, status, configuration JSON viewer
    - Show policies list with enabled/disabled toggle
    - Show recent observations, decisions, actions (last 10 each)
    - Show active tasks
    - _Requirements: 11.2_

  - [ ] 10.3 Create AgentCreateForm component
    - Create `apps/web/components/agents/agent-create-form.tsx`
    - Form fields: name (text input), type (dropdown with all AgentType values), config (JSON editor or key-value pairs)
    - Submit calls POST `/api/agents`
    - Validation: name required, type required
    - _Requirements: 11.3_

  - [ ] 10.4 Create LifecycleControls component
    - Create `apps/web/components/agents/lifecycle-controls.tsx`
    - Display current status with color badge
    - Show transition buttons only for valid next states based on VALID_TRANSITIONS map
    - Each button triggers PATCH `/api/agents/{id}` with new status and reason (prompted via modal)
    - Disable buttons if no valid transitions (DISABLED state)
    - _Requirements: 11.4_

  - [ ] 10.5 Create AuditTrailTimeline component
    - Create `apps/web/components/agents/audit-trail-timeline.tsx`
    - Visual vertical timeline showing: Observations → Decision → Actions → Executions → Outcomes
    - Each node shows type, timestamp, and summary data
    - Expand nodes to see full details (reasoning, parameters, result data)
    - _Requirements: 11.5_

- [ ] 11. Wire Dashboard and Add Navigation
  - [ ] 11.1 Wire all components together on the agents page
    - Connect AgentListView selection to AgentDetailView display
    - Connect LifecycleControls to update mutations
    - Connect AgentCreateForm to create mutation and refresh list
    - Connect decision click in detail view to AuditTrailTimeline
    - Handle loading and error states
    - Display empty states when no agents exist
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 11.2 Add sidebar navigation link for agents page
    - Add `<Link href="/agents">Agents</Link>` to `apps/web/app/layout.tsx` sidebar navigation
    - Position after existing trade-coach link
    - Use consistent styling with other nav links
    - _Requirements: 11.1_

  - [ ]* 11.3 Write unit tests for frontend components
    - Test AgentListView renders all columns and status badges
    - Test LifecycleControls shows only valid transitions
    - Test AgentCreateForm validates required fields
    - Test AuditTrailTimeline renders pipeline nodes
    - Test StatusBadge color coding
    - _Requirements: 11.1, 11.4, 11.5, 11.6_

- [ ] 12. Final Checkpoint — All tests pass, system integrated
  - Run all backend tests (pytest)
  - Verify frontend compiles without errors
  - Verify router is registered and endpoints respond
  - Verify sidebar nav link works
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are test tasks that can be deferred for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints at tasks 5, 8, and 12 ensure incremental validation
- Backend follows existing Python/FastAPI patterns from `apps/quant/trade_coach/` and `apps/quant/paper_trading/`
- Frontend follows existing Next.js App Router patterns from `apps/web/app/paper-trading/`
- In-memory storage means data resets on server restart — this is consistent with the project's current patterns
- The architecture is designed as a foundation; actual agent AI logic (inference, strategy execution) is deferred to later phases
- Property tests use Python Hypothesis library following the project's existing testing patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12", "7.1", "7.2", "7.3"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 10, "tasks": ["11.1", "11.2"] },
    { "id": 11, "tasks": ["11.3"] }
  ]
}
```

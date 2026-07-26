# Implementation Plan: Agent Readiness Dashboard

## Overview

This implementation plan builds the Agent Readiness Dashboard as a new Python module in the quant engine (`apps/quant/agent_readiness/`) and a new frontend page at `/agent-readiness`. The approach: define data models and enums first, implement the service with gate validation logic, expose REST endpoints via FastAPI router, then build the frontend dashboard components. All storage is in-memory following existing project patterns.

## Tasks

- [ ] 1. Create agent_readiness module structure and data models
  - [ ] 1.1 Create module directory and enum definitions
    - Create `apps/quant/agent_readiness/__init__.py` with module docstring and exports
    - Create `apps/quant/agent_readiness/models.py` with all enums: ReadinessStage (9 values), DataHealthStatus, QuantEngineHealthStatus, AIHealthStatus, RiskEngineHealthStatus, ValidationStatus, PaperTradingStatus, ShadowModeStatus
    - Define STAGE_ORDER list for ordered stage comparison
    - Follow existing patterns from `apps/quant/agents/models.py`
    - _Requirements: 1.1, 1.4_

  - [ ] 1.2 Create entity and request models
    - In `apps/quant/agent_readiness/models.py`, define Pydantic models: HealthIndicators, PerformanceMetrics, ProbabilityCalibration, ValidationStatuses, StageAdvancement, AgentReadiness
    - AgentReadiness: agent_id, current_stage (default DRAFT), health, metrics, calibration, validations, stage_history list, created_at, updated_at
    - PerformanceMetrics: trade_count (int, ge=0), win_rate (float, 0-1), profit_factor (float, ge=0), expectancy (float), max_drawdown (float, 0-1)
    - Define request models: AdvanceRequest (reason field), UpdateHealthRequest (optional fields), UpdateMetricsRequest (optional fields with validation)
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

- [ ] 2. Implement Readiness Service — Core Logic
  - [ ] 2.1 Implement service initialization and CRUD
    - Create `apps/quant/agent_readiness/service.py` with AgentReadinessService class
    - In-memory storage: `Dict[str, AgentReadiness]` keyed by agent_id
    - Implement `get_readiness(agent_id)`: return existing record or auto-initialize at DRAFT if agent exists in agents service
    - Implement `list_readiness()`: return all readiness records as list
    - Import and reference the AgentService from `apps/quant/agents/service.py` to validate agent existence
    - Raise HTTP 404 if agent_id does not exist in agent architecture
    - _Requirements: 1.2, 1.3, 11.1, 11.5, 12.3, 12.4_

  - [ ] 2.2 Implement gate validation logic
    - Implement `validate_gate(readiness, target_stage)` returning a dict of criteria names to bool (met/unmet)
    - KNOWLEDGE_READY gate: data_health == connected AND quant_engine_health == running
    - BACKTEST_VALIDATED gate: backtest_status == passed AND profit_factor > 1.0
    - OUT_OF_SAMPLE_VALIDATED gate: out_of_sample_status == passed AND profit_factor > 1.0 AND win_rate > 0.4
    - WALK_FORWARD_VALIDATED gate: walk_forward_status == passed AND expectancy > 0
    - PAPER_TRADING gate: all prior gates passed AND ai_health == connected
    - SHADOW_MODE gate: paper_trading_status == running AND trade_count >= 20 AND profit_factor > 1.0
    - CONTROLLED_LIVE gate: shadow_mode_status == passed AND calibration_error < 0.2 (abs(expected - actual))
    - AUTONOMOUS gate: always returns all criteria as unmet (blocked)
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 2.3 Implement stage advancement
    - Implement `advance_stage(agent_id, reason)`: get readiness, determine next stage (current index + 1), validate target is not AUTONOMOUS (return HTTP 403), validate gate criteria, reject with 409 and unmet criteria list if any gate fails, otherwise update current_stage, append StageAdvancement to history, update timestamp
    - Verify advancement is exactly one step forward (reject skipping stages)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2_

  - [ ] 2.4 Implement health and metrics updates
    - Implement `update_health(agent_id, request)`: validate agent exists, update only provided fields (preserve unset), update last_updated timestamp
    - Implement `update_metrics(agent_id, request)`: validate agent exists, update only provided metric/validation/calibration fields, validate bounds (win_rate 0-1, profit_factor >= 0, max_drawdown 0-1), update timestamp
    - _Requirements: 4.5, 4.6, 5.4, 5.5, 11.3, 11.4_

  - [ ] 2.5 Implement anti-claim safety checks
    - In `get_readiness` response, include a computed field `is_validated` that is True only when stage >= BACKTEST_VALIDATED
    - Ensure no advancement past DRAFT occurs solely from AI Health being connected (gate for KNOWLEDGE_READY requires data_health + quant_engine_health, not AI connectivity)
    - _Requirements: 7.1, 7.2_

- [ ] 3. Implement FastAPI Router and Register
  - [ ] 3.1 Create agent_readiness FastAPI router
    - Create `apps/quant/agent_readiness/router.py`
    - GET `/api/agent-readiness` — list all readiness summaries
    - GET `/api/agent-readiness/{agent_id}` — get full readiness state (auto-initializes if needed)
    - POST `/api/agent-readiness/{agent_id}/advance` — advance stage with gate validation
    - PUT `/api/agent-readiness/{agent_id}/health` — update health indicators
    - PUT `/api/agent-readiness/{agent_id}/metrics` — update performance metrics and validations
    - Instantiate AgentReadinessService as module-level singleton, pass reference to agent service
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ] 3.2 Register router in main.py and add error handling
    - Import router from `agent_readiness.router`
    - Add `app.include_router(agent_readiness_router)` in `apps/quant/main.py` after the agents router
    - Ensure proper error responses: 404 for unknown agent, 403 for AUTONOMOUS attempts, 409 for unmet gates, 422 for invalid metrics
    - _Requirements: 13.1_

- [ ] 4. Checkpoint — Backend service and router complete
  - Verify all endpoints respond correctly via manual testing
  - Ensure import structure works with existing main.py
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Write property-based tests for Readiness Service
  - [ ]* 5.1 Write property test for stage ordering invariant (Hypothesis)
    - **Property 1: Stage ordering invariant**
    - Generate random sequences of valid advancements
    - Verify current_stage index always equals len(stage_history) after each advancement
    - Verify stages only advance forward one step at a time
    - **Validates: Requirements 2.1, correctness property 1**

  - [ ]* 5.2 Write property test for AUTONOMOUS unreachability (Hypothesis)
    - **Property 2: AUTONOMOUS is unreachable**
    - Generate any sequence of API calls (advance, health update, metrics update)
    - Verify current_stage never equals AUTONOMOUS
    - **Validates: Requirements 2.5, 6.1, 6.2, correctness property 2**

  - [ ]* 5.3 Write property test for gate validation idempotence (Hypothesis)
    - **Property 3: Failed advance does not mutate state**
    - Generate random readiness states where gates are not met
    - Call advance and verify the readiness record is unchanged (same stage, same history, same metrics)
    - **Validates: Requirements 2.3, correctness property 3**

  - [ ]* 5.4 Write property test for metrics validation bounds (Hypothesis)
    - **Property 4: Metrics always within valid bounds**
    - Generate random metric updates with valid and invalid values
    - Verify win_rate stays in [0,1], profit_factor >= 0, max_drawdown in [0,1]
    - Verify invalid values are rejected
    - **Validates: Requirements 5.4, correctness property 4**

  - [ ]* 5.5 Write property test for health update field preservation (Hypothesis)
    - **Property 5: Partial health update preserves unset fields**
    - Set initial health state, then update a subset of fields
    - Verify non-updated fields retain their original values
    - **Validates: Requirements 4.5, correctness property 5**

  - [ ]* 5.6 Write property test for auto-initialization (Hypothesis)
    - **Property 6: GET always returns a record for valid agents**
    - For any valid agent_id, GET returns a readiness record at DRAFT stage
    - For invalid agent_id, GET returns 404
    - **Validates: Requirements 12.4, correctness property 6**

  - [ ]* 5.7 Write property test for anti-claim safety (Hypothesis)
    - **Property 7: AI connectivity alone cannot advance past DRAFT**
    - Set AI health to connected but leave data_health disconnected and quant_engine stopped
    - Verify advancement fails — agent stays at DRAFT
    - **Validates: Requirements 7.1, 7.2**

- [ ] 6. Write unit tests for Readiness Service
  - [ ]* 6.1 Write unit tests for readiness CRUD and auto-initialization
    - Test get_readiness for existing agent auto-creates DRAFT record
    - Test get_readiness for non-existent agent returns 404
    - Test list_readiness returns all tracked agents
    - Test initial state has all healths at disconnected/stopped/inactive
    - _Requirements: 1.2, 1.3, 12.3, 12.4_

  - [ ]* 6.2 Write unit tests for gate validation and advancement
    - Test KNOWLEDGE_READY gate with connected/disconnected health
    - Test BACKTEST_VALIDATED gate with passed/failed/pending status and profit factor threshold
    - Test OUT_OF_SAMPLE_VALIDATED gate with all three criteria
    - Test WALK_FORWARD_VALIDATED gate with expectancy check
    - Test PAPER_TRADING gate requires ai_health connected
    - Test SHADOW_MODE gate requires trade_count >= 20
    - Test CONTROLLED_LIVE gate requires calibration error < 20%
    - Test AUTONOMOUS gate always blocked (HTTP 403)
    - Test cannot skip stages (e.g., DRAFT → BACKTEST_VALIDATED rejected)
    - Test successful advancement records timestamp and gate results
    - _Requirements: 2.1-2.5, 3.1-3.8, 6.1, 6.2_

  - [ ]* 6.3 Write unit tests for health and metrics updates
    - Test partial health update preserves unset fields
    - Test metrics update validates bounds (win_rate > 1.0 rejected)
    - Test metrics update with valid data stores correctly
    - Test probability calibration update
    - Test update on non-existent agent returns 404
    - _Requirements: 4.1-4.6, 5.1-5.5_

  - [ ]* 6.4 Write unit tests for anti-claim and AUTONOMOUS enforcement
    - Test is_validated is False for DRAFT and KNOWLEDGE_READY
    - Test is_validated is True for BACKTEST_VALIDATED and beyond
    - Test advance to AUTONOMOUS returns 403 with descriptive message
    - Test AI connectivity alone does not enable advancement past DRAFT
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3_

- [ ] 7. Checkpoint — All backend tests pass
  - Run pytest on `apps/quant/tests/test_agent_readiness*.py`
  - Ensure all property and unit tests pass, ask the user if questions arise.

- [ ] 8. Implement Frontend — Types and Data Fetching
  - [ ] 8.1 Create TypeScript types for agent readiness
    - Create `apps/web/components/agent-readiness/types.ts`
    - Define interfaces: ReadinessStage (enum), DataHealthStatus, QuantEngineHealthStatus, AIHealthStatus, RiskEngineHealthStatus, ValidationStatus, PaperTradingStatus, ShadowModeStatus
    - Define: HealthIndicators, PerformanceMetrics, ProbabilityCalibration, ValidationStatuses, StageAdvancement, AgentReadiness
    - Define: AgentReadinessSummary for list view
    - _Requirements: 8.1-8.4, 9.1-9.5, 10.1-10.4_

  - [ ] 8.2 Create data fetching hooks
    - Create `apps/web/components/agent-readiness/use-agent-readiness.ts`
    - Hook: useAgentReadinessList() — fetches GET `/api/agent-readiness`
    - Hook: useAgentReadiness(agentId) — fetches GET `/api/agent-readiness/{agentId}`
    - Mutation: useAdvanceStage(agentId) — POST `/api/agent-readiness/{agentId}/advance`
    - Mutation: useUpdateHealth(agentId) — PUT `/api/agent-readiness/{agentId}/health`
    - Mutation: useUpdateMetrics(agentId) — PUT `/api/agent-readiness/{agentId}/metrics`
    - Use react-query (TanStack Query) following existing patterns from paper-trading hooks
    - _Requirements: 11.1-11.5_

- [ ] 9. Implement Frontend — Dashboard Components
  - [ ] 9.1 Create HealthIndicators component
    - Create `apps/web/components/agent-readiness/health-indicators.tsx`
    - Display 4 cards in a row: Data Health, Quant Engine Health, AI Health, Risk Engine Health
    - Color-coded status: green (healthy), yellow (degraded/error), red (disconnected/stopped/inactive)
    - Show last_updated timestamp
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 9.2 Create StageProgression component
    - Create `apps/web/components/agent-readiness/stage-progression.tsx`
    - Horizontal timeline showing all 9 stages as steps
    - Completed stages: green with checkmark
    - Current stage: blue/highlighted with pulse animation
    - Future stages: gray
    - AUTONOMOUS stage: red background with lock icon and tooltip "Disabled in V1"
    - Show "Not Validated" warning badge for DRAFT and KNOWLEDGE_READY
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 6.3, 7.3_

  - [ ] 9.3 Create ValidationStatus component
    - Create `apps/web/components/agent-readiness/validation-status.tsx`
    - Cards for: Backtest Status, Out-of-Sample Status, Walk-Forward Status, Paper Trading Status, Shadow Mode Status
    - Each card shows pass/fail/pending with appropriate icon
    - Paper trading card shows metrics (trade count, win rate, profit factor) when running
    - Shadow mode card shows probability calibration when available
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ] 9.4 Create PerformanceMetrics component
    - Create `apps/web/components/agent-readiness/performance-metrics.tsx`
    - Grid of metric cards: Trade Count, Win Rate (%), Profit Factor, Expectancy, Max Drawdown (%)
    - Include probability calibration visual (expected vs actual bar comparison)
    - _Requirements: 9.4, 9.5_

  - [ ] 9.5 Create AgentReadinessDetail combined view
    - Create `apps/web/components/agent-readiness/agent-readiness-detail.tsx`
    - Compose: HealthIndicators, StageProgression, ValidationStatus, PerformanceMetrics
    - Add "Advance Stage" button that shows gate checklist for next stage
    - Button disabled if at CONTROLLED_LIVE (next is AUTONOMOUS = blocked)
    - Show gate criteria as checklist with met (green check) / unmet (red x) indicators
    - _Requirements: 10.1-10.4_

- [ ] 10. Create Dashboard Page and Navigation
  - [ ] 10.1 Create agent-readiness page
    - Create `apps/web/app/agent-readiness/page.tsx`
    - Header with title "Agent Readiness Dashboard"
    - Agent selector dropdown populated from useAgentReadinessList()
    - When agent selected, render AgentReadinessDetail
    - Empty state when no agents tracked
    - Loading and error states
    - _Requirements: 13.2_

  - [ ] 10.2 Add sidebar navigation link
    - Add `<Link href="/agent-readiness">Agent Readiness</Link>` to `apps/web/app/layout.tsx`
    - Position after the "Agents" link in the sidebar
    - Use consistent styling with other nav links
    - _Requirements: 13.3_

- [ ] 11. Checkpoint — Frontend complete and integrated
  - Verify page renders without errors
  - Verify navigation link works
  - Verify data fetching connects to backend API
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are test tasks that can be deferred for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints at tasks 4, 7, and 11 ensure incremental validation
- Backend follows existing Python/FastAPI patterns from `apps/quant/agents/`
- Frontend follows existing Next.js App Router patterns from `apps/web/app/paper-trading/`
- In-memory storage means data resets on server restart — consistent with project patterns
- The readiness service references the agent service singleton to validate agent existence
- Property tests use Python Hypothesis library following the project's existing testing patterns
- AUTONOMOUS enforcement is at the service level (not just UI) to prevent bypass via API

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 9, "tasks": ["10.1", "10.2"] }
  ]
}
```

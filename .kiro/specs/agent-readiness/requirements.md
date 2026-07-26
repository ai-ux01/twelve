# Requirements Document

## Introduction

The Agent Readiness Dashboard provides a comprehensive view of each trading agent's progression through validated readiness stages. Readiness is earned through demonstrated performance at each gate—not merely by connecting an AI model. The system enforces a strict stage progression where each gate must be explicitly passed via validated metrics before an agent can advance. In V1, the AUTONOMOUS stage is permanently disabled at the service level.

## Glossary

- **Readiness_Service**: The backend Python/FastAPI service module (`apps/quant/agent_readiness/`) that manages per-agent readiness state, gate validation, and health checks.
- **Readiness_Dashboard**: The frontend Next.js page (`apps/web/app/agent-readiness/page.tsx`) that displays agent readiness stages, health indicators, and performance metrics.
- **Readiness_Stage**: One of the nine ordered lifecycle stages an agent progresses through (DRAFT → KNOWLEDGE_READY → BACKTEST_VALIDATED → OUT_OF_SAMPLE_VALIDATED → WALK_FORWARD_VALIDATED → PAPER_TRADING → SHADOW_MODE → CONTROLLED_LIVE → AUTONOMOUS).
- **Gate**: A validation checkpoint that must be explicitly passed with verified metrics before an agent can advance to the next Readiness_Stage.
- **Health_Indicator**: A real-time status check for a subsystem (Data Health, Quant Engine Health, AI Health, Risk Engine Health).
- **Performance_Metrics**: Quantitative measurements of agent trading performance (trade count, win rate, profit factor, expectancy, drawdown).
- **Probability_Calibration**: A comparison of expected trade probabilities versus actual outcomes.
- **Agent**: An entity managed by the Agent Architecture system (Phase 16) representing a trading agent with a lifecycle.

## Requirements

### Requirement 1: Readiness Stage Model

**User Story:** As a system operator, I want each agent to have an explicit readiness stage, so that I can track its progression through validated gates.

#### Acceptance Criteria

1. THE Readiness_Service SHALL define exactly nine ordered Readiness_Stage values: DRAFT, KNOWLEDGE_READY, BACKTEST_VALIDATED, OUT_OF_SAMPLE_VALIDATED, WALK_FORWARD_VALIDATED, PAPER_TRADING, SHADOW_MODE, CONTROLLED_LIVE, AUTONOMOUS.
2. THE Readiness_Service SHALL store one Readiness_Stage per agent identified by the agent's unique ID.
3. WHEN a new agent readiness record is created, THE Readiness_Service SHALL initialize the Readiness_Stage to DRAFT.
4. THE Readiness_Service SHALL reject any attempt to set a Readiness_Stage to a value not in the defined enum.

### Requirement 2: Gate Validation and Stage Advancement

**User Story:** As a system operator, I want agents to advance only after passing validated gates, so that readiness is earned through performance rather than assumed from connectivity.

#### Acceptance Criteria

1. WHEN an advancement request is received for an agent, THE Readiness_Service SHALL verify that the target stage is exactly one step ahead of the current stage.
2. WHEN an advancement request is received, THE Readiness_Service SHALL check that all gate criteria for the target stage are met before allowing the transition.
3. IF a gate criterion is not met, THEN THE Readiness_Service SHALL reject the advancement with a descriptive error listing unmet criteria.
4. THE Readiness_Service SHALL record the timestamp and gate results for each successful stage advancement.
5. THE Readiness_Service SHALL refuse to advance any agent to AUTONOMOUS stage, returning an error indicating that AUTONOMOUS is disabled in V1.

### Requirement 3: Gate Criteria Definitions

**User Story:** As a system operator, I want clear criteria for each gate, so that I understand what must be validated before stage advancement.

#### Acceptance Criteria

1. WHEN advancing to KNOWLEDGE_READY, THE Readiness_Service SHALL require that Data Health status is connected and Quant Engine Health status is running.
2. WHEN advancing to BACKTEST_VALIDATED, THE Readiness_Service SHALL require that the backtest status is "passed" with a profit factor greater than 1.0.
3. WHEN advancing to OUT_OF_SAMPLE_VALIDATED, THE Readiness_Service SHALL require that out-of-sample test status is "passed" with a profit factor greater than 1.0 and win rate above 40%.
4. WHEN advancing to WALK_FORWARD_VALIDATED, THE Readiness_Service SHALL require that walk-forward test status is "passed" with consistent positive expectancy.
5. WHEN advancing to PAPER_TRADING, THE Readiness_Service SHALL require that all prior gates are passed and AI Health status is connected.
6. WHEN advancing to SHADOW_MODE, THE Readiness_Service SHALL require paper trading status is "running" with at least 20 completed trades and a profit factor above 1.0.
7. WHEN advancing to CONTROLLED_LIVE, THE Readiness_Service SHALL require shadow mode status is "passed" with probability calibration error below 20%.
8. THE Readiness_Service SHALL permanently block advancement to AUTONOMOUS regardless of metric values.

### Requirement 4: Health Indicator Tracking

**User Story:** As a system operator, I want real-time health indicators for each subsystem, so that I can verify infrastructure prerequisites before advancing agents.

#### Acceptance Criteria

1. THE Readiness_Service SHALL expose a health status for Data Health with values: connected, disconnected, degraded.
2. THE Readiness_Service SHALL expose a health status for Quant Engine Health with values: running, stopped, error.
3. THE Readiness_Service SHALL expose a health status for AI Health with values: connected, disconnected, error.
4. THE Readiness_Service SHALL expose a health status for Risk Engine Health with values: active, inactive, error.
5. WHEN a health status is updated, THE Readiness_Service SHALL record the timestamp of the last update.
6. THE Readiness_Service SHALL store health indicators in-memory per agent.

### Requirement 5: Performance Metrics Storage

**User Story:** As a system operator, I want performance metrics stored per agent, so that gate criteria can be evaluated against quantitative data.

#### Acceptance Criteria

1. THE Readiness_Service SHALL store the following performance metrics per agent: trade_count, win_rate, profit_factor, expectancy, max_drawdown.
2. THE Readiness_Service SHALL store validation statuses per agent: backtest_status (passed, failed, pending), out_of_sample_status (passed, failed, pending), walk_forward_status (passed, failed, pending), paper_trading_status (running, stopped, not_started), shadow_mode_status (passed, failed, running, not_started).
3. THE Readiness_Service SHALL store probability calibration data per agent: expected_probability and actual_probability.
4. WHEN performance metrics are submitted, THE Readiness_Service SHALL validate that win_rate is between 0.0 and 1.0, profit_factor is non-negative, and max_drawdown is between 0.0 and 1.0.
5. THE Readiness_Service SHALL accept metric updates only for agents that exist in the agent architecture system.

### Requirement 6: AUTONOMOUS Stage Enforcement

**User Story:** As a system architect, I want the AUTONOMOUS stage to be permanently disabled in V1, so that no agent can operate without human oversight.

#### Acceptance Criteria

1. THE Readiness_Service SHALL reject any API request that attempts to set an agent's Readiness_Stage to AUTONOMOUS.
2. THE Readiness_Service SHALL return HTTP 403 with a message indicating AUTONOMOUS is disabled in V1.
3. THE Readiness_Dashboard SHALL display the AUTONOMOUS stage as visually disabled with a lock icon and tooltip explaining it is blocked in V1.

### Requirement 7: Anti-Claim Safety Rule

**User Story:** As a system architect, I want the system to never claim an agent is "trained" based on AI model connectivity alone, so that operators are not misled about agent readiness.

#### Acceptance Criteria

1. THE Readiness_Service SHALL require at minimum BACKTEST_VALIDATED stage before reporting any agent as having validated performance.
2. THE Readiness_Service SHALL not advance an agent past DRAFT solely because AI Health shows connected status.
3. THE Readiness_Dashboard SHALL display a warning badge "Not Validated" for any agent at DRAFT or KNOWLEDGE_READY stage.

### Requirement 8: Dashboard Display — Health Section

**User Story:** As a system operator, I want the dashboard to show health indicators, so that I can quickly assess system readiness.

#### Acceptance Criteria

1. THE Readiness_Dashboard SHALL display Data Health status with a color-coded indicator (green for connected, yellow for degraded, red for disconnected).
2. THE Readiness_Dashboard SHALL display Quant Engine Health status with a color-coded indicator (green for running, yellow for error, red for stopped).
3. THE Readiness_Dashboard SHALL display AI Health status with a color-coded indicator (green for connected, red for disconnected or error).
4. THE Readiness_Dashboard SHALL display Risk Engine Health status with a color-coded indicator (green for active, yellow for error, red for inactive).

### Requirement 9: Dashboard Display — Validation Status Section

**User Story:** As a system operator, I want the dashboard to show validation statuses and performance metrics, so that I can evaluate agent readiness at a glance.

#### Acceptance Criteria

1. THE Readiness_Dashboard SHALL display backtest status, out-of-sample status, and walk-forward status each with pass/fail/pending indicators.
2. THE Readiness_Dashboard SHALL display paper trading status with associated metrics when running (trade count, win rate, profit factor).
3. THE Readiness_Dashboard SHALL display shadow mode status with probability calibration data when available.
4. THE Readiness_Dashboard SHALL display performance metrics: trade count, win rate, profit factor, expectancy, and drawdown.
5. THE Readiness_Dashboard SHALL display the probability calibration comparison (expected vs actual) as a visual indicator.

### Requirement 10: Dashboard Display — Agent Stage Section

**User Story:** As a system operator, I want to see the current readiness stage and gate checklist for each agent, so that I understand progression status.

#### Acceptance Criteria

1. THE Readiness_Dashboard SHALL display the current Readiness_Stage for the selected agent with a highlighted stage indicator.
2. THE Readiness_Dashboard SHALL display all nine stages as an ordered progression with completed stages marked with a checkmark.
3. THE Readiness_Dashboard SHALL display gate criteria for the next pending stage as a checklist with met/unmet indicators.
4. WHEN the selected agent is at CONTROLLED_LIVE stage, THE Readiness_Dashboard SHALL show the AUTONOMOUS stage as locked with an explanation tooltip.

### Requirement 11: REST API Endpoints

**User Story:** As a frontend developer, I want REST endpoints for readiness data, so that the dashboard can fetch and update agent readiness information.

#### Acceptance Criteria

1. THE Readiness_Service SHALL expose GET `/api/agent-readiness/{agent_id}` returning the full readiness state for an agent.
2. THE Readiness_Service SHALL expose POST `/api/agent-readiness/{agent_id}/advance` to request stage advancement with gate validation.
3. THE Readiness_Service SHALL expose PUT `/api/agent-readiness/{agent_id}/health` to update health indicator statuses.
4. THE Readiness_Service SHALL expose PUT `/api/agent-readiness/{agent_id}/metrics` to update performance metrics and validation statuses.
5. THE Readiness_Service SHALL expose GET `/api/agent-readiness` returning a summary list of all agents with their current readiness stages.
6. THE Readiness_Service SHALL return HTTP 404 when an agent_id does not exist in the agent architecture system.

### Requirement 12: Integration with Existing Systems

**User Story:** As a system architect, I want the readiness system to integrate with existing Phase 14 (Backtesting) and Phase 11 (Paper Trading) data, so that gate criteria reference actual validated results.

#### Acceptance Criteria

1. THE Readiness_Service SHALL accept backtest results from the backtesting system via the metrics update endpoint.
2. THE Readiness_Service SHALL accept paper trading metrics from the paper trading system via the metrics update endpoint.
3. THE Readiness_Service SHALL validate that the referenced agent_id exists in the agent architecture system before creating a readiness record.
4. WHEN a readiness record is requested for an agent that has no readiness data, THE Readiness_Service SHALL auto-initialize a DRAFT readiness record.

### Requirement 13: Router Registration and Navigation

**User Story:** As a frontend user, I want to access the Agent Readiness Dashboard from the main navigation, so that I can quickly navigate to the readiness view.

#### Acceptance Criteria

1. THE Readiness_Service SHALL register its router in `apps/quant/main.py` following the existing pattern of `app.include_router()`.
2. THE Readiness_Dashboard SHALL be accessible at the route `/agent-readiness`.
3. THE Readiness_Dashboard SHALL have a navigation link labeled "Agent Readiness" in the sidebar of `apps/web/app/layout.tsx`.

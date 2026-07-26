# Requirements Document

## Introduction

The AI Agent Architecture System provides the foundational infrastructure for autonomous and semi-autonomous trading agents within the ProfitTerminal platform. It defines eight specialized agent types (SWING, INTRADAY_STOCK, OPTIONS_SCALPING, RISK, TRADE_COACH, RESEARCH, PORTFOLIO, SUPERVISOR), a seven-stage lifecycle model (DRAFT → TESTING → PAPER → SHADOW → CONTROLLED_LIVE → PAUSED → DISABLED), and a full audit trail from observation through decision to outcome. The system enforces the critical safety constraint that no agent may directly execute broker orders — agents operate in paper-trade-only or human-approved live modes. A Supervisor agent oversees all other agents. The architecture is designed as a foundation that later phases (9–15) integrate with.

## Glossary

- **Agent**: An AI entity defined by a type, lifecycle status, and configuration that perceives market conditions, makes decisions, and takes actions within the ProfitTerminal platform.
- **Agent_Service**: The Python FastAPI backend service responsible for managing agent CRUD operations, lifecycle transitions, and orchestrating the decision pipeline.
- **Agent_Task**: A discrete work item assigned to an Agent, representing a specific objective the agent should accomplish.
- **Agent_Policy**: A set of rules governing an Agent's behavior, constraints, risk limits, and allowed actions.
- **Agent_Observation**: A structured record of what an Agent perceives from market data, portfolio state, or external signals at a point in time.
- **Agent_Decision**: A structured record of what an Agent decides to do based on its observations, policies, and memory.
- **Agent_Action**: A concrete action that an Agent produces as output from a decision (e.g., recommend trade, adjust position, alert user).
- **Agent_Execution**: The record of how an Agent_Action was carried out, including execution context and parameters.
- **Agent_Outcome**: The observed result of an Agent_Execution, including success/failure status and measurable impact.
- **Agent_Memory**: Persistent knowledge and contextual information accumulated by an Agent over time, influencing future decisions.
- **Supervisor_Agent**: A specialized Agent with type SUPERVISOR that monitors, coordinates, and can pause or disable other agents.
- **Agent_Dashboard**: The Next.js frontend page at `/agents` displaying agent configurations, statuses, tasks, and audit trails.
- **Audit_Trail**: The complete chain of records from Agent_Observation → Agent_Decision → Agent_Action → Agent_Execution → Agent_Outcome for any given agent activity.
- **Agent_Type**: One of SWING, INTRADAY_STOCK, OPTIONS_SCALPING, RISK, TRADE_COACH, RESEARCH, PORTFOLIO, or SUPERVISOR.
- **Agent_Status**: The lifecycle state of an Agent: DRAFT, TESTING, PAPER, SHADOW, CONTROLLED_LIVE, PAUSED, or DISABLED.

## Requirements

### Requirement 1: Agent Definition and CRUD Operations

**User Story:** As a platform administrator, I want to create, read, update, and delete agent definitions, so that I can configure and manage the AI agents operating on the platform.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent with a unique identifier, name, Agent_Type, Agent_Status, and configuration object.
2. THE Agent_Service SHALL assign an initial Agent_Status of DRAFT to newly created agents.
3. THE Agent_Service SHALL validate that Agent_Type is one of: SWING, INTRADAY_STOCK, OPTIONS_SCALPING, RISK, TRADE_COACH, RESEARCH, PORTFOLIO, or SUPERVISOR.
4. THE Agent_Service SHALL support retrieving an Agent by its unique identifier, returning all stored fields.
5. THE Agent_Service SHALL support listing all agents with optional filtering by Agent_Type and Agent_Status.
6. THE Agent_Service SHALL support updating an Agent's name, configuration, and Agent_Status.
7. THE Agent_Service SHALL support deleting an Agent, removing all associated records (tasks, policies, memory).
8. IF a request references an Agent that does not exist, THEN THE Agent_Service SHALL return a 404 error with a descriptive message.

### Requirement 2: Agent Lifecycle Management

**User Story:** As a platform administrator, I want agents to follow a defined lifecycle progression, so that new agents are tested and validated before gaining live capabilities.

#### Acceptance Criteria

1. THE Agent_Service SHALL enforce the following valid lifecycle transitions: DRAFT → TESTING, TESTING → PAPER, PAPER → SHADOW, SHADOW → CONTROLLED_LIVE, CONTROLLED_LIVE → PAUSED, PAUSED → CONTROLLED_LIVE, any status → DISABLED.
2. IF a lifecycle transition is requested that violates the valid transition rules, THEN THE Agent_Service SHALL reject the request with an error indicating the current status and allowed transitions.
3. WHEN an Agent transitions from one status to another, THE Agent_Service SHALL record the transition timestamp, previous status, new status, and the reason for transition.
4. WHILE an Agent has Agent_Status DISABLED, THE Agent_Service SHALL prevent that Agent from receiving new tasks or producing decisions.
5. WHILE an Agent has Agent_Status PAUSED, THE Agent_Service SHALL prevent that Agent from producing new decisions but retain its assigned tasks for resumption.

### Requirement 3: Agent Task Management

**User Story:** As a platform administrator, I want to assign and track tasks for agents, so that each agent has clear objectives and I can monitor workload.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent_Task with a unique identifier, associated Agent identifier, description, priority, and status (PENDING, IN_PROGRESS, COMPLETED, FAILED).
2. THE Agent_Service SHALL support listing all tasks for a given Agent with optional status filter.
3. THE Agent_Service SHALL support updating an Agent_Task's status and adding completion metadata.
4. IF an Agent_Task is assigned to an Agent with Agent_Status DISABLED, THEN THE Agent_Service SHALL reject the assignment with an error.
5. THE Agent_Service SHALL support retrieving the count of active tasks (PENDING or IN_PROGRESS) for a given Agent.

### Requirement 4: Agent Policy Management

**User Story:** As a risk manager, I want to define and enforce rules governing each agent's behavior, so that agents operate within safe boundaries.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent_Policy with a unique identifier, associated Agent identifier, policy name, policy type (RISK_LIMIT, POSITION_LIMIT, TRADING_HOURS, INSTRUMENT_RESTRICTION, APPROVAL_REQUIRED), and rule configuration.
2. THE Agent_Service SHALL support listing all policies for a given Agent.
3. THE Agent_Service SHALL support enabling and disabling individual policies without deletion.
4. WHILE an Agent_Policy with type APPROVAL_REQUIRED is enabled, THE Agent_Service SHALL require human approval before the associated Agent's actions are executed.
5. THE Agent_Service SHALL validate that every Agent with Agent_Type SWING, INTRADAY_STOCK, or OPTIONS_SCALPING has at least one RISK_LIMIT policy before transitioning to PAPER status or beyond.

### Requirement 5: Observation Recording

**User Story:** As a system auditor, I want every piece of information an agent perceives recorded, so that I can trace what data informed each decision.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent_Observation with a unique identifier, associated Agent identifier, observation type (MARKET_DATA, PORTFOLIO_STATE, SIGNAL, NEWS, USER_INPUT), timestamp, and data payload.
2. THE Agent_Service SHALL support listing observations for a given Agent with optional time range and type filters.
3. THE Agent_Service SHALL store each Agent_Observation with a reference to the source system and data version.

### Requirement 6: Decision Recording

**User Story:** As a compliance officer, I want every agent decision recorded with full context, so that decisions can be reviewed and explained.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent_Decision with a unique identifier, associated Agent identifier, list of input Agent_Observation identifiers, decision type (TRADE_RECOMMENDATION, RISK_ALERT, PORTFOLIO_ADJUSTMENT, COACHING_INSIGHT, RESEARCH_FINDING), reasoning text, confidence score, and timestamp.
2. WHEN an Agent_Decision is created, THE Agent_Service SHALL validate that all referenced Agent_Observation identifiers exist and belong to the same Agent.
3. THE Agent_Service SHALL support listing decisions for a given Agent with optional time range and type filters.
4. THE Agent_Service SHALL store the Agent's reasoning and confidence score on every decision record.

### Requirement 7: Action, Execution, and Outcome Recording

**User Story:** As a system auditor, I want the complete action-execution-outcome chain recorded for every agent activity, so that I have a full audit trail from decision to result.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent_Action with a unique identifier, associated Agent_Decision identifier, action type (PAPER_TRADE, RECOMMEND, ALERT, REBALANCE, COACH, RESEARCH_REPORT), parameters, and timestamp.
2. THE Agent_Service SHALL support creating an Agent_Execution with a unique identifier, associated Agent_Action identifier, execution status (PENDING, EXECUTING, COMPLETED, FAILED, REJECTED), execution context, started_at, and completed_at timestamps.
3. THE Agent_Service SHALL support creating an Agent_Outcome with a unique identifier, associated Agent_Execution identifier, outcome status (SUCCESS, PARTIAL_SUCCESS, FAILURE), measurable result data, and timestamp.
4. WHEN an Agent_Action has action type PAPER_TRADE, THE Agent_Service SHALL create the action record but SHALL NOT execute any broker order directly.
5. THE Agent_Service SHALL support querying the full Audit_Trail for a given Agent_Decision (decision → actions → executions → outcomes).

### Requirement 8: Broker Execution Safety

**User Story:** As a risk manager, I want absolute assurance that AI agents cannot directly execute broker orders, so that live trading always requires human oversight.

#### Acceptance Criteria

1. THE Agent_Service SHALL restrict Agent_Action types to non-broker-executing actions: PAPER_TRADE, RECOMMEND, ALERT, REBALANCE, COACH, and RESEARCH_REPORT.
2. IF an Agent_Action is created with an action type that would require direct broker execution, THEN THE Agent_Service SHALL reject the action with an error indicating that direct broker execution is prohibited.
3. WHILE an Agent has Agent_Status CONTROLLED_LIVE, THE Agent_Service SHALL require explicit human approval before any PAPER_TRADE or REBALANCE action is marked as COMPLETED in the execution record.
4. THE Agent_Service SHALL log every rejected broker execution attempt with the Agent identifier, attempted action, and timestamp.

### Requirement 9: Agent Memory Management

**User Story:** As a platform developer, I want agents to maintain persistent memory, so that they can learn from past decisions and improve over time.

#### Acceptance Criteria

1. THE Agent_Service SHALL support creating an Agent_Memory entry with a unique identifier, associated Agent identifier, memory type (TRADE_HISTORY, PATTERN, PREFERENCE, CONTEXT, LESSON_LEARNED), content payload, and timestamp.
2. THE Agent_Service SHALL support listing memory entries for a given Agent with optional type filter and time range.
3. THE Agent_Service SHALL support deleting specific memory entries by identifier.
4. THE Agent_Service SHALL enforce a maximum of 1000 memory entries per Agent, removing the oldest entries when the limit is exceeded.

### Requirement 10: Supervisor Agent Capabilities

**User Story:** As a platform administrator, I want the Supervisor agent to monitor and control other agents, so that the system maintains operational safety without constant human intervention.

#### Acceptance Criteria

1. THE Supervisor_Agent SHALL have read access to all other agents' statuses, tasks, decisions, and outcomes.
2. THE Supervisor_Agent SHALL support pausing any agent by transitioning its status to PAUSED with a recorded reason.
3. THE Supervisor_Agent SHALL support disabling any agent by transitioning its status to DISABLED with a recorded reason.
4. WHEN the Supervisor_Agent pauses or disables another Agent, THE Agent_Service SHALL record an Agent_Observation on the Supervisor_Agent with the action taken and reason.
5. THE Agent_Service SHALL prevent the Supervisor_Agent from pausing or disabling itself.

### Requirement 11: Agent Management Dashboard

**User Story:** As a platform administrator, I want a visual dashboard to manage agents, so that I can monitor status, review decisions, and control agents without using the API directly.

#### Acceptance Criteria

1. THE Agent_Dashboard SHALL display a list of all agents with their name, type, status, active task count, and last activity timestamp.
2. THE Agent_Dashboard SHALL provide a detail view for each agent showing configuration, policies, recent observations, decisions, actions, and outcomes.
3. THE Agent_Dashboard SHALL allow creating a new agent with name, type, and initial configuration.
4. THE Agent_Dashboard SHALL allow transitioning an agent's status via lifecycle controls that only display valid next states.
5. THE Agent_Dashboard SHALL display the full Audit_Trail for any selected decision in a visual timeline format.
6. THE Agent_Dashboard SHALL provide status indicators: green for active statuses (TESTING, PAPER, SHADOW, CONTROLLED_LIVE), yellow for PAUSED, gray for DRAFT, and red for DISABLED.

### Requirement 12: API Endpoints

**User Story:** As a frontend developer, I want well-defined REST API endpoints for the agent system, so that the dashboard and other services can interact with agents programmatically.

#### Acceptance Criteria

1. THE Agent_Service SHALL expose a POST endpoint to create an Agent.
2. THE Agent_Service SHALL expose a GET endpoint to list all agents with optional type and status filters.
3. THE Agent_Service SHALL expose a GET endpoint to retrieve a single Agent by identifier.
4. THE Agent_Service SHALL expose a PATCH endpoint to update an Agent's configuration and status.
5. THE Agent_Service SHALL expose a DELETE endpoint to remove an Agent and associated data.
6. THE Agent_Service SHALL expose POST endpoints to create Agent_Task, Agent_Policy, Agent_Observation, Agent_Decision, Agent_Action, Agent_Execution, and Agent_Outcome records.
7. THE Agent_Service SHALL expose GET endpoints to list tasks, policies, observations, decisions, actions, executions, and outcomes for a given Agent with pagination support.
8. THE Agent_Service SHALL expose a GET endpoint to retrieve the full Audit_Trail for a given decision.
9. IF any API request contains invalid data, THEN THE Agent_Service SHALL return a 422 error with field-level validation details.

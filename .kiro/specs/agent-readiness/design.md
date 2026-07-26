# Design Document: Agent Readiness Dashboard

## Overview

The Agent Readiness Dashboard introduces a readiness tracking layer on top of the existing Agent Architecture (Phase 16). It models a nine-stage gated progression for each agent, where advancement requires validated performance metrics rather than mere connectivity. The backend is a new FastAPI module at `apps/quant/agent_readiness/` with in-memory storage. The frontend is a new Next.js page at `apps/web/app/agent-readiness/page.tsx` with components in `apps/web/components/agent-readiness/`.

## Architecture

### Backend Module: `apps/quant/agent_readiness/`

```
apps/quant/agent_readiness/
├── __init__.py
├── models.py          # Pydantic models and enums
├── service.py         # Business logic and gate validation
└── router.py          # FastAPI endpoints
```

### Frontend Structure

```
apps/web/app/agent-readiness/
└── page.tsx           # Dashboard page

apps/web/components/agent-readiness/
├── types.ts           # TypeScript interfaces
├── use-agent-readiness.ts  # Data fetching hooks
├── health-indicators.tsx    # Health status cards
├── stage-progression.tsx    # Stage timeline/checklist
├── validation-status.tsx    # Backtest/OOS/WF/Paper/Shadow status
├── performance-metrics.tsx  # Metrics display cards
└── agent-readiness-detail.tsx  # Combined detail view
```

## Data Models

### ReadinessStage Enum

```python
class ReadinessStage(str, Enum):
    DRAFT = "DRAFT"
    KNOWLEDGE_READY = "KNOWLEDGE_READY"
    BACKTEST_VALIDATED = "BACKTEST_VALIDATED"
    OUT_OF_SAMPLE_VALIDATED = "OUT_OF_SAMPLE_VALIDATED"
    WALK_FORWARD_VALIDATED = "WALK_FORWARD_VALIDATED"
    PAPER_TRADING = "PAPER_TRADING"
    SHADOW_MODE = "SHADOW_MODE"
    CONTROLLED_LIVE = "CONTROLLED_LIVE"
    AUTONOMOUS = "AUTONOMOUS"
```

### Health Status Enums

```python
class DataHealthStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    DEGRADED = "degraded"

class QuantEngineHealthStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"

class AIHealthStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"

class RiskEngineHealthStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"

class ValidationStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"

class PaperTradingStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    NOT_STARTED = "not_started"

class ShadowModeStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    RUNNING = "running"
    NOT_STARTED = "not_started"
```

### AgentReadiness Entity

```python
class HealthIndicators(BaseModel):
    data_health: DataHealthStatus = DataHealthStatus.DISCONNECTED
    quant_engine_health: QuantEngineHealthStatus = QuantEngineHealthStatus.STOPPED
    ai_health: AIHealthStatus = AIHealthStatus.DISCONNECTED
    risk_engine_health: RiskEngineHealthStatus = RiskEngineHealthStatus.INACTIVE
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class PerformanceMetrics(BaseModel):
    trade_count: int = 0
    win_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    profit_factor: float = Field(default=0.0, ge=0.0)
    expectancy: float = 0.0
    max_drawdown: float = Field(default=0.0, ge=0.0, le=1.0)

class ProbabilityCalibration(BaseModel):
    expected_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    actual_probability: float = Field(default=0.0, ge=0.0, le=1.0)

class ValidationStatuses(BaseModel):
    backtest_status: ValidationStatus = ValidationStatus.PENDING
    out_of_sample_status: ValidationStatus = ValidationStatus.PENDING
    walk_forward_status: ValidationStatus = ValidationStatus.PENDING
    paper_trading_status: PaperTradingStatus = PaperTradingStatus.NOT_STARTED
    shadow_mode_status: ShadowModeStatus = ShadowModeStatus.NOT_STARTED

class StageAdvancement(BaseModel):
    stage: ReadinessStage
    timestamp: datetime
    gate_results: Dict[str, bool]

class AgentReadiness(BaseModel):
    agent_id: str
    current_stage: ReadinessStage = ReadinessStage.DRAFT
    health: HealthIndicators = Field(default_factory=HealthIndicators)
    metrics: PerformanceMetrics = Field(default_factory=PerformanceMetrics)
    calibration: ProbabilityCalibration = Field(default_factory=ProbabilityCalibration)
    validations: ValidationStatuses = Field(default_factory=ValidationStatuses)
    stage_history: List[StageAdvancement] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

## Gate Validation Logic

The service implements a `validate_gate(agent_readiness, target_stage)` method that checks criteria based on the target stage:

| Target Stage | Gate Criteria |
|---|---|
| KNOWLEDGE_READY | data_health == connected AND quant_engine_health == running |
| BACKTEST_VALIDATED | backtest_status == passed AND profit_factor > 1.0 |
| OUT_OF_SAMPLE_VALIDATED | out_of_sample_status == passed AND profit_factor > 1.0 AND win_rate > 0.4 |
| WALK_FORWARD_VALIDATED | walk_forward_status == passed AND expectancy > 0 |
| PAPER_TRADING | all prior gates passed AND ai_health == connected |
| SHADOW_MODE | paper_trading_status == running AND trade_count >= 20 AND profit_factor > 1.0 |
| CONTROLLED_LIVE | shadow_mode_status == passed AND calibration_error < 0.2 |
| AUTONOMOUS | ALWAYS BLOCKED (returns error) |

Calibration error is computed as `abs(expected_probability - actual_probability)`.

## API Design

### Endpoints

| Method | Path | Description | Req |
|---|---|---|---|
| GET | `/api/agent-readiness` | List all agent readiness summaries | 11.5 |
| GET | `/api/agent-readiness/{agent_id}` | Get full readiness state | 11.1 |
| POST | `/api/agent-readiness/{agent_id}/advance` | Advance to next stage | 11.2 |
| PUT | `/api/agent-readiness/{agent_id}/health` | Update health indicators | 11.3 |
| PUT | `/api/agent-readiness/{agent_id}/metrics` | Update metrics/validations | 11.4 |

### Advance Request/Response

```python
class AdvanceRequest(BaseModel):
    reason: str = Field(..., min_length=1)

# Success response: AgentReadiness with updated stage
# Error response (unmet gates):
# { "detail": "Gate criteria not met", "unmet_criteria": ["backtest_status must be passed", ...] }
# Error response (AUTONOMOUS blocked):
# HTTP 403 { "detail": "AUTONOMOUS stage is disabled in V1" }
```

### Health Update Request

```python
class UpdateHealthRequest(BaseModel):
    data_health: Optional[DataHealthStatus] = None
    quant_engine_health: Optional[QuantEngineHealthStatus] = None
    ai_health: Optional[AIHealthStatus] = None
    risk_engine_health: Optional[RiskEngineHealthStatus] = None
```

### Metrics Update Request

```python
class UpdateMetricsRequest(BaseModel):
    trade_count: Optional[int] = Field(None, ge=0)
    win_rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    profit_factor: Optional[float] = Field(None, ge=0.0)
    expectancy: Optional[float] = None
    max_drawdown: Optional[float] = Field(None, ge=0.0, le=1.0)
    backtest_status: Optional[ValidationStatus] = None
    out_of_sample_status: Optional[ValidationStatus] = None
    walk_forward_status: Optional[ValidationStatus] = None
    paper_trading_status: Optional[PaperTradingStatus] = None
    shadow_mode_status: Optional[ShadowModeStatus] = None
    expected_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    actual_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
```

## Frontend Component Design

### Page Layout

The dashboard page displays:
1. **Header**: Title "Agent Readiness" with agent selector dropdown
2. **Health Section**: 4 health indicator cards in a row
3. **Stage Progression**: Horizontal timeline showing all 9 stages with current highlighted
4. **Validation Status**: Cards for backtest, OOS, walk-forward, paper trading, shadow mode
5. **Performance Metrics**: Grid of metric cards (trade count, win rate, profit factor, expectancy, drawdown)
6. **Gate Checklist**: For the next stage, shows met/unmet criteria

### Data Flow

```
page.tsx
  └─ useAgentReadiness(agentId)
       ├─ GET /api/agent-readiness (list, for selector)
       └─ GET /api/agent-readiness/{agentId} (detail)
            ├─ <HealthIndicators data={readiness.health} />
            ├─ <StageProgression current={readiness.current_stage} history={readiness.stage_history} />
            ├─ <ValidationStatus validations={readiness.validations} metrics={readiness.metrics} />
            ├─ <PerformanceMetrics metrics={readiness.metrics} calibration={readiness.calibration} />
            └─ <AgentReadinessDetail readiness={readiness} />
```

### Key UI Decisions

- **Stage colors**: Completed = green, Current = blue/pulsing, Future = gray, AUTONOMOUS = red/locked
- **Health indicators**: Use standard traffic-light colors (green/yellow/red)
- **"Not Validated" badge**: Shown prominently for DRAFT and KNOWLEDGE_READY agents
- **AUTONOMOUS lock**: Displayed with lock icon, gray background, and tooltip
- **Agent selector**: Dropdown at top of page listing all tracked agents

## Integration Points

1. **Agent Architecture (Phase 16)**: The readiness service reads agent existence from the agents service. On first GET, if no readiness record exists, auto-initializes at DRAFT.
2. **Backtesting (Phase 14)**: External callers push backtest results via PUT `/api/agent-readiness/{agent_id}/metrics`.
3. **Paper Trading (Phase 11)**: External callers push paper trading metrics via the same endpoint.
4. **Router Registration**: The agent_readiness router is registered in `main.py` with `app.include_router(agent_readiness_router)`.

## Storage

All data is in-memory using a Python dictionary keyed by `agent_id`. Data resets on server restart. This follows the same pattern as the Agent Architecture module.

## Correctness Properties

1. **Stage ordering invariant**: An agent's current_stage index must equal the length of its stage_history. Stages can only advance forward one step at a time.
2. **AUTONOMOUS is unreachable**: No sequence of valid API calls can result in an agent having current_stage == AUTONOMOUS.
3. **Gate validation idempotence**: Calling advance when gates are not met does not change any state—the readiness record remains unchanged.
4. **Metrics validation bounds**: win_rate is always in [0, 1], profit_factor >= 0, max_drawdown in [0, 1].
5. **Health update preserves unset fields**: Updating one health field does not modify other health fields.
6. **Auto-initialization**: GET for a valid agent_id always returns a readiness record (auto-creates at DRAFT if missing).

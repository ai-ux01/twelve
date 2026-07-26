"""
AI Trading Lab Module.

This module implements a conversational AI trading assistant that accepts
natural-language prompts, classifies trading intent via GPT-4, orchestrates
data fetching and quantitative analysis from the existing Quant Engine,
applies risk management, and streams structured recommendations via
Server-Sent Events.

The module lives at `apps/quant/trading_lab/` and exposes endpoints at
`/api/ai-trading/`.
"""

from .models import (
    TradingIntent,
    ResponseMode,
    SignalDirection,
    IntentClassification,
    PipelineContext,
    Recommendation,
    RiskAssessment,
    DecisionRecord,
    PromptRequest,
    ActionRequest,
    HistoryResponse,
    ActionResponse,
    SSEEvent,
    StatusEvent,
    RecommendationEvent,
)
from .exceptions import (
    TradingLabError,
    IntentDetectionError,
    QuantEngineError,
    RecommendationError,
    StaleDataError,
    PaperTradeError,
)
from .intent_detector import IntentDetector
from .risk_engine import RiskEngine
from .interaction_store import InteractionStore
from .response_formatter import ResponseFormatter
from .recommendation_engine import RecommendationEngine
from .orchestrator import Orchestrator, PipelineStep
from .router import router as trading_lab_router

__all__ = [
    # Enums
    "TradingIntent",
    "ResponseMode",
    "SignalDirection",
    # Domain Models
    "IntentClassification",
    "PipelineContext",
    "Recommendation",
    "RiskAssessment",
    "DecisionRecord",
    # Request Models
    "PromptRequest",
    "ActionRequest",
    # Response Models
    "HistoryResponse",
    "ActionResponse",
    # SSE Event Models
    "SSEEvent",
    "StatusEvent",
    "RecommendationEvent",
    # Exceptions
    "TradingLabError",
    "IntentDetectionError",
    "QuantEngineError",
    "RecommendationError",
    "StaleDataError",
    "PaperTradeError",
    # Components
    "IntentDetector",
    "RiskEngine",
    "InteractionStore",
    "ResponseFormatter",
    "RecommendationEngine",
    "Orchestrator",
    "PipelineStep",
    # Router
    "trading_lab_router",
]

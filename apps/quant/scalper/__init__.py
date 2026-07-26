"""
Options Scalping Agent Module.

This module implements an AI-powered auto-refreshing options scalping agent
that analyzes NIFTY50 and BANKNIFTY options every 60 seconds and generates
high-quality BUY/SELL/HOLD signals with strict probability (≥70%) and
risk/reward (≥1:2) thresholds.

Phase 9 - Options Scalping AI Agent
"""

from .models import (
    ScalperSignalType,
    TrendClassification,
    OIInterpretation,
    TrendlineStatus,
    ScalperAnalysisResult,
    MarketDataPackage,
    TechnicalIndicators,
    OptionsAnalysis,
    OIBuildup,
    OptionsContract,
    SupportResistance,
    Signal,
    ScalperConfiguration,
    WebSocketMessage,
)
from .market_data_fetcher import (
    MarketDataFetcher,
    MarketDataFetchError,
    StaleDataError,
)
from .technical_analyzer import (
    TechnicalAnalyzer,
    TechnicalAnalyzerError,
)
from .options_analyzer import (
    OptionsAnalyzer,
    OptionsAnalyzerError,
)
from .ai_analysis_engine import (
    AIAnalysisEngine,
    AIAnalysisEngineError,
    AIAnalysisResult,
)
from .signal_generator import (
    SignalGenerator,
    SignalGeneratorError,
)
from .auto_refresh_orchestrator import (
    AutoRefreshOrchestrator,
    AutoRefreshOrchestratorError,
    OrchestratorState,
    FetchFailureError,
    AIAnalysisFailureError,
)
from .router import router as scalper_router
from .websocket import (
    WebSocketConnectionManager,
    connection_manager,
    ws_router,
)
from .repository import (
    AnalysisHistoryRepository,
    ConfigurationRepository,
)

__all__ = [
    "ScalperSignalType",
    "TrendClassification",
    "OIInterpretation",
    "TrendlineStatus",
    "ScalperAnalysisResult",
    "MarketDataPackage",
    "TechnicalIndicators",
    "OptionsAnalysis",
    "OIBuildup",
    "OptionsContract",
    "SupportResistance",
    "Signal",
    "ScalperConfiguration",
    "WebSocketMessage",
    "MarketDataFetcher",
    "MarketDataFetchError",
    "StaleDataError",
    "TechnicalAnalyzer",
    "TechnicalAnalyzerError",
    "OptionsAnalyzer",
    "OptionsAnalyzerError",
    "AIAnalysisEngine",
    "AIAnalysisEngineError",
    "AIAnalysisResult",
    "SignalGenerator",
    "SignalGeneratorError",
    "AutoRefreshOrchestrator",
    "AutoRefreshOrchestratorError",
    "OrchestratorState",
    "FetchFailureError",
    "AIAnalysisFailureError",
    "scalper_router",
    "WebSocketConnectionManager",
    "connection_manager",
    "ws_router",
    "AnalysisHistoryRepository",
    "ConfigurationRepository",
]

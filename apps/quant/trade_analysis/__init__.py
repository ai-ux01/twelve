"""
Trade Analysis Engine.

Provides CSV import, trade matching, enrichment with technical indicators,
performance metrics calculation, dimension-based grouping, and AI-driven analysis.
"""

from .models import (
    TradeDirection,
    MarketRegime,
    TimeBucket,
    HoldingPeriodBucket,
    TradeRecord,
    UnmatchedEntry,
    PerformanceMetrics,
    GroupedMetrics,
    CSVParseResult,
    CSVRowError,
    TradeMatchResult,
    TradeAction,
    ManualTradeRequest,
    CSVImportResponse,
    MetricsResponse,
    GroupedMetricsResponse,
    AIAnalyzeRequest,
    AIAnalysisResponse,
    ErrorResponse,
    FieldError,
)
from .exceptions import (
    CSVParseError,
    ValidationError,
    EnrichmentError,
    GroupingDimensionError,
    AIAnalysisError,
)
from .csv_importer import CSVImporter
from .trade_enricher import TradeEnricher
from .performance_calculator import TradePerformanceCalculator
from .grouping_engine import GroupingEngine
from .ai_analyzer import AIAnalyzer
from .repository import TradeRepository

__all__ = [
    "TradeDirection",
    "MarketRegime",
    "TimeBucket",
    "HoldingPeriodBucket",
    "TradeRecord",
    "UnmatchedEntry",
    "PerformanceMetrics",
    "GroupedMetrics",
    "CSVParseResult",
    "CSVRowError",
    "TradeMatchResult",
    "TradeAction",
    "ManualTradeRequest",
    "CSVImportResponse",
    "MetricsResponse",
    "GroupedMetricsResponse",
    "AIAnalyzeRequest",
    "AIAnalysisResponse",
    "ErrorResponse",
    "FieldError",
    "CSVParseError",
    "ValidationError",
    "EnrichmentError",
    "GroupingDimensionError",
    "AIAnalysisError",
    "CSVImporter",
    "TradeEnricher",
    "TradePerformanceCalculator",
    "GroupingEngine",
    "AIAnalyzer",
    "TradeRepository",
]

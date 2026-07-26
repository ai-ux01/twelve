"""
Trade Coach Module.

AI-powered trading behavior analysis and coaching system.
Detects behavioral patterns, generates coaching reports using GPT-4,
and compares performance across Paper, Live, and Backtest trade sources.

Phase 15 - AI Trade Coach
"""

from .models import (
    BehaviorPattern,
    BehaviorDetection,
    CoachReport,
    CoachRequest,
    CoachResponse,
    SourceComparison,
    SourceMetrics,
)
from .behavior_detector import BehaviorDetector
from .data_source_selector import DataSourceSelector, DataSourceResult
from .live_analysis import LiveAnalyzer, SlippageSummary, LiveAnalysisResult
from .report_generator import ReportGenerator
from .source_comparator import SourceComparator
from .router import router

__all__ = [
    "BehaviorPattern",
    "BehaviorDetection",
    "CoachReport",
    "CoachRequest",
    "CoachResponse",
    "SourceComparison",
    "SourceMetrics",
    "BehaviorDetector",
    "DataSourceSelector",
    "DataSourceResult",
    "LiveAnalyzer",
    "SlippageSummary",
    "LiveAnalysisResult",
    "ReportGenerator",
    "SourceComparator",
    "router",
]

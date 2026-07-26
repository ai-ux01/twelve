"""
Prompt Library Module.

This module provides a full lifecycle management system for AI trading prompts.
It supports CRUD operations with immutable versioning, category-based organization,
performance tracking per prompt version, and a comparison interface.

The module lives at `apps/quant/prompt_library/` and exposes endpoints at
`/api/prompts`.
"""

from .models import (
    PromptCategory,
    PromptVersion,
    PromptRecord,
    PerformanceMetrics,
    TestExecution,
    CreatePromptRequest,
    EditPromptRequest,
    TestPromptRequest,
    UpdateMetricsRequest,
    PromptResponse,
    PromptDetailResponse,
    PromptVersionResponse,
    PerformanceMetricsResponse,
    CompareVersionsRequest,
    CompareVersionsResponse,
)
from .store import PromptStore
from .router import router as prompt_library_router

__all__ = [
    # Enums
    "PromptCategory",
    # Domain Models
    "PromptVersion",
    "PromptRecord",
    "PerformanceMetrics",
    "TestExecution",
    # Request Models
    "CreatePromptRequest",
    "EditPromptRequest",
    "TestPromptRequest",
    "UpdateMetricsRequest",
    # Response Models
    "PromptResponse",
    "PromptDetailResponse",
    "PromptVersionResponse",
    "PerformanceMetricsResponse",
    "CompareVersionsRequest",
    "CompareVersionsResponse",
    # Components
    "PromptStore",
    # Router
    "prompt_library_router",
]

"""
Prompt Library Data Models.

Defines all enums, dataclasses, and Pydantic models for the prompt library system.

Requirements: 1.1, 1.4, 10.1, 12.1, 12.2
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# === Enums ===


class PromptCategory(str, Enum):
    """Categories for AI trading prompts."""

    MASTER_AGENT = "MASTER_AGENT"
    MARKET_REGIME = "MARKET_REGIME"
    SWING_HUNTER = "SWING_HUNTER"
    INTRADAY = "INTRADAY"
    OPTIONS_SCALPING = "OPTIONS_SCALPING"
    TRADE_DETECTIVE = "TRADE_DETECTIVE"
    STRATEGY_RESEARCH = "STRATEGY_RESEARCH"
    STRATEGY_BUILDER = "STRATEGY_BUILDER"
    BACKTEST_ANALYST = "BACKTEST_ANALYST"
    PROBABILITY_CALIBRATION = "PROBABILITY_CALIBRATION"
    AGENT_SELF_EVALUATION = "AGENT_SELF_EVALUATION"
    RISK_REVIEW = "RISK_REVIEW"
    AGENT_SUPERVISOR = "AGENT_SUPERVISOR"


# === Core Dataclasses ===


@dataclass
class PromptVersion:
    """An immutable snapshot of a prompt at a specific version."""

    version: int
    content: str
    created_at: datetime
    name: str  # snapshot of prompt name at this version
    category: PromptCategory  # snapshot of category at this version


@dataclass
class PromptRecord:
    """Complete prompt record with version history."""

    id: str  # UUID
    name: str  # current display name
    category: PromptCategory
    versions: List[PromptVersion] = field(default_factory=list)
    is_archived: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PerformanceMetrics:
    """Performance metrics for a specific prompt version."""

    prompt_id: str
    version: int
    trades_count: int
    win_rate: float  # 0-100 percentage
    profit_factor: float
    expectancy: float
    average_r: float
    max_drawdown: float  # negative value
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TestExecution:
    """Record of a prompt test execution."""

    prompt_id: str
    version: int
    input_text: str
    output_text: str
    executed_at: datetime = field(default_factory=datetime.utcnow)


# === Pydantic Request Models ===


class CreatePromptRequest(BaseModel):
    """Request model for creating a new prompt."""

    name: str = Field(..., min_length=1)
    category: PromptCategory
    content: str = Field(..., min_length=1)


class EditPromptRequest(BaseModel):
    """Request model for editing a prompt (creates a new version)."""

    content: str = Field(..., min_length=1)
    name: Optional[str] = Field(None, min_length=1)
    category: Optional[PromptCategory] = None


class TestPromptRequest(BaseModel):
    """Request model for testing a prompt version."""

    input_text: str = Field(..., min_length=1)


class UpdateMetricsRequest(BaseModel):
    """Request model for updating performance metrics."""

    trades_count: int = Field(..., ge=0)
    win_rate: float = Field(..., ge=0.0, le=100.0)
    profit_factor: float = Field(..., ge=0.0)
    expectancy: float
    average_r: float
    max_drawdown: float = Field(..., le=0.0)


# === Pydantic Response Models ===


class PromptVersionResponse(BaseModel):
    """Response model for a single prompt version."""

    version: int
    content: str
    created_at: datetime
    name: str
    category: PromptCategory


class PromptResponse(BaseModel):
    """Response model for a prompt in list views."""

    id: str
    name: str
    category: PromptCategory
    latest_version: int
    latest_content: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class PerformanceMetricsResponse(BaseModel):
    """Response model for performance metrics."""

    prompt_id: str
    version: int
    trades_count: int
    win_rate: float
    profit_factor: float
    expectancy: float
    average_r: float
    max_drawdown: float
    updated_at: datetime


class PromptDetailResponse(BaseModel):
    """Response model for detailed prompt view with all versions."""

    id: str
    name: str
    category: PromptCategory
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    versions: List[PromptVersionResponse]
    performance: Optional[Dict[int, PerformanceMetricsResponse]] = None


class CompareVersionsRequest(BaseModel):
    """Request model for comparing prompt versions."""

    version_ids: List[Dict[str, Any]]  # [{prompt_id, version}, ...]


class CompareVersionsResponse(BaseModel):
    """Response model for version comparison."""

    versions: List[PromptVersionResponse]
    metrics: List[Optional[PerformanceMetricsResponse]]
    content_diffs: List[str]  # unified diff strings between consecutive versions

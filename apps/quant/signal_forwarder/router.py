"""
FastAPI Router for Auto-Trade Configuration.

Provides REST API endpoints for:
- GET /api/auto-trade-config — Retrieve current auto-trade configuration
- PUT /api/auto-trade-config — Update auto-trade configuration

Requirements: 5.3
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from signal_forwarder.config import AutoTradeConfigService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auto-trade-config", tags=["auto-trade-config"])

# Module-level config service instance
_config_service = AutoTradeConfigService()

# Default user ID (will be replaced with actual auth later)
DEFAULT_USER_ID = "default"


# ============================================================
# Request / Response Models
# ============================================================


class AutoTradeConfigResponse(BaseModel):
    """Response model for GET /api/auto-trade-config."""

    options_scalper_enabled: bool
    swing_scanner_enabled: bool
    intraday_scorer_enabled: bool
    options_scalper_threshold: float
    swing_scanner_threshold: float
    intraday_scorer_threshold: float
    default_swing_quantity: int
    default_intraday_quantity: int
    duplicate_window_minutes: int


class AutoTradeConfigUpdateRequest(BaseModel):
    """Request body for PUT /api/auto-trade-config."""

    options_scalper_enabled: Optional[bool] = Field(
        None, description="Enable/disable Options Scalper auto-trading"
    )
    swing_scanner_enabled: Optional[bool] = Field(
        None, description="Enable/disable Swing Scanner auto-trading"
    )
    intraday_scorer_enabled: Optional[bool] = Field(
        None, description="Enable/disable Intraday Scorer auto-trading"
    )
    options_scalper_threshold: Optional[float] = Field(
        None, description="Options Scalper confidence threshold (50-95)"
    )
    swing_scanner_threshold: Optional[float] = Field(
        None, description="Swing Scanner score threshold (0-100)"
    )
    intraday_scorer_threshold: Optional[float] = Field(
        None, description="Intraday Scorer score threshold (0-100)"
    )
    default_swing_quantity: Optional[int] = Field(
        None, description="Default quantity for swing trades"
    )
    default_intraday_quantity: Optional[int] = Field(
        None, description="Default quantity for intraday trades"
    )
    duplicate_window_minutes: Optional[int] = Field(
        None, description="Duplicate signal suppression window in minutes (1-1440)"
    )

    @field_validator("options_scalper_threshold")
    @classmethod
    def validate_scalper_threshold(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 50.0 or v > 95.0):
            raise ValueError("options_scalper_threshold must be between 50 and 95")
        return v

    @field_validator("swing_scanner_threshold")
    @classmethod
    def validate_swing_threshold(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0.0 or v > 100.0):
            raise ValueError("swing_scanner_threshold must be between 0 and 100")
        return v

    @field_validator("intraday_scorer_threshold")
    @classmethod
    def validate_intraday_threshold(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0.0 or v > 100.0):
            raise ValueError("intraday_scorer_threshold must be between 0 and 100")
        return v

    @field_validator("duplicate_window_minutes")
    @classmethod
    def validate_duplicate_window(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 1440):
            raise ValueError("duplicate_window_minutes must be between 1 and 1440")
        return v


# ============================================================
# Endpoints
# ============================================================


@router.get("", response_model=AutoTradeConfigResponse)
async def get_auto_trade_config() -> AutoTradeConfigResponse:
    """
    Get the current auto-trade configuration.

    Returns the configuration for the default user. If no configuration
    exists, returns default values (all sources enabled with standard thresholds).

    Returns:
        200: Current AutoTradeConfig as JSON

    Requirements: 5.3, 5.4
    """
    config = _config_service.get_config(DEFAULT_USER_ID)

    return AutoTradeConfigResponse(
        options_scalper_enabled=config.options_scalper_enabled,
        swing_scanner_enabled=config.swing_scanner_enabled,
        intraday_scorer_enabled=config.intraday_scorer_enabled,
        options_scalper_threshold=config.options_scalper_threshold,
        swing_scanner_threshold=config.swing_scanner_threshold,
        intraday_scorer_threshold=config.intraday_scorer_threshold,
        default_swing_quantity=config.default_swing_quantity,
        default_intraday_quantity=config.default_intraday_quantity,
        duplicate_window_minutes=config.duplicate_window_minutes,
    )


@router.put("", response_model=AutoTradeConfigResponse)
async def update_auto_trade_config(
    request: AutoTradeConfigUpdateRequest,
) -> AutoTradeConfigResponse:
    """
    Update the auto-trade configuration.

    Accepts JSON body with configuration fields to update. Only provided
    fields are updated; omitted fields retain their current values.

    Validates ranges:
        - options_scalper_threshold: 50-95
        - swing_scanner_threshold: 0-100
        - intraday_scorer_threshold: 0-100
        - duplicate_window_minutes: 1-1440

    Returns:
        200: Updated AutoTradeConfig as JSON
        400: Values outside valid ranges

    Requirements: 5.3
    """
    # Build updates dict from non-None fields
    updates: Dict[str, Any] = {}
    update_data = request.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No valid configuration fields provided",
        )

    try:
        updated_config = _config_service.update_config(DEFAULT_USER_ID, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    logger.info(f"Auto-trade config updated: {list(update_data.keys())}")

    return AutoTradeConfigResponse(
        options_scalper_enabled=updated_config.options_scalper_enabled,
        swing_scanner_enabled=updated_config.swing_scanner_enabled,
        intraday_scorer_enabled=updated_config.intraday_scorer_enabled,
        options_scalper_threshold=updated_config.options_scalper_threshold,
        swing_scanner_threshold=updated_config.swing_scanner_threshold,
        intraday_scorer_threshold=updated_config.intraday_scorer_threshold,
        default_swing_quantity=updated_config.default_swing_quantity,
        default_intraday_quantity=updated_config.default_intraday_quantity,
        duplicate_window_minutes=updated_config.duplicate_window_minutes,
    )

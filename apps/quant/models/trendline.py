"""
Trendline analysis result models for the Quant Engine.

This module defines comprehensive Pydantic models for trendline analysis,
including trend direction, trendline status, breakout detection, and complete
analysis results combining swing points, support/resistance lines, and breakout status.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
from models.market_data import SwingPoint, TrendlineResult


class TrendDirectionEnum(str, Enum):
    """
    Market trend direction classification.

    Attributes:
        UPTREND: Price is making higher highs and higher lows
        DOWNTREND: Price is making lower highs and lower lows
        SIDEWAYS: Price is moving in a range without clear direction
    """

    UPTREND = "UPTREND"
    DOWNTREND = "DOWNTREND"
    SIDEWAYS = "SIDEWAYS"


class TrendlineStatusEnum(str, Enum):
    """
    Current status of a trendline.

    Attributes:
        ACTIVE: Trendline is currently valid and price is respecting it
        BROKEN: Trendline has been broken (price crossed with volume confirmation)
        RETESTING: Price is retesting the trendline after a breakout
    """

    ACTIVE = "ACTIVE"
    BROKEN = "BROKEN"
    RETESTING = "RETESTING"


class BreakoutStatusEnum(str, Enum):
    """
    Breakout or breakdown status.

    Attributes:
        NONE: No breakout detected, price is within trendlines
        BREAKOUT: Price has broken above resistance (may not be confirmed)
        BREAKDOWN: Price has broken below support (may not be confirmed)
        CONFIRMED: Breakout/breakdown is confirmed with volume and follow-through
    """

    NONE = "NONE"
    BREAKOUT = "BREAKOUT"
    BREAKDOWN = "BREAKDOWN"
    CONFIRMED = "CONFIRMED"


class TrendlineAnalysisResult(BaseModel):
    """
    Comprehensive trendline analysis result.

    This model combines swing point detection, trendline calculation,
    and breakout detection into a single comprehensive analysis result.

    Attributes:
        support_line: Support trendline (None if insufficient swing lows)
        resistance_line: Resistance trendline (None if insufficient swing highs)
        swing_points: List of detected swing points (highs and lows)
        breakout_status: Current breakout/breakdown status
        direction: Overall trend direction based on swing points
        support_status: Status of the support trendline
        resistance_status: Status of the resistance trendline
        confidence: Confidence score for the trend direction (0-100)
    """

    support_line: Optional[TrendlineResult] = Field(
        None,
        description=(
            "Support trendline calculated from swing lows, "
            "None if insufficient points"
        ),
    )
    resistance_line: Optional[TrendlineResult] = Field(
        None,
        description=(
            "Resistance trendline calculated from swing highs, "
            "None if insufficient points"
        ),
    )
    swing_points: List[SwingPoint] = Field(
        default_factory=list,
        description="List of detected swing points (swing highs and swing lows)",
    )
    breakout_status: BreakoutStatusEnum = Field(
        ..., description="Current breakout or breakdown status"
    )
    direction: TrendDirectionEnum = Field(
        ..., description="Overall trend direction classification"
    )
    support_status: TrendlineStatusEnum = Field(
        default=TrendlineStatusEnum.ACTIVE,
        description="Current status of the support trendline",
    )
    resistance_status: TrendlineStatusEnum = Field(
        default=TrendlineStatusEnum.ACTIVE,
        description="Current status of the resistance trendline",
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="Confidence score for the trend direction (0-100)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "support_line": {
                        "slope": 2.5,
                        "intercept": 2350.0,
                        "r_squared": 0.89,
                        "start_point": [0, 2350.0],
                        "end_point": [30, 2425.0],
                    },
                    "resistance_line": {
                        "slope": 2.8,
                        "intercept": 2400.0,
                        "r_squared": 0.85,
                        "start_point": [0, 2400.0],
                        "end_point": [30, 2484.0],
                    },
                    "swing_points": [
                        {
                            "timestamp": "2024-01-15T09:15:00Z",
                            "price": 2470.0,
                            "type": "HIGH",
                            "index": 5,
                        },
                        {
                            "timestamp": "2024-01-16T14:30:00Z",
                            "price": 2445.0,
                            "type": "LOW",
                            "index": 12,
                        },
                    ],
                    "breakout_status": "NONE",
                    "direction": "UPTREND",
                    "support_status": "ACTIVE",
                    "resistance_status": "ACTIVE",
                    "confidence": 78.5,
                },
                {
                    "support_line": {
                        "slope": -1.5,
                        "intercept": 2500.0,
                        "r_squared": 0.92,
                        "start_point": [0, 2500.0],
                        "end_point": [30, 2455.0],
                    },
                    "resistance_line": {
                        "slope": -1.2,
                        "intercept": 2550.0,
                        "r_squared": 0.88,
                        "start_point": [0, 2550.0],
                        "end_point": [30, 2514.0],
                    },
                    "swing_points": [
                        {
                            "timestamp": "2024-01-15T09:15:00Z",
                            "price": 2520.0,
                            "type": "HIGH",
                            "index": 5,
                        },
                        {
                            "timestamp": "2024-01-16T14:30:00Z",
                            "price": 2480.0,
                            "type": "LOW",
                            "index": 12,
                        },
                        {
                            "timestamp": "2024-01-17T11:00:00Z",
                            "price": 2510.0,
                            "type": "HIGH",
                            "index": 18,
                        },
                        {
                            "timestamp": "2024-01-18T13:45:00Z",
                            "price": 2465.0,
                            "type": "LOW",
                            "index": 25,
                        },
                    ],
                    "breakout_status": "BREAKDOWN",
                    "direction": "DOWNTREND",
                    "support_status": "BROKEN",
                    "resistance_status": "ACTIVE",
                    "confidence": 82.3,
                },
                {
                    "support_line": {
                        "slope": 0.1,
                        "intercept": 2450.0,
                        "r_squared": 0.45,
                        "start_point": [0, 2450.0],
                        "end_point": [30, 2453.0],
                    },
                    "resistance_line": {
                        "slope": -0.05,
                        "intercept": 2500.0,
                        "r_squared": 0.50,
                        "start_point": [0, 2500.0],
                        "end_point": [30, 2498.5],
                    },
                    "swing_points": [
                        {
                            "timestamp": "2024-01-15T09:15:00Z",
                            "price": 2490.0,
                            "type": "HIGH",
                            "index": 5,
                        },
                        {
                            "timestamp": "2024-01-16T14:30:00Z",
                            "price": 2460.0,
                            "type": "LOW",
                            "index": 12,
                        },
                        {
                            "timestamp": "2024-01-17T11:00:00Z",
                            "price": 2485.0,
                            "type": "HIGH",
                            "index": 18,
                        },
                        {
                            "timestamp": "2024-01-18T13:45:00Z",
                            "price": 2465.0,
                            "type": "LOW",
                            "index": 25,
                        },
                    ],
                    "breakout_status": "NONE",
                    "direction": "SIDEWAYS",
                    "support_status": "ACTIVE",
                    "resistance_status": "ACTIVE",
                    "confidence": 35.2,
                },
                {
                    "support_line": {
                        "slope": 3.2,
                        "intercept": 2300.0,
                        "r_squared": 0.94,
                        "start_point": [0, 2300.0],
                        "end_point": [30, 2396.0],
                    },
                    "resistance_line": {
                        "slope": 3.5,
                        "intercept": 2350.0,
                        "r_squared": 0.91,
                        "start_point": [0, 2350.0],
                        "end_point": [30, 2455.0],
                    },
                    "swing_points": [
                        {
                            "timestamp": "2024-01-15T09:15:00Z",
                            "price": 2380.0,
                            "type": "HIGH",
                            "index": 5,
                        },
                        {
                            "timestamp": "2024-01-16T14:30:00Z",
                            "price": 2345.0,
                            "type": "LOW",
                            "index": 12,
                        },
                        {
                            "timestamp": "2024-01-17T11:00:00Z",
                            "price": 2420.0,
                            "type": "HIGH",
                            "index": 18,
                        },
                        {
                            "timestamp": "2024-01-18T13:45:00Z",
                            "price": 2385.0,
                            "type": "LOW",
                            "index": 25,
                        },
                        {
                            "timestamp": "2024-01-19T10:30:00Z",
                            "price": 2465.0,
                            "type": "HIGH",
                            "index": 30,
                        },
                    ],
                    "breakout_status": "CONFIRMED",
                    "direction": "UPTREND",
                    "support_status": "ACTIVE",
                    "resistance_status": "BROKEN",
                    "confidence": 91.7,
                },
            ]
        }
    }

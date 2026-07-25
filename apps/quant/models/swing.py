"""
Swing Trading Candidate Result Models.

This module defines the result models for swing trading scanner output.
These models structure the data returned by the scanner, providing all
necessary information for users to evaluate potential swing trading
candidates at a glance.

Requirements: 5.4
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from enum import Enum


class SetupType(str, Enum):
    """Types of swing trading setups."""

    BREAKOUT = "BREAKOUT"
    RETEST = "RETEST"
    PULLBACK = "PULLBACK"
    CONTINUATION = "CONTINUATION"
    REVERSAL = "REVERSAL"
    CONSOLIDATION_BREAKOUT = "CONSOLIDATION_BREAKOUT"


class Signal(str, Enum):
    """Trading signal for the candidate."""

    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    NO_TRADE = "NO_TRADE"


class ComponentScoresBreakdown(BaseModel):
    """
    Breakdown of component scores for transparency.

    Each component is scored 0-100, showing the strength of different
    technical factors that contribute to the overall candidate score.

    Attributes:
        trend_score: Trend component score (0-100)
        technical_score: Technical indicators score (0-100)
        volume_score: Volume analysis score (0-100)
        relative_strength_score: Relative strength score (0-100)
        breakout_score: Breakout pattern score (0-100)
        sector_score: Sector strength score (0-100)
        risk_reward_score: Risk/reward ratio score (0-100)
    """

    trend_score: float = Field(
        ..., ge=0.0, le=100.0, description="Trend component score (0-100)"
    )
    technical_score: float = Field(
        ..., ge=0.0, le=100.0, description="Technical indicators score (0-100)"
    )
    volume_score: float = Field(
        ..., ge=0.0, le=100.0, description="Volume analysis score (0-100)"
    )
    relative_strength_score: float = Field(
        ..., ge=0.0, le=100.0, description="Relative strength score (0-100)"
    )
    breakout_score: float = Field(
        ..., ge=0.0, le=100.0, description="Breakout pattern score (0-100)"
    )
    sector_score: float = Field(
        ..., ge=0.0, le=100.0, description="Sector strength score (0-100)"
    )
    risk_reward_score: float = Field(
        ..., ge=0.0, le=100.0, description="Risk/reward ratio score (0-100)"
    )


class KeyMetricsSummary(BaseModel):
    """
    Key technical metrics for quick evaluation.

    Provides the most important technical indicators and metrics
    that traders need to quickly assess the candidate quality.

    Attributes:
        current_price: Current market price
        volume: Current trading volume
        trend_direction: Current trend direction (UPTREND, DOWNTREND, SIDEWAYS)
        rsi: Relative Strength Index (0-100)
        adx: Average Directional Index (0-100)
        relative_volume: Volume relative to average (1.0 = average)
        distance_from_52w_high: Percentage distance from 52-week high
        distance_from_52w_low: Percentage distance from 52-week low
    """

    current_price: float = Field(..., gt=0, description="Current market price")
    volume: int = Field(..., ge=0, description="Current trading volume")
    trend_direction: str = Field(
        ..., description="Current trend direction (UPTREND, DOWNTREND, SIDEWAYS)"
    )
    rsi: float = Field(
        ..., ge=0.0, le=100.0, description="Relative Strength Index (0-100)"
    )
    adx: float = Field(
        ..., ge=0.0, le=100.0, description="Average Directional Index (0-100)"
    )
    relative_volume: float = Field(
        ..., ge=0.0, description="Volume relative to average (1.0 = average)"
    )
    distance_from_52w_high: float = Field(
        ..., description="Percentage distance from 52-week high (negative if below)"
    )
    distance_from_52w_low: float = Field(
        ..., description="Percentage distance from 52-week low (positive if above)"
    )


class SwingCandidate(BaseModel):
    """
    Swing trading candidate with complete analysis.

    Represents a single stock candidate returned by the swing scanner.
    Includes all information needed for traders to evaluate the opportunity:
    scoring breakdown, entry/exit levels, technical factors, and setup type.

    Attributes:
        symbol: Stock trading symbol (e.g., 'RELIANCE', 'TCS')
        name: Company name (optional)
        score: Overall candidate score (0-100)
        sector: Stock sector (e.g., 'Technology', 'Energy')
        signal: Trading signal (BUY, SELL, HOLD, NO_TRADE)
        setup_type: Type of setup detected (BREAKOUT, RETEST, etc.)
        entry: Suggested entry price
        stop_loss: Suggested stop loss price
        target: Suggested target price
        risk_reward: Risk/reward ratio (e.g., 3.0 means 3:1)
        component_scores: Breakdown of scoring components
        key_metrics: Summary of key technical indicators
        rationale: Brief explanation of why this is a candidate (optional)
    """

    symbol: str = Field(
        ..., min_length=1, max_length=20, description="Stock trading symbol"
    )
    name: Optional[str] = Field(None, max_length=100, description="Company name")
    score: float = Field(
        ..., ge=0.0, le=100.0, description="Overall candidate score (0-100)"
    )
    sector: str = Field(..., min_length=1, max_length=50, description="Stock sector")
    signal: Signal = Field(
        ..., description="Trading signal (BUY, SELL, HOLD, NO_TRADE)"
    )
    setup_type: SetupType = Field(..., description="Type of swing setup detected")
    entry: float = Field(..., gt=0, description="Suggested entry price")
    stop_loss: float = Field(..., gt=0, description="Suggested stop loss price")
    target: float = Field(..., gt=0, description="Suggested target price")
    risk_reward: float = Field(
        ..., gt=0, description="Risk/reward ratio (e.g., 3.0 means 3:1)"
    )
    component_scores: ComponentScoresBreakdown = Field(
        ..., description="Breakdown of scoring components"
    )
    key_metrics: KeyMetricsSummary = Field(
        ..., description="Summary of key technical indicators"
    )
    rationale: Optional[str] = Field(
        None, max_length=500, description="Brief explanation of candidate quality"
    )

    @field_validator("stop_loss")
    @classmethod
    def validate_stop_loss(cls, v: float, info) -> float:
        """Ensure stop loss is below entry for long positions."""
        if hasattr(info, "data") and "entry" in info.data and "signal" in info.data:
            entry = info.data["entry"]
            signal = info.data["signal"]

            # For BUY signals, stop loss should be below entry
            if signal == Signal.BUY and v >= entry:
                raise ValueError(
                    f"For BUY signal, stop_loss ({v}) must be below entry ({entry})"
                )

            # For SELL signals, stop loss should be above entry
            if signal == Signal.SELL and v <= entry:
                raise ValueError(
                    f"For SELL signal, stop_loss ({v}) must be above entry ({entry})"
                )

        return v

    @field_validator("target")
    @classmethod
    def validate_target(cls, v: float, info) -> float:
        """Ensure target is above entry for long positions."""
        if hasattr(info, "data") and "entry" in info.data and "signal" in info.data:
            entry = info.data["entry"]
            signal = info.data["signal"]

            # For BUY signals, target should be above entry
            if signal == Signal.BUY and v <= entry:
                raise ValueError(
                    f"For BUY signal, target ({v}) must be above entry ({entry})"
                )

            # For SELL signals, target should be below entry
            if signal == Signal.SELL and v >= entry:
                raise ValueError(
                    f"For SELL signal, target ({v}) must be below entry ({entry})"
                )

        return v

    @field_validator("risk_reward")
    @classmethod
    def validate_risk_reward(cls, v: float, info) -> float:
        """Validate calculated risk/reward matches entry/stop/target."""
        if hasattr(info, "data"):
            data = info.data
            if all(k in data for k in ["entry", "stop_loss", "target"]):
                entry = data["entry"]
                stop_loss = data["stop_loss"]
                target = data["target"]

                # Calculate expected risk/reward
                risk = abs(entry - stop_loss)
                reward = abs(target - entry)

                if risk > 0:
                    expected_rr = reward / risk
                    # Allow small floating point differences
                    if abs(v - expected_rr) > 0.1:
                        raise ValueError(
                            f"Risk/reward ({v:.2f}) doesn't match "
                            f"calculated value ({expected_rr:.2f}) from "
                            f"entry={entry}, stop={stop_loss}, target={target}"
                        )

        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "name": "Reliance Industries Limited",
                    "score": 78.5,
                    "sector": "Energy",
                    "signal": "BUY",
                    "setup_type": "BREAKOUT",
                    "entry": 2460.0,
                    "stop_loss": 2430.0,
                    "target": 2520.0,
                    "risk_reward": 2.0,
                    "component_scores": {
                        "trend_score": 85.0,
                        "technical_score": 75.0,
                        "volume_score": 80.0,
                        "relative_strength_score": 70.0,
                        "breakout_score": 90.0,
                        "sector_score": 65.0,
                        "risk_reward_score": 75.0,
                    },
                    "key_metrics": {
                        "current_price": 2460.0,
                        "volume": 1200000,
                        "trend_direction": "UPTREND",
                        "rsi": 58.5,
                        "adx": 32.4,
                        "relative_volume": 1.35,
                        "distance_from_52w_high": -5.4,
                        "distance_from_52w_low": 11.8,
                    },
                    "rationale": "Strong uptrend breakout with volume confirmation and favorable risk/reward",
                }
            ]
        }
    }


class ScanResult(BaseModel):
    """
    Complete scan result with all candidates.

    Returned by the swing scanner endpoint. Contains all qualifying
    candidates ranked by score, along with metadata about the scan.

    Attributes:
        candidates: List of swing candidates, sorted by score (descending)
        total_scanned: Total number of stocks scanned
        filters_applied: List of filters applied during scanning
        scan_timestamp: When the scan was performed (optional)
        market_regime: Overall market condition at scan time (optional)
    """

    candidates: List[SwingCandidate] = Field(
        ..., description="List of swing candidates, sorted by score (descending)"
    )
    total_scanned: int = Field(..., ge=0, description="Total number of stocks scanned")
    filters_applied: List[str] = Field(
        default_factory=list, description="List of filters applied during scanning"
    )
    scan_timestamp: Optional[str] = Field(
        None, description="Timestamp when scan was performed (ISO 8601 format)"
    )
    market_regime: Optional[str] = Field(
        None,
        max_length=50,
        description="Overall market condition (BULL_MARKET, BEAR_MARKET, SIDEWAYS, VOLATILE)",
    )

    @field_validator("candidates")
    @classmethod
    def validate_candidates_sorted(
        cls, v: List[SwingCandidate]
    ) -> List[SwingCandidate]:
        """Ensure candidates are sorted by score in descending order."""
        if len(v) > 1:
            scores = [c.score for c in v]
            if scores != sorted(scores, reverse=True):
                raise ValueError(
                    "candidates must be sorted by score in descending order"
                )
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "candidates": [
                        {
                            "symbol": "RELIANCE",
                            "name": "Reliance Industries Limited",
                            "score": 78.5,
                            "sector": "Energy",
                            "signal": "BUY",
                            "setup_type": "BREAKOUT",
                            "entry": 2460.0,
                            "stop_loss": 2430.0,
                            "target": 2520.0,
                            "risk_reward": 2.0,
                            "component_scores": {
                                "trend_score": 85.0,
                                "technical_score": 75.0,
                                "volume_score": 80.0,
                                "relative_strength_score": 70.0,
                                "breakout_score": 90.0,
                                "sector_score": 65.0,
                                "risk_reward_score": 75.0,
                            },
                            "key_metrics": {
                                "current_price": 2460.0,
                                "volume": 1200000,
                                "trend_direction": "UPTREND",
                                "rsi": 58.5,
                                "adx": 32.4,
                                "relative_volume": 1.35,
                                "distance_from_52w_high": -5.4,
                                "distance_from_52w_low": 11.8,
                            },
                            "rationale": "Strong breakout with volume",
                        },
                        {
                            "symbol": "TCS",
                            "name": "Tata Consultancy Services",
                            "score": 72.3,
                            "sector": "Technology",
                            "signal": "BUY",
                            "setup_type": "RETEST",
                            "entry": 3500.0,
                            "stop_loss": 3450.0,
                            "target": 3600.0,
                            "risk_reward": 2.0,
                            "component_scores": {
                                "trend_score": 75.0,
                                "technical_score": 70.0,
                                "volume_score": 65.0,
                                "relative_strength_score": 80.0,
                                "breakout_score": 60.0,
                                "sector_score": 85.0,
                                "risk_reward_score": 70.0,
                            },
                            "key_metrics": {
                                "current_price": 3500.0,
                                "volume": 800000,
                                "trend_direction": "UPTREND",
                                "rsi": 52.1,
                                "adx": 28.7,
                                "relative_volume": 1.15,
                                "distance_from_52w_high": -8.2,
                                "distance_from_52w_low": 15.3,
                            },
                            "rationale": "Successful retest of breakout level",
                        },
                    ],
                    "total_scanned": 150,
                    "filters_applied": [
                        "min_score >= 60",
                        "min_volume >= 100000",
                        "active_stocks_only",
                    ],
                    "scan_timestamp": "2024-01-15T10:30:00Z",
                    "market_regime": "BULL_MARKET",
                }
            ]
        }
    }

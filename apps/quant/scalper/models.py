"""
Options Scalping Agent Data Models.

This module defines Pydantic models for the options scalping agent,
including analysis results, market data packages, technical indicators,
options analysis, signals, and configuration.

Requirements: 20.1, 20.2, 30.1, 30.2, 30.3, 30.4, 30.5, 30.6
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime, date


class ScalperSignalType(str, Enum):
    """Signal types for options scalping."""

    BUY_CE = "BUY CE"
    BUY_PE = "BUY PE"
    HOLD = "HOLD"


class TrendClassification(str, Enum):
    """Market trend classification."""

    BULLISH = "Bullish"
    BEARISH = "Bearish"
    NEUTRAL = "Neutral"


class OIInterpretation(str, Enum):
    """Open Interest interpretation classification."""

    BULLISH = "Bullish"
    BEARISH = "Bearish"
    NEUTRAL = "Neutral"


class TrendlineStatus(str, Enum):
    """Trendline status classification."""

    BULLISH = "Bullish"
    BEARISH = "Bearish"
    NEUTRAL = "Neutral"


class TechnicalIndicators(BaseModel):
    """
    Technical indicators calculated from OHLCV data.

    Contains all technical indicators used by the scalping agent
    for market analysis and signal generation.

    Attributes:
        vwap: Volume Weighted Average Price for the current session
        ema_5: 5-period Exponential Moving Average
        ema_15: 15-period Exponential Moving Average
        rsi: 14-period Relative Strength Index (0-100)
        macd: MACD line value (12, 26 periods)
        macd_signal: MACD signal line value (9-period EMA of MACD)
        macd_histogram: MACD histogram (MACD - Signal)
        atr: 14-period Average True Range
        current_volume: Current period trading volume
        avg_volume: 20-period average volume
        volume_ratio: Current volume / average volume ratio
    """

    vwap: float = Field(..., gt=0, description="Volume Weighted Average Price")
    ema_5: float = Field(..., gt=0, description="5-period EMA")
    ema_15: float = Field(..., gt=0, description="15-period EMA")
    rsi: float = Field(..., ge=0.0, le=100.0, description="RSI (0-100)")
    macd: float = Field(..., description="MACD line value")
    macd_signal: float = Field(..., description="MACD signal line value")
    macd_histogram: float = Field(..., description="MACD histogram value")
    atr: float = Field(..., gt=0, description="Average True Range (14-period)")
    current_volume: int = Field(..., ge=0, description="Current period volume")
    avg_volume: float = Field(..., ge=0, description="20-period average volume")
    volume_ratio: float = Field(..., ge=0, description="Volume ratio (current/average)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "vwap": 21500.0,
                    "ema_5": 21520.0,
                    "ema_15": 21480.0,
                    "rsi": 62.5,
                    "macd": 15.3,
                    "macd_signal": 12.1,
                    "macd_histogram": 3.2,
                    "atr": 85.5,
                    "current_volume": 250000,
                    "avg_volume": 200000.0,
                    "volume_ratio": 1.25,
                }
            ]
        }
    }


class OIBuildup(BaseModel):
    """
    Represents a contract with significant OI buildup.

    Attributes:
        strike_price: Strike price of the contract
        option_type: Option type (CE or PE)
        oi_change: Absolute change in open interest
        oi_change_pct: Percentage change in open interest
    """

    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field(..., pattern=r"^(CE|PE)$", description="Option type")
    oi_change: int = Field(..., description="Absolute OI change")
    oi_change_pct: float = Field(..., description="OI change percentage")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "strike_price": 21500.0,
                    "option_type": "CE",
                    "oi_change": 5000,
                    "oi_change_pct": 15.2,
                }
            ]
        }
    }


class OptionsAnalysis(BaseModel):
    """
    Options chain analysis results.

    Contains aggregated options metrics including OI, PCR,
    IV, and buildup detection results.

    Attributes:
        call_oi: Total Call open interest
        put_oi: Total Put open interest
        call_oi_change: Change in Call OI from previous refresh
        put_oi_change: Change in Put OI from previous refresh
        call_oi_change_pct: Percentage change in Call OI
        put_oi_change_pct: Percentage change in Put OI
        pcr: Put-Call Ratio (Put OI / Call OI)
        atm_call_iv: ATM Call implied volatility (nearest weekly expiry)
        atm_put_iv: ATM Put implied volatility (nearest weekly expiry)
        top_call_oi_buildup: Top 5 Call contracts with highest OI increase
        top_put_oi_buildup: Top 5 Put contracts with highest OI increase
    """

    call_oi: int = Field(..., ge=0, description="Total Call open interest")
    put_oi: int = Field(..., ge=0, description="Total Put open interest")
    call_oi_change: int = Field(..., description="Call OI change from previous refresh")
    put_oi_change: int = Field(..., description="Put OI change from previous refresh")
    call_oi_change_pct: float = Field(..., description="Call OI change percentage")
    put_oi_change_pct: float = Field(..., description="Put OI change percentage")
    pcr: float = Field(..., ge=0, description="Put-Call Ratio")
    atm_call_iv: Optional[float] = Field(
        None, ge=0, description="ATM Call implied volatility"
    )
    atm_put_iv: Optional[float] = Field(
        None, ge=0, description="ATM Put implied volatility"
    )
    top_call_oi_buildup: List[OIBuildup] = Field(
        default_factory=list, description="Top 5 Call OI buildup contracts"
    )
    top_put_oi_buildup: List[OIBuildup] = Field(
        default_factory=list, description="Top 5 Put OI buildup contracts"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "call_oi": 5000000,
                    "put_oi": 6000000,
                    "call_oi_change": 150000,
                    "put_oi_change": 200000,
                    "call_oi_change_pct": 3.1,
                    "put_oi_change_pct": 3.4,
                    "pcr": 1.2,
                    "atm_call_iv": 0.18,
                    "atm_put_iv": 0.20,
                    "top_call_oi_buildup": [],
                    "top_put_oi_buildup": [],
                }
            ]
        }
    }


class OptionsContract(BaseModel):
    """
    Represents a single options contract with liquidity metrics.

    Attributes:
        strike_price: Strike price of the option
        option_type: Option type (CE or PE)
        expiry_date: Expiry date of the contract
        bid: Bid price
        ask: Ask price
        ltp: Last traded price
        volume: Trading volume
        open_interest: Current open interest
        implied_volatility: Implied volatility (as decimal)
        mid_price: Mid-price = (bid + ask) / 2
        spread: Bid-ask spread = ask - bid
        spread_percentage: Spread percentage = (spread / mid_price) * 100
        is_liquid: Whether contract meets liquidity criteria
        delta: Option delta (from Greeks)
        gamma: Option gamma
        theta: Option theta
        vega: Option vega
    """

    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field(..., pattern=r"^(CE|PE)$", description="Option type")
    expiry_date: date = Field(..., description="Contract expiry date")
    bid: float = Field(..., ge=0, description="Bid price")
    ask: float = Field(..., ge=0, description="Ask price")
    ltp: float = Field(..., ge=0, description="Last traded price")
    volume: int = Field(..., ge=0, description="Trading volume")
    open_interest: int = Field(..., ge=0, description="Open interest")
    implied_volatility: Optional[float] = Field(
        None, ge=0, description="Implied volatility"
    )
    mid_price: float = Field(..., ge=0, description="Mid-price (bid+ask)/2")
    spread: float = Field(..., ge=0, description="Bid-ask spread")
    spread_percentage: float = Field(..., ge=0, description="Spread percentage")
    is_liquid: bool = Field(..., description="Meets liquidity criteria")
    delta: Optional[float] = Field(None, description="Option delta")
    gamma: Optional[float] = Field(None, description="Option gamma")
    theta: Optional[float] = Field(None, description="Option theta")
    vega: Optional[float] = Field(None, description="Option vega")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "strike_price": 21500.0,
                    "option_type": "CE",
                    "expiry_date": "2024-12-26",
                    "bid": 98.0,
                    "ask": 102.0,
                    "ltp": 100.0,
                    "volume": 5000,
                    "open_interest": 10000,
                    "implied_volatility": 0.15,
                    "mid_price": 100.0,
                    "spread": 4.0,
                    "spread_percentage": 4.0,
                    "is_liquid": True,
                    "delta": 0.52,
                    "gamma": 0.003,
                    "theta": -12.5,
                    "vega": 45.2,
                }
            ]
        }
    }


class SupportResistance(BaseModel):
    """
    Support and resistance levels with distance calculations.

    Attributes:
        support_level: Nearest support level below current price
        resistance_level: Nearest resistance level above current price
        distance_to_support_pct: Distance to support as percentage of current price
        distance_to_resistance_pct: Distance to resistance as percentage of current price
    """

    support_level: Optional[float] = Field(
        None, gt=0, description="Nearest support level"
    )
    resistance_level: Optional[float] = Field(
        None, gt=0, description="Nearest resistance level"
    )
    distance_to_support_pct: Optional[float] = Field(
        None, description="Distance to support as % of current price"
    )
    distance_to_resistance_pct: Optional[float] = Field(
        None, description="Distance to resistance as % of current price"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "support_level": 21400.0,
                    "resistance_level": 21600.0,
                    "distance_to_support_pct": 0.47,
                    "distance_to_resistance_pct": 0.47,
                }
            ]
        }
    }


class Signal(BaseModel):
    """
    Generated trading signal with contract details.

    Attributes:
        signal_type: Signal type (BUY CE, BUY PE, or HOLD)
        probability: AI confidence percentage (0-100)
        risk_reward_ratio: Risk/reward ratio (e.g., 2.5 for 1:2.5)
        selected_contract: Selected options contract (None for HOLD)
        entry_price: Suggested entry price (mid-price)
        target_price: Target price (entry + 2*ATR)
        stop_loss: Stop loss price (entry - 1*ATR)
        hold_reason: Reason for HOLD signal (None for BUY)
    """

    signal_type: ScalperSignalType = Field(..., description="Signal type")
    probability: float = Field(
        ..., ge=0.0, le=100.0, description="AI confidence (0-100%)"
    )
    risk_reward_ratio: float = Field(..., ge=0, description="Risk/reward ratio")
    selected_contract: Optional[OptionsContract] = Field(
        None, description="Selected contract for BUY signal"
    )
    entry_price: Optional[float] = Field(
        None, gt=0, description="Suggested entry price"
    )
    target_price: Optional[float] = Field(None, gt=0, description="Target price")
    stop_loss: Optional[float] = Field(None, gt=0, description="Stop loss price")
    hold_reason: Optional[str] = Field(
        None, description="Reason for HOLD signal"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "signal_type": "BUY CE",
                    "probability": 75.5,
                    "risk_reward_ratio": 2.5,
                    "selected_contract": {
                        "strike_price": 21500.0,
                        "option_type": "CE",
                        "expiry_date": "2024-12-26",
                        "bid": 98.0,
                        "ask": 102.0,
                        "ltp": 100.0,
                        "volume": 5000,
                        "open_interest": 10000,
                        "implied_volatility": 0.15,
                        "mid_price": 100.0,
                        "spread": 4.0,
                        "spread_percentage": 4.0,
                        "is_liquid": True,
                        "delta": 0.52,
                        "gamma": 0.003,
                        "theta": -12.5,
                        "vega": 45.2,
                    },
                    "entry_price": 100.0,
                    "target_price": 271.0,
                    "stop_loss": 14.5,
                    "hold_reason": None,
                }
            ]
        }
    }


class MarketDataPackage(BaseModel):
    """
    Complete market data package for analysis.

    Contains all data needed for a single analysis cycle including
    spot price, OHLCV candles, options chain, and previous analysis
    for OI change calculation.

    Attributes:
        timestamp: Data collection timestamp
        underlying: Underlying symbol (NIFTY or BANKNIFTY)
        spot_price: Current spot price of the underlying
        ohlcv_data: List of 1-minute OHLCV candles (last 100 bars)
        options_chain: List of options contracts
        previous_analysis: Previous analysis result for OI change calculation
    """

    timestamp: datetime = Field(..., description="Data collection timestamp")
    underlying: str = Field(
        ..., pattern=r"^(NIFTY|BANKNIFTY)$", description="Underlying symbol"
    )
    spot_price: float = Field(..., gt=0, description="Current spot price")
    ohlcv_data: List[Any] = Field(
        ..., min_length=1, description="1-minute OHLCV candles"
    )
    options_chain: List[OptionsContract] = Field(
        ..., description="Options contracts within 10% of spot"
    )
    previous_analysis: Optional[Any] = Field(
        None, description="Previous analysis for OI change calculation"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "timestamp": "2024-12-20T10:30:00Z",
                    "underlying": "NIFTY",
                    "spot_price": 21500.0,
                    "ohlcv_data": [],
                    "options_chain": [],
                    "previous_analysis": None,
                }
            ]
        }
    }


class ScalperAnalysisResult(BaseModel):
    """
    Complete analysis result from the options scalping agent.

    This is the primary output model containing signal, trade details,
    market metrics, technical indicators, options metrics, and AI rationale.

    Requirements: 20.1, 20.2

    Attributes:
        timestamp: Analysis completion timestamp
        underlying: Underlying symbol (NIFTY or BANKNIFTY)
        signal_type: Signal type (BUY CE, BUY PE, HOLD)
        probability: AI confidence percentage (0-100)
        risk_reward_ratio: Risk/reward ratio (e.g., 2.5)
        strike_price: Selected strike price (None for HOLD)
        expiry_date: Contract expiry date (None for HOLD)
        entry_price: Suggested entry price (None for HOLD)
        target_price: Target price (None for HOLD)
        stop_loss: Stop loss price (None for HOLD)
        lot_size: Lot size (50 for NIFTY, 25 for BANKNIFTY)
        spot_price: Current spot price
        trend: Market trend classification
        oi_interpretation: OI interpretation
        pcr: Put-Call Ratio
        trendline_status: Trendline status
        support_level: Nearest support level
        resistance_level: Nearest resistance level
        rsi: RSI value
        macd: MACD line value
        macd_signal: MACD signal line value
        vwap: VWAP value
        ema_5: 5-period EMA
        ema_15: 15-period EMA
        atr: ATR value
        volume_ratio: Volume ratio
        call_oi: Total Call OI
        put_oi: Total Put OI
        call_oi_change: Call OI change
        put_oi_change: Put OI change
        atm_iv: ATM implied volatility
        rationale: AI-generated rationale (100-300 words)
        hold_reason: Reason for HOLD signal (None for BUY)
    """

    timestamp: datetime = Field(..., description="Analysis timestamp")
    underlying: str = Field(
        ..., pattern=r"^(NIFTY|BANKNIFTY)$", description="Underlying symbol"
    )
    signal_type: ScalperSignalType = Field(..., description="Signal type")
    probability: float = Field(
        ..., ge=0.0, le=100.0, description="Probability percentage"
    )
    risk_reward_ratio: float = Field(..., ge=0, description="Risk/reward ratio")

    # Trade details (None for HOLD)
    strike_price: Optional[float] = Field(None, description="Strike price")
    expiry_date: Optional[date] = Field(None, description="Expiry date")
    entry_price: Optional[float] = Field(None, gt=0, description="Entry price")
    target_price: Optional[float] = Field(None, gt=0, description="Target price")
    stop_loss: Optional[float] = Field(None, gt=0, description="Stop loss price")
    lot_size: Optional[int] = Field(None, gt=0, description="Lot size")

    # Market metrics
    spot_price: float = Field(..., gt=0, description="Current spot price")
    trend: TrendClassification = Field(..., description="Trend classification")
    oi_interpretation: OIInterpretation = Field(
        ..., description="OI interpretation"
    )
    pcr: float = Field(..., ge=0, description="Put-Call Ratio")
    trendline_status: TrendlineStatus = Field(
        ..., description="Trendline status"
    )
    support_level: Optional[float] = Field(None, description="Support level")
    resistance_level: Optional[float] = Field(None, description="Resistance level")

    # Technical indicators
    rsi: float = Field(..., ge=0.0, le=100.0, description="RSI value")
    macd: float = Field(..., description="MACD line value")
    macd_signal: float = Field(..., description="MACD signal line value")
    vwap: float = Field(..., gt=0, description="VWAP value")
    ema_5: float = Field(..., gt=0, description="5-period EMA")
    ema_15: float = Field(..., gt=0, description="15-period EMA")
    atr: float = Field(..., gt=0, description="ATR value")
    volume_ratio: float = Field(..., ge=0, description="Volume ratio")

    # Options metrics
    call_oi: int = Field(..., ge=0, description="Total Call OI")
    put_oi: int = Field(..., ge=0, description="Total Put OI")
    call_oi_change: int = Field(..., description="Call OI change")
    put_oi_change: int = Field(..., description="Put OI change")
    atm_iv: Optional[float] = Field(None, ge=0, description="ATM implied volatility")

    # AI rationale
    rationale: str = Field(
        ..., min_length=1, max_length=5000, description="AI rationale (100-300 words)"
    )

    # Metadata
    hold_reason: Optional[str] = Field(None, description="HOLD reason")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "timestamp": "2024-12-20T10:30:00Z",
                    "underlying": "NIFTY",
                    "signal_type": "BUY CE",
                    "probability": 75.5,
                    "risk_reward_ratio": 2.5,
                    "strike_price": 21500.0,
                    "expiry_date": "2024-12-26",
                    "entry_price": 100.0,
                    "target_price": 271.0,
                    "stop_loss": 14.5,
                    "lot_size": 50,
                    "spot_price": 21500.0,
                    "trend": "Bullish",
                    "oi_interpretation": "Bullish",
                    "pcr": 1.2,
                    "trendline_status": "Bullish",
                    "support_level": 21400.0,
                    "resistance_level": 21600.0,
                    "rsi": 62.5,
                    "macd": 15.3,
                    "macd_signal": 12.1,
                    "vwap": 21500.0,
                    "ema_5": 21520.0,
                    "ema_15": 21480.0,
                    "atr": 85.5,
                    "volume_ratio": 1.25,
                    "call_oi": 5000000,
                    "put_oi": 6000000,
                    "call_oi_change": 150000,
                    "put_oi_change": 200000,
                    "atm_iv": 0.18,
                    "rationale": "Strong bullish momentum with price above VWAP and EMA crossover. RSI in bullish zone without being overbought. MACD showing positive histogram expansion. Put OI buildup at lower strikes indicates strong support. PCR at 1.2 suggests moderate bullishness. ATM strike offers excellent liquidity with tight spread.",
                    "hold_reason": None,
                }
            ]
        }
    }


class ScalperConfiguration(BaseModel):
    """
    User-configurable settings for the options scalping agent.

    Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6

    Attributes:
        id: Configuration record ID (auto-generated)
        user_id: User ID this configuration belongs to
        refresh_interval: Auto-refresh interval in seconds (30-300, default 60)
        probability_threshold: Minimum probability for BUY signal (50-90%, default 70)
        risk_reward_threshold: Minimum R:R ratio for BUY signal (1.0-5.0, default 2.0)
        max_spread_percentage: Maximum allowed bid-ask spread % (1-10, default 5)
        min_open_interest: Minimum OI for contract selection (100-10000, default 1000)
    """

    id: Optional[int] = Field(None, description="Configuration record ID")
    user_id: str = Field(..., min_length=1, description="User ID")
    refresh_interval: int = Field(
        default=60,
        ge=30,
        le=300,
        description="Refresh interval in seconds (30-300)",
    )
    probability_threshold: float = Field(
        default=70.0,
        ge=50.0,
        le=90.0,
        description="Probability threshold percentage (50-90)",
    )
    risk_reward_threshold: float = Field(
        default=2.0,
        ge=1.0,
        le=5.0,
        description="Risk/reward ratio threshold (1.0-5.0)",
    )
    max_spread_percentage: float = Field(
        default=5.0,
        ge=1.0,
        le=10.0,
        description="Max spread percentage (1-10)",
    )
    min_open_interest: int = Field(
        default=1000,
        ge=100,
        le=10000,
        description="Minimum open interest (100-10000)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "id": 1,
                    "user_id": "user123",
                    "refresh_interval": 60,
                    "probability_threshold": 70.0,
                    "risk_reward_threshold": 2.0,
                    "max_spread_percentage": 5.0,
                    "min_open_interest": 1000,
                }
            ]
        }
    }


class WebSocketMessage(BaseModel):
    """
    WebSocket message format for real-time updates.

    Attributes:
        message_type: Type of message (analysis_update, heartbeat, error)
        timestamp: Message timestamp
        underlying: Underlying symbol (optional)
        signal_data: Analysis result data (optional)
        market_data: Additional market data (optional)
        error: Error message (optional)
    """

    message_type: str = Field(
        ...,
        pattern=r"^(analysis_update|heartbeat|error)$",
        description="Message type",
    )
    timestamp: datetime = Field(..., description="Message timestamp")
    underlying: Optional[str] = Field(None, description="Underlying symbol")
    signal_data: Optional[ScalperAnalysisResult] = Field(
        None, description="Analysis result"
    )
    market_data: Optional[Dict[str, Any]] = Field(
        None, description="Additional market data"
    )
    error: Optional[str] = Field(None, description="Error message")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message_type": "analysis_update",
                    "timestamp": "2024-12-20T10:30:00Z",
                    "underlying": "NIFTY",
                    "signal_data": None,
                    "market_data": None,
                    "error": None,
                },
                {
                    "message_type": "heartbeat",
                    "timestamp": "2024-12-20T10:30:30Z",
                    "underlying": None,
                    "signal_data": None,
                    "market_data": None,
                    "error": None,
                },
            ]
        }
    }

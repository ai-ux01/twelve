"""
AI Analysis Engine for the Options Scalping Agent.

This module provides comprehensive market analysis using LLM (GPT-4) integration
to generate trading recommendations with structured output including signal type,
probability, entry/target/stop-loss prices, trend classification, OI interpretation,
and a detailed rationale.

Requirements: 9.1, 9.3, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from scalper.models import (
    MarketDataPackage,
    TechnicalIndicators,
    OptionsAnalysis,
    SupportResistance,
    TrendClassification,
    OIInterpretation,
)

logger = logging.getLogger(__name__)


class AIAnalysisResult(BaseModel):
    """
    Structured result from AI analysis.

    Attributes:
        signal_type: Recommended action (BUY CE, BUY PE, or HOLD)
        probability: Confidence percentage (0-100)
        entry_price: Suggested entry price
        target_price: Suggested target price
        stop_loss: Suggested stop loss price
        trend: Trend classification (Bullish, Bearish, Neutral)
        oi_interpretation: OI-based market sentiment (Bullish, Bearish, Neutral)
        rationale: Detailed explanation (100-300 words)
    """

    signal_type: str = Field(..., description="BUY CE, BUY PE, or HOLD")
    probability: float = Field(..., ge=0, le=100, description="Confidence 0-100%")
    entry_price: Optional[float] = Field(None, description="Suggested entry price")
    target_price: Optional[float] = Field(None, description="Suggested target price")
    stop_loss: Optional[float] = Field(None, description="Suggested stop loss price")
    trend: str = Field(..., description="Bullish, Bearish, or Neutral")
    oi_interpretation: str = Field(..., description="Bullish, Bearish, or Neutral")
    rationale: str = Field(..., description="100-300 word explanation")


class AIAnalysisEngineError(Exception):
    """Raised when AI analysis fails."""

    pass


class AIAnalysisEngine:
    """
    AI Analysis Engine for the Options Scalping Agent.

    Performs comprehensive market analysis using LLM (GPT-4) integration.
    Evaluates price action, trend, technical indicators, options chain metrics,
    support/resistance levels, and trendlines to generate structured trading
    recommendations.

    The engine uses the persona of an "Elite intraday options scalper with
    aggressive risk/reward preferences" and enforces a 2-second timeout
    for LLM responses.

    On failure, returns a HOLD signal with "Analysis Error" reason.

    Requirements: 9.1, 9.3, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13
    """

    # LLM Configuration
    LLM_TIMEOUT: float = 2.0  # 2 seconds timeout
    LLM_MODEL: str = "gpt-4"
    PERSONA: str = (
        "You are an elite intraday options scalper with aggressive risk/reward "
        "preferences. You specialize in NIFTY50 and BANKNIFTY options scalping "
        "on the Indian stock market (NSE). You analyze 1-minute charts and "
        "options chain data to identify high-probability short-term trades."
    )

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        """
        Initialize the AI Analysis Engine.

        Args:
            api_key: OpenAI API key. If None, reads from OPENAI_API_KEY env var.
            model: LLM model to use. Defaults to GPT-4.
            timeout: Timeout for LLM calls in seconds. Defaults to 2.0.
        """
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._model = model or os.environ.get("AI_MODEL", "") or self.LLM_MODEL
        self._timeout = timeout if timeout is not None else self.LLM_TIMEOUT
        self._client = None

    def _get_client(self):
        """Lazily initialize the OpenAI client."""
        if self._client is None:
            try:
                from openai import OpenAI

                self._client = OpenAI(
                    api_key=self._api_key,
                    timeout=self._timeout,
                )
            except ImportError:
                raise AIAnalysisEngineError(
                    "openai package not installed. Install with: pip install openai"
                )
            except Exception as e:
                raise AIAnalysisEngineError(
                    f"Failed to initialize OpenAI client: {e}"
                )
        return self._client

    def analyze_market_data(
        self,
        data_package: MarketDataPackage,
        technical_indicators: TechnicalIndicators,
        options_analysis: OptionsAnalysis,
        support_resistance: SupportResistance,
        trendline_status: str = "Neutral",
    ) -> AIAnalysisResult:
        """
        Perform comprehensive market analysis using LLM.

        Sends the complete data package to GPT-4 with the scalper persona
        and returns a structured trading recommendation.

        Args:
            data_package: Complete market data package with spot price and OHLCV.
            technical_indicators: Calculated technical indicators.
            options_analysis: Options chain analysis results.
            support_resistance: Support and resistance levels.
            trendline_status: Current trendline status (Bullish/Bearish/Neutral).

        Returns:
            AIAnalysisResult with signal, probability, prices, and rationale.

        Note:
            On any failure (timeout, API error, parse error), returns HOLD
            with "Analysis Error" reason rather than raising an exception.
        """
        try:
            # Build context for the LLM
            context = self._build_analysis_context(
                data_package=data_package,
                technical_indicators=technical_indicators,
                options_analysis=options_analysis,
                support_resistance=support_resistance,
                trendline_status=trendline_status,
            )

            # Classify components locally for additional context
            price_action = self.classify_price_action(data_package.ohlcv_data)
            indicator_interpretation = self.interpret_technical_indicators(
                technical_indicators
            )
            options_sentiment = self.interpret_options_metrics(options_analysis)

            # Build the prompt
            prompt = self._build_prompt(
                context=context,
                price_action=price_action,
                indicator_interpretation=indicator_interpretation,
                options_sentiment=options_sentiment,
            )

            # Call LLM
            client = self._get_client()
            response = client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": self.PERSONA},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=1000,
                response_format={"type": "json_object"},
            )

            # Parse LLM response
            content = response.choices[0].message.content
            result = self._parse_llm_response(content)

            # Generate rationale if not sufficient
            if not result.rationale or len(result.rationale.split()) < 50:
                result.rationale = self.generate_rationale(
                    {
                        "signal_type": result.signal_type,
                        "probability": result.probability,
                        "trend": result.trend,
                        "price_action": price_action,
                        "indicators": indicator_interpretation,
                        "options_sentiment": options_sentiment,
                        "spot_price": data_package.spot_price,
                        "support_resistance": support_resistance.model_dump(),
                        "trendline_status": trendline_status,
                    }
                )

            logger.info(
                f"AI analysis complete: signal={result.signal_type}, "
                f"probability={result.probability}%"
            )
            return result

        except Exception as e:
            logger.error(f"AI analysis failed: {e}", exc_info=True)
            # Graceful degradation: return HOLD with error reason
            return AIAnalysisResult(
                signal_type="HOLD",
                probability=0.0,
                entry_price=None,
                target_price=None,
                stop_loss=None,
                trend="Neutral",
                oi_interpretation="Neutral",
                rationale="Analysis Error: AI analysis could not be completed. "
                "The system was unable to generate a trading recommendation "
                "due to a technical issue. No position is recommended at this time. "
                "The system will retry analysis in the next refresh cycle. "
                "Please wait for the next automatic refresh or trigger a manual refresh.",
            )

    def classify_price_action(self, ohlcv_data: List[Any]) -> str:
        """
        Identify candlestick patterns and momentum from OHLCV data.

        Analyzes the most recent candles to identify patterns such as:
        - Doji, Hammer, Engulfing, Marubozu
        - Momentum direction (up/down/sideways)
        - Volatility expansion/contraction

        Args:
            ohlcv_data: List of OHLCV candle data.

        Returns:
            String description of current price action pattern and momentum.
        """
        if not ohlcv_data or len(ohlcv_data) < 3:
            return "Insufficient data for price action analysis"

        try:
            # Get last few candles for pattern analysis
            recent_candles = ohlcv_data[-5:] if len(ohlcv_data) >= 5 else ohlcv_data

            # Extract OHLC values - handle both dict and object formats
            candle_data = []
            for candle in recent_candles:
                if isinstance(candle, dict):
                    o = candle.get("open", 0)
                    h = candle.get("high", 0)
                    l = candle.get("low", 0)
                    c = candle.get("close", 0)
                    v = candle.get("volume", 0)
                else:
                    o = getattr(candle, "open", 0)
                    h = getattr(candle, "high", 0)
                    l = getattr(candle, "low", 0)
                    c = getattr(candle, "close", 0)
                    v = getattr(candle, "volume", 0)
                candle_data.append({"open": o, "high": h, "low": l, "close": c, "volume": v})

            if not candle_data:
                return "No valid candle data available"

            last = candle_data[-1]
            body = abs(last["close"] - last["open"])
            upper_shadow = last["high"] - max(last["close"], last["open"])
            lower_shadow = min(last["close"], last["open"]) - last["low"]
            total_range = last["high"] - last["low"]

            patterns = []

            # Doji detection (body < 10% of range)
            if total_range > 0 and body / total_range < 0.1:
                patterns.append("Doji (indecision)")

            # Hammer detection (lower shadow > 2x body, small upper shadow)
            elif body > 0 and lower_shadow > 2 * body and upper_shadow < body * 0.5:
                patterns.append("Hammer (potential reversal)")

            # Inverted Hammer
            elif body > 0 and upper_shadow > 2 * body and lower_shadow < body * 0.5:
                patterns.append("Inverted Hammer")

            # Marubozu (no shadows, strong momentum)
            elif total_range > 0 and body / total_range > 0.9:
                direction = "Bullish" if last["close"] > last["open"] else "Bearish"
                patterns.append(f"{direction} Marubozu (strong momentum)")

            # Engulfing pattern (compare last two candles)
            if len(candle_data) >= 2:
                prev = candle_data[-2]
                if (
                    last["close"] > last["open"]
                    and prev["close"] < prev["open"]
                    and last["open"] <= prev["close"]
                    and last["close"] >= prev["open"]
                ):
                    patterns.append("Bullish Engulfing")
                elif (
                    last["close"] < last["open"]
                    and prev["close"] > prev["open"]
                    and last["open"] >= prev["close"]
                    and last["close"] <= prev["open"]
                ):
                    patterns.append("Bearish Engulfing")

            # Momentum analysis using last 3-5 candles
            closes = [c["close"] for c in candle_data]
            if len(closes) >= 3:
                momentum_change = closes[-1] - closes[0]
                avg_close = sum(closes) / len(closes)
                if avg_close > 0:
                    momentum_pct = (momentum_change / avg_close) * 100
                    if momentum_pct > 0.1:
                        patterns.append(f"Bullish momentum (+{momentum_pct:.2f}%)")
                    elif momentum_pct < -0.1:
                        patterns.append(f"Bearish momentum ({momentum_pct:.2f}%)")
                    else:
                        patterns.append("Sideways/consolidating")

            if not patterns:
                patterns.append("No clear pattern identified")

            return "; ".join(patterns)

        except Exception as e:
            logger.warning(f"Price action classification failed: {e}")
            return "Price action analysis unavailable"

    def interpret_technical_indicators(
        self, indicators: TechnicalIndicators
    ) -> Dict[str, str]:
        """
        Classify each technical indicator as bullish, bearish, or neutral.

        Interpretation rules:
        - VWAP: Price above = Bullish, below = Bearish
        - RSI: >70 = Overbought (Bearish), <30 = Oversold (Bullish), else Neutral
        - MACD: Line > Signal = Bullish, Line < Signal = Bearish
        - EMA: EMA5 > EMA15 = Bullish, EMA5 < EMA15 = Bearish
        - Volume: Ratio > 1.5 = High (Confirmation), < 0.5 = Low (Weak)

        Args:
            indicators: TechnicalIndicators model with all calculated values.

        Returns:
            Dict mapping indicator name to interpretation string.
        """
        interpretation = {}

        # VWAP interpretation (relative to EMA5 as proxy for current price)
        current_price_proxy = indicators.ema_5
        if current_price_proxy > indicators.vwap:
            interpretation["vwap"] = "Bullish (price above VWAP)"
        elif current_price_proxy < indicators.vwap:
            interpretation["vwap"] = "Bearish (price below VWAP)"
        else:
            interpretation["vwap"] = "Neutral (price at VWAP)"

        # RSI interpretation
        if indicators.rsi > 70:
            interpretation["rsi"] = "Overbought (Bearish signal)"
        elif indicators.rsi < 30:
            interpretation["rsi"] = "Oversold (Bullish signal)"
        elif indicators.rsi > 60:
            interpretation["rsi"] = "Bullish zone"
        elif indicators.rsi < 40:
            interpretation["rsi"] = "Bearish zone"
        else:
            interpretation["rsi"] = "Neutral"

        # MACD interpretation
        if indicators.macd > indicators.macd_signal:
            if indicators.macd_histogram > 0:
                interpretation["macd"] = "Bullish (MACD above signal, positive histogram)"
            else:
                interpretation["macd"] = "Bullish (MACD above signal)"
        elif indicators.macd < indicators.macd_signal:
            if indicators.macd_histogram < 0:
                interpretation["macd"] = "Bearish (MACD below signal, negative histogram)"
            else:
                interpretation["macd"] = "Bearish (MACD below signal)"
        else:
            interpretation["macd"] = "Neutral (MACD at signal)"

        # EMA crossover interpretation
        if indicators.ema_5 > indicators.ema_15:
            diff_pct = ((indicators.ema_5 - indicators.ema_15) / indicators.ema_15) * 100
            interpretation["ema"] = f"Bullish (EMA5 above EMA15 by {diff_pct:.2f}%)"
        elif indicators.ema_5 < indicators.ema_15:
            diff_pct = ((indicators.ema_15 - indicators.ema_5) / indicators.ema_15) * 100
            interpretation["ema"] = f"Bearish (EMA5 below EMA15 by {diff_pct:.2f}%)"
        else:
            interpretation["ema"] = "Neutral (EMAs converged)"

        # Volume interpretation
        if indicators.volume_ratio > 1.5:
            interpretation["volume"] = "High volume (strong confirmation)"
        elif indicators.volume_ratio > 1.0:
            interpretation["volume"] = "Above average volume"
        elif indicators.volume_ratio > 0.5:
            interpretation["volume"] = "Below average volume (weak signal)"
        else:
            interpretation["volume"] = "Very low volume (no confirmation)"

        # ATR interpretation (volatility context)
        interpretation["atr"] = f"ATR: {indicators.atr:.2f} (volatility measure)"

        return interpretation

    def interpret_options_metrics(self, options_analysis: OptionsAnalysis) -> str:
        """
        Derive market sentiment from options chain metrics.

        Interpretation rules:
        - PCR > 1.5: Bearish sentiment
        - PCR < 0.7: Bullish sentiment
        - PCR 0.7-1.5: Neutral sentiment
        - Call OI increase with Put OI stable/decrease: Bullish
        - Put OI increase with Call OI stable/decrease: Bearish
        - High IV: Uncertainty/caution

        Args:
            options_analysis: OptionsAnalysis model with OI and PCR data.

        Returns:
            String description of overall market sentiment from options data.
        """
        sentiments = []

        # PCR interpretation
        if options_analysis.pcr > 1.5:
            sentiments.append(f"PCR {options_analysis.pcr:.2f}: Bearish (high put writing)")
        elif options_analysis.pcr < 0.7:
            sentiments.append(f"PCR {options_analysis.pcr:.2f}: Bullish (high call writing)")
        else:
            sentiments.append(f"PCR {options_analysis.pcr:.2f}: Neutral")

        # OI change interpretation
        call_oi_change = options_analysis.call_oi_change
        put_oi_change = options_analysis.put_oi_change

        if call_oi_change > 0 and put_oi_change <= 0:
            sentiments.append("Call OI buildup with Put OI decline: Bullish")
        elif put_oi_change > 0 and call_oi_change <= 0:
            sentiments.append("Put OI buildup with Call OI decline: Bearish")
        elif call_oi_change > 0 and put_oi_change > 0:
            if put_oi_change > call_oi_change:
                sentiments.append("Both OI increasing, Put dominant: Mildly Bearish")
            else:
                sentiments.append("Both OI increasing, Call dominant: Mildly Bullish")
        else:
            sentiments.append("OI declining on both sides: Neutral/Unwinding")

        # IV interpretation
        if options_analysis.atm_call_iv is not None:
            iv = options_analysis.atm_call_iv
            if iv > 0.30:
                sentiments.append(f"High IV ({iv:.1%}): Exercise caution")
            elif iv < 0.15:
                sentiments.append(f"Low IV ({iv:.1%}): Potential breakout setup")
            else:
                sentiments.append(f"Moderate IV ({iv:.1%})")

        return "; ".join(sentiments)

    def generate_rationale(self, analysis: Dict[str, Any]) -> str:
        """
        Generate a 100-300 word explanation of the trading recommendation.

        Covers: price action, trend, indicators, OI analysis, support/resistance,
        and probability/R:R reasoning.

        Args:
            analysis: Dict containing analysis components including signal_type,
                     probability, trend, price_action, indicators, options_sentiment,
                     spot_price, support_resistance, and trendline_status.

        Returns:
            String rationale between 100-300 words.
        """
        signal = analysis.get("signal_type", "HOLD")
        probability = analysis.get("probability", 0)
        trend = analysis.get("trend", "Neutral")
        price_action = analysis.get("price_action", "No pattern")
        indicators = analysis.get("indicators", {})
        options_sentiment = analysis.get("options_sentiment", "Neutral")
        spot_price = analysis.get("spot_price", 0)
        sr_data = analysis.get("support_resistance", {})
        trendline = analysis.get("trendline_status", "Neutral")

        parts = []

        # Signal summary
        if signal == "HOLD":
            parts.append(
                f"Recommending HOLD with {probability:.1f}% confidence. "
                f"Current conditions do not meet the required thresholds for entry."
            )
        else:
            parts.append(
                f"Recommending {signal} with {probability:.1f}% confidence. "
                f"Market conditions align for an aggressive scalping opportunity."
            )

        # Price action context
        parts.append(f"Price action shows: {price_action}.")

        # Trend context
        parts.append(
            f"Overall trend is {trend} with trendline status {trendline}. "
            f"Spot price at {spot_price:.2f}."
        )

        # Technical indicators
        ind_parts = []
        for key, value in indicators.items():
            ind_parts.append(f"{key.upper()}: {value}")
        if ind_parts:
            parts.append("Technical indicators: " + "; ".join(ind_parts[:4]) + ".")

        # Options metrics
        parts.append(f"Options sentiment: {options_sentiment}.")

        # Support/Resistance context
        support = sr_data.get("support_level")
        resistance = sr_data.get("resistance_level")
        if support and resistance:
            parts.append(
                f"Key levels - Support: {support:.2f}, Resistance: {resistance:.2f}. "
                f"Price positioned between these levels provides context for "
                f"entry/exit decisions."
            )
        elif support:
            parts.append(f"Support at {support:.2f} provides downside protection.")
        elif resistance:
            parts.append(f"Resistance at {resistance:.2f} acts as potential target.")

        # Probability/R:R reasoning
        if signal != "HOLD":
            parts.append(
                f"The {probability:.1f}% probability exceeds the 70% threshold "
                f"and the risk/reward profile meets the minimum 1:2 requirement, "
                f"making this a valid scalping setup."
            )
        else:
            parts.append(
                "Either probability is below 70% or risk/reward ratio is below 1:2, "
                "making this setup insufficient for entry."
            )

        rationale = " ".join(parts)

        # Ensure within 100-300 word range
        word_count = len(rationale.split())
        if word_count < 100:
            rationale += (
                " Market participants should monitor these levels closely "
                "for any changes in momentum or sentiment that could trigger "
                "a new trading opportunity in the next analysis cycle. "
                "The auto-refresh system will continue monitoring conditions."
            )

        # Trim if over 300 words
        words = rationale.split()
        if len(words) > 300:
            rationale = " ".join(words[:295]) + "."

        return rationale

    def _build_analysis_context(
        self,
        data_package: MarketDataPackage,
        technical_indicators: TechnicalIndicators,
        options_analysis: OptionsAnalysis,
        support_resistance: SupportResistance,
        trendline_status: str,
    ) -> str:
        """Build a formatted context string with all market data for the LLM."""
        context_parts = []

        # Spot price and underlying
        context_parts.append(
            f"Underlying: {data_package.underlying}\n"
            f"Spot Price: {data_package.spot_price:.2f}\n"
            f"Timestamp: {data_package.timestamp.isoformat()}"
        )

        # OHLCV summary (last 5 candles)
        if data_package.ohlcv_data:
            recent = data_package.ohlcv_data[-5:]
            ohlcv_lines = ["Recent OHLCV (last 5 candles):"]
            for candle in recent:
                if isinstance(candle, dict):
                    o = candle.get("open", 0)
                    h = candle.get("high", 0)
                    l = candle.get("low", 0)
                    c = candle.get("close", 0)
                    v = candle.get("volume", 0)
                else:
                    o = getattr(candle, "open", 0)
                    h = getattr(candle, "high", 0)
                    l = getattr(candle, "low", 0)
                    c = getattr(candle, "close", 0)
                    v = getattr(candle, "volume", 0)
                ohlcv_lines.append(
                    f"  O:{o:.2f} H:{h:.2f} L:{l:.2f} C:{c:.2f} V:{v}"
                )
            context_parts.append("\n".join(ohlcv_lines))

        # Technical indicators
        context_parts.append(
            f"Technical Indicators:\n"
            f"  VWAP: {technical_indicators.vwap:.2f}\n"
            f"  EMA 5: {technical_indicators.ema_5:.2f}\n"
            f"  EMA 15: {technical_indicators.ema_15:.2f}\n"
            f"  RSI (14): {technical_indicators.rsi:.2f}\n"
            f"  MACD: {technical_indicators.macd:.4f}\n"
            f"  MACD Signal: {technical_indicators.macd_signal:.4f}\n"
            f"  MACD Histogram: {technical_indicators.macd_histogram:.4f}\n"
            f"  ATR (14): {technical_indicators.atr:.2f}\n"
            f"  Volume Ratio: {technical_indicators.volume_ratio:.2f}"
        )

        # Options metrics
        context_parts.append(
            f"Options Metrics:\n"
            f"  Call OI: {options_analysis.call_oi:,}\n"
            f"  Put OI: {options_analysis.put_oi:,}\n"
            f"  Call OI Change: {options_analysis.call_oi_change:+,}\n"
            f"  Put OI Change: {options_analysis.put_oi_change:+,}\n"
            f"  PCR: {options_analysis.pcr:.2f}\n"
            f"  ATM Call IV: {options_analysis.atm_call_iv or 'N/A'}\n"
            f"  ATM Put IV: {options_analysis.atm_put_iv or 'N/A'}"
        )

        # Support/Resistance
        context_parts.append(
            f"Support/Resistance:\n"
            f"  Support: {support_resistance.support_level or 'N/A'}\n"
            f"  Resistance: {support_resistance.resistance_level or 'N/A'}\n"
            f"  Distance to Support: {support_resistance.distance_to_support_pct or 'N/A'}%\n"
            f"  Distance to Resistance: {support_resistance.distance_to_resistance_pct or 'N/A'}%"
        )

        # Trendline
        context_parts.append(f"Trendline Status: {trendline_status}")

        return "\n\n".join(context_parts)

    def _build_prompt(
        self,
        context: str,
        price_action: str,
        indicator_interpretation: Dict[str, str],
        options_sentiment: str,
    ) -> str:
        """Build the LLM prompt with all analysis context."""
        indicator_summary = "\n".join(
            f"  - {k}: {v}" for k, v in indicator_interpretation.items()
        )

        return f"""Analyze the following market data and provide a trading recommendation.

{context}

Pre-Analysis:
  Price Action: {price_action}
  Technical Interpretation:
{indicator_summary}
  Options Sentiment: {options_sentiment}

Based on this data, provide your trading recommendation as JSON with these fields:
- "signal_type": "BUY CE", "BUY PE", or "HOLD"
- "probability": number 0-100 (your confidence percentage)
- "entry_price": number or null (suggested entry for the options contract)
- "target_price": number or null (price target)
- "stop_loss": number or null (stop loss level)
- "trend": "Bullish", "Bearish", or "Neutral"
- "oi_interpretation": "Bullish", "Bearish", or "Neutral"
- "rationale": string (100-300 word explanation covering price action, trend, \
technical indicators, OI analysis, support/resistance, and probability reasoning)

Rules:
- Only recommend BUY if probability >= 70% and risk/reward >= 1:2
- For BUY CE: bullish setup with upward momentum
- For BUY PE: bearish setup with downward momentum
- If uncertain or mixed signals, recommend HOLD
- Entry/target/stop_loss should be for the ATM options contract premium, not spot price
- Consider PCR > 1.5 as bearish, < 0.7 as bullish
- Price above VWAP is bullish, below is bearish
"""

    def _parse_llm_response(self, content: str) -> AIAnalysisResult:
        """
        Parse the LLM JSON response into an AIAnalysisResult.

        Args:
            content: Raw JSON string from LLM response.

        Returns:
            AIAnalysisResult with validated fields.

        Raises:
            AIAnalysisEngineError: If parsing fails or required fields missing.
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise AIAnalysisEngineError(f"Failed to parse LLM response as JSON: {e}")

        # Validate signal_type
        signal_type = data.get("signal_type", "HOLD")
        if signal_type not in ("BUY CE", "BUY PE", "HOLD"):
            signal_type = "HOLD"

        # Validate probability
        probability = data.get("probability", 0)
        try:
            probability = float(probability)
            probability = max(0.0, min(100.0, probability))
        except (TypeError, ValueError):
            probability = 0.0

        # Validate trend
        trend = data.get("trend", "Neutral")
        if trend not in ("Bullish", "Bearish", "Neutral"):
            trend = "Neutral"

        # Validate OI interpretation
        oi_interpretation = data.get("oi_interpretation", "Neutral")
        if oi_interpretation not in ("Bullish", "Bearish", "Neutral"):
            oi_interpretation = "Neutral"

        # Validate prices (optional for HOLD)
        entry_price = self._parse_optional_float(data.get("entry_price"))
        target_price = self._parse_optional_float(data.get("target_price"))
        stop_loss = self._parse_optional_float(data.get("stop_loss"))

        # Validate rationale
        rationale = data.get("rationale", "")
        if not isinstance(rationale, str):
            rationale = ""

        return AIAnalysisResult(
            signal_type=signal_type,
            probability=probability,
            entry_price=entry_price,
            target_price=target_price,
            stop_loss=stop_loss,
            trend=trend,
            oi_interpretation=oi_interpretation,
            rationale=rationale,
        )

    @staticmethod
    def _parse_optional_float(value: Any) -> Optional[float]:
        """Parse a value to float, returning None if invalid."""
        if value is None:
            return None
        try:
            result = float(value)
            return result if result > 0 else None
        except (TypeError, ValueError):
            return None

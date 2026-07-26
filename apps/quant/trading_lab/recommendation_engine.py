"""
AI Trading Lab Recommendation Engine.

This module implements GPT-4-based synthesis of quantitative analysis results
into structured, human-readable trading recommendations. It applies confidence
and risk thresholds, calculates position sizing, and streams output via SSE.

Requirements: 4.1, 4.2, 4.3, 7.2, 7.3, 7.4, 3.1
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

from .exceptions import RecommendationError
from .models import (
    Recommendation,
    ResponseMode,
    SignalDirection,
)
from .response_formatter import ResponseFormatter

logger = logging.getLogger(__name__)


class RecommendationEngine:
    """
    Synthesizes quant analysis results into structured trading recommendations using GPT-4.

    Applies low-confidence threshold (probability < 60%), high-risk threshold
    (R:R < 1.5), and 2% max portfolio risk position sizing. Streams recommendation
    chunks for SSE delivery.

    Requirements: 4.1, 4.2, 4.3, 7.2, 7.3, 7.4, 3.1
    """

    LOW_CONFIDENCE_THRESHOLD: float = 60.0  # probability percentage
    HIGH_RISK_RR_THRESHOLD: float = 1.5
    MAX_RISK_PERCENT: float = 0.02  # 2% max risk per trade
    MAX_RETRIES: int = 2
    BASE_DELAY: float = 1.0
    BACKOFF_MULTIPLIER: float = 2.0
    LLM_MODEL: str = "gpt-4"

    SYSTEM_PROMPT: str = """You are an expert quantitative trading analyst for the Indian stock market (NSE/BSE).
You synthesize technical analysis data into clear, actionable trading recommendations.

Given the analysis data, produce a JSON recommendation with:
1. signal: "BUY", "SELL", or "HOLD"
2. probability: confidence percentage (0-100) based on indicator alignment
3. risk_reward_ratio: calculated from entry, stop_loss, and target
4. entry_price: suggested entry price
5. stop_loss: suggested stop loss level
6. target_price: suggested target price
7. rationale: 2-3 sentence explanation of why this signal is generated

Base your analysis strictly on the provided data. Do NOT make up prices or indicators.
If the data is insufficient for a strong signal, default to HOLD with lower probability.

Respond ONLY with a JSON object in this exact format:
{
    "signal": "BUY|SELL|HOLD",
    "probability": <float 0-100>,
    "entry_price": <float or null>,
    "stop_loss": <float or null>,
    "target_price": <float or null>,
    "rationale": "<explanation string>"
}"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        """
        Initialize the Recommendation Engine.

        Args:
            api_key: OpenAI API key. If None, reads from OPENAI_API_KEY env var.
            model: LLM model to use. Defaults to GPT-4.
        """
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._model = model or os.environ.get("AI_MODEL", "") or self.LLM_MODEL
        self._client = None
        self._formatter = ResponseFormatter()

    def _get_client(self):
        """Lazily initialize the OpenAI async client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=self._api_key)
            except ImportError:
                raise RecommendationError(
                    "openai package not installed. Install with: pip install openai"
                )
            except Exception as e:
                raise RecommendationError(
                    f"Failed to initialize OpenAI client: {e}"
                )
        return self._client

    async def generate(
        self,
        analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        mode: ResponseMode,
        intent: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        portfolio_value: float = 1000000.0,
    ) -> AsyncGenerator[str, None]:
        """
        Generate a streaming trading recommendation based on quant analysis and risk.

        Uses GPT-4 to synthesize analysis into a human-readable rationale, applies
        confidence and risk thresholds, calculates position sizing, and streams
        SSE-formatted chunks.

        Args:
            analysis: Dictionary with quant analysis results (indicators, scores, etc.)
            risk_assessment: Dictionary with risk engine evaluation results.
            mode: Response display mode (QUICK, DETAILED, TRADER, QUANT, COACH).
            intent: The detected trading intent string (optional context).
            symbols: List of symbols being analyzed (optional context).
            portfolio_value: Total portfolio value for position sizing. Defaults to 1,000,000.

        Yields:
            SSE-formatted strings as the recommendation builds.

        Requirements: 4.1, 4.2, 4.3, 7.2, 7.3, 7.4, 3.1
        """
        market_data_timestamp = self._get_market_data_timestamp(analysis)

        # Yield initial status
        yield self._format_sse("status", {"step": "ai_reasoning", "message": "Generating AI recommendation..."})

        try:
            # Call GPT-4 to synthesize the recommendation
            gpt_result = await self._call_gpt4(analysis, risk_assessment, symbols)
        except RecommendationError:
            # GPT-4 failed — generate deterministic recommendation from data
            gpt_result = self._deterministic_recommendation(analysis, risk_assessment, symbols)

        # Build the Recommendation object
        recommendation = self._build_recommendation(
            gpt_result=gpt_result,
            risk_assessment=risk_assessment,
            market_data_timestamp=market_data_timestamp,
            portfolio_value=portfolio_value,
        )

        # Format the recommendation based on mode
        formatted_response = self._formatter.format(recommendation, mode)

        # Stream the formatted response in chunks
        chunk_size = 100
        for i in range(0, len(formatted_response), chunk_size):
            chunk = formatted_response[i:i + chunk_size]
            yield self._format_sse("chunk", {"text": chunk})
            await asyncio.sleep(0.01)  # Small delay for streaming effect

        # Yield the final recommendation event
        yield self._format_sse("recommendation", {
            "signal": recommendation.signal.value,
            "probability": recommendation.probability,
            "risk_reward_ratio": recommendation.risk_reward_ratio,
            "entry_price": recommendation.entry_price,
            "stop_loss": recommendation.stop_loss,
            "target_price": recommendation.target_price,
            "position_size": recommendation.position_size,
            "rationale": recommendation.rationale,
            "is_low_confidence": recommendation.is_low_confidence,
            "is_high_risk": recommendation.is_high_risk,
            "warnings": recommendation.warnings,
            "market_data_timestamp": market_data_timestamp.isoformat(),
            "formatted_response": formatted_response,
        })

    async def _call_gpt4(
        self,
        analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        symbols: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Call GPT-4 to synthesize analysis into a recommendation.

        Retries up to MAX_RETRIES times with exponential backoff on failure.

        Args:
            analysis: Quant analysis results.
            risk_assessment: Risk evaluation results.
            symbols: Symbols being analyzed.

        Returns:
            Dictionary with signal, probability, prices, and rationale.

        Raises:
            RecommendationError: If GPT-4 fails after all retries.
        """
        user_content = self._build_user_prompt(analysis, risk_assessment, symbols)
        last_error: Optional[Exception] = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                client = self._get_client()
                response = await client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )

                content = response.choices[0].message.content
                if not content:
                    raise RecommendationError("Empty response from GPT-4")

                result = json.loads(content)
                return self._validate_gpt_result(result)

            except RecommendationError:
                raise
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Recommendation generation attempt {attempt + 1} failed: {e}"
                )
                if attempt < self.MAX_RETRIES:
                    delay = self.BASE_DELAY * (self.BACKOFF_MULTIPLIER ** attempt)
                    await asyncio.sleep(delay)

        raise RecommendationError(
            f"Recommendation generation failed after {self.MAX_RETRIES + 1} attempts: {last_error}"
        )

    def _build_user_prompt(
        self,
        analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        symbols: Optional[List[str]] = None,
    ) -> str:
        """Build the user prompt content for GPT-4."""
        parts = []

        if symbols:
            parts.append(f"Symbols: {', '.join(symbols)}")

        parts.append(f"Analysis Data:\n{json.dumps(analysis, indent=2, default=str)}")
        parts.append(f"Risk Assessment:\n{json.dumps(risk_assessment, indent=2, default=str)}")

        return "\n\n".join(parts)

    def _validate_gpt_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize GPT-4 response fields."""
        signal = result.get("signal", "HOLD").upper()
        if signal not in ("BUY", "SELL", "HOLD"):
            signal = "HOLD"

        probability = float(result.get("probability", 50.0))
        probability = max(0.0, min(100.0, probability))

        entry_price = result.get("entry_price")
        stop_loss = result.get("stop_loss")
        target_price = result.get("target_price")
        rationale = result.get("rationale", "No rationale provided.")

        # Ensure prices are valid floats or None
        entry_price = float(entry_price) if entry_price is not None else None
        stop_loss = float(stop_loss) if stop_loss is not None else None
        target_price = float(target_price) if target_price is not None else None

        return {
            "signal": signal,
            "probability": probability,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "target_price": target_price,
            "rationale": rationale,
        }

    def _build_recommendation(
        self,
        gpt_result: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        market_data_timestamp: datetime,
        portfolio_value: float,
    ) -> Recommendation:
        """
        Build a Recommendation object from GPT-4 result and risk data.

        Applies low-confidence and high-risk thresholds, calculates position sizing.

        Args:
            gpt_result: Validated GPT-4 output.
            risk_assessment: Risk engine evaluation.
            market_data_timestamp: Timestamp of market data used.
            portfolio_value: Portfolio value for position sizing.

        Returns:
            Recommendation model instance.
        """
        signal = SignalDirection(gpt_result["signal"])
        probability = gpt_result["probability"]
        entry_price = gpt_result["entry_price"]
        stop_loss = gpt_result["stop_loss"]
        target_price = gpt_result["target_price"]
        rationale = gpt_result["rationale"]

        # Calculate risk/reward ratio
        risk_reward_ratio = 0.0
        if entry_price and stop_loss and target_price:
            risk_per_share = abs(entry_price - stop_loss)
            reward_per_share = abs(target_price - entry_price)
            if risk_per_share > 0:
                risk_reward_ratio = reward_per_share / risk_per_share

        # Use risk assessment R:R if available and our calculation is zero
        if risk_reward_ratio == 0.0 and risk_assessment.get("risk_reward_ratio"):
            risk_reward_ratio = float(risk_assessment["risk_reward_ratio"])

        # Calculate position size using 2% max risk rule
        position_size = self._calculate_position_size(
            entry_price, stop_loss, portfolio_value
        )

        # Apply low-confidence threshold
        is_low_confidence = probability < self.LOW_CONFIDENCE_THRESHOLD
        warnings: List[str] = []
        if is_low_confidence:
            warnings.append(
                f"Low confidence: probability {probability:.0f}% is below "
                f"{self.LOW_CONFIDENCE_THRESHOLD:.0f}% threshold"
            )

        # Apply high-risk threshold
        is_high_risk = risk_reward_ratio < self.HIGH_RISK_RR_THRESHOLD
        if is_high_risk and risk_reward_ratio > 0:
            warnings.append(
                f"High risk: R:R ratio {risk_reward_ratio:.2f} is below "
                f"minimum threshold of {self.HIGH_RISK_RR_THRESHOLD}"
            )

        # Merge warnings from risk assessment
        if risk_assessment.get("warnings"):
            warnings.extend(risk_assessment["warnings"])

        return Recommendation(
            signal=signal,
            probability=probability,
            risk_reward_ratio=round(risk_reward_ratio, 4),
            entry_price=entry_price,
            stop_loss=stop_loss,
            target_price=target_price,
            position_size=position_size,
            rationale=rationale,
            is_low_confidence=is_low_confidence,
            is_high_risk=is_high_risk,
            warnings=warnings,
            market_data_timestamp=market_data_timestamp,
        )

    def _calculate_position_size(
        self,
        entry_price: Optional[float],
        stop_loss: Optional[float],
        portfolio_value: float,
    ) -> int:
        """
        Calculate position size for max 2% portfolio risk.

        Args:
            entry_price: Entry price.
            stop_loss: Stop loss price.
            portfolio_value: Total portfolio value.

        Returns:
            Suggested position size in shares.
        """
        if not entry_price or not stop_loss:
            return 0
        risk_per_share = abs(entry_price - stop_loss)
        if risk_per_share == 0:
            return 0
        max_risk_amount = portfolio_value * self.MAX_RISK_PERCENT
        return int(max_risk_amount / risk_per_share)

    def _get_market_data_timestamp(self, analysis: Dict[str, Any]) -> datetime:
        """
        Extract market_data_timestamp from analysis, or use current time.

        Args:
            analysis: Analysis dictionary that may contain a timestamp.

        Returns:
            datetime representing the market data timestamp.
        """
        ts = analysis.get("market_data_timestamp")
        if ts:
            if isinstance(ts, datetime):
                return ts
            if isinstance(ts, str):
                try:
                    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
        return datetime.now(timezone.utc)

    @staticmethod
    def _format_sse(event_type: str, data: Dict[str, Any]) -> str:
        """
        Format data as an SSE event string.

        Args:
            event_type: SSE event type (status, chunk, recommendation, error, done).
            data: Dictionary payload to JSON-encode.

        Returns:
            SSE-formatted string: "event: {type}\ndata: {json}\n\n"
        """
        return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"

    def _deterministic_recommendation(
        self,
        analysis: Dict[str, Any],
        risk_assessment: Dict[str, Any],
        symbols: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a deterministic recommendation based on market data without AI.

        Uses indicator values from the market data to produce a signal.
        Analyzes all available symbols and picks the strongest opportunity.
        """
        market_data = analysis.get("market_data", {})
        data = market_data.get("data", {})

        if not data:
            return {
                "signal": "HOLD",
                "probability": 0.0,
                "entry_price": None,
                "stop_loss": None,
                "target_price": None,
                "rationale": f"Insufficient market data available for analysis. No candle data found for {symbols or 'requested symbols'}.",
            }

        # Analyze each symbol and pick the best opportunity
        best_result = None
        best_score = 0

        for sym_name, sym_data in data.items():
            candles = sym_data.get("candles", [])
            if not candles or len(candles) < 20:
                continue

            result = self._analyze_single_symbol(sym_name, candles)
            if result and result.get("_score", 0) > best_score:
                best_score = result["_score"]
                best_result = result

        if best_result:
            best_result.pop("_score", None)
            return best_result

        # No good signal found
        first_sym = symbols[0] if symbols else list(data.keys())[0] if data else "unknown"
        return {
            "signal": "HOLD",
            "probability": 35.0,
            "entry_price": None,
            "stop_loss": None,
            "target_price": None,
            "rationale": f"Analyzed {len(data)} symbols but found no strong directional edge. Recommending HOLD until a clearer setup emerges.",
        }

    def _analyze_single_symbol(self, symbol_name: str, candles: List[Dict]) -> Optional[Dict[str, Any]]:
        """Analyze a single symbol's candle data and return recommendation dict with internal _score."""
        closes = [c["close"] for c in candles]
        highs = [c["high"] for c in candles]
        lows = [c["low"] for c in candles]
        current_price = closes[-1]

        # SMA20
        sma20 = sum(closes[-20:]) / 20
        # SMA50
        sma50 = sum(closes[-50:]) / 50 if len(closes) >= 50 else sma20

        # Simple RSI approximation
        gains = []
        losses = []
        for i in range(1, min(15, len(closes))):
            change = closes[-i] - closes[-i - 1]
            if change > 0:
                gains.append(change)
            else:
                losses.append(abs(change))
        avg_gain = sum(gains) / 14 if gains else 0.001
        avg_loss = sum(losses) / 14 if losses else 0.001
        rs = avg_gain / avg_loss if avg_loss > 0 else 100
        rsi = 100 - (100 / (1 + rs))

        # ATR for stop/target
        trs = []
        for i in range(1, min(15, len(candles))):
            h = highs[-i]
            l = lows[-i]
            pc = closes[-i - 1]
            tr = max(h - l, abs(h - pc), abs(l - pc))
            trs.append(tr)
        atr = sum(trs) / len(trs) if trs else current_price * 0.02

        # Scoring
        score = 50.0
        reasons = []

        if current_price > sma20:
            score += 10
            reasons.append(f"Price above SMA20")
        else:
            score -= 5
            reasons.append(f"Price below SMA20")

        if current_price > sma50:
            score += 10
            reasons.append("Above SMA50 — uptrend intact")

        if 40 <= rsi <= 60:
            score += 5
            reasons.append(f"RSI neutral ({rsi:.0f})")
        elif rsi < 35:
            score += 15
            reasons.append(f"RSI oversold ({rsi:.0f}) — bounce potential")
        elif 60 < rsi <= 75:
            score += 8
            reasons.append(f"RSI bullish momentum ({rsi:.0f})")
        elif rsi > 75:
            score -= 5
            reasons.append(f"RSI extended ({rsi:.0f}) — watch for pullback")

        # Volume check
        volumes = [c.get("volume", 0) for c in candles]
        if volumes and volumes[-1] > 0:
            avg_vol = sum(volumes[-20:]) / min(20, len(volumes))
            if volumes[-1] > avg_vol * 1.3:
                score += 5
                reasons.append("Strong volume")

        # Generate signal
        if score >= 65:
            signal = "BUY"
            probability = min(score, 85.0)
            entry = current_price
            stop_loss = current_price - (atr * 2)
            target = current_price + (atr * 3)
        elif score <= 35:
            signal = "SELL"
            probability = min(100 - score, 75.0)
            entry = current_price
            stop_loss = current_price + (atr * 2)
            target = current_price - (atr * 3)
        else:
            signal = "HOLD"
            probability = 40.0
            entry = None
            stop_loss = None
            target = None

        rationale = f"{symbol_name} @ ₹{current_price:.2f}: " + ". ".join(reasons[:3])
        if signal == "BUY":
            rationale += f". Entry ₹{entry:.2f}, SL ₹{stop_loss:.2f}, Target ₹{target:.2f}."
        elif signal == "HOLD":
            rationale += ". No clear directional edge."

        return {
            "signal": signal,
            "probability": round(probability, 1),
            "entry_price": round(entry, 2) if entry else None,
            "stop_loss": round(stop_loss, 2) if stop_loss else None,
            "target_price": round(target, 2) if target else None,
            "rationale": rationale,
            "_score": score,  # internal for comparison
        }

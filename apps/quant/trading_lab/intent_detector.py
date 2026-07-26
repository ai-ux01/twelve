"""
AI Trading Lab Intent Detector.

This module implements GPT-4 based intent classification for natural-language
trading prompts. It detects the trading intent, extracts stock symbols,
and determines confidence levels.

Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.3
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

from .exceptions import IntentDetectionError
from .models import IntentClassification, TradingIntent

logger = logging.getLogger(__name__)


class IntentDetector:
    """
    Classifies natural-language prompts into structured trading intents using GPT-4.

    Uses GPT-4 structured JSON output to reliably parse intent, symbols,
    and confidence from user prompts. Implements retry logic with exponential
    backoff for API resilience.

    Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.3
    """

    CONFIDENCE_THRESHOLD: float = 0.6
    MAX_RETRIES: int = 2
    BASE_DELAY: float = 1.0
    BACKOFF_MULTIPLIER: float = 2.0
    LLM_MODEL: str = "gpt-4"

    SYSTEM_PROMPT: str = """You are a trading intent classifier for the Indian stock market (NSE/BSE).
Classify the user's prompt into exactly one intent and extract any stock symbols mentioned.

Available intents:
1. SWING_STOCK - User wants swing trade analysis (holding period: days to weeks). Examples: "Should I buy RELIANCE for swing?", "Give me a swing trade setup for TCS", "What's the best swing entry for INFY?"
2. INTRADAY_STOCK - User wants intraday/day trade analysis. Examples: "Intraday levels for HDFC Bank", "Day trade setup for SBIN", "Scalp trade ideas for today"
3. OPTIONS_SCALPING - User wants options trading analysis (calls, puts, premiums). Examples: "Should I buy NIFTY 20000 CE?", "BANKNIFTY puts for tomorrow", "Options strategy for RELIANCE"
4. TRADE_ANALYSIS - User wants technical analysis of a specific trade/stock. Examples: "Analyze RELIANCE chart", "Technical view on TCS", "What do indicators say about INFY?"
5. PORTFOLIO_ANALYSIS - User wants portfolio/position review. Examples: "How are my paper trades?", "Show my portfolio", "Review my open positions"
6. MARKET_ANALYSIS - User wants overall market view/direction. Examples: "How's the market looking?", "NIFTY direction for today", "Market sentiment analysis"
7. STRATEGY_ANALYSIS - User wants strategy comparison or optimization. Examples: "Best strategy for volatile markets", "Compare momentum vs mean reversion", "Which strategy works for BANKNIFTY?"
8. PAPER_TRADE - User wants to execute a paper trade. Examples: "Buy 100 shares of RELIANCE on paper", "Paper trade INFY at current price", "Execute paper buy for TCS"

Stock symbols to look for: NSE listed stocks (e.g., RELIANCE, TCS, INFY, HDFC, SBIN, ICICIBANK, HDFCBANK, WIPRO, ITC, BAJFINANCE) and indices (NIFTY, BANKNIFTY, NIFTY50, FINNIFTY).

Respond ONLY with a JSON object in this exact format:
{
    "intent": "<one of the 8 intent values>",
    "symbols": ["<extracted symbols in uppercase>"],
    "confidence": <float between 0.0 and 1.0>
}

Rules:
- Always return exactly one intent
- confidence should reflect how certain you are about the classification
- Extract ALL stock symbols/indices mentioned in the prompt
- If no symbols are mentioned, return an empty list
- If the prompt is ambiguous or unclear, use a low confidence score (below 0.6)"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        """
        Initialize the Intent Detector.

        Args:
            api_key: OpenAI API key. If None, reads from OPENAI_API_KEY env var.
            model: LLM model to use. Defaults to GPT-4.
        """
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._model = model or os.environ.get("AI_MODEL", "") or self.LLM_MODEL
        self._client = None

    def _get_client(self):
        """Lazily initialize the OpenAI async client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=self._api_key)
            except ImportError:
                raise IntentDetectionError(
                    "openai package not installed. Install with: pip install openai"
                )
            except Exception as e:
                raise IntentDetectionError(
                    f"Failed to initialize OpenAI client: {e}"
                )
        return self._client

    async def classify(self, prompt: str) -> IntentClassification:
        """
        Classify a user prompt into a structured trading intent.

        Uses GPT-4 when available, otherwise falls back to rule-based classification.
        Returns needs_clarification=True when confidence is below threshold.

        Args:
            prompt: The natural-language trading prompt from the user.

        Returns:
            IntentClassification with intent, symbols, confidence, and
            needs_clarification flag.

        Raises:
            IntentDetectionError: If classification fails after all retries.
        """
        if not prompt or not prompt.strip():
            raise IntentDetectionError("Prompt cannot be empty")

        # Try GPT-4 first if API key is available
        if self._api_key:
            try:
                return await self._classify_with_llm(prompt)
            except IntentDetectionError as e:
                logger.warning(f"LLM classification failed, using rule-based fallback: {e}")

        # Fallback to rule-based classification
        return self._classify_rule_based(prompt)

    async def _classify_with_llm(self, prompt: str) -> IntentClassification:
        """Classify using GPT-4 with retry logic."""
        last_error: Optional[Exception] = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                client = self._get_client()
                response = await client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )

                content = response.choices[0].message.content
                if not content:
                    raise IntentDetectionError("Empty response from GPT-4")

                result = json.loads(content)
                return self._parse_result(result)

            except IntentDetectionError:
                raise
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Intent detection attempt {attempt + 1} failed: {e}"
                )
                if attempt < self.MAX_RETRIES:
                    delay = self.BASE_DELAY * (
                        self.BACKOFF_MULTIPLIER ** attempt
                    )
                    await asyncio.sleep(delay)

        raise IntentDetectionError(
            f"Intent detection failed after {self.MAX_RETRIES + 1} attempts: {last_error}"
        )

    def _classify_rule_based(self, prompt: str) -> IntentClassification:
        """
        Rule-based intent classification using keyword matching.

        Provides a deterministic fallback when GPT-4 is unavailable.
        """
        import re

        prompt_lower = prompt.lower()

        # Extract symbols (uppercase words that look like stock tickers)
        # Match words that are 2-15 chars, all uppercase, possibly with numbers
        raw_symbols = re.findall(r'\b([A-Z][A-Z0-9]{1,14})\b', prompt)
        # Known indices and common stocks
        known_symbols = {
            "NIFTY", "BANKNIFTY", "NIFTY50", "FINNIFTY",
            "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK",
            "SBIN", "HINDUNILVR", "ITC", "BHARTIARTL", "KOTAKBANK",
            "LT", "AXISBANK", "ASIANPAINT", "MARUTI", "TITAN",
            "SUNPHARMA", "BAJFINANCE", "WIPRO", "HCLTECH", "ULTRACEMCO",
            "TATAMOTORS", "TATASTEEL", "POWERGRID", "NTPC", "ONGC",
            "COALINDIA", "ADANIENT", "ADANIPORTS", "TECHM", "NESTLEIND",
            "HDFC", "BAJAJ",
        }
        symbols = [s for s in raw_symbols if s in known_symbols]

        # Intent classification by keywords
        intent = TradingIntent.MARKET_ANALYSIS
        confidence = 0.7

        # Options keywords
        options_keywords = ["option", "ce", "pe", "call", "put", "premium", "strike", "expiry", "scalp nifty", "scalp banknifty"]
        if any(kw in prompt_lower for kw in options_keywords):
            intent = TradingIntent.OPTIONS_SCALPING
            confidence = 0.85
        # Swing keywords
        elif any(kw in prompt_lower for kw in ["swing", "swing trade", "positional", "hold for", "few days", "weekly"]):
            intent = TradingIntent.SWING_STOCK
            confidence = 0.85
        # Intraday keywords
        elif any(kw in prompt_lower for kw in ["intraday", "day trade", "daytrade", "scalp", "today's trade"]):
            intent = TradingIntent.INTRADAY_STOCK
            confidence = 0.85
        # Paper trade keywords
        elif any(kw in prompt_lower for kw in ["paper trade", "paper buy", "buy on paper", "execute paper"]):
            intent = TradingIntent.PAPER_TRADE
            confidence = 0.85
        # Portfolio keywords
        elif any(kw in prompt_lower for kw in ["portfolio", "my trades", "my positions", "open positions", "holdings"]):
            intent = TradingIntent.PORTFOLIO_ANALYSIS
            confidence = 0.80
        # Trade analysis keywords
        elif any(kw in prompt_lower for kw in ["analyze", "analysis", "technical", "chart", "indicator"]):
            if symbols:
                intent = TradingIntent.TRADE_ANALYSIS
                confidence = 0.80
            else:
                intent = TradingIntent.MARKET_ANALYSIS
                confidence = 0.70
        # Strategy keywords
        elif any(kw in prompt_lower for kw in ["strategy", "backtest", "compare strategies"]):
            intent = TradingIntent.STRATEGY_ANALYSIS
            confidence = 0.80
        # Market keywords
        elif any(kw in prompt_lower for kw in ["market", "nifty direction", "sentiment", "outlook"]):
            intent = TradingIntent.MARKET_ANALYSIS
            confidence = 0.75
        # Default: if symbols are mentioned, treat as swing
        elif symbols:
            intent = TradingIntent.SWING_STOCK
            confidence = 0.65

        # If "best" + "trade" → swing
        if "best" in prompt_lower and "trade" in prompt_lower:
            if intent == TradingIntent.MARKET_ANALYSIS:
                intent = TradingIntent.SWING_STOCK
                confidence = 0.75

        # Set default symbols for options if none specified
        if intent == TradingIntent.OPTIONS_SCALPING and not symbols:
            symbols = ["NIFTY", "BANKNIFTY"]

        needs_clarification = confidence < self.CONFIDENCE_THRESHOLD

        return IntentClassification(
            intent=intent,
            symbols=symbols,
            confidence=confidence,
            needs_clarification=needs_clarification,
        )

    def _parse_result(self, result: dict) -> IntentClassification:
        """
        Parse GPT-4 JSON response into IntentClassification.

        Args:
            result: Parsed JSON dictionary from GPT-4 response.

        Returns:
            IntentClassification with validated fields.

        Raises:
            IntentDetectionError: If the response structure is invalid.
        """
        try:
            intent_str = result.get("intent", "")
            symbols = result.get("symbols", [])
            confidence = float(result.get("confidence", 0.0))

            # Validate intent
            try:
                intent = TradingIntent(intent_str)
            except ValueError:
                raise IntentDetectionError(
                    f"Invalid intent value from GPT-4: {intent_str}"
                )

            # Validate confidence range
            confidence = max(0.0, min(1.0, confidence))

            # Normalize symbols to uppercase
            symbols = [s.upper().strip() for s in symbols if s and s.strip()]

            # Determine if clarification is needed
            needs_clarification = confidence < self.CONFIDENCE_THRESHOLD

            return IntentClassification(
                intent=intent,
                symbols=symbols,
                confidence=confidence,
                needs_clarification=needs_clarification,
            )

        except IntentDetectionError:
            raise
        except Exception as e:
            raise IntentDetectionError(
                f"Failed to parse GPT-4 classification response: {e}"
            )

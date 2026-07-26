"""
AI Trading Lab Custom Exceptions.

This module defines custom exception classes for the AI Trading Lab module,
covering errors in intent detection, quant engine communication,
recommendation generation, data freshness, and paper trading.

Requirements: 8.1, 8.2, 8.3, 8.4
"""


class TradingLabError(Exception):
    """Base exception for all AI Trading Lab errors."""

    def __init__(self, message: str = "An error occurred in the AI Trading Lab"):
        self.message = message
        super().__init__(self.message)


class IntentDetectionError(TradingLabError):
    """
    Raised when the Intent Detector fails to classify a user prompt.

    This may occur due to GPT-4 API failures, malformed responses,
    or unexpected classification results.

    Requirement: 8.1
    """

    def __init__(self, message: str = "Failed to detect trading intent from prompt"):
        super().__init__(message)


class QuantEngineError(TradingLabError):
    """
    Raised when the Quant Engine is unreachable or returns an error.

    This covers failures in fetching market data, running technical analysis,
    or communicating with existing quant services.

    Requirement: 8.2
    """

    def __init__(self, message: str = "Quant Engine service is unavailable"):
        super().__init__(message)


class RecommendationError(TradingLabError):
    """
    Raised when the Recommendation Engine fails to generate a recommendation.

    This may occur due to GPT-4 API failures during synthesis,
    incomplete analysis data, or malformed outputs.

    Requirement: 8.3
    """

    def __init__(self, message: str = "Failed to generate trading recommendation"):
        super().__init__(message)


class StaleDataError(TradingLabError):
    """
    Raised when market data is stale and cannot be refreshed.

    During market hours, if data is older than 5 minutes and a re-fetch
    fails, this error prevents generating recommendations from outdated data.

    Requirement: 3.2, 3.3
    """

    def __init__(self, message: str = "Market data is stale and cannot be refreshed"):
        super().__init__(message)


class PaperTradeError(TradingLabError):
    """
    Raised when a paper trade execution fails.

    This covers failures when communicating with the NestJS paper trading
    service or when the trade request is rejected.

    Requirement: 8.4
    """

    def __init__(self, message: str = "Paper trade execution failed"):
        super().__init__(message)

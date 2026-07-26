"""
Paper Trading Custom Exceptions.
"""


class PaperTradingError(Exception):
    """Base exception for paper trading module."""

    pass


class TradeNotFoundError(PaperTradingError):
    """Raised when a trade is not found."""

    def __init__(self, trade_id: str):
        self.trade_id = trade_id
        super().__init__(f"Paper trade {trade_id} not found")


class MarketDataUnavailableError(PaperTradingError):
    """Raised when market data cannot be fetched for a symbol."""

    def __init__(self, symbol: str):
        self.symbol = symbol
        super().__init__(f"Market data unavailable for {symbol}")


class APIConnectionError(PaperTradingError):
    """Raised when the NestJS API is unreachable."""

    def __init__(self, url: str, message: str = ""):
        self.url = url
        super().__init__(f"API connection error for {url}: {message}")

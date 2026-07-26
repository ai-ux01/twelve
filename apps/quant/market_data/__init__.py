"""
Market Data Module.

Provides market data from MongoDB (candles collection from bot-ai database).
This replaces the Kite Connect API dependency for local development.
"""

from .mongo_provider import MongoMarketDataProvider

__all__ = ["MongoMarketDataProvider"]

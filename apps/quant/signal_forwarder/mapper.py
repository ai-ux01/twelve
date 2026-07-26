"""
Signal Mapper Module.

Pure functions that convert analysis results from signal sources into
CreatePaperTradeDto payloads for the Paper Trading API.

Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 3.6, 6.6
"""

from __future__ import annotations

from typing import Dict, Any, Optional

from scalper.models import ScalperAnalysisResult, ScalperSignalType


class SignalMapper:
    """Maps analysis results to Paper Trading API payloads."""

    @staticmethod
    def _build_options_symbol(underlying: str, expiry_date, strike_price: float, option_type: str) -> str:
        """
        Construct the options symbol from components.

        Format: {underlying}{YY}{MON}{strike}{optionType}
        Example: NIFTY24DEC21500CE

        Args:
            underlying: Underlying index (e.g., "NIFTY", "BANKNIFTY")
            expiry_date: Expiry date (date object)
            strike_price: Strike price (e.g., 21500.0)
            option_type: Option type ("CE" or "PE")

        Returns:
            Constructed symbol string.
        """
        year_suffix = str(expiry_date.year)[-2:]
        month_abbr = expiry_date.strftime("%b").upper()
        strike_int = int(strike_price)
        return f"{underlying}{year_suffix}{month_abbr}{strike_int}{option_type}"

    @staticmethod
    def map_scalper_signal(result: ScalperAnalysisResult, user_id: str) -> Dict[str, Any]:
        """
        Map Options Scalper analysis result to CreatePaperTradeDto payload.

        The scalper result is mapped with:
        - direction: LONG (for both BUY CE and BUY PE)
        - tradeType: OPTIONS_SCALPING
        - optionType: CE for BUY CE, PE for BUY PE
        - quantity: lot_size from the result
        - All price fields mapped directly
        - probability and riskRewardRatio included
        - agentId: "options_scalper"
        - indicators dict with spot_price, trend, rsi, pcr

        Args:
            result: ScalperAnalysisResult from the Options Scalper analysis.
            user_id: User ID for the paper trade.

        Returns:
            Dict payload matching CreatePaperTradeDto schema.

        Raises:
            ValueError: If signal_type is HOLD (not a tradeable signal).
        """
        if result.signal_type == ScalperSignalType.HOLD:
            raise ValueError("Cannot map HOLD signal to a paper trade")

        # Determine option type from signal_type
        option_type = "CE" if result.signal_type == ScalperSignalType.BUY_CE else "PE"

        # Build the options symbol
        symbol = SignalMapper._build_options_symbol(
            underlying=result.underlying,
            expiry_date=result.expiry_date,
            strike_price=result.strike_price,
            option_type=option_type,
        )

        # Build indicators dict from analysis context
        indicators = {
            "spot_price": result.spot_price,
            "trend": result.trend.value,
            "rsi": result.rsi,
            "pcr": result.pcr,
        }

        return {
            "userId": user_id,
            "symbol": symbol,
            "direction": "LONG",
            "tradeType": "OPTIONS_SCALPING",
            "entryPrice": result.entry_price,
            "stopLoss": result.stop_loss,
            "target": result.target_price,
            "quantity": result.lot_size,
            "agentId": "options_scalper",
            "probability": result.probability,
            "riskRewardRatio": result.risk_reward_ratio,
            "strikePrice": result.strike_price,
            "optionType": option_type,
            "expiryDate": str(result.expiry_date),
            "underlying": result.underlying,
            "indicators": indicators,
        }

    @staticmethod
    def _derive_swing_direction(candidate: Dict[str, Any]) -> str:
        """
        Derive trade direction from a swing candidate's trend/direction indicator.

        Checks for 'direction' field first, then 'trend' field.
        Bullish indicators map to LONG, bearish to SHORT.

        Args:
            candidate: Swing candidate dict with trend/direction info.

        Returns:
            "LONG" or "SHORT".
        """
        # Check 'direction' field first
        direction_value = candidate.get("direction", "").lower()
        if direction_value:
            if direction_value in ("long", "bullish", "buy"):
                return "LONG"
            if direction_value in ("short", "bearish", "sell"):
                return "SHORT"

        # Fall back to 'trend' field
        trend_value = candidate.get("trend", "").lower()
        if trend_value in ("bullish", "up", "uptrend", "long"):
            return "LONG"
        if trend_value in ("bearish", "down", "downtrend", "short"):
            return "SHORT"

        # Default to LONG if no clear indicator
        return "LONG"

    @staticmethod
    def map_swing_signal(candidate: Dict[str, Any], user_id: str, quantity: int) -> Dict[str, Any]:
        """
        Map Swing Scanner candidate to CreatePaperTradeDto payload.

        The swing candidate is mapped with:
        - tradeType: SWING
        - direction: derived from analysis trend (LONG for bullish, SHORT for bearish)
        - quantity: from config (default_swing_quantity)
        - probability: total_score from the candidate
        - entry/stop_loss/target: from the candidate's analysis
        - agentId: "swing_scanner"
        - indicators: total_score plus any available indicator scores

        Args:
            candidate: Dict with swing scan result fields including:
                - symbol: Trading symbol
                - total_score (or score): Overall score for the candidate
                - entry_price (or current_price): Entry price
                - stop_loss: Stop loss level
                - target: Target price
                - trend (or direction): Bullish/bearish indicator
            user_id: User ID for the paper trade.
            quantity: Trade quantity from config (default_swing_quantity).

        Returns:
            Dict payload matching CreatePaperTradeDto schema.

        Raises:
            ValueError: If candidate is missing required price fields.
        """
        symbol = candidate.get("symbol", "")

        # Get total score - try 'total_score' first, then 'score'
        total_score = candidate.get("total_score", candidate.get("score", 0.0))

        # Get entry price - try 'entry_price' first, then 'current_price'
        entry_price = candidate.get("entry_price", candidate.get("current_price"))
        if entry_price is None:
            raise ValueError(f"Swing candidate for {symbol} missing entry_price/current_price")

        stop_loss = candidate.get("stop_loss")
        if stop_loss is None:
            raise ValueError(f"Swing candidate for {symbol} missing stop_loss")

        target = candidate.get("target")
        if target is None:
            raise ValueError(f"Swing candidate for {symbol} missing target")

        # Derive direction from trend/direction indicator
        direction = SignalMapper._derive_swing_direction(candidate)

        # Build indicators from available data
        indicators: Dict[str, Any] = {
            "total_score": total_score,
        }
        # Include additional indicator fields if present
        if "rsi" in candidate:
            indicators["rsi"] = candidate["rsi"]
        if "adx" in candidate:
            indicators["adx"] = candidate["adx"]

        return {
            "userId": user_id,
            "symbol": symbol,
            "direction": direction,
            "tradeType": "SWING",
            "entryPrice": entry_price,
            "stopLoss": stop_loss,
            "target": target,
            "quantity": quantity,
            "agentId": "swing_scanner",
            "probability": total_score,
            "indicators": indicators,
        }

    @staticmethod
    def map_intraday_signal(
        result: Dict[str, Any],
        symbol: str,
        current_price: float,
        stop_loss: float,
        target: float,
        user_id: str,
        quantity: int,
        direction: str = "LONG",
    ) -> Dict[str, Any]:
        """
        Map Intraday Scorer result to CreatePaperTradeDto payload.

        The intraday result is mapped with:
        - tradeType: INTRADAY
        - direction: from EMA alignment (passed as parameter by caller)
        - quantity: from config (default_intraday_quantity)
        - probability: total_score
        - indicators: trend_score, momentum_score, volume_score, vwap_score
        - agentId: "intraday_scorer"

        Args:
            result: Dict with intraday scoring result fields including:
                - total_score: Overall score
                - strength: STRONG/MODERATE/WEAK
                - trend_score: Trend component score
                - momentum_score: Momentum component score
                - volume_score: Volume component score
                - vwap_score: VWAP component score
            symbol: Trading symbol.
            current_price: Current market price (used as entry price).
            stop_loss: Stop loss level.
            target: Target price.
            user_id: User ID for the paper trade.
            quantity: Trade quantity from config (default_intraday_quantity).
            direction: Trade direction ("LONG" or "SHORT"), determined by
                caller from EMA alignment.

        Returns:
            Dict payload matching CreatePaperTradeDto schema.
        """
        total_score = result.get("total_score", 0.0)

        # Build indicators from score components
        indicators = {
            "trend_score": result.get("trend_score", 0.0),
            "momentum_score": result.get("momentum_score", 0.0),
            "volume_score": result.get("volume_score", 0.0),
            "vwap_score": result.get("vwap_score", 0.0),
        }

        return {
            "userId": user_id,
            "symbol": symbol,
            "direction": direction,
            "tradeType": "INTRADAY",
            "entryPrice": current_price,
            "stopLoss": stop_loss,
            "target": target,
            "quantity": quantity,
            "agentId": "intraday_scorer",
            "probability": total_score,
            "indicators": indicators,
        }

"""
Trade Mapper — Pure transformation functions for converting source-specific
trade data into the unified TradeRecord format.

No I/O is performed in this module. All functions are deterministic given the same input.

Requirements: 1.2, 1.3, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 6.1, 6.3
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List

from trade_analysis.models import TradeDirection, TradeRecord

from .models import MatchResult


class MappingError(Exception):
    """Raised when a trade cannot be mapped due to missing or invalid fields."""

    pass


class TradeMapper:
    """Converts source-specific trade data into TradeRecord format."""

    def map_paper_trade(self, paper_trade: dict) -> TradeRecord:
        """Map a closed paper trade from the NestJS API to a TradeRecord.

        Expected paper_trade fields:
            - id: str
            - symbol: str
            - direction: "LONG" | "SHORT"
            - entryPrice: float
            - exitPrice: float
            - quantity: int
            - realizedPnL: float
            - enteredAt: ISO datetime string
            - exitedAt: ISO datetime string
            - tradeType: str (e.g. "SWING", "OPTIONS_SCALPING")

        Returns:
            TradeRecord with strategy="paper_trade", setup=tradeType
        """
        try:
            symbol = paper_trade["symbol"]
            direction_str = paper_trade["direction"]
            entry_price = float(paper_trade["entryPrice"])
            exit_price = float(paper_trade["exitPrice"])
            quantity = int(paper_trade["quantity"])
            realized_pnl = float(paper_trade["realizedPnL"])
            entered_at = self._parse_datetime(paper_trade["enteredAt"])
            exited_at = self._parse_datetime(paper_trade["exitedAt"])
            trade_type = paper_trade.get("tradeType", "")
        except (KeyError, TypeError) as e:
            raise MappingError(
                f"Missing required field in paper trade: {e}"
            ) from e
        except (ValueError,) as e:
            raise MappingError(
                f"Invalid field value in paper trade: {e}"
            ) from e

        direction = self._parse_direction(direction_str)
        holding_period_days = (exited_at - entered_at).days

        return TradeRecord(
            id=str(uuid.uuid4()),
            user_id="",  # Set by the service layer
            symbol=symbol,
            direction=direction,
            entry_date=entered_at,
            exit_date=exited_at,
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=quantity,
            realized_pnl=realized_pnl,
            holding_period_days=holding_period_days,
            strategy="paper_trade",
            setup=trade_type,
            created_at=entered_at,
        )

    def map_live_stock_trade(
        self, buy_order: dict, sell_order: dict
    ) -> TradeRecord:
        """Map a paired BUY/SELL stock order pair to a TradeRecord.

        The entry order is the one that opens the position:
        - If BUY timestamp < SELL timestamp → LONG (BUY is entry, SELL is exit)
        - If SELL timestamp < BUY timestamp → SHORT (SELL is entry, BUY is exit)

        Expected order fields (Kotak API format):
            - trdSym: str (trading symbol)
            - trnsTp: "B" | "S" (transaction type)
            - qty or flQty: int (quantity)
            - prc: float (executed price)
            - flDtTm: str (fill datetime)
            - ordSt: str (order status)
            - nOrdNo: str (order number)

        Returns:
            TradeRecord with strategy="live_stock"
        """
        try:
            buy_price = float(buy_order["prc"])
            sell_price = float(sell_order["prc"])
            buy_time = self._parse_datetime(buy_order["flDtTm"])
            sell_time = self._parse_datetime(sell_order["flDtTm"])
            symbol = buy_order.get("trdSym", sell_order.get("trdSym", ""))
            quantity = int(
                buy_order.get("flQty", buy_order.get("qty", 0))
            )
        except (KeyError, TypeError) as e:
            raise MappingError(
                f"Missing required field in stock order: {e}"
            ) from e
        except (ValueError,) as e:
            raise MappingError(
                f"Invalid field value in stock order: {e}"
            ) from e

        if not symbol:
            raise MappingError("Missing symbol in stock orders")
        if quantity <= 0:
            raise MappingError("Invalid quantity in stock orders")

        # Determine direction based on order sequence
        if buy_time <= sell_time:
            # BUY first → LONG position
            direction = TradeDirection.LONG
            entry_price = buy_price
            exit_price = sell_price
            entry_date = buy_time
            exit_date = sell_time
        else:
            # SELL first → SHORT position
            direction = TradeDirection.SHORT
            entry_price = sell_price
            exit_price = buy_price
            entry_date = sell_time
            exit_date = buy_time

        # P&L: (exit - entry) × qty × direction_sign
        dir_sign = 1 if direction == TradeDirection.LONG else -1
        realized_pnl = (exit_price - entry_price) * quantity * dir_sign
        holding_period_days = (exit_date - entry_date).days

        return TradeRecord(
            id=str(uuid.uuid4()),
            user_id="",  # Set by the service layer
            symbol=symbol,
            direction=direction,
            entry_date=entry_date,
            exit_date=exit_date,
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=quantity,
            realized_pnl=realized_pnl,
            holding_period_days=holding_period_days,
            strategy="live_stock",
            created_at=entry_date,
        )

    def map_live_options_trade(
        self, buy_order: dict, sell_order: dict
    ) -> TradeRecord:
        """Map a paired BUY/SELL options order pair to a TradeRecord.

        Direction is inferred from order sequence (same as stock).
        P&L = (exit_premium - entry_premium) × quantity × lot_size × dir_sign

        Expected order fields (Kotak API format):
            - trdSym: str (full contract symbol, e.g. "NIFTY24JAN20000CE")
            - trnsTp: "B" | "S"
            - qty or flQty: int
            - prc: float (premium price)
            - flDtTm: str (fill datetime)
            - lot_size: int (defaults to 1 if not present)
            - option_type: "CE" | "PE" (or inferred from symbol suffix)
            - strike: float (or inferred from symbol)
            - expiry: str (or inferred from symbol)

        Returns:
            TradeRecord with strategy="live_options", setup="{option_type} {strike} {expiry}"
        """
        try:
            buy_price = float(buy_order["prc"])
            sell_price = float(sell_order["prc"])
            buy_time = self._parse_datetime(buy_order["flDtTm"])
            sell_time = self._parse_datetime(sell_order["flDtTm"])
            symbol = buy_order.get("trdSym", sell_order.get("trdSym", ""))
            quantity = int(
                buy_order.get("flQty", buy_order.get("qty", 0))
            )
            lot_size = int(
                buy_order.get("lot_size", sell_order.get("lot_size", 1))
            )
        except (KeyError, TypeError) as e:
            raise MappingError(
                f"Missing required field in options order: {e}"
            ) from e
        except (ValueError,) as e:
            raise MappingError(
                f"Invalid field value in options order: {e}"
            ) from e

        if not symbol:
            raise MappingError("Missing symbol in options orders")
        if quantity <= 0:
            raise MappingError("Invalid quantity in options orders")

        # Extract option details from order or infer from symbol
        option_type = buy_order.get(
            "option_type", sell_order.get("option_type", "")
        )
        strike = buy_order.get("strike", sell_order.get("strike", ""))
        expiry = buy_order.get("expiry", sell_order.get("expiry", ""))

        # Infer option_type from symbol suffix if not explicitly set
        if not option_type:
            option_type = self._infer_option_type(symbol)

        # Build setup string
        setup = f"{option_type} {strike} {expiry}".strip()

        # Determine direction based on order sequence
        if buy_time <= sell_time:
            direction = TradeDirection.LONG
            entry_price = buy_price
            exit_price = sell_price
            entry_date = buy_time
            exit_date = sell_time
        else:
            direction = TradeDirection.SHORT
            entry_price = sell_price
            exit_price = buy_price
            entry_date = sell_time
            exit_date = buy_time

        # P&L: (exit_premium - entry_premium) × qty × lot_size × dir_sign
        dir_sign = 1 if direction == TradeDirection.LONG else -1
        realized_pnl = (
            (exit_price - entry_price) * quantity * lot_size * dir_sign
        )
        holding_period_days = (exit_date - entry_date).days

        return TradeRecord(
            id=str(uuid.uuid4()),
            user_id="",  # Set by the service layer
            symbol=symbol,
            direction=direction,
            entry_date=entry_date,
            exit_date=exit_date,
            entry_price=entry_price,
            exit_price=exit_price,
            quantity=quantity,
            realized_pnl=realized_pnl,
            holding_period_days=holding_period_days,
            strategy="live_options",
            setup=setup,
            created_at=entry_date,
        )

    def match_orders(
        self, orders: List[dict], instrument_type: str
    ) -> MatchResult:
        """Pair BUY/SELL orders into matched trade pairs.

        For equity (instrument_type="equity"):
            Orders are matched by symbol (trdSym).

        For options (instrument_type="options"):
            Orders are matched by full contract: symbol + strike + expiry + option_type.

        Args:
            orders: List of order dicts from Kotak API
            instrument_type: "equity" or "options"

        Returns:
            MatchResult with matched_pairs (buy, sell) tuples and unmatched_orders
        """
        buy_orders: dict[str, List[dict]] = {}
        sell_orders: dict[str, List[dict]] = {}

        for order in orders:
            key = self._get_match_key(order, instrument_type)
            txn_type = order.get("trnsTp", "")

            if txn_type == "B":
                buy_orders.setdefault(key, []).append(order)
            elif txn_type == "S":
                sell_orders.setdefault(key, []).append(order)

        matched_pairs: List[tuple] = []
        unmatched: List[dict] = []

        # Match buys with sells by key
        all_keys = set(list(buy_orders.keys()) + list(sell_orders.keys()))

        for key in all_keys:
            buys = buy_orders.get(key, [])
            sells = sell_orders.get(key, [])

            # Sort by timestamp for FIFO matching
            buys.sort(key=lambda o: o.get("flDtTm", ""))
            sells.sort(key=lambda o: o.get("flDtTm", ""))

            # Pair up in order
            pairs_count = min(len(buys), len(sells))
            for i in range(pairs_count):
                matched_pairs.append((buys[i], sells[i]))

            # Remaining unmatched
            if len(buys) > pairs_count:
                unmatched.extend(buys[pairs_count:])
            if len(sells) > pairs_count:
                unmatched.extend(sells[pairs_count:])

        return MatchResult(
            matched_pairs=matched_pairs,
            unmatched_orders=unmatched,
        )

    def filter_equity_orders(self, orders: List[dict]) -> List[dict]:
        """Filter orders to only completed equity orders.

        An equity order has:
            - ordSt (status) = "complete"
            - exSeg (exchange segment) = "nse_cm" OR instrument_type = "equity"

        Returns:
            List of completed equity orders
        """
        result = []
        for order in orders:
            status = str(order.get("ordSt", "")).lower()
            if status != "complete":
                continue

            # Check exchange segment or instrument type for equity
            ex_seg = str(order.get("exSeg", "")).lower()
            instrument = str(order.get("instrument_type", "")).lower()

            if ex_seg == "nse_cm" or instrument == "equity":
                result.append(order)

        return result

    def filter_options_orders(self, orders: List[dict]) -> List[dict]:
        """Filter orders to only completed options/futures orders.

        An options order has:
            - ordSt (status) = "complete"
            - instrument_type contains "OPT" or "FUT"
              OR exSeg contains "nse_fo" or "bse_fo"

        Returns:
            List of completed options/futures orders
        """
        result = []
        for order in orders:
            status = str(order.get("ordSt", "")).lower()
            if status != "complete":
                continue

            instrument = str(order.get("instrument_type", "")).upper()
            ex_seg = str(order.get("exSeg", "")).lower()

            if (
                "OPT" in instrument
                or "FUT" in instrument
                or "nse_fo" in ex_seg
                or "bse_fo" in ex_seg
            ):
                result.append(order)

        return result

    # --- Private helpers ---

    def _parse_direction(self, direction_str: str) -> TradeDirection:
        """Parse direction string to TradeDirection enum."""
        upper = direction_str.upper()
        if upper == "LONG":
            return TradeDirection.LONG
        elif upper == "SHORT":
            return TradeDirection.SHORT
        else:
            raise MappingError(f"Invalid direction: {direction_str}")

    def _parse_datetime(self, dt_str: str) -> datetime:
        """Parse an ISO-format datetime string."""
        if not dt_str:
            raise MappingError("Empty datetime string")
        try:
            # Handle ISO format with or without timezone
            if dt_str.endswith("Z"):
                dt_str = dt_str[:-1] + "+00:00"
            return datetime.fromisoformat(dt_str)
        except (ValueError, TypeError) as e:
            raise MappingError(f"Cannot parse datetime '{dt_str}': {e}") from e

    def _get_match_key(self, order: dict, instrument_type: str) -> str:
        """Generate a grouping key for order matching.

        Equity: matched by symbol only.
        Options: matched by symbol + strike + expiry + option_type.
        """
        symbol = order.get("trdSym", "")

        if instrument_type == "equity":
            return symbol

        # Options: full contract key
        option_type = order.get("option_type", "")
        if not option_type:
            option_type = self._infer_option_type(symbol)

        strike = str(order.get("strike", ""))
        expiry = str(order.get("expiry", ""))

        return f"{symbol}|{strike}|{expiry}|{option_type}"

    def _infer_option_type(self, symbol: str) -> str:
        """Infer option type (CE/PE) from the symbol suffix."""
        upper = symbol.upper()
        if upper.endswith("CE"):
            return "CE"
        elif upper.endswith("PE"):
            return "PE"
        return ""

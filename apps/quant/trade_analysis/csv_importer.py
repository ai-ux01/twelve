"""
Trade Analysis Engine CSV Importer and Trade Matcher.

Parses CSV files into trade actions and matches BUY/SELL pairs into
complete TradeRecords using FIFO matching.

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
"""

from __future__ import annotations

import csv
import io
import logging
import re
from collections import defaultdict
from datetime import datetime
from typing import List
from uuid import uuid4

from .exceptions import CSVParseError
from .models import (
    CSVParseResult,
    CSVRowError,
    TradeAction,
    TradeDirection,
    TradeMatchResult,
    TradeRecord,
    UnmatchedEntry,
)

logger = logging.getLogger(__name__)


class CSVImporter:
    """
    Parses CSV files and matches BUY/SELL pairs into TradeRecords.

    Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
    """

    REQUIRED_COLUMNS = {"date", "symbol", "action", "quantity", "price"}
    OPTIONAL_COLUMNS = {"strategy", "setup", "sector"}

    def parse_csv(self, file_content: str) -> CSVParseResult:
        """
        Parse CSV content into raw trade actions.

        Supports date formats: ISO 8601, DD/MM/YYYY, MM/DD/YYYY.
        Returns parsed rows and per-row validation errors.

        Args:
            file_content: Raw CSV file content as string.

        Returns:
            CSVParseResult with trade_actions and errors.
        """
        trade_actions: List[TradeAction] = []
        errors: List[CSVRowError] = []

        try:
            reader = csv.DictReader(io.StringIO(file_content))
        except Exception as e:
            raise CSVParseError(f"Failed to parse CSV: {e}")

        if reader.fieldnames is None:
            raise CSVParseError("CSV file is empty or has no header row")

        # Normalize column names to lowercase
        normalized_fields = {f.strip().lower() for f in reader.fieldnames if f}

        # Check required columns
        missing = self.REQUIRED_COLUMNS - normalized_fields
        if missing:
            raise CSVParseError(
                f"CSV missing required columns: {', '.join(sorted(missing))}"
            )

        for row_idx, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            # Normalize keys
            normalized_row = {k.strip().lower(): v.strip() if v else "" for k, v in row.items() if k}

            # Validate required fields
            action_obj = self._parse_row(row_idx, normalized_row, errors)
            if action_obj:
                trade_actions.append(action_obj)

        return CSVParseResult(trade_actions=trade_actions, errors=errors)

    def _parse_row(
        self, row_number: int, row: dict, errors: List[CSVRowError]
    ) -> TradeAction | None:
        """Parse a single CSV row, appending errors if invalid."""

        # Check date
        date_str = row.get("date", "").strip()
        if not date_str:
            errors.append(CSVRowError(row_number=row_number, field_name="date", message="Date is required"))
            return None

        parsed_date = self._parse_date(date_str)
        if parsed_date is None:
            errors.append(CSVRowError(
                row_number=row_number,
                field_name="date",
                message=f"Invalid date format: '{date_str}'. Supported: ISO 8601, DD/MM/YYYY, MM/DD/YYYY",
            ))
            return None

        # Check symbol
        symbol = row.get("symbol", "").strip().upper()
        if not symbol:
            errors.append(CSVRowError(row_number=row_number, field_name="symbol", message="Symbol is required"))
            return None

        # Check action
        action = row.get("action", "").strip().upper()
        if action not in ("BUY", "SELL"):
            errors.append(CSVRowError(
                row_number=row_number,
                field_name="action",
                message=f"Action must be BUY or SELL, got: '{row.get('action', '')}'",
            ))
            return None

        # Check quantity
        quantity_str = row.get("quantity", "").strip()
        if not quantity_str:
            errors.append(CSVRowError(row_number=row_number, field_name="quantity", message="Quantity is required"))
            return None
        try:
            quantity = int(quantity_str)
            if quantity <= 0:
                raise ValueError("non-positive")
        except ValueError:
            errors.append(CSVRowError(
                row_number=row_number,
                field_name="quantity",
                message=f"Quantity must be a positive integer, got: '{quantity_str}'",
            ))
            return None

        # Check price
        price_str = row.get("price", "").strip()
        if not price_str:
            errors.append(CSVRowError(row_number=row_number, field_name="price", message="Price is required"))
            return None
        try:
            price = float(price_str)
            if price <= 0:
                raise ValueError("non-positive")
        except ValueError:
            errors.append(CSVRowError(
                row_number=row_number,
                field_name="price",
                message=f"Price must be a positive number, got: '{price_str}'",
            ))
            return None

        # Optional fields
        strategy = row.get("strategy", "").strip() or None
        setup = row.get("setup", "").strip() or None
        sector = row.get("sector", "").strip() or None

        return TradeAction(
            row_number=row_number,
            date=parsed_date,
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=price,
            strategy=strategy,
            setup=setup,
            sector=sector,
        )

    def _parse_date(self, date_str: str) -> datetime | None:
        """
        Attempt to parse a date string in multiple formats.

        Supports:
        - ISO 8601 (YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, etc.)
        - DD/MM/YYYY
        - MM/DD/YYYY

        For ambiguous dates like 01/02/2024, we try DD/MM/YYYY first.
        """
        # Try ISO 8601 formats first
        iso_formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        for fmt in iso_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # Try DD/MM/YYYY format
        try:
            return datetime.strptime(date_str, "%d/%m/%Y")
        except ValueError:
            pass

        # Try MM/DD/YYYY format
        try:
            return datetime.strptime(date_str, "%m/%d/%Y")
        except ValueError:
            pass

        # Try DD-MM-YYYY
        try:
            return datetime.strptime(date_str, "%d-%m-%Y")
        except ValueError:
            pass

        return None

    def match_trades(
        self, actions: List[TradeAction], user_id: str = "default"
    ) -> TradeMatchResult:
        """
        Match BUY/SELL actions for same symbol into complete TradeRecords.

        Uses FIFO matching: earliest BUY matched with earliest SELL for same symbol.
        Unmatched entries (open trades) are flagged separately.

        Args:
            actions: List of parsed TradeAction objects.
            user_id: User ID to assign to created TradeRecords.

        Returns:
            TradeMatchResult with matched_trades and unmatched_entries.
        """
        # Group actions by symbol
        buys_by_symbol: dict[str, List[TradeAction]] = defaultdict(list)
        sells_by_symbol: dict[str, List[TradeAction]] = defaultdict(list)

        for action in actions:
            if action.action == "BUY":
                buys_by_symbol[action.symbol].append(action)
            else:
                sells_by_symbol[action.symbol].append(action)

        # Sort each group by date (FIFO)
        for symbol in buys_by_symbol:
            buys_by_symbol[symbol].sort(key=lambda a: a.date)
        for symbol in sells_by_symbol:
            sells_by_symbol[symbol].sort(key=lambda a: a.date)

        matched_trades: List[TradeRecord] = []
        unmatched_entries: List[UnmatchedEntry] = []

        # Get all symbols
        all_symbols = set(buys_by_symbol.keys()) | set(sells_by_symbol.keys())

        for symbol in all_symbols:
            buys = buys_by_symbol.get(symbol, [])
            sells = sells_by_symbol.get(symbol, [])

            buy_idx = 0
            sell_idx = 0

            while buy_idx < len(buys) and sell_idx < len(sells):
                buy = buys[buy_idx]
                sell = sells[sell_idx]

                # Match: use minimum quantity
                match_qty = min(buy.quantity, sell.quantity)

                # Determine direction and calculate P&L
                direction = TradeDirection.LONG
                realized_pnl = (sell.price - buy.price) * match_qty

                holding_days = (sell.date - buy.date).days

                trade = TradeRecord(
                    id=str(uuid4()),
                    user_id=user_id,
                    symbol=symbol,
                    direction=direction,
                    entry_date=buy.date,
                    exit_date=sell.date,
                    entry_price=buy.price,
                    exit_price=sell.price,
                    quantity=match_qty,
                    realized_pnl=realized_pnl,
                    holding_period_days=holding_days,
                    strategy=buy.strategy or sell.strategy,
                    setup=buy.setup or sell.setup,
                    sector=buy.sector or sell.sector,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                matched_trades.append(trade)

                # Handle partial fills
                remaining_buy_qty = buy.quantity - match_qty
                remaining_sell_qty = sell.quantity - match_qty

                if remaining_buy_qty > 0:
                    # Create a new TradeAction with remaining quantity
                    buys[buy_idx] = TradeAction(
                        row_number=buy.row_number,
                        date=buy.date,
                        symbol=buy.symbol,
                        action=buy.action,
                        quantity=remaining_buy_qty,
                        price=buy.price,
                        strategy=buy.strategy,
                        setup=buy.setup,
                        sector=buy.sector,
                    )
                    sell_idx += 1
                elif remaining_sell_qty > 0:
                    sells[sell_idx] = TradeAction(
                        row_number=sell.row_number,
                        date=sell.date,
                        symbol=sell.symbol,
                        action=sell.action,
                        quantity=remaining_sell_qty,
                        price=sell.price,
                        strategy=sell.strategy,
                        setup=sell.setup,
                        sector=sell.sector,
                    )
                    buy_idx += 1
                else:
                    buy_idx += 1
                    sell_idx += 1

            # Flag remaining unmatched buys
            while buy_idx < len(buys):
                buy = buys[buy_idx]
                unmatched_entries.append(UnmatchedEntry(
                    row_number=buy.row_number,
                    symbol=buy.symbol,
                    action="BUY",
                    date=buy.date,
                    price=buy.price,
                    quantity=buy.quantity,
                    reason="No matching SELL found",
                ))
                buy_idx += 1

            # Flag remaining unmatched sells
            while sell_idx < len(sells):
                sell = sells[sell_idx]
                unmatched_entries.append(UnmatchedEntry(
                    row_number=sell.row_number,
                    symbol=sell.symbol,
                    action="SELL",
                    date=sell.date,
                    price=sell.price,
                    quantity=sell.quantity,
                    reason="No matching BUY found",
                ))
                sell_idx += 1

        return TradeMatchResult(
            matched_trades=matched_trades,
            unmatched_entries=unmatched_entries,
        )

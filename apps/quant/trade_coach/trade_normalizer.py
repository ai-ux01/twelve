"""
Trade Normalizer Module.

Transforms raw Kotak Neo API responses (positions, holdings, trade book)
into the internal TradeRecord format used by the Trade Coach.

All normalization methods are pure functions with no side effects.

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import List, Optional

from trade_analysis.models import TradeDirection, TradeRecord

logger = logging.getLogger(__name__)


class TradeNormalizer:
    """Transforms Kotak Neo API responses into internal TradeRecord format.

    Pure function module — no side effects, no network calls.
    Skips records with missing required fields and logs warnings.
    Preserves all numeric precision from source data.
    """

    def normalize_positions(self, raw_positions: list[dict]) -> list[TradeRecord]:
        """Convert Kotak Neo position records to TradeRecords.

        Mapping:
            trdSym → strip -EQ suffix → symbol
            buyAmt / qty → entry_price
            qty → quantity (int)
            prod → infer direction (MIS/CNC)
            trade_source = "live", id = "live-" + UUID

        Args:
            raw_positions: List of raw position dicts from Kotak Neo API.

        Returns:
            List of valid TradeRecord objects. Invalid records are skipped.
        """
        results: list[TradeRecord] = []

        for record in raw_positions:
            try:
                # Check required fields
                trd_sym = record.get("trdSym")
                qty_str = record.get("qty")
                buy_amt_str = record.get("buyAmt")

                if not trd_sym or qty_str is None or buy_amt_str is None:
                    identifier = trd_sym or record.get("sym") or str(record)
                    logger.warning(
                        "Skipping position record with missing required fields: %s",
                        identifier,
                    )
                    continue

                # Parse and validate
                qty = int(qty_str)
                buy_amt = float(buy_amt_str)

                if qty == 0:
                    logger.warning(
                        "Skipping position record with zero quantity: %s", trd_sym
                    )
                    continue

                # Compute entry price preserving precision
                entry_price = buy_amt / qty

                # Strip -EQ suffix from symbol
                symbol = _strip_exchange_suffix(trd_sym)

                # Infer direction from quantity sign and product type
                # Positive qty = LONG, Negative qty = SHORT
                direction = TradeDirection.LONG if qty > 0 else TradeDirection.SHORT
                quantity = abs(qty)

                # Compute sell amount for exit price if available
                sell_amt_str = record.get("sellAmt")
                exit_price = 0.0
                if sell_amt_str:
                    sell_amt = float(sell_amt_str)
                    if sell_amt > 0 and quantity > 0:
                        exit_price = sell_amt / quantity

                # Compute realized P&L if both buy and sell amounts are available
                realized_pnl = 0.0
                if sell_amt_str:
                    sell_amt = float(sell_amt_str)
                    if direction == TradeDirection.LONG:
                        realized_pnl = sell_amt - buy_amt
                    else:
                        realized_pnl = buy_amt - sell_amt

                trade_record = TradeRecord(
                    id=f"live-{uuid.uuid4()}",
                    user_id="default",
                    symbol=symbol,
                    direction=direction,
                    entry_date=datetime.utcnow(),
                    exit_date=datetime.utcnow(),
                    entry_price=entry_price,
                    exit_price=exit_price,
                    quantity=quantity,
                    realized_pnl=realized_pnl,
                    holding_period_days=0,
                    strategy="live",
                )
                results.append(trade_record)

            except (ValueError, TypeError, KeyError) as e:
                identifier = record.get("trdSym") or record.get("sym") or str(record)
                logger.warning(
                    "Skipping position record due to parse error (%s): %s",
                    e,
                    identifier,
                )
                continue

        return results

    def normalize_holdings(self, raw_holdings: list[dict]) -> list[TradeRecord]:
        """Convert Kotak Neo holding records to TradeRecords.

        Mapping:
            displaySymbol → symbol
            averagePrice → entry_price
            mktValue / quantity → current price (exit_price)
            unrealisedGainLoss → realized_pnl
            trade_source = "live"

        Args:
            raw_holdings: List of raw holding dicts from Kotak Neo API.

        Returns:
            List of valid TradeRecord objects. Invalid records are skipped.
        """
        results: list[TradeRecord] = []

        for record in raw_holdings:
            try:
                # Check required fields
                display_symbol = record.get("displaySymbol")
                quantity_str = record.get("quantity")
                avg_price_str = record.get("averagePrice")

                if not display_symbol or quantity_str is None or avg_price_str is None:
                    identifier = (
                        display_symbol or record.get("symbol") or str(record)
                    )
                    logger.warning(
                        "Skipping holding record with missing required fields: %s",
                        identifier,
                    )
                    continue

                # Parse numeric values preserving precision
                quantity = int(quantity_str)
                avg_price = float(avg_price_str)

                if quantity <= 0:
                    logger.warning(
                        "Skipping holding record with non-positive quantity: %s",
                        display_symbol,
                    )
                    continue

                # Compute current price from market value
                mkt_value_str = record.get("mktValue")
                exit_price = 0.0
                if mkt_value_str:
                    mkt_value = float(mkt_value_str)
                    exit_price = mkt_value / quantity

                # Map unrealised gain/loss to realized_pnl
                pnl_str = record.get("unrealisedGainLoss")
                realized_pnl = float(pnl_str) if pnl_str is not None else 0.0

                trade_record = TradeRecord(
                    id=f"live-{uuid.uuid4()}",
                    user_id="default",
                    symbol=display_symbol,
                    direction=TradeDirection.LONG,  # Holdings are always long
                    entry_date=datetime.utcnow(),
                    exit_date=datetime.utcnow(),
                    entry_price=avg_price,
                    exit_price=exit_price,
                    quantity=quantity,
                    realized_pnl=realized_pnl,
                    holding_period_days=0,
                    strategy="live",
                )
                results.append(trade_record)

            except (ValueError, TypeError, KeyError) as e:
                identifier = (
                    record.get("displaySymbol") or record.get("symbol") or str(record)
                )
                logger.warning(
                    "Skipping holding record due to parse error (%s): %s",
                    e,
                    identifier,
                )
                continue

        return results

    def normalize_trades(self, raw_trades: list[dict]) -> list[TradeRecord]:
        """Convert Kotak Neo executed trade records to TradeRecords.

        Mapping:
            trdSym → strip -EQ suffix → symbol
            trnsTp "B" → LONG, "S" → SHORT
            qty → int
            prc → float (preserve precision)
            flDtTm → parse as "YYYY-MM-DD HH:MM:SS" → entry_date
            trade_source = "live"

        Args:
            raw_trades: List of raw trade dicts from Kotak Neo API.

        Returns:
            List of valid TradeRecord objects. Invalid records are skipped.
        """
        results: list[TradeRecord] = []

        for record in raw_trades:
            try:
                # Check required fields
                trd_sym = record.get("trdSym")
                trns_tp = record.get("trnsTp")
                qty_str = record.get("qty")
                prc_str = record.get("prc")

                if not trd_sym or not trns_tp or qty_str is None or prc_str is None:
                    identifier = (
                        trd_sym or record.get("nOrdNo") or str(record)
                    )
                    logger.warning(
                        "Skipping trade record with missing required fields: %s",
                        identifier,
                    )
                    continue

                # Strip -EQ suffix from symbol
                symbol = _strip_exchange_suffix(trd_sym)

                # Map direction
                direction = _map_direction(trns_tp)
                if direction is None:
                    logger.warning(
                        "Skipping trade record with unknown direction '%s': %s",
                        trns_tp,
                        trd_sym,
                    )
                    continue

                # Parse numeric values preserving precision
                qty = int(qty_str)
                prc = float(prc_str)

                if qty <= 0:
                    logger.warning(
                        "Skipping trade record with non-positive quantity: %s",
                        trd_sym,
                    )
                    continue

                # Parse execution timestamp
                fl_dt_tm = record.get("flDtTm")
                entry_date = datetime.utcnow()
                if fl_dt_tm:
                    try:
                        entry_date = datetime.strptime(fl_dt_tm, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        # If parsing fails, use current time but don't skip
                        logger.warning(
                            "Could not parse flDtTm '%s' for trade %s, using current time",
                            fl_dt_tm,
                            trd_sym,
                        )

                trade_record = TradeRecord(
                    id=f"live-{uuid.uuid4()}",
                    user_id="default",
                    symbol=symbol,
                    direction=direction,
                    entry_date=entry_date,
                    exit_date=entry_date,  # Same as entry for individual trades
                    entry_price=prc,
                    exit_price=prc,  # For executed trades, price is execution price
                    quantity=qty,
                    realized_pnl=0.0,  # Individual trades don't have P&L until matched
                    holding_period_days=0,
                    strategy="live",
                )
                results.append(trade_record)

            except (ValueError, TypeError, KeyError) as e:
                identifier = record.get("trdSym") or record.get("nOrdNo") or str(record)
                logger.warning(
                    "Skipping trade record due to parse error (%s): %s",
                    e,
                    identifier,
                )
                continue

        return results


def _strip_exchange_suffix(symbol: str) -> str:
    """Strip exchange suffix (e.g., -EQ) from a trading symbol.

    Args:
        symbol: Raw trading symbol like "RELIANCE-EQ".

    Returns:
        Clean symbol like "RELIANCE".
    """
    if symbol.endswith("-EQ"):
        return symbol[:-3]
    return symbol


def _map_direction(trns_tp: str) -> Optional[TradeDirection]:
    """Map Kotak Neo transaction type to TradeDirection.

    Args:
        trns_tp: Transaction type from Kotak API ("B" for buy, "S" for sell).

    Returns:
        TradeDirection.LONG for "B", TradeDirection.SHORT for "S", None for unknown.
    """
    if trns_tp == "B":
        return TradeDirection.LONG
    elif trns_tp == "S":
        return TradeDirection.SHORT
    return None

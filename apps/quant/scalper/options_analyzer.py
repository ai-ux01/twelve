"""
Options Analyzer for the Options Scalping Agent.

This module wraps the Phase 8 OptionsChainService and adds
scalping-specific analysis including OI metrics, PCR calculation,
ATM IV extraction, OI buildup detection, and liquidity validation.

Requirements: 24.1, 24.2, 24.3, 24.4, 7.1, 7.2, 7.4, 7.5, 7.9, 7.11, 7.12, 7.15, 7.16,
              8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Dict, List, Optional, Tuple

from scalper.models import (
    OptionsAnalysis,
    OptionsContract,
    OIBuildup,
)


logger = logging.getLogger(__name__)


class OptionsAnalyzerError(Exception):
    """Raised when options analysis fails."""

    pass


class OptionsAnalyzer:
    """
    Options Analyzer for the Options Scalping Agent.

    Analyzes options chain data to calculate OI metrics, PCR, ATM IV,
    OI buildup, and liquidity validation. Integrates with Phase 8
    OptionsChainService for contract data processing.

    The analyzer takes pre-fetched List[OptionsContract] from the
    MarketDataFetcher and calculates:
    - Total Call/Put OI and OI changes from previous refresh
    - Put-Call Ratio (PCR)
    - ATM Call IV and ATM Put IV for nearest weekly expiry
    - OI buildup detection (top 5 contracts with ≥100 OI increase)
    - Standalone liquidity validation per contract

    Requirements: 24.1, 24.2, 24.3, 24.4, 7.1, 7.2, 7.4, 7.5, 7.9, 7.11, 7.12, 7.15, 7.16,
                  8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
    """

    # Minimum OI increase for buildup detection
    OI_BUILDUP_THRESHOLD: int = 100

    # Maximum number of top OI buildup contracts to return
    TOP_OI_BUILDUP_COUNT: int = 5

    # Maximum spread percentage for liquidity
    MAX_SPREAD_PERCENTAGE: float = 5.0

    # Minimum OI for liquidity
    MIN_OPEN_INTEREST: int = 100

    def __init__(self):
        """Initialize OptionsAnalyzer."""
        pass

    def analyze_options_chain(
        self,
        chain_data: List[OptionsContract],
        spot_price: float,
        previous_chain_data: Optional[List[OptionsContract]] = None,
    ) -> OptionsAnalysis:
        """
        Analyze the options chain and calculate all options metrics.

        Extracts bid, ask, ltp, volume, OI, IV, and Greeks from each
        OptionsContract, then calculates aggregate metrics.

        Args:
            chain_data: List of OptionsContract objects (pre-fetched from MarketDataFetcher)
            spot_price: Current spot price for ATM identification
            previous_chain_data: Previous refresh's chain data for OI change calculation

        Returns:
            OptionsAnalysis model with all calculated metrics.

        Raises:
            OptionsAnalyzerError: If chain_data is empty or invalid.

        Requirements: 24.1, 24.2, 24.3, 24.4, 7.1, 7.2, 7.4, 7.5, 7.9, 7.11, 7.12, 7.15, 7.16
        """
        if not chain_data:
            raise OptionsAnalyzerError("No options chain data provided")

        if spot_price <= 0:
            raise OptionsAnalyzerError(
                f"Invalid spot price: {spot_price}. Must be positive."
            )

        # Calculate OI metrics (total OI, changes)
        call_oi, put_oi, call_oi_change, put_oi_change, call_oi_change_pct, put_oi_change_pct = (
            self.calculate_oi_metrics(chain_data, previous_chain_data)
        )

        # Calculate PCR
        pcr = self.calculate_pcr(call_oi, put_oi)

        # Calculate ATM IV
        atm_call_iv, atm_put_iv = self._calculate_atm_iv(chain_data, spot_price)

        # Identify OI buildup
        oi_changes = self._compute_oi_changes(chain_data, previous_chain_data)
        top_call_oi_buildup, top_put_oi_buildup = self.identify_oi_buildup(oi_changes)

        return OptionsAnalysis(
            call_oi=call_oi,
            put_oi=put_oi,
            call_oi_change=call_oi_change,
            put_oi_change=put_oi_change,
            call_oi_change_pct=call_oi_change_pct,
            put_oi_change_pct=put_oi_change_pct,
            pcr=pcr if pcr is not None else 0.0,
            atm_call_iv=atm_call_iv,
            atm_put_iv=atm_put_iv,
            top_call_oi_buildup=top_call_oi_buildup,
            top_put_oi_buildup=top_put_oi_buildup,
        )

    def calculate_oi_metrics(
        self,
        chain_data: List[OptionsContract],
        previous_data: Optional[List[OptionsContract]] = None,
    ) -> Tuple[int, int, int, int, float, float]:
        """
        Compute total Call/Put OI and OI changes from previous refresh.

        Args:
            chain_data: Current options chain data
            previous_data: Previous refresh's chain data (None for first refresh)

        Returns:
            Tuple of (call_oi, put_oi, call_oi_change, put_oi_change,
                      call_oi_change_pct, put_oi_change_pct)

        Requirements: 7.1, 7.2, 7.4, 7.5
        """
        # Calculate current total OI for calls and puts
        call_oi = sum(
            c.open_interest for c in chain_data if c.option_type == "CE"
        )
        put_oi = sum(
            c.open_interest for c in chain_data if c.option_type == "PE"
        )

        # Calculate OI changes from previous refresh
        if previous_data is None:
            # First refresh: no previous data to compare against
            call_oi_change = 0
            put_oi_change = 0
            call_oi_change_pct = 0.0
            put_oi_change_pct = 0.0
        else:
            prev_call_oi = sum(
                c.open_interest for c in previous_data if c.option_type == "CE"
            )
            prev_put_oi = sum(
                c.open_interest for c in previous_data if c.option_type == "PE"
            )

            call_oi_change = call_oi - prev_call_oi
            put_oi_change = put_oi - prev_put_oi

            call_oi_change_pct = (
                round((call_oi_change / prev_call_oi) * 100, 2)
                if prev_call_oi > 0
                else 0.0
            )
            put_oi_change_pct = (
                round((put_oi_change / prev_put_oi) * 100, 2)
                if prev_put_oi > 0
                else 0.0
            )

        return (call_oi, put_oi, call_oi_change, put_oi_change,
                call_oi_change_pct, put_oi_change_pct)

    def calculate_pcr(self, call_oi: int, put_oi: int) -> Optional[float]:
        """
        Compute Put-Call Ratio.

        PCR = Total Put OI / Total Call OI.
        Returns None if Call OI is 0 (division by zero).

        Args:
            call_oi: Total Call open interest
            put_oi: Total Put open interest

        Returns:
            PCR value rounded to 4 decimals, or None if Call OI is 0.

        Requirements: 7.9
        """
        if call_oi == 0:
            return None

        return round(put_oi / call_oi, 4)

    def identify_oi_buildup(
        self,
        oi_changes: List[Dict],
    ) -> Tuple[List[OIBuildup], List[OIBuildup]]:
        """
        Find top 5 contracts with highest OI increase (≥100 threshold).

        Args:
            oi_changes: List of dicts with strike_price, option_type, oi_change, oi_change_pct

        Returns:
            Tuple of (top_call_oi_buildup, top_put_oi_buildup), each with up to 5 entries.

        Requirements: 7.11, 7.12, 7.15, 7.16
        """
        call_buildups: List[OIBuildup] = []
        put_buildups: List[OIBuildup] = []

        for change in oi_changes:
            oi_change = change.get("oi_change", 0)

            # Only include contracts with OI increase ≥ threshold
            if oi_change < self.OI_BUILDUP_THRESHOLD:
                continue

            buildup = OIBuildup(
                strike_price=change["strike_price"],
                option_type=change["option_type"],
                oi_change=oi_change,
                oi_change_pct=change.get("oi_change_pct", 0.0),
            )

            if change["option_type"] == "CE":
                call_buildups.append(buildup)
            else:
                put_buildups.append(buildup)

        # Sort by OI change descending and take top 5
        call_buildups.sort(key=lambda x: x.oi_change, reverse=True)
        put_buildups.sort(key=lambda x: x.oi_change, reverse=True)

        return (
            call_buildups[: self.TOP_OI_BUILDUP_COUNT],
            put_buildups[: self.TOP_OI_BUILDUP_COUNT],
        )

    def validate_contract_liquidity(
        self,
        contract: Optional[OptionsContract] = None,
        bid: Optional[float] = None,
        ask: Optional[float] = None,
        volume: Optional[int] = None,
        open_interest: Optional[int] = None,
    ) -> Tuple[bool, float, float, float]:
        """
        Validate liquidity for a single options contract.

        Can be called with either an OptionsContract object or individual values.

        Calculates:
        - Spread = ask - bid
        - Mid-price = (bid + ask) / 2
        - Spread percentage = (spread / mid-price) × 100

        Sets liquidity_valid = false if any of:
        - spread % > 5%
        - volume = 0
        - OI ≤ 100
        - bid ≤ 0
        - ask ≤ 0
        - bid > ask (crossed market)
        - bid is null
        - ask is null

        Args:
            contract: OptionsContract to validate (optional, use if individual values not given)
            bid: Bid price (used if contract is None)
            ask: Ask price (used if contract is None)
            volume: Trading volume (used if contract is None)
            open_interest: Open interest (used if contract is None)

        Returns:
            Tuple of (liquidity_valid, spread, mid_price, spread_percentage)

        Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
        """
        # Extract values from contract if provided
        if contract is not None:
            bid = contract.bid
            ask = contract.ask
            volume = contract.volume
            open_interest = contract.open_interest

        # Check for null values (Requirements 8.10, 8.11)
        if bid is None or ask is None:
            return (False, 0.0, 0.0, 0.0)

        if volume is None or open_interest is None:
            return (False, 0.0, 0.0, 0.0)

        # Check bid ≤ 0 (Requirement 8.8)
        if bid <= 0:
            spread = max(ask - bid, 0.0) if ask > 0 else 0.0
            mid_price = (bid + ask) / 2 if (bid + ask) > 0 else 0.0
            spread_pct = (spread / mid_price * 100) if mid_price > 0 else 0.0
            return (False, spread, mid_price, spread_pct)

        # Check ask ≤ 0 (Requirement 8.9)
        if ask <= 0:
            return (False, 0.0, 0.0, 0.0)

        # Check bid > ask (crossed market) (Requirement 8.7)
        if bid > ask:
            spread = 0.0
            mid_price = (bid + ask) / 2
            spread_pct = 0.0
            return (False, spread, mid_price, spread_pct)

        # Calculate spread metrics (Requirements 8.1, 8.2, 8.3)
        spread = ask - bid
        mid_price = (bid + ask) / 2
        spread_pct = (spread / mid_price) * 100 if mid_price > 0 else 0.0

        # Check spread percentage > 5% (Requirement 8.5)
        if spread_pct > self.MAX_SPREAD_PERCENTAGE:
            return (False, spread, mid_price, spread_pct)

        # Check volume = 0 (Requirement 8.4, 8.6)
        if volume == 0:
            return (False, spread, mid_price, spread_pct)

        # Check OI ≤ 100 (Requirement 8.6)
        if open_interest <= self.MIN_OPEN_INTEREST:
            return (False, spread, mid_price, spread_pct)

        # All checks passed
        return (True, spread, mid_price, spread_pct)

    # --- Private helper methods ---

    def _calculate_atm_iv(
        self,
        chain_data: List[OptionsContract],
        spot_price: float,
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Calculate ATM Call IV and ATM Put IV for nearest weekly expiry.

        ATM strike is the strike price nearest to the spot price.
        Only considers contracts for the nearest expiry date in the chain.

        Args:
            chain_data: List of OptionsContract objects
            spot_price: Current spot price

        Returns:
            Tuple of (atm_call_iv, atm_put_iv). Either may be None if not found.

        Requirements: 7.15, 7.16
        """
        if not chain_data:
            return (None, None)

        # Find the nearest expiry date (weekly)
        today = date.today()
        expiry_dates = sorted(set(
            c.expiry_date for c in chain_data if c.expiry_date >= today
        ))

        if not expiry_dates:
            return (None, None)

        nearest_expiry = expiry_dates[0]

        # Filter contracts for nearest expiry
        nearest_contracts = [
            c for c in chain_data if c.expiry_date == nearest_expiry
        ]

        if not nearest_contracts:
            return (None, None)

        # Find ATM strike (nearest to spot price)
        all_strikes = sorted(set(c.strike_price for c in nearest_contracts))
        if not all_strikes:
            return (None, None)

        atm_strike = min(all_strikes, key=lambda s: abs(s - spot_price))

        # Get ATM Call IV
        atm_call_iv = None
        atm_calls = [
            c for c in nearest_contracts
            if c.strike_price == atm_strike and c.option_type == "CE"
        ]
        if atm_calls and atm_calls[0].implied_volatility is not None:
            atm_call_iv = atm_calls[0].implied_volatility

        # Get ATM Put IV
        atm_put_iv = None
        atm_puts = [
            c for c in nearest_contracts
            if c.strike_price == atm_strike and c.option_type == "PE"
        ]
        if atm_puts and atm_puts[0].implied_volatility is not None:
            atm_put_iv = atm_puts[0].implied_volatility

        return (atm_call_iv, atm_put_iv)

    def _compute_oi_changes(
        self,
        chain_data: List[OptionsContract],
        previous_data: Optional[List[OptionsContract]],
    ) -> List[Dict]:
        """
        Compute per-contract OI changes between current and previous data.

        Args:
            chain_data: Current chain data
            previous_data: Previous chain data (None = first refresh)

        Returns:
            List of dicts with strike_price, option_type, oi_change, oi_change_pct
        """
        if previous_data is None:
            # First refresh: no changes to report
            return []

        # Build lookup map for previous data: (strike_price, option_type) -> OI
        prev_oi_map: Dict[Tuple[float, str], int] = {}
        for c in previous_data:
            key = (c.strike_price, c.option_type)
            prev_oi_map[key] = c.open_interest

        oi_changes: List[Dict] = []
        for c in chain_data:
            key = (c.strike_price, c.option_type)
            prev_oi = prev_oi_map.get(key, 0)
            oi_change = c.open_interest - prev_oi

            oi_change_pct = (
                round((oi_change / prev_oi) * 100, 2)
                if prev_oi > 0
                else 0.0
            )

            oi_changes.append({
                "strike_price": c.strike_price,
                "option_type": c.option_type,
                "oi_change": oi_change,
                "oi_change_pct": oi_change_pct,
            })

        return oi_changes

"""
Signal Generator for the Options Scalping Agent.

This module applies probability and risk/reward thresholds, selects
the best options contract, and enforces safety controls to generate
high-quality BUY/HOLD signals.

Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10,
              11.1, 11.2, 11.3, 11.5, 11.6, 12.1, 12.2, 12.3, 12.4, 12.5,
              12.6, 12.7, 12.8, 12.9, 12.10
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

from scalper.models import (
    MarketDataPackage,
    OptionsContract,
    ScalperSignalType,
    Signal,
    TechnicalIndicators,
)
from scalper.ai_analysis_engine import AIAnalysisResult


logger = logging.getLogger(__name__)

# IST timezone offset: UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

# Indian stock market holidays for 2024-2025 (NSE holidays)
# This list should be updated annually
INDIAN_MARKET_HOLIDAYS: List[date] = [
    # 2024 holidays
    date(2024, 1, 26),   # Republic Day
    date(2024, 3, 8),    # Maha Shivaratri
    date(2024, 3, 25),   # Holi
    date(2024, 3, 29),   # Good Friday
    date(2024, 4, 11),   # Id-Ul-Fitr (Ramadan)
    date(2024, 4, 14),   # Dr. Ambedkar Jayanti
    date(2024, 4, 17),   # Ram Navami
    date(2024, 4, 21),   # Mahavir Jayanti
    date(2024, 5, 1),    # Maharashtra Day
    date(2024, 5, 23),   # Buddha Purnima
    date(2024, 6, 17),   # Eid-Ul-Adha (Bakri Id)
    date(2024, 7, 17),   # Muharram
    date(2024, 8, 15),   # Independence Day
    date(2024, 9, 16),   # Milad-Un-Nabi
    date(2024, 10, 2),   # Mahatma Gandhi Jayanti
    date(2024, 10, 12),  # Dussehra
    date(2024, 11, 1),   # Diwali (Laxmi Pujan)
    date(2024, 11, 15),  # Gurunanak Jayanti
    date(2024, 12, 25),  # Christmas
    # 2025 holidays
    date(2025, 1, 26),   # Republic Day
    date(2025, 2, 26),   # Maha Shivaratri
    date(2025, 3, 14),   # Holi
    date(2025, 3, 31),   # Id-Ul-Fitr (Ramadan)
    date(2025, 4, 10),   # Mahavir Jayanti
    date(2025, 4, 14),   # Dr. Ambedkar Jayanti
    date(2025, 4, 18),   # Good Friday
    date(2025, 5, 1),    # Maharashtra Day
    date(2025, 5, 12),   # Buddha Purnima
    date(2025, 6, 7),    # Eid-Ul-Adha (Bakri Id)
    date(2025, 7, 6),    # Muharram
    date(2025, 8, 15),   # Independence Day
    date(2025, 8, 16),   # Janmashtami
    date(2025, 9, 5),    # Milad-Un-Nabi
    date(2025, 10, 2),   # Mahatma Gandhi Jayanti / Dussehra
    date(2025, 10, 21),  # Diwali (Laxmi Pujan)
    date(2025, 10, 22),  # Diwali (Balipratipada)
    date(2025, 11, 5),   # Gurunanak Jayanti
    date(2025, 12, 25),  # Christmas
]

# Strike intervals
STRIKE_INTERVAL = {
    "NIFTY": 50,
    "BANKNIFTY": 100,
}

# Lot sizes
LOT_SIZE = {
    "NIFTY": 50,
    "BANKNIFTY": 25,
}

# Market hours in IST
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30


class SignalGeneratorError(Exception):
    """Raised when signal generation fails."""

    pass


class SignalGenerator:
    """
    Signal Generator for the Options Scalping Agent.

    Applies probability and R:R thresholds, selects the best options
    contract, and enforces safety controls to produce BUY/HOLD signals.

    Signal Generation Logic:
    1. Probability Check: AI probability >= 70%
    2. R:R Check: (Target - Entry) / (Entry - Stop Loss) >= 2.0
    3. Contract Selection: ATM ± 2 strikes with best liquidity
    4. Safety Controls: Market hours, stale data, extreme IV, etc.

    Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10,
                  11.1, 11.2, 11.3, 11.5, 11.6, 12.1, 12.2, 12.3, 12.4, 12.5,
                  12.6, 12.7, 12.8, 12.9, 12.10
    """

    # Default thresholds (can be overridden via configuration)
    DEFAULT_PROBABILITY_THRESHOLD: float = 70.0
    DEFAULT_RR_THRESHOLD: float = 2.0
    DEFAULT_MAX_SPREAD_PCT: float = 5.0
    DEFAULT_MIN_OI: int = 1000
    DEFAULT_MIN_VOLUME: int = 500
    DEFAULT_MAX_IV: float = 1.0  # 100% as decimal
    DEFAULT_STALE_DATA_SECONDS: int = 120  # 2 minutes
    DEFAULT_MIN_DAYS_TO_EXPIRY: int = 2

    def __init__(
        self,
        probability_threshold: float = DEFAULT_PROBABILITY_THRESHOLD,
        rr_threshold: float = DEFAULT_RR_THRESHOLD,
        max_spread_pct: float = DEFAULT_MAX_SPREAD_PCT,
        min_oi: int = DEFAULT_MIN_OI,
        min_volume: int = DEFAULT_MIN_VOLUME,
        max_iv: float = DEFAULT_MAX_IV,
        stale_data_seconds: int = DEFAULT_STALE_DATA_SECONDS,
        min_days_to_expiry: int = DEFAULT_MIN_DAYS_TO_EXPIRY,
    ):
        """
        Initialize the Signal Generator.

        Args:
            probability_threshold: Minimum probability for BUY signal (default 70%).
            rr_threshold: Minimum risk/reward ratio for BUY signal (default 2.0).
            max_spread_pct: Maximum spread percentage for liquidity (default 5%).
            min_oi: Minimum open interest for contract selection (default 1000).
            min_volume: Minimum volume for contract selection (default 500).
            max_iv: Maximum implied volatility as decimal (default 1.0 = 100%).
            stale_data_seconds: Maximum data age in seconds (default 120).
            min_days_to_expiry: Minimum days to expiry for contract selection (default 2).
        """
        self._probability_threshold = probability_threshold
        self._rr_threshold = rr_threshold
        self._max_spread_pct = max_spread_pct
        self._min_oi = min_oi
        self._min_volume = min_volume
        self._max_iv = max_iv
        self._stale_data_seconds = stale_data_seconds
        self._min_days_to_expiry = min_days_to_expiry

    def generate_signal(
        self,
        ai_result: AIAnalysisResult,
        contracts: List[OptionsContract],
        market_data: MarketDataPackage,
        technical_indicators: TechnicalIndicators,
        current_time: Optional[datetime] = None,
    ) -> Signal:
        """
        Generate a trading signal based on AI analysis and available contracts.

        This is the main method that orchestrates the signal generation workflow:
        1. Apply safety controls (priority order)
        2. Determine option type (CE/PE) from AI trend
        3. Select best contract
        4. Calculate entry, target, stop loss
        5. Check probability and R:R thresholds
        6. Generate BUY or HOLD signal

        Args:
            ai_result: AI analysis result with signal type, probability, trend.
            contracts: List of available options contracts.
            market_data: Market data package with timestamp and spot price.
            technical_indicators: Technical indicators (for ATR).
            current_time: Current time (optional, defaults to now in IST).

        Returns:
            Signal with signal type, probability, R:R, contract, and prices.

        Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10
        """
        if current_time is None:
            current_time = datetime.now(IST)

        # Step 1: Apply safety controls (priority order)
        safety_signal = self.apply_safety_controls(
            ai_result=ai_result,
            contracts=contracts,
            market_data=market_data,
            technical_indicators=technical_indicators,
            current_time=current_time,
        )
        if safety_signal is not None:
            return safety_signal

        # Step 2: Determine option type from AI trend
        option_type = self._determine_option_type(ai_result)

        # Step 3: Select best contract
        selected_contract = self.select_best_contract(
            contracts=contracts,
            option_type=option_type,
            spot_price=market_data.spot_price,
            underlying=market_data.underlying,
            current_date=current_time.date(),
        )

        if selected_contract is None:
            return Signal(
                signal_type=ScalperSignalType.HOLD,
                probability=ai_result.probability,
                risk_reward_ratio=0.0,
                selected_contract=None,
                entry_price=None,
                target_price=None,
                stop_loss=None,
                hold_reason="No Contract Selected",
            )

        # Step 4: Calculate entry, target, stop loss
        atr = technical_indicators.atr
        entry_price = self._calculate_entry_price(selected_contract)
        target_price = self._calculate_target_price(entry_price, atr)
        stop_loss = self._calculate_stop_loss(entry_price, atr)

        # Step 5: Calculate R:R ratio
        rr_ratio = self.calculate_risk_reward_ratio(entry_price, target_price, stop_loss)

        # Step 6: Check thresholds
        probability = ai_result.probability

        if probability >= self._probability_threshold and rr_ratio >= self._rr_threshold:
            # Generate BUY signal
            signal_type = (
                ScalperSignalType.BUY_CE if option_type == "CE"
                else ScalperSignalType.BUY_PE
            )
            return Signal(
                signal_type=signal_type,
                probability=probability,
                risk_reward_ratio=rr_ratio,
                selected_contract=selected_contract,
                entry_price=entry_price,
                target_price=target_price,
                stop_loss=stop_loss,
                hold_reason=None,
            )
        else:
            # Generate HOLD signal with appropriate reason
            if probability < self._probability_threshold:
                hold_reason = "Low Probability"
            else:
                hold_reason = "Insufficient R:R"

            return Signal(
                signal_type=ScalperSignalType.HOLD,
                probability=probability,
                risk_reward_ratio=rr_ratio,
                selected_contract=selected_contract,
                entry_price=entry_price,
                target_price=target_price,
                stop_loss=stop_loss,
                hold_reason=hold_reason,
            )

    def calculate_risk_reward_ratio(
        self, entry: float, target: float, stop_loss: float
    ) -> float:
        """
        Calculate the risk/reward ratio.

        R:R = (target - entry) / (entry - stop_loss)

        Args:
            entry: Entry price.
            target: Target price.
            stop_loss: Stop loss price.

        Returns:
            Risk/reward ratio. Returns 0.0 if entry equals stop_loss (division by zero).

        Requirements: 10.3
        """
        risk = entry - stop_loss
        if risk <= 0:
            return 0.0

        reward = target - entry
        if reward <= 0:
            return 0.0

        return round(reward / risk, 2)

    def select_best_contract(
        self,
        contracts: List[OptionsContract],
        option_type: str,
        spot_price: float,
        underlying: str = "NIFTY",
        current_date: Optional[date] = None,
    ) -> Optional[OptionsContract]:
        """
        Select the best contract for the signal.

        Selection criteria:
        1. Filter by option type (CE or PE)
        2. Filter by expiry: nearest weekly with >= 2 days remaining
        3. Filter by strike: ATM ± 2 strikes
        4. Filter by liquidity: spread <= 5%, OI > 1000, volume > 500, IV < 100%
        5. Rank by strike proximity to ATM, then by lowest spread

        Args:
            contracts: List of available options contracts.
            option_type: "CE" or "PE".
            spot_price: Current spot price for ATM identification.
            underlying: "NIFTY" or "BANKNIFTY" (for strike interval).
            current_date: Current date (optional, defaults to today).

        Returns:
            Best contract, or None if no contract meets criteria.

        Requirements: 11.1, 11.2, 11.3, 11.5, 11.6
        """
        if not contracts:
            return None

        if current_date is None:
            current_date = date.today()

        strike_interval = STRIKE_INTERVAL.get(underlying, 50)

        # Step 1: Filter by option type
        typed_contracts = [c for c in contracts if c.option_type == option_type]
        if not typed_contracts:
            return None

        # Step 2: Filter by expiry - nearest weekly with >= min_days_to_expiry remaining
        min_expiry_date = current_date + timedelta(days=self._min_days_to_expiry)
        valid_expiry_contracts = [
            c for c in typed_contracts if c.expiry_date >= min_expiry_date
        ]
        if not valid_expiry_contracts:
            return None

        # Find the nearest expiry
        nearest_expiry = min(c.expiry_date for c in valid_expiry_contracts)
        expiry_contracts = [
            c for c in valid_expiry_contracts if c.expiry_date == nearest_expiry
        ]

        # Step 3: Filter by strike proximity - ATM ± 2 strikes
        atm_strike = self._find_atm_strike(spot_price, strike_interval)
        max_strike_distance = 2 * strike_interval

        proximity_contracts = [
            c for c in expiry_contracts
            if abs(c.strike_price - atm_strike) <= max_strike_distance
        ]
        if not proximity_contracts:
            return None

        # Step 4: Filter by liquidity criteria
        liquid_contracts = [
            c for c in proximity_contracts
            if self._passes_liquidity_filter(c)
        ]
        if not liquid_contracts:
            return None

        # Step 5: Rank by strike proximity (ascending), then by lowest spread
        liquid_contracts.sort(
            key=lambda c: (
                abs(c.strike_price - atm_strike),
                c.spread_percentage,
            )
        )

        return liquid_contracts[0]

    def apply_safety_controls(
        self,
        ai_result: AIAnalysisResult,
        contracts: List[OptionsContract],
        market_data: MarketDataPackage,
        technical_indicators: TechnicalIndicators,
        current_time: Optional[datetime] = None,
        selected_contract: Optional[OptionsContract] = None,
    ) -> Optional[Signal]:
        """
        Apply safety controls in priority order.

        Returns a HOLD Signal if any violation is found, or None if all checks pass.

        Priority order:
        1. Stale Data (market data timestamp > 2 min old)
        2. Market Closed (outside 9:15 AM - 3:30 PM IST, weekdays only)
        3. No Contract Selected (no contracts available)
        4. Incomplete Data (any null field in required data)
        5. Extreme IV (IV > 100%)
        6. Poor Liquidity (spread > 5%)
        7. Low Probability (< 70%)
        8. Insufficient R:R (< 1:2)

        Args:
            ai_result: AI analysis result.
            contracts: List of available contracts.
            market_data: Market data package with timestamp.
            technical_indicators: Technical indicators.
            current_time: Current time (optional, defaults to now in IST).
            selected_contract: Pre-selected contract for IV/liquidity checks (optional).

        Returns:
            Signal with HOLD and reason if violation found, None if all pass.

        Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10
        """
        if current_time is None:
            current_time = datetime.now(IST)

        # 1. Check stale data
        stale_reason = self._check_stale_data(market_data, current_time)
        if stale_reason:
            return self._create_hold_signal(ai_result.probability, stale_reason)

        # 2. Check market hours
        market_reason = self._check_market_hours(current_time)
        if market_reason:
            return self._create_hold_signal(ai_result.probability, market_reason)

        # 3. Check contract availability
        if not contracts or len(contracts) == 0:
            return self._create_hold_signal(
                ai_result.probability, "No Contract Selected"
            )

        # 4. Check incomplete data
        incomplete_reason = self._check_incomplete_data(
            ai_result, market_data, technical_indicators
        )
        if incomplete_reason:
            return self._create_hold_signal(ai_result.probability, incomplete_reason)

        # 5. Check extreme IV (on selected contract or best available)
        contract_to_check = selected_contract
        if contract_to_check is None:
            # Check the best available contract for the option type
            option_type = self._determine_option_type(ai_result)
            contract_to_check = self.select_best_contract(
                contracts=contracts,
                option_type=option_type,
                spot_price=market_data.spot_price,
                underlying=market_data.underlying,
                current_date=current_time.date(),
            )

        if contract_to_check is not None:
            iv_reason = self._check_extreme_iv(contract_to_check)
            if iv_reason:
                return self._create_hold_signal(ai_result.probability, iv_reason)

            # 6. Check liquidity
            liquidity_reason = self._check_liquidity(contract_to_check)
            if liquidity_reason:
                return self._create_hold_signal(ai_result.probability, liquidity_reason)

        # 7. Check probability threshold
        if ai_result.probability < self._probability_threshold:
            return self._create_hold_signal(ai_result.probability, "Low Probability")

        # 8. Check R:R ratio
        if contract_to_check is not None:
            entry = self._calculate_entry_price(contract_to_check)
            target = self._calculate_target_price(entry, technical_indicators.atr)
            stop_loss = self._calculate_stop_loss(entry, technical_indicators.atr)
            rr = self.calculate_risk_reward_ratio(entry, target, stop_loss)
            if rr < self._rr_threshold:
                return self._create_hold_signal(ai_result.probability, "Insufficient R:R")

        # All checks pass
        return None

    # --- Private helper methods ---

    def _determine_option_type(self, ai_result: AIAnalysisResult) -> str:
        """
        Determine CE or PE based on AI trend classification.

        Bullish trend → CE (Call option)
        Bearish trend → PE (Put option)
        Neutral → CE (default to Call)

        Args:
            ai_result: AI analysis result with trend field.

        Returns:
            "CE" or "PE".
        """
        trend = ai_result.trend.lower() if ai_result.trend else "neutral"

        if trend == "bearish":
            return "PE"
        # Bullish or Neutral defaults to CE
        return "CE"

    def _find_atm_strike(self, spot_price: float, strike_interval: int) -> float:
        """
        Find the ATM strike nearest to the spot price.

        Rounds spot price to the nearest strike interval.

        Args:
            spot_price: Current spot price.
            strike_interval: Strike interval (50 for NIFTY, 100 for BANKNIFTY).

        Returns:
            ATM strike price.
        """
        return round(spot_price / strike_interval) * strike_interval

    def _passes_liquidity_filter(self, contract: OptionsContract) -> bool:
        """
        Check if a contract passes all liquidity filters.

        Criteria:
        - Spread <= max_spread_pct (default 5%)
        - OI > min_oi (default 1000)
        - Volume > min_volume (default 500)
        - IV < max_iv (default 1.0 = 100%)

        Args:
            contract: Options contract to check.

        Returns:
            True if contract passes all filters.

        Requirements: 11.3, 11.5, 11.6
        """
        # Check spread percentage
        if contract.spread_percentage > self._max_spread_pct:
            return False

        # Check open interest
        if contract.open_interest <= self._min_oi:
            return False

        # Check volume
        if contract.volume <= self._min_volume:
            return False

        # Check implied volatility
        if contract.implied_volatility is not None:
            if contract.implied_volatility > self._max_iv:
                return False

        return True

    def _calculate_entry_price(self, contract: OptionsContract) -> float:
        """
        Calculate entry price as mid-price.

        Entry = (bid + ask) / 2

        Args:
            contract: Selected options contract.

        Returns:
            Mid-price entry price.
        """
        return (contract.bid + contract.ask) / 2

    def _calculate_target_price(self, entry: float, atr: float) -> float:
        """
        Calculate target price.

        Target = Entry + (2 × ATR)

        Args:
            entry: Entry price.
            atr: Average True Range value.

        Returns:
            Target price.
        """
        return entry + (2 * atr)

    def _calculate_stop_loss(self, entry: float, atr: float) -> float:
        """
        Calculate stop loss price.

        Stop Loss = Entry - (1 × ATR)

        Args:
            entry: Entry price.
            atr: Average True Range value.

        Returns:
            Stop loss price.
        """
        return entry - (1 * atr)

    def _check_stale_data(
        self, market_data: MarketDataPackage, current_time: datetime
    ) -> Optional[str]:
        """
        Check if market data is stale (> 2 minutes old).

        Args:
            market_data: Market data package with timestamp.
            current_time: Current time for comparison.

        Returns:
            "Stale Data" if stale, None otherwise.

        Requirements: 12.1
        """
        data_timestamp = market_data.timestamp

        # Ensure both timestamps are timezone-aware for comparison
        if data_timestamp.tzinfo is None:
            # Assume data timestamp is in IST if no timezone
            data_timestamp = data_timestamp.replace(tzinfo=IST)

        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=IST)

        age_seconds = (current_time - data_timestamp).total_seconds()

        if age_seconds > self._stale_data_seconds:
            return "Stale Data"

        return None

    def _check_market_hours(self, current_time: datetime) -> Optional[str]:
        """
        Check if current time is within market hours.

        Market hours: 9:15 AM - 3:30 PM IST, weekdays only.
        Also checks for Indian stock market holidays.

        Args:
            current_time: Current time in IST.

        Returns:
            "Market Closed" if outside hours, None otherwise.

        Requirements: 12.2, 12.3
        """
        # Ensure we're working in IST
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=IST)
        else:
            current_time = current_time.astimezone(IST)

        current_date = current_time.date()

        # Check weekend (Saturday = 5, Sunday = 6)
        if current_date.weekday() >= 5:
            return "Market Closed"

        # Check Indian stock market holidays
        if current_date in INDIAN_MARKET_HOLIDAYS:
            return "Market Closed"

        # Check market hours: 9:15 AM to 3:30 PM IST
        market_open = current_time.replace(
            hour=MARKET_OPEN_HOUR, minute=MARKET_OPEN_MINUTE, second=0, microsecond=0
        )
        market_close = current_time.replace(
            hour=MARKET_CLOSE_HOUR, minute=MARKET_CLOSE_MINUTE, second=0, microsecond=0
        )

        if current_time < market_open or current_time > market_close:
            return "Market Closed"

        return None

    def _check_incomplete_data(
        self,
        ai_result: AIAnalysisResult,
        market_data: MarketDataPackage,
        technical_indicators: TechnicalIndicators,
    ) -> Optional[str]:
        """
        Check if any required data field is missing or null.

        Args:
            ai_result: AI analysis result.
            market_data: Market data package.
            technical_indicators: Technical indicators.

        Returns:
            "Incomplete Data" if any field is null/missing, None otherwise.

        Requirements: 12.5
        """
        # Check critical AI result fields
        if ai_result.probability is None:
            return "Incomplete Data"
        if not ai_result.trend:
            return "Incomplete Data"
        if not ai_result.signal_type:
            return "Incomplete Data"

        # Check critical market data fields
        if market_data.spot_price is None or market_data.spot_price <= 0:
            return "Incomplete Data"
        if market_data.timestamp is None:
            return "Incomplete Data"

        # Check critical technical indicator fields
        if technical_indicators.atr is None or technical_indicators.atr <= 0:
            return "Incomplete Data"

        return None

    def _check_extreme_iv(self, contract: OptionsContract) -> Optional[str]:
        """
        Check if selected contract has extreme IV (> 100%).

        IV is stored as decimal, so > 1.0 means > 100%.

        Args:
            contract: Selected options contract.

        Returns:
            "Extreme IV" if IV > 100%, None otherwise.

        Requirements: 12.4
        """
        if contract.implied_volatility is not None:
            if contract.implied_volatility > self._max_iv:
                return "Extreme IV"
        return None

    def _check_liquidity(self, contract: OptionsContract) -> Optional[str]:
        """
        Check if selected contract has poor liquidity (spread > 5%).

        Args:
            contract: Selected options contract.

        Returns:
            "Poor Liquidity" if spread > 5%, None otherwise.

        Requirements: 12.6
        """
        if contract.spread_percentage > self._max_spread_pct:
            return "Poor Liquidity"
        return None

    def _create_hold_signal(self, probability: float, reason: str) -> Signal:
        """
        Create a HOLD signal with the given reason.

        Args:
            probability: AI probability (may be 0 if unavailable).
            reason: Hold reason string.

        Returns:
            Signal with HOLD type and specified reason.
        """
        return Signal(
            signal_type=ScalperSignalType.HOLD,
            probability=probability if probability is not None else 0.0,
            risk_reward_ratio=0.0,
            selected_contract=None,
            entry_price=None,
            target_price=None,
            stop_loss=None,
            hold_reason=reason,
        )

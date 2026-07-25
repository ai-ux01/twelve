"""
Liquidity Analyzer Service.

This service analyzes options contracts to identify illiquid contracts based on
multiple criteria:
- Wide bid-ask spread (spread > 5% of mid-price)
- Low volume (volume < 100)
- Low open interest (OI < 500)
- Deep out-of-the-money (> 10% away from ATM strike)

The service provides liquidity warnings for individual contracts and summary
metrics for the entire options chain.

Requirements: 7.1, 8.1
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class LiquidityWarning(BaseModel):
    """
    Liquidity warning flags for a single option contract.

    Attributes:
        wide_bid_ask_spread: True if bid-ask spread > 5% of mid-price
        low_volume: True if volume < 100
        low_oi: True if open interest < 500
        deep_otm: True if contract is > 10% away from ATM strike
    """

    wide_bid_ask_spread: bool = Field(
        default=False, description="Wide bid-ask spread (> 5% of mid-price)"
    )
    low_volume: bool = Field(default=False, description="Low volume (< 100)")
    low_oi: bool = Field(default=False, description="Low open interest (< 500)")
    deep_otm: bool = Field(default=False, description="Deep OTM (> 10% away from ATM)")

    @property
    def is_illiquid(self) -> bool:
        """
        Check if contract has any liquidity warnings.

        Returns:
            True if any warning flag is set
        """
        return (
            self.wide_bid_ask_spread or self.low_volume or self.low_oi or self.deep_otm
        )

    @property
    def warning_count(self) -> int:
        """
        Count the number of liquidity warnings.

        Returns:
            Number of warning flags set
        """
        return sum(
            [
                self.wide_bid_ask_spread,
                self.low_volume,
                self.low_oi,
                self.deep_otm,
            ]
        )


class ContractLiquidity(BaseModel):
    """
    Liquidity analysis for a single option contract.

    Attributes:
        strike_price: Strike price of the option
        option_type: Type of option (CALL or PUT)
        bid: Bid price
        ask: Ask price
        ltp: Last traded price
        mid_price: Mid-price (bid + ask) / 2
        bid_ask_spread: Absolute bid-ask spread (ask - bid)
        bid_ask_spread_percent: Bid-ask spread as percentage of mid-price
        volume: Trading volume
        open_interest: Open interest
        distance_from_atm_percent: Distance from ATM strike as percentage
        liquidity_warning: Liquidity warning flags
    """

    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field(..., description="Option type (CALL or PUT)")
    bid: float = Field(..., ge=0, description="Bid price")
    ask: float = Field(..., ge=0, description="Ask price")
    ltp: float = Field(..., ge=0, description="Last traded price")
    mid_price: float = Field(..., ge=0, description="Mid-price (bid+ask)/2")
    bid_ask_spread: float = Field(..., ge=0, description="Absolute bid-ask spread")
    bid_ask_spread_percent: float = Field(
        ..., ge=0, description="Bid-ask spread as % of mid-price"
    )
    volume: int = Field(..., ge=0, description="Trading volume")
    open_interest: int = Field(..., ge=0, description="Open interest")
    distance_from_atm_percent: float = Field(
        ..., description="Distance from ATM strike (%)"
    )
    liquidity_warning: Optional[LiquidityWarning] = Field(
        None, description="Liquidity warning flags"
    )


class LiquidityMetrics(BaseModel):
    """
    Summary liquidity metrics for the entire options chain.

    Attributes:
        total_contracts: Total number of contracts analyzed
        liquid_contracts: Number of liquid contracts (no warnings)
        illiquid_contracts: Number of illiquid contracts (any warning)
        average_volume: Average volume across all contracts
        average_oi: Average open interest across all contracts
        average_bid_ask_spread: Average bid-ask spread percentage
        wide_spread_count: Number of contracts with wide spreads
        low_volume_count: Number of contracts with low volume
        low_oi_count: Number of contracts with low OI
        deep_otm_count: Number of deep OTM contracts
        illiquid_contracts_list: List of illiquid contracts with details
    """

    total_contracts: int = Field(..., ge=0, description="Total contracts analyzed")
    liquid_contracts: int = Field(..., ge=0, description="Liquid contracts count")
    illiquid_contracts: int = Field(..., ge=0, description="Illiquid contracts count")
    average_volume: float = Field(..., ge=0, description="Average volume")
    average_oi: float = Field(..., ge=0, description="Average open interest")
    average_bid_ask_spread: float = Field(
        ..., ge=0, description="Average bid-ask spread (%)"
    )
    wide_spread_count: int = Field(..., ge=0, description="Contracts with wide spreads")
    low_volume_count: int = Field(..., ge=0, description="Contracts with low volume")
    low_oi_count: int = Field(..., ge=0, description="Contracts with low OI")
    deep_otm_count: int = Field(..., ge=0, description="Deep OTM contracts")
    illiquid_contracts_list: List[ContractLiquidity] = Field(
        default_factory=list, description="List of illiquid contracts"
    )


class OptionContractInput(BaseModel):
    """
    Input model for a single option contract to be analyzed.

    Attributes:
        strike_price: Strike price of the option
        option_type: Type of option (CALL or PUT)
        bid: Bid price
        ask: Ask price
        ltp: Last traded price
        volume: Trading volume
        open_interest: Open interest
    """

    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: str = Field(..., description="Option type (CALL or PUT)")
    bid: float = Field(..., ge=0, description="Bid price")
    ask: float = Field(..., ge=0, description="Ask price")
    ltp: float = Field(..., ge=0, description="Last traded price")
    volume: int = Field(..., ge=0, description="Trading volume")
    open_interest: int = Field(..., ge=0, description="Open interest")


class LiquidityAnalyzer:
    """
    Service for analyzing liquidity of options contracts.

    Identifies illiquid contracts based on:
    - Wide bid-ask spread (spread > 5% of mid-price)
    - Low volume (volume < 100)
    - Low open interest (OI < 500)
    - Deep OTM (> 10% away from ATM strike)

    Provides both individual contract warnings and summary metrics.

    Requirements: 7.1, 8.1
    """

    def __init__(
        self,
        wide_spread_threshold: float = 5.0,
        low_volume_threshold: int = 100,
        low_oi_threshold: int = 500,
        deep_otm_threshold: float = 10.0,
    ):
        """
        Initialize liquidity analyzer with configurable thresholds.

        Args:
            wide_spread_threshold: Spread % threshold for wide spreads (default: 5.0%)
            low_volume_threshold: Volume threshold for low volume (default: 100)
            low_oi_threshold: OI threshold for low OI (default: 500)
            deep_otm_threshold: Distance % threshold for deep OTM (default: 10.0%)
        """
        self.wide_spread_threshold = wide_spread_threshold
        self.low_volume_threshold = low_volume_threshold
        self.low_oi_threshold = low_oi_threshold
        self.deep_otm_threshold = deep_otm_threshold

    def analyze_liquidity(
        self,
        contracts: List[OptionContractInput],
        atm_strike: float,
    ) -> LiquidityMetrics:
        """
        Analyze liquidity for all contracts in the options chain.

        Args:
            contracts: List of option contracts to analyze
            atm_strike: ATM strike price for calculating OTM distance

        Returns:
            LiquidityMetrics with summary and list of illiquid contracts

        Raises:
            ValueError: If no contracts provided or invalid ATM strike
        """
        if not contracts:
            raise ValueError("No contracts provided for liquidity analysis")

        if atm_strike <= 0:
            raise ValueError(f"Invalid ATM strike: {atm_strike}")

        # Analyze each contract
        contract_liquidities = []
        for contract in contracts:
            liquidity = self._analyze_contract(contract, atm_strike)
            contract_liquidities.append(liquidity)

        # Calculate summary metrics
        metrics = self._calculate_summary_metrics(contract_liquidities)

        return metrics

    def _analyze_contract(
        self,
        contract: OptionContractInput,
        atm_strike: float,
    ) -> ContractLiquidity:
        """
        Analyze liquidity for a single contract.

        Args:
            contract: Option contract to analyze
            atm_strike: ATM strike price

        Returns:
            ContractLiquidity with liquidity warning flags
        """
        # Calculate mid-price
        mid_price = (
            (contract.bid + contract.ask) / 2.0
            if (contract.bid + contract.ask) > 0
            else contract.ltp
        )

        # Calculate bid-ask spread
        bid_ask_spread = contract.ask - contract.bid

        # Calculate spread percentage (avoid division by zero)
        if mid_price > 0:
            bid_ask_spread_percent = (bid_ask_spread / mid_price) * 100.0
        else:
            # If mid_price is 0, use a very high spread percentage
            bid_ask_spread_percent = 100.0

        # Calculate distance from ATM
        distance_from_atm_percent = (
            abs(contract.strike_price - atm_strike) / atm_strike
        ) * 100.0

        # Check liquidity warnings
        warning = LiquidityWarning(
            wide_bid_ask_spread=bid_ask_spread_percent > self.wide_spread_threshold,
            low_volume=contract.volume < self.low_volume_threshold,
            low_oi=contract.open_interest < self.low_oi_threshold,
            deep_otm=distance_from_atm_percent > self.deep_otm_threshold,
        )

        # Build contract liquidity result
        return ContractLiquidity(
            strike_price=contract.strike_price,
            option_type=contract.option_type,
            bid=contract.bid,
            ask=contract.ask,
            ltp=contract.ltp,
            mid_price=mid_price,
            bid_ask_spread=bid_ask_spread,
            bid_ask_spread_percent=bid_ask_spread_percent,
            volume=contract.volume,
            open_interest=contract.open_interest,
            distance_from_atm_percent=distance_from_atm_percent,
            liquidity_warning=warning,
        )

    def _calculate_summary_metrics(
        self,
        contract_liquidities: List[ContractLiquidity],
    ) -> LiquidityMetrics:
        """
        Calculate summary liquidity metrics for all contracts.

        Args:
            contract_liquidities: List of analyzed contracts

        Returns:
            LiquidityMetrics with summary statistics
        """
        total_contracts = len(contract_liquidities)

        # Count liquid vs illiquid contracts
        illiquid_contracts_list = [
            c
            for c in contract_liquidities
            if c.liquidity_warning and c.liquidity_warning.is_illiquid
        ]
        illiquid_count = len(illiquid_contracts_list)
        liquid_count = total_contracts - illiquid_count

        # Calculate averages
        if total_contracts > 0:
            average_volume = (
                sum(c.volume for c in contract_liquidities) / total_contracts
            )
            average_oi = (
                sum(c.open_interest for c in contract_liquidities) / total_contracts
            )
            average_bid_ask_spread = (
                sum(c.bid_ask_spread_percent for c in contract_liquidities)
                / total_contracts
            )
        else:
            average_volume = 0.0
            average_oi = 0.0
            average_bid_ask_spread = 0.0

        # Count specific warning types
        wide_spread_count = sum(
            1
            for c in contract_liquidities
            if c.liquidity_warning and c.liquidity_warning.wide_bid_ask_spread
        )
        low_volume_count = sum(
            1
            for c in contract_liquidities
            if c.liquidity_warning and c.liquidity_warning.low_volume
        )
        low_oi_count = sum(
            1
            for c in contract_liquidities
            if c.liquidity_warning and c.liquidity_warning.low_oi
        )
        deep_otm_count = sum(
            1
            for c in contract_liquidities
            if c.liquidity_warning and c.liquidity_warning.deep_otm
        )

        return LiquidityMetrics(
            total_contracts=total_contracts,
            liquid_contracts=liquid_count,
            illiquid_contracts=illiquid_count,
            average_volume=average_volume,
            average_oi=average_oi,
            average_bid_ask_spread=average_bid_ask_spread,
            wide_spread_count=wide_spread_count,
            low_volume_count=low_volume_count,
            low_oi_count=low_oi_count,
            deep_otm_count=deep_otm_count,
            illiquid_contracts_list=illiquid_contracts_list,
        )

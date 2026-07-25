"""
Options Chain Service.

This service processes options chain data to:
1. Calculate Greeks for all contracts in batch
2. Apply liquidity filtering based on volume, OI, and bid-ask spread
3. Identify illiquid contracts with warnings

Requirements: 7.1, 7.3
"""

from typing import List, Tuple
from datetime import datetime

from models.market_data import (
    OptionsChainContractRequest,
    OptionsChainContractResult,
    LiquidityWarning,
    OptionType,
)
from calculators.greeks import calculate_greeks_batch


class OptionsChainService:
    """
    Service for processing options chain data.
    
    Provides:
    - Batch Greeks calculation for entire options chain
    - Liquidity filtering and warning generation
    - Contract classification (liquid vs illiquid)
    
    Requirements: 7.1, 7.3
    """
    
    def __init__(
        self,
        min_volume: int = 100,
        min_oi: int = 500,
        max_spread_pct: float = 5.0,
    ):
        """
        Initialize options chain service.
        
        Args:
            min_volume: Minimum volume threshold for liquidity (default: 100)
            min_oi: Minimum open interest threshold for liquidity (default: 500)
            max_spread_pct: Maximum bid-ask spread percentage for liquidity (default: 5.0%)
        """
        self.min_volume = min_volume
        self.min_oi = min_oi
        self.max_spread_pct = max_spread_pct
    
    def process_options_chain(
        self,
        symbol: str,
        spot_price: float,
        expiry: datetime,
        contracts: List[OptionsChainContractRequest],
        risk_free_rate: float = 0.07,
    ) -> Tuple[List[OptionsChainContractResult], int, int]:
        """
        Process entire options chain: calculate Greeks and apply liquidity filtering.
        
        Args:
            symbol: Underlying symbol
            spot_price: Current spot price
            expiry: Expiry date
            contracts: List of option contracts to process
            risk_free_rate: Risk-free interest rate (default: 0.07)
        
        Returns:
            Tuple of:
            - List of processed contracts with Greeks and liquidity data
            - Number of liquid contracts
            - Number of illiquid contracts
        """
        # Step 1: Prepare contracts for batch Greeks calculation
        greeks_input = [
            {
                "strike_price": c.strike_price,
                "expiry_date": expiry,
                "volatility": c.volatility,
                "option_type": c.option_type.value,
            }
            for c in contracts
        ]
        
        # Step 2: Calculate Greeks in batch (optimized for performance)
        greeks_results = calculate_greeks_batch(
            spot_price=spot_price,
            contracts=greeks_input,
            risk_free_rate=risk_free_rate,
        )
        
        # Step 3: Process each contract with liquidity analysis
        processed_contracts = []
        liquid_count = 0
        illiquid_count = 0
        
        for i, contract in enumerate(contracts):
            greeks = greeks_results[i]
            
            # Analyze liquidity
            warnings, is_liquid = self._analyze_liquidity(contract)
            
            if is_liquid:
                liquid_count += 1
            else:
                illiquid_count += 1
            
            # Build result
            result = OptionsChainContractResult(
                strike_price=contract.strike_price,
                option_type=contract.option_type,
                ltp=contract.ltp,
                open_interest=contract.open_interest,
                volume=contract.volume,
                bid=contract.bid,
                ask=contract.ask,
                greeks={
                    "delta": greeks["delta"],
                    "gamma": greeks["gamma"],
                    "theta": greeks["theta"],
                    "vega": greeks["vega"],
                },
                iv=contract.volatility,
                liquidity_warnings=warnings,
                is_liquid=is_liquid,
            )
            
            processed_contracts.append(result)
        
        return processed_contracts, liquid_count, illiquid_count
    
    def _analyze_liquidity(
        self, contract: OptionsChainContractRequest
    ) -> Tuple[List[LiquidityWarning], bool]:
        """
        Analyze liquidity of an option contract.
        
        Checks:
        1. Volume >= min_volume
        2. Open Interest >= min_oi
        3. Bid-ask spread <= max_spread_pct (if bid/ask available)
        
        Args:
            contract: Option contract to analyze
        
        Returns:
            Tuple of (liquidity warnings, is_liquid)
        """
        warnings = []
        
        # Check volume
        if contract.volume < self.min_volume:
            warnings.append(LiquidityWarning.LOW_VOLUME)
        
        # Check open interest
        if contract.open_interest < self.min_oi:
            warnings.append(LiquidityWarning.LOW_OI)
        
        # Check bid-ask spread (if available)
        if contract.bid is not None and contract.ask is not None:
            if contract.bid > 0:  # Avoid division by zero
                spread_pct = ((contract.ask - contract.bid) / contract.bid) * 100
                if spread_pct > self.max_spread_pct:
                    warnings.append(LiquidityWarning.WIDE_SPREAD)
        
        # Determine if contract is illiquid
        # Contract is illiquid if it has 2 or more warnings
        is_liquid = len(warnings) < 2
        
        if not is_liquid and LiquidityWarning.ILLIQUID not in warnings:
            warnings.append(LiquidityWarning.ILLIQUID)
        
        # If no warnings, add NONE
        if not warnings:
            warnings.append(LiquidityWarning.NONE)
        
        return warnings, is_liquid

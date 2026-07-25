"""
Options Analysis Service.

This service performs deterministic analysis of options chain data for NIFTY and
BANKNIFTY options. It provides PCR (Put-Call Ratio) calculation, ATM strike
identification, OI buildup/unwinding detection, and support/resistance zone
identification from high OI concentrations.

This service is called by the Backend API OptionsService to provide structured
analysis results for options chain data.

Requirements: 7.1
"""

from typing import List, Optional, Tuple
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class OptionType(str, Enum):
    """Option type enumeration."""
    CALL = "CALL"
    PUT = "PUT"


class BuildupType(str, Enum):
    """OI buildup/unwinding type classification."""
    LONG_BUILDUP = "LONG_BUILDUP"  # Price up + OI up (bullish)
    SHORT_BUILDUP = "SHORT_BUILDUP"  # Price down + OI up (bearish)
    LONG_UNWINDING = "LONG_UNWINDING"  # Price down + OI down (bearish)
    SHORT_UNWINDING = "SHORT_UNWINDING"  # Price up + OI down (bullish)
    NEUTRAL = "NEUTRAL"  # No clear pattern


class OptionContractData(BaseModel):
    """
    Input model for a single option contract in the options chain.
    
    Attributes:
        strike_price: Strike price of the option
        option_type: Type of option (CALL or PUT)
        ltp: Last traded price
        open_interest: Current open interest
        change_in_oi: Change in open interest from previous period
        volume: Trading volume
    """
    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: OptionType = Field(..., description="Option type (CALL or PUT)")
    ltp: float = Field(..., ge=0, description="Last traded price")
    open_interest: int = Field(..., ge=0, description="Current open interest")
    change_in_oi: int = Field(..., description="Change in OI from previous period")
    volume: int = Field(..., ge=0, description="Trading volume")


class PCRAnalysis(BaseModel):
    """
    Put-Call Ratio (PCR) analysis result.
    
    PCR > 1.0 = Bearish (more puts than calls)
    PCR < 1.0 = Bullish (more calls than puts)
    PCR ≈ 1.0 = Neutral
    
    Attributes:
        pcr_by_oi: PCR calculated from open interest
        pcr_by_volume: PCR calculated from volume
        sentiment: Market sentiment based on PCR (BULLISH, BEARISH, NEUTRAL)
        total_call_oi: Total call open interest
        total_put_oi: Total put open interest
        total_call_volume: Total call volume
        total_put_volume: Total put volume
    """
    pcr_by_oi: float = Field(..., ge=0, description="PCR by open interest")
    pcr_by_volume: float = Field(..., ge=0, description="PCR by volume")
    sentiment: str = Field(..., description="Market sentiment (BULLISH, BEARISH, NEUTRAL)")
    total_call_oi: int = Field(..., ge=0, description="Total call OI")
    total_put_oi: int = Field(..., ge=0, description="Total put OI")
    total_call_volume: int = Field(..., ge=0, description="Total call volume")
    total_put_volume: int = Field(..., ge=0, description="Total put volume")


class NearATMStrike(BaseModel):
    """
    Near ATM strike data.
    
    Attributes:
        strike: Strike price
        distance_from_spot: Distance from spot price as percentage
        call_oi: Call open interest at this strike
        put_oi: Put open interest at this strike
        call_volume: Call volume at this strike
        put_volume: Put volume at this strike
    """
    strike: float = Field(..., gt=0, description="Strike price")
    distance_from_spot: float = Field(..., description="Distance from spot price (%)")
    call_oi: int = Field(..., ge=0, description="Call OI at this strike")
    put_oi: int = Field(..., ge=0, description="Put OI at this strike")
    call_volume: int = Field(..., ge=0, description="Call volume at this strike")
    put_volume: int = Field(..., ge=0, description="Put volume at this strike")


class ATMAnalysis(BaseModel):
    """
    ATM (At-The-Money) strike analysis result.
    
    Identifies the ATM strike (closest to current price) and near ATM strikes
    (±3 strikes from ATM).
    
    Attributes:
        spot_price: Current spot price
        atm_strike: ATM strike price (closest to spot)
        strike_interval: Interval between consecutive strikes
        near_atm_strikes: List of near ATM strikes (±3 strikes)
    """
    spot_price: float = Field(..., gt=0, description="Current spot price")
    atm_strike: float = Field(..., gt=0, description="ATM strike (closest to spot)")
    strike_interval: float = Field(..., gt=0, description="Strike interval")
    near_atm_strikes: List[NearATMStrike] = Field(
        ..., description="Near ATM strikes (±3 strikes)"
    )


class SupportResistanceLevel(BaseModel):
    """
    Support or resistance level identified from OI concentration.
    
    Attributes:
        strike: Strike price level
        strength: Strength of the level (0-1)
        reason: Explanation for why this is a support/resistance level
    """
    strike: float = Field(..., gt=0, description="Strike price level")
    strength: float = Field(..., ge=0, le=1, description="Strength (0-1)")
    reason: str = Field(..., description="Explanation for this level")


class OIChangeAnalysis(BaseModel):
    """
    Analysis of significant OI changes at specific strikes.
    
    Attributes:
        strike: Strike price
        call_oi_change: Call OI change
        put_oi_change: Put OI change
        interpretation: Interpretation of the OI change
    """
    strike: float = Field(..., gt=0, description="Strike price")
    call_oi_change: int = Field(..., description="Call OI change")
    put_oi_change: int = Field(..., description="Put OI change")
    interpretation: str = Field(..., description="Interpretation of OI change")


class OIAnalysis(BaseModel):
    """
    Open Interest (OI) buildup/unwinding analysis result.
    
    Analyzes OI patterns to detect:
    - Long buildup: Price up + OI up (bullish)
    - Short buildup: Price down + OI up (bearish)
    - Long unwinding: Price down + OI down (bearish)
    - Short unwinding: Price up + OI down (bullish)
    
    Also identifies support/resistance from high OI concentrations.
    
    Attributes:
        buildup_type: Type of OI buildup/unwinding
        explanation: Explanation of the buildup pattern
        support_levels: Identified support levels from put OI
        resistance_levels: Identified resistance levels from call OI
        max_call_oi_strike: Strike with maximum call OI
        max_put_oi_strike: Strike with maximum put OI
        oi_change_analysis: Analysis of significant OI changes
    """
    buildup_type: BuildupType = Field(..., description="OI buildup/unwinding type")
    explanation: str = Field(..., description="Explanation of buildup pattern")
    support_levels: List[SupportResistanceLevel] = Field(
        ..., description="Support levels from put OI"
    )
    resistance_levels: List[SupportResistanceLevel] = Field(
        ..., description="Resistance levels from call OI"
    )
    max_call_oi_strike: float = Field(..., gt=0, description="Strike with max call OI")
    max_put_oi_strike: float = Field(..., gt=0, description="Strike with max put OI")
    oi_change_analysis: List[OIChangeAnalysis] = Field(
        ..., description="Significant OI changes by strike"
    )


class OptionsAnalysisResult(BaseModel):
    """
    Complete options chain analysis result.
    
    This is the main result returned by the Options Analysis Service,
    containing PCR analysis, ATM identification, OI analysis, and
    support/resistance levels.
    
    Attributes:
        symbol: Symbol analyzed (NIFTY or BANKNIFTY)
        timestamp: Analysis timestamp
        pcr_analysis: Put-Call Ratio analysis
        atm_analysis: ATM strike identification
        oi_analysis: OI buildup/unwinding analysis
    """
    symbol: str = Field(..., description="Symbol (NIFTY or BANKNIFTY)")
    timestamp: datetime = Field(..., description="Analysis timestamp")
    pcr_analysis: PCRAnalysis = Field(..., description="PCR analysis")
    atm_analysis: ATMAnalysis = Field(..., description="ATM strike analysis")
    oi_analysis: OIAnalysis = Field(..., description="OI buildup/unwinding analysis")


class OptionsAnalysisService:
    """
    Service for analyzing options chain data.
    
    Provides deterministic analysis of options chain data including:
    - PCR (Put-Call Ratio) calculation from OI and Volume
    - ATM strike identification and near ATM strikes (±3 strikes)
    - OI buildup/unwinding detection
    - Support/resistance zone identification from high OI concentrations
    
    This service is called by the Backend API OptionsService.
    
    Requirements: 7.1
    """
    
    def __init__(
        self,
        pcr_bullish_threshold: float = 0.8,
        pcr_bearish_threshold: float = 1.2,
        near_atm_strikes_count: int = 3,
        support_resistance_oi_threshold: float = 0.5,
        significant_oi_change_threshold: int = 1000,
    ):
        """
        Initialize options analysis service.
        
        Args:
            pcr_bullish_threshold: PCR threshold for bullish sentiment (default: 0.8)
            pcr_bearish_threshold: PCR threshold for bearish sentiment (default: 1.2)
            near_atm_strikes_count: Number of strikes above/below ATM (default: 3)
            support_resistance_oi_threshold: OI threshold for support/resistance (default: 0.5)
            significant_oi_change_threshold: Threshold for significant OI change (default: 1000)
        """
        self.pcr_bullish_threshold = pcr_bullish_threshold
        self.pcr_bearish_threshold = pcr_bearish_threshold
        self.near_atm_strikes_count = near_atm_strikes_count
        self.support_resistance_oi_threshold = support_resistance_oi_threshold
        self.significant_oi_change_threshold = significant_oi_change_threshold
    
    def analyze(
        self,
        symbol: str,
        spot_price: float,
        contracts: List[OptionContractData],
    ) -> OptionsAnalysisResult:
        """
        Perform comprehensive options chain analysis.
        
        Analyzes the options chain to provide:
        1. PCR (Put-Call Ratio) from OI and Volume
        2. ATM strike identification and near ATM strikes
        3. OI buildup/unwinding detection
        4. Support/resistance levels from OI concentrations
        
        Args:
            symbol: Symbol (NIFTY or BANKNIFTY)
            spot_price: Current spot price
            contracts: List of option contracts in the chain
        
        Returns:
            OptionsAnalysisResult with complete analysis
        
        Raises:
            ValueError: If insufficient data provided
        """
        if not contracts:
            raise ValueError("No option contracts provided for analysis")
        
        # 1. PCR Analysis
        pcr_analysis = self._calculate_pcr_analysis(contracts)
        
        # 2. ATM Analysis
        atm_analysis = self._calculate_atm_analysis(spot_price, contracts)
        
        # 3. OI Analysis
        oi_analysis = self._calculate_oi_analysis(spot_price, contracts)
        
        # 4. Create result
        result = OptionsAnalysisResult(
            symbol=symbol,
            timestamp=datetime.utcnow(),
            pcr_analysis=pcr_analysis,
            atm_analysis=atm_analysis,
            oi_analysis=oi_analysis,
        )
        
        return result
    
    def _calculate_pcr_analysis(
        self, contracts: List[OptionContractData]
    ) -> PCRAnalysis:
        """
        Calculate Put-Call Ratio (PCR) from OI and Volume.
        
        PCR > 1.0 = Bearish (more puts than calls)
        PCR < 1.0 = Bullish (more calls than puts)
        PCR ≈ 1.0 = Neutral
        
        Args:
            contracts: List of option contracts
        
        Returns:
            PCRAnalysis with PCR ratios and sentiment
        """
        total_call_oi = 0
        total_put_oi = 0
        total_call_volume = 0
        total_put_volume = 0
        
        # Aggregate OI and Volume by option type
        for contract in contracts:
            if contract.option_type == OptionType.CALL:
                total_call_oi += contract.open_interest
                total_call_volume += contract.volume
            else:  # PUT
                total_put_oi += contract.open_interest
                total_put_volume += contract.volume
        
        # Calculate PCR by OI
        pcr_by_oi = total_put_oi / total_call_oi if total_call_oi > 0 else 0.0
        
        # Calculate PCR by Volume
        pcr_by_volume = total_put_volume / total_call_volume if total_call_volume > 0 else 0.0
        
        # Determine sentiment based on PCR by OI
        if pcr_by_oi > self.pcr_bearish_threshold:
            sentiment = "BEARISH"
        elif pcr_by_oi < self.pcr_bullish_threshold:
            sentiment = "BULLISH"
        else:
            sentiment = "NEUTRAL"
        
        return PCRAnalysis(
            pcr_by_oi=pcr_by_oi,
            pcr_by_volume=pcr_by_volume,
            sentiment=sentiment,
            total_call_oi=total_call_oi,
            total_put_oi=total_put_oi,
            total_call_volume=total_call_volume,
            total_put_volume=total_put_volume,
        )
    
    def _calculate_atm_analysis(
        self, spot_price: float, contracts: List[OptionContractData]
    ) -> ATMAnalysis:
        """
        Identify ATM strike (closest to spot) and near ATM strikes (±3 strikes).
        
        Args:
            spot_price: Current spot price
            contracts: List of option contracts
        
        Returns:
            ATMAnalysis with ATM strike and near ATM strikes
        """
        # Get unique strike prices
        strikes = sorted(list(set(c.strike_price for c in contracts)))
        
        if not strikes:
            raise ValueError("No strikes found in contracts")
        
        # Find ATM strike (closest to spot price)
        atm_strike = min(strikes, key=lambda x: abs(x - spot_price))
        
        # Determine strike interval
        strike_interval = strikes[1] - strikes[0] if len(strikes) > 1 else 50.0
        
        # Find near ATM strikes (±3 strikes from ATM)
        atm_index = strikes.index(atm_strike)
        start_index = max(0, atm_index - self.near_atm_strikes_count)
        end_index = min(len(strikes), atm_index + self.near_atm_strikes_count + 1)
        near_atm_strike_prices = strikes[start_index:end_index]
        
        # Build near ATM strikes data
        near_atm_strikes = []
        for strike in near_atm_strike_prices:
            # Find contracts for this strike
            call_contract = next(
                (c for c in contracts if c.strike_price == strike and c.option_type == OptionType.CALL),
                None
            )
            put_contract = next(
                (c for c in contracts if c.strike_price == strike and c.option_type == OptionType.PUT),
                None
            )
            
            distance_from_spot = ((strike - spot_price) / spot_price) * 100
            
            near_atm_strikes.append(
                NearATMStrike(
                    strike=strike,
                    distance_from_spot=distance_from_spot,
                    call_oi=call_contract.open_interest if call_contract else 0,
                    put_oi=put_contract.open_interest if put_contract else 0,
                    call_volume=call_contract.volume if call_contract else 0,
                    put_volume=put_contract.volume if put_contract else 0,
                )
            )
        
        return ATMAnalysis(
            spot_price=spot_price,
            atm_strike=atm_strike,
            strike_interval=strike_interval,
            near_atm_strikes=near_atm_strikes,
        )
    
    def _calculate_oi_analysis(
        self, spot_price: float, contracts: List[OptionContractData]
    ) -> OIAnalysis:
        """
        Analyze OI buildup/unwinding patterns and identify support/resistance.
        
        Patterns:
        - Long Buildup: Price up + OI up (bullish)
        - Short Buildup: Price down + OI up (bearish)
        - Long Unwinding: Price down + OI down (bearish)
        - Short Unwinding: Price up + OI down (bullish)
        
        Also identifies support/resistance from high OI concentrations.
        
        Args:
            spot_price: Current spot price
            contracts: List of option contracts
        
        Returns:
            OIAnalysis with buildup type and support/resistance levels
        """
        # Separate contracts by type
        call_contracts = [c for c in contracts if c.option_type == OptionType.CALL]
        put_contracts = [c for c in contracts if c.option_type == OptionType.PUT]
        
        # Find max OI strikes
        max_call_oi = max((c.open_interest for c in call_contracts), default=0)
        max_put_oi = max((c.open_interest for c in put_contracts), default=0)
        
        max_call_oi_strike = next(
            (c.strike_price for c in call_contracts if c.open_interest == max_call_oi),
            spot_price
        )
        max_put_oi_strike = next(
            (c.strike_price for c in put_contracts if c.open_interest == max_put_oi),
            spot_price
        )
        
        # Calculate total OI changes
        total_call_oi_change = sum(c.change_in_oi for c in call_contracts)
        total_put_oi_change = sum(c.change_in_oi for c in put_contracts)
        
        # Determine buildup type
        buildup_type, explanation = self._determine_buildup_type(
            total_call_oi_change, total_put_oi_change
        )
        
        # Identify support levels (high put OI below spot)
        support_levels = self._identify_support_levels(
            spot_price, put_contracts, max_put_oi
        )
        
        # Identify resistance levels (high call OI above spot)
        resistance_levels = self._identify_resistance_levels(
            spot_price, call_contracts, max_call_oi
        )
        
        # Analyze significant OI changes
        oi_change_analysis = self._analyze_oi_changes(contracts)
        
        return OIAnalysis(
            buildup_type=buildup_type,
            explanation=explanation,
            support_levels=support_levels,
            resistance_levels=resistance_levels,
            max_call_oi_strike=max_call_oi_strike,
            max_put_oi_strike=max_put_oi_strike,
            oi_change_analysis=oi_change_analysis,
        )
    
    def _determine_buildup_type(
        self, total_call_oi_change: int, total_put_oi_change: int
    ) -> Tuple[BuildupType, str]:
        """
        Determine OI buildup/unwinding type.
        
        Args:
            total_call_oi_change: Total change in call OI
            total_put_oi_change: Total change in put OI
        
        Returns:
            Tuple of (buildup_type, explanation)
        """
        # Note: We need price change data to fully determine buildup type
        # For now, we'll use OI change patterns as proxy
        
        if total_call_oi_change > 0 and total_put_oi_change > 0:
            # Both increasing - check which is dominant
            if total_call_oi_change > total_put_oi_change:
                return (
                    BuildupType.LONG_BUILDUP,
                    "Increasing call OI > put OI suggests bullish positioning"
                )
            else:
                return (
                    BuildupType.SHORT_BUILDUP,
                    "Increasing put OI > call OI suggests bearish positioning"
                )
        elif total_call_oi_change < 0 and total_put_oi_change < 0:
            # Both decreasing - check which is dominant
            if abs(total_call_oi_change) > abs(total_put_oi_change):
                return (
                    BuildupType.SHORT_UNWINDING,
                    "Decreasing call OI > put OI suggests short covering (bullish)"
                )
            else:
                return (
                    BuildupType.LONG_UNWINDING,
                    "Decreasing put OI > call OI suggests long unwinding (bearish)"
                )
        else:
            return (
                BuildupType.NEUTRAL,
                "Mixed OI changes, no clear directional bias"
            )
    
    def _identify_support_levels(
        self,
        spot_price: float,
        put_contracts: List[OptionContractData],
        max_put_oi: int,
    ) -> List[SupportResistanceLevel]:
        """
        Identify support levels from high put OI below spot price.
        
        Args:
            spot_price: Current spot price
            put_contracts: List of put contracts
            max_put_oi: Maximum put OI
        
        Returns:
            List of support levels
        """
        if max_put_oi == 0:
            return []
        
        # Filter puts below spot with significant OI
        support_candidates = [
            c for c in put_contracts
            if c.strike_price < spot_price
            and c.open_interest > max_put_oi * self.support_resistance_oi_threshold
        ]
        
        # Sort by OI (descending) and take top 3
        support_candidates.sort(key=lambda x: x.open_interest, reverse=True)
        support_candidates = support_candidates[:3]
        
        # Build support levels
        support_levels = []
        for contract in support_candidates:
            strength = contract.open_interest / max_put_oi
            reason = f"High put OI ({contract.open_interest:,}) suggests support"
            
            support_levels.append(
                SupportResistanceLevel(
                    strike=contract.strike_price,
                    strength=strength,
                    reason=reason,
                )
            )
        
        return support_levels
    
    def _identify_resistance_levels(
        self,
        spot_price: float,
        call_contracts: List[OptionContractData],
        max_call_oi: int,
    ) -> List[SupportResistanceLevel]:
        """
        Identify resistance levels from high call OI above spot price.
        
        Args:
            spot_price: Current spot price
            call_contracts: List of call contracts
            max_call_oi: Maximum call OI
        
        Returns:
            List of resistance levels
        """
        if max_call_oi == 0:
            return []
        
        # Filter calls above spot with significant OI
        resistance_candidates = [
            c for c in call_contracts
            if c.strike_price > spot_price
            and c.open_interest > max_call_oi * self.support_resistance_oi_threshold
        ]
        
        # Sort by OI (descending) and take top 3
        resistance_candidates.sort(key=lambda x: x.open_interest, reverse=True)
        resistance_candidates = resistance_candidates[:3]
        
        # Build resistance levels
        resistance_levels = []
        for contract in resistance_candidates:
            strength = contract.open_interest / max_call_oi
            reason = f"High call OI ({contract.open_interest:,}) suggests resistance"
            
            resistance_levels.append(
                SupportResistanceLevel(
                    strike=contract.strike_price,
                    strength=strength,
                    reason=reason,
                )
            )
        
        return resistance_levels
    
    def _analyze_oi_changes(
        self, contracts: List[OptionContractData]
    ) -> List[OIChangeAnalysis]:
        """
        Analyze significant OI changes by strike.
        
        Args:
            contracts: List of option contracts
        
        Returns:
            List of OI change analyses for significant changes
        """
        # Group by strike
        strikes_data = {}
        for contract in contracts:
            strike = contract.strike_price
            if strike not in strikes_data:
                strikes_data[strike] = {"call_oi_change": 0, "put_oi_change": 0}
            
            if contract.option_type == OptionType.CALL:
                strikes_data[strike]["call_oi_change"] = contract.change_in_oi
            else:
                strikes_data[strike]["put_oi_change"] = contract.change_in_oi
        
        # Find significant OI changes
        significant_changes = []
        for strike, data in strikes_data.items():
            call_change = data["call_oi_change"]
            put_change = data["put_oi_change"]
            
            # Check if change is significant
            if abs(call_change) > self.significant_oi_change_threshold or \
               abs(put_change) > self.significant_oi_change_threshold:
                
                # Interpret the change
                interpretation = self._interpret_oi_change(call_change, put_change)
                
                significant_changes.append(
                    OIChangeAnalysis(
                        strike=strike,
                        call_oi_change=call_change,
                        put_oi_change=put_change,
                        interpretation=interpretation,
                    )
                )
        
        # Sort by total absolute change (most significant first)
        significant_changes.sort(
            key=lambda x: abs(x.call_oi_change) + abs(x.put_oi_change),
            reverse=True
        )
        
        # Return top 5
        return significant_changes[:5]
    
    def _interpret_oi_change(
        self, call_oi_change: int, put_oi_change: int
    ) -> str:
        """
        Interpret OI change at a specific strike.
        
        Args:
            call_oi_change: Change in call OI
            put_oi_change: Change in put OI
        
        Returns:
            Interpretation string
        """
        if call_oi_change > 0 and put_oi_change > 0:
            return "Both call and put OI increasing - mixed positioning"
        elif call_oi_change > 0:
            return "Call writing/buying - potential resistance or bullish positioning"
        elif put_oi_change > 0:
            return "Put writing/buying - potential support or bearish positioning"
        elif call_oi_change < 0:
            return "Call unwinding - resistance weakening or position squaring"
        elif put_oi_change < 0:
            return "Put unwinding - support weakening or position squaring"
        else:
            return "No significant OI change"

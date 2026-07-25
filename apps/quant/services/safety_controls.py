"""
AI Safety Controls Service for Swing Trading.

This service implements safety controls that prevent trades when conditions
are not favorable. It validates recommendations against multiple criteria:

1. Score Thresholds: Minimum score requirements (default: 60)
2. Risk/Reward Ratios: Minimum risk/reward (default: 2.0)
3. Market Regime: Prevent trades in bearish markets
4. Data Completeness: Ensure all critical data is present
5. AI Confidence: Block trades below confidence threshold

All trade decisions are logged for audit trail.

Requirements: 5.7, 12.2
"""

import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


# Configure logging
logger = logging.getLogger(__name__)


class TradeDecision(str, Enum):
    """Trade decision outcomes."""

    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NO_TRADE = "NO_TRADE"


class SafetyViolation(BaseModel):
    """Individual safety violation."""

    rule: str = Field(..., description="Name of the safety rule violated")
    message: str = Field(..., description="Human-readable violation message")
    severity: str = Field(..., description="Severity: ERROR, WARNING")
    threshold: Optional[float] = Field(None, description="Threshold value for the rule")
    actual: Optional[float] = Field(
        None, description="Actual value that violated the rule"
    )


class SafetyCheckResult(BaseModel):
    """Result of safety controls validation."""

    decision: TradeDecision = Field(
        ..., description="Final decision: APPROVED, REJECTED, NO_TRADE"
    )
    violations: List[SafetyViolation] = Field(
        default_factory=list, description="List of safety violations"
    )
    passed: bool = Field(..., description="True if all safety checks passed")
    recommendation: str = Field(..., description="Recommendation text")
    checked_at: datetime = Field(
        default_factory=datetime.utcnow, description="Timestamp of safety check"
    )
    audit_log: Dict[str, Any] = Field(
        default_factory=dict, description="Complete audit trail of all checks"
    )


class SafetyThresholds(BaseModel):
    """Configurable safety thresholds."""

    min_score: float = Field(
        default=60.0,
        ge=0.0,
        le=100.0,
        description="Minimum total score required (default: 60)",
    )
    min_risk_reward: float = Field(
        default=2.0, ge=0.0, description="Minimum risk/reward ratio (default: 2.0)"
    )
    bear_market_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Bear market strength threshold to block trades (default: 0.7)",
    )
    min_ai_confidence: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Minimum AI confidence score (default: 0.6)",
    )
    require_support_resistance: bool = Field(
        default=True, description="Require support/resistance levels to be present"
    )
    require_trendlines: bool = Field(
        default=True, description="Require trendline analysis to be present"
    )


class SafetyControlsService:
    """
    Safety controls service for AI-powered swing trading.

    This service implements multiple layers of safety checks to prevent
    trades when conditions are not favorable:

    1. **Score Threshold**: Reject if total score < min_score (default: 60)
    2. **Risk/Reward**: Reject if risk/reward ratio < min_risk_reward (default: 2.0)
    3. **Market Regime**: Reject if bear market with strength > threshold
    4. **Data Completeness**: Reject if critical data is missing
    5. **AI Confidence**: Reject if AI confidence < min_confidence
    6. **AI NO_TRADE Signal**: Always reject if AI explicitly recommends NO_TRADE

    All checks are logged for complete audit trail.

    Usage:
        safety_controls = SafetyControlsService(thresholds=custom_thresholds)
        result = safety_controls.validate_recommendation(
            score=72.5,
            risk_reward_ratio=2.5,
            market_regime="BULL_MARKET",
            market_regime_strength=0.75,
            has_support_resistance=True,
            has_trendlines=True,
            ai_signal="BUY",
            ai_confidence=0.82
        )

        if result.passed:
            # Execute trade
        else:
            # Log violations and skip trade
            for violation in result.violations:
                logger.warning(f"{violation.rule}: {violation.message}")
    """

    def __init__(self, thresholds: Optional[SafetyThresholds] = None):
        """
        Initialize safety controls service.

        Args:
            thresholds: Custom safety thresholds (uses defaults if not provided)
        """
        self.thresholds = thresholds or SafetyThresholds()
        logger.info(
            f"SafetyControlsService initialized: "
            f"min_score={self.thresholds.min_score}, "
            f"min_risk_reward={self.thresholds.min_risk_reward}, "
            f"bear_market_threshold={self.thresholds.bear_market_threshold}, "
            f"min_ai_confidence={self.thresholds.min_ai_confidence}"
        )

    def validate_recommendation(
        self,
        score: float,
        risk_reward_ratio: float,
        market_regime: Optional[str] = None,
        market_regime_strength: Optional[float] = None,
        has_support_resistance: bool = False,
        has_trendlines: bool = False,
        ai_signal: Optional[str] = None,
        ai_confidence: Optional[float] = None,
        symbol: Optional[str] = None,
        additional_context: Optional[Dict[str, Any]] = None,
    ) -> SafetyCheckResult:
        """
        Validate a trade recommendation against all safety controls.

        This method performs comprehensive safety validation and returns
        a detailed result with all violations and audit trail.

        Args:
            score: Total swing trading score (0-100)
            risk_reward_ratio: Risk/reward ratio (e.g., 2.5 means 2.5:1)
            market_regime: Market regime ("BULL_MARKET", "BEAR_MARKET", etc.)
            market_regime_strength: Strength of market regime (0.0-1.0)
            has_support_resistance: Whether support/resistance data is present
            has_trendlines: Whether trendline analysis is present
            ai_signal: AI recommendation signal ("BUY", "SELL", "HOLD", "NO_TRADE")
            ai_confidence: AI confidence score (0.0-1.0)
            symbol: Trading symbol (for logging)
            additional_context: Additional context for audit trail

        Returns:
            SafetyCheckResult: Comprehensive validation result
        """
        violations: List[SafetyViolation] = []
        audit_log: Dict[str, Any] = {
            "symbol": symbol,
            "timestamp": datetime.utcnow().isoformat(),
            "inputs": {
                "score": score,
                "risk_reward_ratio": risk_reward_ratio,
                "market_regime": market_regime,
                "market_regime_strength": market_regime_strength,
                "has_support_resistance": has_support_resistance,
                "has_trendlines": has_trendlines,
                "ai_signal": ai_signal,
                "ai_confidence": ai_confidence,
            },
            "thresholds": self.thresholds.model_dump(),
            "checks_performed": [],
        }

        if additional_context:
            audit_log["additional_context"] = additional_context

        logger.info(f"Running safety checks for {symbol or 'unknown symbol'}")

        # Check 1: AI NO_TRADE Signal (highest priority)
        check_result = self._check_ai_no_trade_signal(ai_signal)
        audit_log["checks_performed"].append(check_result)
        if check_result["violation"]:
            violations.append(check_result["violation"])

        # Check 2: Score Threshold
        check_result = self._check_score_threshold(score)
        audit_log["checks_performed"].append(check_result)
        if check_result["violation"]:
            violations.append(check_result["violation"])

        # Check 3: Risk/Reward Ratio
        check_result = self._check_risk_reward(risk_reward_ratio)
        audit_log["checks_performed"].append(check_result)
        if check_result["violation"]:
            violations.append(check_result["violation"])

        # Check 4: Market Regime
        check_result = self._check_market_regime(market_regime, market_regime_strength)
        audit_log["checks_performed"].append(check_result)
        if check_result["violation"]:
            violations.append(check_result["violation"])

        # Check 5: Data Completeness
        check_result = self._check_data_completeness(
            has_support_resistance, has_trendlines
        )
        audit_log["checks_performed"].append(check_result)
        if check_result["violation"]:
            violations.append(check_result["violation"])

        # Check 6: AI Confidence
        check_result = self._check_ai_confidence(ai_confidence)
        audit_log["checks_performed"].append(check_result)
        if check_result["violation"]:
            violations.append(check_result["violation"])

        # Determine final decision
        passed = len(violations) == 0

        if not passed:
            # Count ERROR-level violations
            error_violations = [v for v in violations if v.severity == "ERROR"]

            if error_violations:
                decision = TradeDecision.NO_TRADE
                recommendation = (
                    f"NO TRADE recommended due to {len(error_violations)} safety violation(s). "
                    f"Violations: {', '.join(v.rule for v in error_violations)}"
                )
            else:
                # Only warnings - allow but flag
                decision = TradeDecision.APPROVED
                recommendation = (
                    f"Trade approved with {len(violations)} warning(s). "
                    f"Warnings: {', '.join(v.rule for v in violations)}"
                )
                passed = True  # Warnings don't block trades
        else:
            decision = TradeDecision.APPROVED
            recommendation = "All safety checks passed. Trade approved."

        audit_log["final_decision"] = {
            "decision": decision,
            "passed": passed,
            "total_violations": len(violations),
            "error_violations": len([v for v in violations if v.severity == "ERROR"]),
            "warning_violations": len(
                [v for v in violations if v.severity == "WARNING"]
            ),
        }

        result = SafetyCheckResult(
            decision=decision,
            violations=violations,
            passed=passed,
            recommendation=recommendation,
            checked_at=datetime.utcnow(),
            audit_log=audit_log,
        )

        # Log the decision
        if passed:
            logger.info(f"Safety check PASSED for {symbol}: {recommendation}")
        else:
            logger.warning(f"Safety check FAILED for {symbol}: {recommendation}")
            for violation in violations:
                logger.warning(
                    f"  - {violation.rule}: {violation.message} "
                    f"(severity: {violation.severity})"
                )

        return result

    def _check_ai_no_trade_signal(self, ai_signal: Optional[str]) -> Dict[str, Any]:
        """
        Check if AI explicitly recommended NO_TRADE.

        This is the highest priority check. If AI says NO_TRADE, we always reject.

        Args:
            ai_signal: AI signal ("BUY", "SELL", "HOLD", "NO_TRADE")

        Returns:
            Check result dictionary
        """
        check_name = "AI_NO_TRADE_SIGNAL"

        if ai_signal == "NO_TRADE":
            violation = SafetyViolation(
                rule=check_name,
                message="AI explicitly recommended NO_TRADE - conditions not favorable",
                severity="ERROR",
            )
            logger.warning(f"Check {check_name}: FAILED - AI recommended NO_TRADE")
            return {
                "check": check_name,
                "passed": False,
                "violation": violation,
            }

        logger.debug(f"Check {check_name}: PASSED - AI signal is {ai_signal}")
        return {
            "check": check_name,
            "passed": True,
            "violation": None,
        }

    def _check_score_threshold(self, score: float) -> Dict[str, Any]:
        """
        Check if score meets minimum threshold.

        Args:
            score: Total score (0-100)

        Returns:
            Check result dictionary
        """
        check_name = "SCORE_THRESHOLD"

        if score < self.thresholds.min_score:
            violation = SafetyViolation(
                rule=check_name,
                message=(
                    f"Score {score:.1f} is below minimum threshold "
                    f"{self.thresholds.min_score:.1f}"
                ),
                severity="ERROR",
                threshold=self.thresholds.min_score,
                actual=score,
            )
            logger.warning(
                f"Check {check_name}: FAILED - "
                f"Score {score:.1f} < {self.thresholds.min_score:.1f}"
            )
            return {
                "check": check_name,
                "passed": False,
                "violation": violation,
            }

        logger.debug(
            f"Check {check_name}: PASSED - "
            f"Score {score:.1f} >= {self.thresholds.min_score:.1f}"
        )
        return {
            "check": check_name,
            "passed": True,
            "violation": None,
        }

    def _check_risk_reward(self, risk_reward_ratio: float) -> Dict[str, Any]:
        """
        Check if risk/reward ratio meets minimum threshold.

        Args:
            risk_reward_ratio: Risk/reward ratio (e.g., 2.5 means 2.5:1)

        Returns:
            Check result dictionary
        """
        check_name = "RISK_REWARD_RATIO"

        if risk_reward_ratio < self.thresholds.min_risk_reward:
            violation = SafetyViolation(
                rule=check_name,
                message=(
                    f"Risk/reward ratio {risk_reward_ratio:.2f} is below minimum "
                    f"threshold {self.thresholds.min_risk_reward:.2f}"
                ),
                severity="ERROR",
                threshold=self.thresholds.min_risk_reward,
                actual=risk_reward_ratio,
            )
            logger.warning(
                f"Check {check_name}: FAILED - "
                f"R:R {risk_reward_ratio:.2f} < {self.thresholds.min_risk_reward:.2f}"
            )
            return {
                "check": check_name,
                "passed": False,
                "violation": violation,
            }

        logger.debug(
            f"Check {check_name}: PASSED - "
            f"R:R {risk_reward_ratio:.2f} >= {self.thresholds.min_risk_reward:.2f}"
        )
        return {
            "check": check_name,
            "passed": True,
            "violation": None,
        }

    def _check_market_regime(
        self,
        market_regime: Optional[str],
        market_regime_strength: Optional[float],
    ) -> Dict[str, Any]:
        """
        Check market regime and reject trades in strong bear markets.

        Args:
            market_regime: Market regime ("BULL_MARKET", "BEAR_MARKET", etc.)
            market_regime_strength: Strength of regime (0.0-1.0)

        Returns:
            Check result dictionary
        """
        check_name = "MARKET_REGIME"

        # If no market regime data, issue warning but don't block
        if market_regime is None or market_regime_strength is None:
            violation = SafetyViolation(
                rule=check_name,
                message="Market regime data not available",
                severity="WARNING",
            )
            logger.warning(f"Check {check_name}: WARNING - No market regime data")
            return {
                "check": check_name,
                "passed": True,  # Warning only
                "violation": violation,
            }

        # Block trades in strong bear markets
        if (
            market_regime == "BEAR_MARKET"
            and market_regime_strength > self.thresholds.bear_market_threshold
        ):
            violation = SafetyViolation(
                rule=check_name,
                message=(
                    f"Strong bear market detected (strength: {market_regime_strength:.2f}) - "
                    f"trading not recommended"
                ),
                severity="ERROR",
                threshold=self.thresholds.bear_market_threshold,
                actual=market_regime_strength,
            )
            logger.warning(
                f"Check {check_name}: FAILED - "
                f"Bear market strength {market_regime_strength:.2f} > "
                f"{self.thresholds.bear_market_threshold:.2f}"
            )
            return {
                "check": check_name,
                "passed": False,
                "violation": violation,
            }

        logger.debug(
            f"Check {check_name}: PASSED - "
            f"Market regime: {market_regime}, strength: {market_regime_strength:.2f}"
        )
        return {
            "check": check_name,
            "passed": True,
            "violation": None,
        }

    def _check_data_completeness(
        self,
        has_support_resistance: bool,
        has_trendlines: bool,
    ) -> Dict[str, Any]:
        """
        Check if critical technical analysis data is present.

        Args:
            has_support_resistance: Whether support/resistance data is present
            has_trendlines: Whether trendline data is present

        Returns:
            Check result dictionary
        """
        check_name = "DATA_COMPLETENESS"

        missing_data = []

        if self.thresholds.require_support_resistance and not has_support_resistance:
            missing_data.append("support/resistance levels")

        if self.thresholds.require_trendlines and not has_trendlines:
            missing_data.append("trendline analysis")

        if missing_data:
            violation = SafetyViolation(
                rule=check_name,
                message=(
                    f"Missing critical data: {', '.join(missing_data)}. "
                    f"Cannot make informed trading decision."
                ),
                severity="ERROR",
            )
            logger.warning(
                f"Check {check_name}: FAILED - Missing: {', '.join(missing_data)}"
            )
            return {
                "check": check_name,
                "passed": False,
                "violation": violation,
            }

        logger.debug(f"Check {check_name}: PASSED - All required data present")
        return {
            "check": check_name,
            "passed": True,
            "violation": None,
        }

    def _check_ai_confidence(self, ai_confidence: Optional[float]) -> Dict[str, Any]:
        """
        Check if AI confidence meets minimum threshold.

        Args:
            ai_confidence: AI confidence score (0.0-1.0)

        Returns:
            Check result dictionary
        """
        check_name = "AI_CONFIDENCE"

        # If no AI confidence provided, issue warning but don't block
        if ai_confidence is None:
            violation = SafetyViolation(
                rule=check_name,
                message="AI confidence score not available",
                severity="WARNING",
            )
            logger.warning(f"Check {check_name}: WARNING - No AI confidence data")
            return {
                "check": check_name,
                "passed": True,  # Warning only
                "violation": violation,
            }

        # Check against threshold
        if ai_confidence < self.thresholds.min_ai_confidence:
            violation = SafetyViolation(
                rule=check_name,
                message=(
                    f"AI confidence {ai_confidence:.2f} is below minimum threshold "
                    f"{self.thresholds.min_ai_confidence:.2f}"
                ),
                severity="ERROR",
                threshold=self.thresholds.min_ai_confidence,
                actual=ai_confidence,
            )
            logger.warning(
                f"Check {check_name}: FAILED - "
                f"Confidence {ai_confidence:.2f} < "
                f"{self.thresholds.min_ai_confidence:.2f}"
            )
            return {
                "check": check_name,
                "passed": False,
                "violation": violation,
            }

        logger.debug(
            f"Check {check_name}: PASSED - "
            f"Confidence {ai_confidence:.2f} >= "
            f"{self.thresholds.min_ai_confidence:.2f}"
        )
        return {
            "check": check_name,
            "passed": True,
            "violation": None,
        }

    def get_thresholds(self) -> SafetyThresholds:
        """
        Get current safety thresholds.

        Returns:
            SafetyThresholds: Current thresholds
        """
        return self.thresholds

    def update_thresholds(self, thresholds: SafetyThresholds):
        """
        Update safety thresholds.

        Args:
            thresholds: New thresholds to apply
        """
        self.thresholds = thresholds
        logger.info(f"Safety thresholds updated: {thresholds.model_dump()}")

"""
Symbol Validation Service for Options Trading.

This service validates trading symbols for options analysis, ensuring that
only NIFTY and BANKNIFTY symbols are accepted for options trading operations.
All other symbols are rejected with clear error messages.

This validator enforces requirement 7.1 (Options Scalping Analysis) by
restricting options trading to the two supported Indian index options, and
supports requirement 18.1 (Data Flow Architecture Enforcement) by providing
validation before data flows to downstream services.

Requirements: 7.1, 18.1
"""

import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum


# Configure logging
logger = logging.getLogger(__name__)


# Accepted symbols for options trading (NIFTY and BANKNIFTY only)
ACCEPTED_SYMBOLS = ["NIFTY", "BANKNIFTY"]


class ValidationStatus(str, Enum):
    """Symbol validation status."""

    VALID = "VALID"
    INVALID = "INVALID"


class SymbolValidationError(BaseModel):
    """Symbol validation error details."""

    symbol: str = Field(..., description="The symbol that failed validation")
    reason: str = Field(..., description="Reason for validation failure")
    accepted_symbols: List[str] = Field(
        ..., description="List of accepted symbols for options trading"
    )


class SymbolValidationResult(BaseModel):
    """Result of symbol validation."""

    status: ValidationStatus = Field(..., description="Validation status")
    symbol: str = Field(..., description="The symbol that was validated")
    is_valid: bool = Field(..., description="True if symbol is valid for options trading")
    error: Optional[SymbolValidationError] = Field(
        None, description="Error details if validation failed"
    )
    accepted_symbols: List[str] = Field(
        default_factory=lambda: ACCEPTED_SYMBOLS.copy(),
        description="List of accepted symbols for options trading",
    )


class SymbolValidator:
    """
    Symbol validation service for options trading.

    This validator ensures that only NIFTY and BANKNIFTY symbols are accepted
    for options trading operations. All other symbols are rejected with clear
    error messages indicating which symbols are supported.

    The validator supports requirement 7.1 by restricting options analysis to
    the two Indian index options that the system is designed to handle, and
    supports requirement 18.1 by providing validation before data flows to
    downstream analysis services.

    Usage:
        validator = SymbolValidator()
        result = validator.validate_symbol("NIFTY")

        if result.is_valid:
            # Proceed with options analysis
            pass
        else:
            # Return error to user
            logger.error(result.error.reason)

    Accepted Symbols:
        - NIFTY: NSE NIFTY 50 Index Options
        - BANKNIFTY: NSE BANK NIFTY Index Options

    Examples:
        >>> validator = SymbolValidator()
        >>> result = validator.validate_symbol("NIFTY")
        >>> result.is_valid
        True

        >>> result = validator.validate_symbol("RELIANCE")
        >>> result.is_valid
        False
        >>> result.error.reason
        'Symbol RELIANCE is not supported for options trading. Only NIFTY and BANKNIFTY are accepted.'
    """

    def __init__(self):
        """Initialize the symbol validator."""
        logger.info(
            f"SymbolValidator initialized. Accepted symbols: {', '.join(ACCEPTED_SYMBOLS)}"
        )

    def validate_symbol(self, symbol: str) -> SymbolValidationResult:
        """
        Validate a trading symbol for options operations.

        This method checks if the provided symbol is one of the accepted symbols
        (NIFTY or BANKNIFTY). Symbol comparison is case-insensitive and whitespace
        is trimmed.

        Args:
            symbol: Trading symbol to validate (e.g., "NIFTY", "BANKNIFTY")

        Returns:
            SymbolValidationResult: Validation result with status and error details

        Examples:
            >>> validator = SymbolValidator()
            >>> result = validator.validate_symbol("NIFTY")
            >>> result.is_valid
            True
            >>> result.status
            <ValidationStatus.VALID: 'VALID'>

            >>> result = validator.validate_symbol("nifty")  # Case-insensitive
            >>> result.is_valid
            True

            >>> result = validator.validate_symbol("RELIANCE")
            >>> result.is_valid
            False
            >>> result.error.reason
            'Symbol RELIANCE is not supported for options trading. Only NIFTY and BANKNIFTY are accepted.'
        """
        # Normalize symbol: strip whitespace and convert to uppercase
        normalized_symbol = symbol.strip().upper()

        logger.debug(f"Validating symbol: {symbol} (normalized: {normalized_symbol})")

        # Check if symbol is in accepted list
        if normalized_symbol in ACCEPTED_SYMBOLS:
            logger.info(f"Symbol validation PASSED: {normalized_symbol}")
            return SymbolValidationResult(
                status=ValidationStatus.VALID,
                symbol=normalized_symbol,
                is_valid=True,
                error=None,
                accepted_symbols=ACCEPTED_SYMBOLS.copy(),
            )

        # Symbol is not accepted - create error response
        error_message = (
            f"Symbol {normalized_symbol} is not supported for options trading. "
            f"Only {' and '.join(ACCEPTED_SYMBOLS)} are accepted."
        )

        logger.warning(f"Symbol validation FAILED: {normalized_symbol} - {error_message}")

        error = SymbolValidationError(
            symbol=normalized_symbol,
            reason=error_message,
            accepted_symbols=ACCEPTED_SYMBOLS.copy(),
        )

        return SymbolValidationResult(
            status=ValidationStatus.INVALID,
            symbol=normalized_symbol,
            is_valid=False,
            error=error,
            accepted_symbols=ACCEPTED_SYMBOLS.copy(),
        )

    def validate_symbols(self, symbols: List[str]) -> List[SymbolValidationResult]:
        """
        Validate multiple trading symbols for options operations.

        This method validates a list of symbols and returns individual validation
        results for each symbol.

        Args:
            symbols: List of trading symbols to validate

        Returns:
            List[SymbolValidationResult]: Validation results for each symbol

        Examples:
            >>> validator = SymbolValidator()
            >>> results = validator.validate_symbols(["NIFTY", "BANKNIFTY", "RELIANCE"])
            >>> [r.is_valid for r in results]
            [True, True, False]
            >>> results[2].error.reason
            'Symbol RELIANCE is not supported for options trading. Only NIFTY and BANKNIFTY are accepted.'
        """
        logger.info(f"Validating {len(symbols)} symbols: {', '.join(symbols)}")

        results = [self.validate_symbol(symbol) for symbol in symbols]

        valid_count = sum(1 for r in results if r.is_valid)
        invalid_count = len(results) - valid_count

        logger.info(
            f"Batch validation complete: {valid_count} valid, {invalid_count} invalid"
        )

        return results

    def get_accepted_symbols(self) -> List[str]:
        """
        Get the list of accepted symbols for options trading.

        Returns:
            List[str]: List of accepted symbols (NIFTY, BANKNIFTY)
        """
        return ACCEPTED_SYMBOLS.copy()

    def is_valid_symbol(self, symbol: str) -> bool:
        """
        Quick check if a symbol is valid without full validation result.

        This is a convenience method for simple boolean checks.

        Args:
            symbol: Trading symbol to check

        Returns:
            bool: True if symbol is valid, False otherwise

        Examples:
            >>> validator = SymbolValidator()
            >>> validator.is_valid_symbol("NIFTY")
            True
            >>> validator.is_valid_symbol("RELIANCE")
            False
        """
        normalized_symbol = symbol.strip().upper()
        return normalized_symbol in ACCEPTED_SYMBOLS

"""
Unit tests for Symbol Validator Service.

Tests the symbol validation logic for options trading, ensuring that only
NIFTY and BANKNIFTY symbols are accepted and all others are rejected with
appropriate error messages.

Requirements: 7.1, 18.1, 16.5
"""

import pytest
from validators.symbol_validator import (
    SymbolValidator,
    SymbolValidationResult,
    ValidationStatus,
    ACCEPTED_SYMBOLS,
)


class TestSymbolValidator:
    """Test suite for SymbolValidator."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = SymbolValidator()

    def test_validate_nifty_uppercase(self):
        """Test that NIFTY (uppercase) is accepted."""
        result = self.validator.validate_symbol("NIFTY")

        assert result.is_valid is True
        assert result.status == ValidationStatus.VALID
        assert result.symbol == "NIFTY"
        assert result.error is None
        assert "NIFTY" in result.accepted_symbols
        assert "BANKNIFTY" in result.accepted_symbols

    def test_validate_banknifty_uppercase(self):
        """Test that BANKNIFTY (uppercase) is accepted."""
        result = self.validator.validate_symbol("BANKNIFTY")

        assert result.is_valid is True
        assert result.status == ValidationStatus.VALID
        assert result.symbol == "BANKNIFTY"
        assert result.error is None

    def test_validate_nifty_lowercase(self):
        """Test that nifty (lowercase) is accepted (case-insensitive)."""
        result = self.validator.validate_symbol("nifty")

        assert result.is_valid is True
        assert result.status == ValidationStatus.VALID
        assert result.symbol == "NIFTY"  # Should be normalized to uppercase
        assert result.error is None

    def test_validate_banknifty_lowercase(self):
        """Test that banknifty (lowercase) is accepted (case-insensitive)."""
        result = self.validator.validate_symbol("banknifty")

        assert result.is_valid is True
        assert result.status == ValidationStatus.VALID
        assert result.symbol == "BANKNIFTY"  # Should be normalized to uppercase
        assert result.error is None

    def test_validate_nifty_mixed_case(self):
        """Test that NiFtY (mixed case) is accepted (case-insensitive)."""
        result = self.validator.validate_symbol("NiFtY")

        assert result.is_valid is True
        assert result.status == ValidationStatus.VALID
        assert result.symbol == "NIFTY"  # Should be normalized to uppercase
        assert result.error is None

    def test_validate_nifty_with_whitespace(self):
        """Test that NIFTY with leading/trailing whitespace is accepted."""
        result = self.validator.validate_symbol("  NIFTY  ")

        assert result.is_valid is True
        assert result.status == ValidationStatus.VALID
        assert result.symbol == "NIFTY"  # Should be trimmed and normalized
        assert result.error is None

    def test_validate_reliance_rejected(self):
        """Test that RELIANCE is rejected."""
        result = self.validator.validate_symbol("RELIANCE")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "RELIANCE"
        assert result.error is not None
        assert result.error.symbol == "RELIANCE"
        assert "RELIANCE" in result.error.reason
        assert "not supported" in result.error.reason
        assert "NIFTY" in result.error.reason
        assert "BANKNIFTY" in result.error.reason
        assert result.error.accepted_symbols == ACCEPTED_SYMBOLS

    def test_validate_tcs_rejected(self):
        """Test that TCS is rejected."""
        result = self.validator.validate_symbol("TCS")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "TCS"
        assert result.error is not None
        assert "TCS" in result.error.reason
        assert "not supported" in result.error.reason

    def test_validate_sensex_rejected(self):
        """Test that SENSEX is rejected."""
        result = self.validator.validate_symbol("SENSEX")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "SENSEX"
        assert result.error is not None

    def test_validate_finnifty_rejected(self):
        """Test that FINNIFTY is rejected (not in accepted list)."""
        result = self.validator.validate_symbol("FINNIFTY")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == "FINNIFTY"
        assert result.error is not None
        assert "FINNIFTY" in result.error.reason

    def test_validate_empty_string_rejected(self):
        """Test that empty string is rejected."""
        result = self.validator.validate_symbol("")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == ""
        assert result.error is not None

    def test_validate_whitespace_only_rejected(self):
        """Test that whitespace-only string is rejected."""
        result = self.validator.validate_symbol("   ")

        assert result.is_valid is False
        assert result.status == ValidationStatus.INVALID
        assert result.symbol == ""  # Should be trimmed to empty
        assert result.error is not None

    def test_validate_symbols_batch_all_valid(self):
        """Test batch validation with all valid symbols."""
        symbols = ["NIFTY", "BANKNIFTY"]
        results = self.validator.validate_symbols(symbols)

        assert len(results) == 2
        assert all(r.is_valid for r in results)
        assert results[0].symbol == "NIFTY"
        assert results[1].symbol == "BANKNIFTY"

    def test_validate_symbols_batch_all_invalid(self):
        """Test batch validation with all invalid symbols."""
        symbols = ["RELIANCE", "TCS", "INFY"]
        results = self.validator.validate_symbols(symbols)

        assert len(results) == 3
        assert all(not r.is_valid for r in results)
        assert all(r.error is not None for r in results)

    def test_validate_symbols_batch_mixed(self):
        """Test batch validation with mixed valid and invalid symbols."""
        symbols = ["NIFTY", "RELIANCE", "BANKNIFTY", "TCS"]
        results = self.validator.validate_symbols(symbols)

        assert len(results) == 4
        assert results[0].is_valid is True  # NIFTY
        assert results[1].is_valid is False  # RELIANCE
        assert results[2].is_valid is True  # BANKNIFTY
        assert results[3].is_valid is False  # TCS

    def test_validate_symbols_batch_with_case_variations(self):
        """Test batch validation with case variations."""
        symbols = ["nifty", "BANKNIFTY", "NiFtY"]
        results = self.validator.validate_symbols(symbols)

        assert len(results) == 3
        assert all(r.is_valid for r in results)
        assert results[0].symbol == "NIFTY"
        assert results[1].symbol == "BANKNIFTY"
        assert results[2].symbol == "NIFTY"

    def test_get_accepted_symbols(self):
        """Test getting the list of accepted symbols."""
        accepted = self.validator.get_accepted_symbols()

        assert isinstance(accepted, list)
        assert len(accepted) == 2
        assert "NIFTY" in accepted
        assert "BANKNIFTY" in accepted

    def test_get_accepted_symbols_returns_copy(self):
        """Test that get_accepted_symbols returns a copy, not reference."""
        accepted1 = self.validator.get_accepted_symbols()
        accepted2 = self.validator.get_accepted_symbols()

        # Modify one list
        accepted1.append("TEST")

        # Verify the other is unchanged (they are separate copies)
        assert len(accepted2) == 2
        assert "TEST" not in accepted2

    def test_is_valid_symbol_nifty(self):
        """Test is_valid_symbol convenience method with NIFTY."""
        assert self.validator.is_valid_symbol("NIFTY") is True

    def test_is_valid_symbol_banknifty(self):
        """Test is_valid_symbol convenience method with BANKNIFTY."""
        assert self.validator.is_valid_symbol("BANKNIFTY") is True

    def test_is_valid_symbol_invalid(self):
        """Test is_valid_symbol convenience method with invalid symbol."""
        assert self.validator.is_valid_symbol("RELIANCE") is False

    def test_is_valid_symbol_case_insensitive(self):
        """Test is_valid_symbol is case-insensitive."""
        assert self.validator.is_valid_symbol("nifty") is True
        assert self.validator.is_valid_symbol("BankNifty") is True

    def test_is_valid_symbol_with_whitespace(self):
        """Test is_valid_symbol handles whitespace."""
        assert self.validator.is_valid_symbol("  NIFTY  ") is True

    def test_error_contains_accepted_symbols(self):
        """Test that error response contains list of accepted symbols."""
        result = self.validator.validate_symbol("RELIANCE")

        assert result.error is not None
        assert result.error.accepted_symbols == ACCEPTED_SYMBOLS
        assert len(result.error.accepted_symbols) == 2

    def test_validation_result_always_contains_accepted_symbols(self):
        """Test that validation result always includes accepted symbols list."""
        valid_result = self.validator.validate_symbol("NIFTY")
        invalid_result = self.validator.validate_symbol("RELIANCE")

        assert valid_result.accepted_symbols == ACCEPTED_SYMBOLS
        assert invalid_result.accepted_symbols == ACCEPTED_SYMBOLS

    def test_error_reason_contains_both_accepted_symbols(self):
        """Test that error reason mentions both NIFTY and BANKNIFTY."""
        result = self.validator.validate_symbol("RELIANCE")

        assert result.error is not None
        assert "NIFTY" in result.error.reason
        assert "BANKNIFTY" in result.error.reason

    def test_validate_symbols_empty_list(self):
        """Test batch validation with empty list."""
        results = self.validator.validate_symbols([])

        assert results == []
        assert len(results) == 0

    def test_validate_symbols_single_item(self):
        """Test batch validation with single item."""
        results = self.validator.validate_symbols(["NIFTY"])

        assert len(results) == 1
        assert results[0].is_valid is True
        assert results[0].symbol == "NIFTY"


class TestSymbolValidatorEdgeCases:
    """Test edge cases and boundary conditions."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = SymbolValidator()

    def test_special_characters_rejected(self):
        """Test that symbols with special characters are rejected."""
        result = self.validator.validate_symbol("NIFTY@50")

        assert result.is_valid is False
        assert result.error is not None

    def test_numbers_only_rejected(self):
        """Test that numeric symbols are rejected."""
        result = self.validator.validate_symbol("12345")

        assert result.is_valid is False
        assert result.error is not None

    def test_partial_match_rejected(self):
        """Test that partial matches are rejected (e.g., 'NIFT' not 'NIFTY')."""
        result = self.validator.validate_symbol("NIFT")

        assert result.is_valid is False
        assert result.error is not None

    def test_superstring_match_rejected(self):
        """Test that superstrings are rejected (e.g., 'NIFTYX' not 'NIFTY')."""
        result = self.validator.validate_symbol("NIFTYX")

        assert result.is_valid is False
        assert result.error is not None

    def test_multiple_whitespaces(self):
        """Test symbol with multiple internal whitespaces."""
        result = self.validator.validate_symbol("NIFTY   50")

        # Should be rejected because after strip, it's "NIFTY   50" not "NIFTY"
        assert result.is_valid is False

    def test_newline_characters(self):
        """Test symbol with newline characters."""
        result = self.validator.validate_symbol("NIFTY\n")

        # After strip, should be "NIFTY" and valid
        assert result.is_valid is True
        assert result.symbol == "NIFTY"

    def test_tab_characters(self):
        """Test symbol with tab characters."""
        result = self.validator.validate_symbol("\tNIFTY\t")

        # After strip, should be "NIFTY" and valid
        assert result.is_valid is True
        assert result.symbol == "NIFTY"

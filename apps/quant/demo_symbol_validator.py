"""
Demonstration of Symbol Validator Service.

This script demonstrates the symbol validation functionality for options trading,
showing how NIFTY and BANKNIFTY are accepted while all other symbols are rejected.

Requirements: 7.1, 18.1
"""

from validators.symbol_validator import SymbolValidator


def main():
    """Demonstrate symbol validator functionality."""
    print("=" * 70)
    print("Symbol Validator Service - Demonstration")
    print("=" * 70)
    print()

    # Initialize validator
    validator = SymbolValidator()

    # Show accepted symbols
    print("Accepted Symbols for Options Trading:")
    for symbol in validator.get_accepted_symbols():
        print(f"  - {symbol}")
    print()

    # Test valid symbols
    print("-" * 70)
    print("Testing Valid Symbols:")
    print("-" * 70)

    valid_symbols = ["NIFTY", "BANKNIFTY", "nifty", "  BANKNIFTY  "]

    for symbol in valid_symbols:
        result = validator.validate_symbol(symbol)
        print(f"\nSymbol: '{symbol}'")
        print(f"  Status: {result.status}")
        print(f"  Is Valid: {result.is_valid}")
        print(f"  Normalized: {result.symbol}")

    # Test invalid symbols
    print()
    print("-" * 70)
    print("Testing Invalid Symbols:")
    print("-" * 70)

    invalid_symbols = ["RELIANCE", "TCS", "INFY", "FINNIFTY", "SENSEX"]

    for symbol in invalid_symbols:
        result = validator.validate_symbol(symbol)
        print(f"\nSymbol: '{symbol}'")
        print(f"  Status: {result.status}")
        print(f"  Is Valid: {result.is_valid}")
        if result.error:
            print(f"  Error: {result.error.reason}")

    # Test batch validation
    print()
    print("-" * 70)
    print("Testing Batch Validation:")
    print("-" * 70)

    batch_symbols = ["NIFTY", "RELIANCE", "BANKNIFTY", "TCS"]
    results = validator.validate_symbols(batch_symbols)

    print(f"\nValidating {len(batch_symbols)} symbols: {', '.join(batch_symbols)}")
    print()

    for result in results:
        status_icon = "✓" if result.is_valid else "✗"
        print(f"{status_icon} {result.symbol}: {result.status}")
        if result.error:
            print(f"    {result.error.reason}")

    # Test convenience method
    print()
    print("-" * 70)
    print("Testing Convenience Method (is_valid_symbol):")
    print("-" * 70)
    print()

    test_symbols = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS"]

    for symbol in test_symbols:
        is_valid = validator.is_valid_symbol(symbol)
        status_icon = "✓" if is_valid else "✗"
        print(f"{status_icon} {symbol}: {is_valid}")

    print()
    print("=" * 70)
    print("Demonstration Complete")
    print("=" * 70)


if __name__ == "__main__":
    main()

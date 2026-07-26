"""
Trade Analysis Engine Custom Exceptions.

Requirements: 1.2, 9.6
"""


class CSVParseError(Exception):
    """Raised when CSV parsing fails due to malformed content."""

    def __init__(self, message: str, row_number: int = 0, field_name: str = ""):
        self.message = message
        self.row_number = row_number
        self.field_name = field_name
        super().__init__(message)


class ValidationError(Exception):
    """Raised when input validation fails (e.g., manual trade entry)."""

    def __init__(self, message: str, field_errors: list = None):
        self.message = message
        self.field_errors = field_errors or []
        super().__init__(message)


class EnrichmentError(Exception):
    """Raised when trade enrichment fails (e.g., no historical data)."""

    def __init__(self, message: str, trade_id: str = ""):
        self.message = message
        self.trade_id = trade_id
        super().__init__(message)


class GroupingDimensionError(Exception):
    """Raised when an invalid grouping dimension is requested."""

    def __init__(self, dimension: str, valid_dimensions: list = None):
        self.dimension = dimension
        self.valid_dimensions = valid_dimensions or []
        self.message = (
            f"Invalid grouping dimension: '{dimension}'. "
            f"Valid dimensions: {', '.join(self.valid_dimensions)}"
        )
        super().__init__(self.message)


class AIAnalysisError(Exception):
    """Raised when AI analysis fails (e.g., OpenAI API error)."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)

"""
Backtesting Engine Rule Evaluator.

Evaluates entry conditions at each bar using AND-combination logic.
Supports comparators: GT, LT, GTE, LTE, EQ, CROSSES_ABOVE, CROSSES_BELOW.
Enforces no look-ahead by only accessing current or past bar data.
"""

from __future__ import annotations

import logging
import math
from typing import List, Union

from .indicator_engine import IndicatorEngine
from .models import RuleCondition, RuleConfig

logger = logging.getLogger(__name__)


class RuleEvaluator:
    """
    Evaluates entry rules against indicator values.

    Rules are AND-combined: all conditions in a rule must be true
    for the rule to trigger.
    Enforces look-ahead prevention by never accessing future bars.
    """

    def __init__(self, indicator_engine: IndicatorEngine):
        """
        Initialize RuleEvaluator.

        Args:
            indicator_engine: The indicator engine providing point-in-time values.
        """
        self.indicator_engine = indicator_engine

    def evaluate_entry(self, rules: List[RuleConfig], bar_index: int) -> bool:
        """
        Evaluate entry rules at a given bar index.

        Returns True if ANY rule is satisfied (OR across rules).
        Each rule's conditions are AND-combined.

        Args:
            rules: List of RuleConfig (OR-combined).
            bar_index: Current bar index to evaluate at.

        Returns:
            True if entry signal is triggered.
        """
        if not rules:
            return False

        for rule in rules:
            if self._evaluate_rule(rule, bar_index):
                return True

        return False

    def _evaluate_rule(self, rule: RuleConfig, bar_index: int) -> bool:
        """
        Evaluate a single rule (AND-combination of conditions).

        Args:
            rule: RuleConfig with conditions.
            bar_index: Current bar index.

        Returns:
            True if ALL conditions are satisfied.
        """
        if not rule.conditions:
            return False

        for condition in rule.conditions:
            if not self._evaluate_condition(condition, bar_index):
                return False

        return True

    def _evaluate_condition(self, condition: RuleCondition, bar_index: int) -> bool:
        """
        Evaluate a single condition.

        Args:
            condition: RuleCondition with indicator, comparator, value.
            bar_index: Current bar index.

        Returns:
            True if the condition is met.
        """
        # Get indicator value at current bar
        current_value = self.indicator_engine.get_value(condition.indicator, bar_index)

        if math.isnan(current_value):
            return False

        # Determine the threshold value
        threshold = self._resolve_value(condition.value, bar_index)
        if threshold is None or math.isnan(threshold):
            return False

        comparator = condition.comparator.upper()

        if comparator == "GT":
            return current_value > threshold
        elif comparator == "LT":
            return current_value < threshold
        elif comparator == "GTE":
            return current_value >= threshold
        elif comparator == "LTE":
            return current_value <= threshold
        elif comparator == "EQ":
            return abs(current_value - threshold) < 1e-10
        elif comparator == "CROSSES_ABOVE":
            return self._crosses_above(condition.indicator, condition.value, bar_index)
        elif comparator == "CROSSES_BELOW":
            return self._crosses_below(condition.indicator, condition.value, bar_index)
        else:
            logger.warning(f"Unknown comparator: {comparator}")
            return False

    def _resolve_value(self, value: Union[float, str], bar_index: int) -> float:
        """
        Resolve a condition value.

        If value is numeric, return it directly.
        If value is a string, treat it as an indicator name and get its value.

        Args:
            value: Numeric threshold or indicator name.
            bar_index: Current bar index.

        Returns:
            Resolved numeric value.
        """
        if isinstance(value, (int, float)):
            return float(value)

        # Treat as indicator name
        indicator_value = self.indicator_engine.get_value(str(value), bar_index)
        return indicator_value

    def _crosses_above(
        self, indicator: str, value: Union[float, str], bar_index: int
    ) -> bool:
        """
        CROSSES_ABOVE: value[i-1] <= threshold AND value[i] > threshold.

        Args:
            indicator: Indicator name.
            value: Threshold (numeric or indicator name).
            bar_index: Current bar index.

        Returns:
            True if indicator crossed above threshold.
        """
        if bar_index < 1:
            return False

        current_val = self.indicator_engine.get_value(indicator, bar_index)
        prev_val = self.indicator_engine.get_value(indicator, bar_index - 1)

        if math.isnan(current_val) or math.isnan(prev_val):
            return False

        current_threshold = self._resolve_value(value, bar_index)
        prev_threshold = self._resolve_value(value, bar_index - 1)

        if math.isnan(current_threshold) or math.isnan(prev_threshold):
            return False

        return prev_val <= prev_threshold and current_val > current_threshold

    def _crosses_below(
        self, indicator: str, value: Union[float, str], bar_index: int
    ) -> bool:
        """
        CROSSES_BELOW: value[i-1] >= threshold AND value[i] < threshold.

        Args:
            indicator: Indicator name.
            value: Threshold (numeric or indicator name).
            bar_index: Current bar index.

        Returns:
            True if indicator crossed below threshold.
        """
        if bar_index < 1:
            return False

        current_val = self.indicator_engine.get_value(indicator, bar_index)
        prev_val = self.indicator_engine.get_value(indicator, bar_index - 1)

        if math.isnan(current_val) or math.isnan(prev_val):
            return False

        current_threshold = self._resolve_value(value, bar_index)
        prev_threshold = self._resolve_value(value, bar_index - 1)

        if math.isnan(current_threshold) or math.isnan(prev_threshold):
            return False

        return prev_val >= prev_threshold and current_val < current_threshold

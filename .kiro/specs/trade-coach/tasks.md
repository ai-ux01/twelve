# Implementation Plan:

## Overview

Implementation plan for the AI Trade Coach feature (Phase 15). The module detects behavioral patterns from stored trades, generates AI coaching reports via GPT-4, and compares performance across paper/live/backtest sources. Backend at `apps/quant/trade_coach/`, frontend at `apps/web/app/trade-coach/`.

## Tasks

- [ ] 1. Create `apps/quant/trade_coach/__init__.py` with module docstring and exports (BehaviorDetector, ReportGenerator, SourceComparator, router)
- [ ] 2. Create `apps/quant/trade_coach/models.py` with enums (`BehaviorPattern` with 10 patterns, `BehaviorSeverity`), dataclasses (`BehaviorDetection`, `CoachReport`, `SourceMetrics`, `SourceComparison`), and Pydantic API models (`CoachRequest`, `CoachResponse`, `BehaviorDetectionResponse`, `BehaviorsResponse`, `CoachReportResponse`, `SourceMetricsResponse`, `SourceComparisonResponse`)
- [ ] 3. Create `apps/quant/trade_coach/behavior_detector.py` with `BehaviorDetector` class, configurable thresholds (portfolio_value=1_000_000, daily_threshold=5, weekly_threshold=20, revenge_window=5min, oversizing_pct=3%, chasing_pct=1%, weak_setup_threshold=50%, rr_threshold=1.5, early_exit_pct=50%, max_holding=30days), and the `_classify_severity(count, thresholds)` helper
- [ ] 4. Implement `detect_overtrading(trades)` — groups trades by entry_date day and week, flags days with >5 trades or weeks with >20 trades, assigns severity via thresholds (1, 3, 5)
- [ ] 5. Implement `detect_revenge_trading(trades)` — sorts trades by entry_date, identifies trades entered within 5 minutes of a losing trade's exit_date, assigns severity via thresholds (1, 3, 5)
- [ ] 6. Implement `detect_oversizing(trades)` — flags trades where entry_price × quantity exceeds 3% of portfolio value, assigns severity via thresholds (1, 3, 7)
- [ ] 7. Implement `detect_chasing(trades)` — for trades with stop_loss, computes fair value as midpoint of entry and stop, flags entry >1% deviation, assigns severity via thresholds (2, 5, 10)
- [ ] 8. Implement `detect_weak_setups(trades)` — flags trades with probability field < 50%, skips trades without probability, assigns severity via thresholds (2, 5, 10)
- [ ] 9. Implement `detect_counter_trend(trades)` — flags trades where market_regime is TRENDING and direction opposes RSI signal (RSI>50 + SHORT, or RSI<50 + LONG), assigns severity via thresholds (1, 3, 5)
- [ ] 10. Implement `detect_poor_risk_reward(trades)` — computes R:R from risk_reward_ratio or (exit-entry)/(entry-stop), flags R:R < 1.5, assigns severity via thresholds (3, 7, 15)
- [ ] 11. Implement `detect_moving_stops(trades)` — for trades with both stop_loss and MAE, flags where abs(MAE) > 1.2 × initial_stop_distance × quantity, assigns severity via thresholds (1, 3, 5)
- [ ] 12. Implement `detect_early_exits(trades)` — for winning trades with MFE, flags where realized_pnl < 50% of MFE, assigns severity via thresholds (2, 5, 10)
- [ ] 13. Implement `detect_late_exits(trades)` — flags trades with holding_period_days > 30, assigns severity via thresholds (1, 3, 5)
- [ ] 14. Implement `detect_all(trades)` — runs all 10 detectors, returns list of non-None BehaviorDetection results
- [ ] 15. Write property test: for any list of trades, detect_all returns only detections with count > 0 and severity is monotonically non-decreasing with increasing count [PBT]
- [ ] 16. Create `apps/quant/trade_coach/report_generator.py` with `ReportGenerator` class, system prompt enforcing no hallucination and JSON output format
- [ ] 17. Implement `_build_context(metrics, grouped, behaviors, total_trades)` — builds context string with aggregate metrics, grouped breakdowns by strategy/market_regime/time_of_day/setup, and detected behavior patterns
- [ ] 18. Implement `_generate_ai_report(context)` — calls GPT-4 with system prompt + context, returns CoachReport, retries 2 times with exponential backoff (1s, 2s)
- [ ] 19. Implement `_parse_report_json(content)` — strips markdown code fences, parses JSON into CoachReport dataclass
- [ ] 20. Implement `_generate_fallback_report(metrics, behaviors)` — rule-based report generation from metrics thresholds and behavior patterns
- [ ] 21. Implement `generate_report(trades, behaviors)` — orchestrates metrics computation via TradePerformanceCalculator and GroupingEngine, context building, AI generation with fallback on failure
- [ ] 22. Write property test: for any non-empty trades list, generate_report (using fallback path) returns CoachReport where all list fields are non-None and generated_at is set [PBT]
- [ ] 23. Create `apps/quant/trade_coach/source_comparator.py` with `SourceComparator` class and source keyword constants (PAPER_INDICATORS, BACKTEST_INDICATORS, LIVE_INDICATORS)
- [ ] 24. Implement `_determine_source(trade)` — checks strategy/setup fields for paper/backtest/live keywords, defaults to "live" when no indicators match
- [ ] 25. Implement `_classify_trades(trades)` — partitions all trades into paper/live/backtest lists using _determine_source
- [ ] 26. Implement `_compute_source_metrics(source, trades)` — computes SourceMetrics (win_rate, profit_factor, expectancy, average_r, total_pnl, max_drawdown) via TradePerformanceCalculator
- [ ] 27. Implement `_generate_insights(paper, live, backtest)` — generates insights for win rate gaps >10pp, profit factor divergence >1.5x, paper-vs-live >5pp gap, backtest-vs-live >10pp gap, best expectancy
- [ ] 28. Implement `compare_sources(trades)` — orchestrates classification, metrics computation, and insight generation into SourceComparison
- [ ] 29. Write property test: for any list of trades, _classify_trades produces three lists whose total length equals the input list length (no trade lost or duplicated) [PBT]
- [ ] 30. Create `apps/quant/trade_coach/router.py` with FastAPI router (prefix `/api/trade-coach`, tags `["trade-coach"]`), `get_repository()` function sharing TradeRepository with trade_analysis
- [ ] 31. Implement `POST /api/trade-coach/analyze` endpoint — accepts CoachRequest, fetches trades, applies time_range_days filter, runs detect_all + generate_report, returns CoachResponse
- [ ] 32. Implement `GET /api/trade-coach/behaviors` endpoint — accepts user_id query param, fetches trades, runs detect_all, returns BehaviorsResponse
- [ ] 33. Implement `GET /api/trade-coach/compare` endpoint — accepts user_id query param, fetches trades, runs compare_sources, returns SourceComparisonResponse
- [ ] 34. Register the trade_coach router in `apps/quant/main.py` using `from trade_coach.router import router as trade_coach_router` and `app.include_router(trade_coach_router)`
- [ ] 35. Create `apps/web/components/trade-coach/types.ts` with TypeScript interfaces matching API response models
- [ ] 36. Create `apps/web/components/trade-coach/CoachReport.tsx` — displays 7 report sections (strengths, weaknesses, best_setups, worst_setups, best_conditions, common_mistakes, recommendations) with loading state and empty state
- [ ] 37. Create `apps/web/components/trade-coach/BehaviorList.tsx` — renders detected behaviors with severity badges (color-coded: green/yellow/orange/red), counts, descriptions, and details
- [ ] 38. Create `apps/web/components/trade-coach/SourceComparison.tsx` — displays per-source metrics in comparison grid with insights list
- [ ] 39. Create `apps/web/components/trade-coach/index.ts` barrel export
- [ ] 40. Create `apps/web/app/trade-coach/page.tsx` — main page with header, "Analyze My Trading" button, parallel API calls to /analyze + /behaviors + /compare, loading/error states, renders CoachReport + BehaviorList + SourceComparison
- [ ] 41. Add sidebar navigation link for `/trade-coach` route
- [ ] 42. Write unit test: BehaviorDetector.detect_all with trades containing overtrading (6 trades in 1 day) returns overtrading detection
- [ ] 43. Write unit test: BehaviorDetector returns empty list for trades with no pattern violations
- [ ] 44. Write unit test: SourceComparator classifies trades with "paper" in strategy as paper source and trades with "backtest" in setup as backtest source
- [ ] 45. Write integration test: POST /api/trade-coach/analyze with pre-loaded trades returns valid CoachResponse with non-empty behaviors
- [ ] 46. Write integration test: GET /api/trade-coach/compare returns insights when trades from paper and live sources exist

## Task Dependency Graph

```json
{
  "waves": [
    [1, 2],
    [3, 16, 23, 35],
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18, 19, 20, 24, 25, 26, 27, 36, 37, 38],
    [14, 21, 28, 39],
    [15, 22, 29, 30, 40],
    [31, 32, 33, 41],
    [34],
    [42, 43, 44, 45, 46]
  ]
}
```

## Notes

- The trade_coach module already exists with a working implementation. These tasks document the complete feature for reference and any remaining work (tests, verification).
- All detection thresholds are configurable via class constructor or module-level constants.
- The GPT-4 integration follows the same pattern as trade_analysis/ai_analyzer.py (system prompt + factual context + retry with backoff).
- Frontend uses the same Tailwind CSS utility classes and component patterns as other pages in the app.

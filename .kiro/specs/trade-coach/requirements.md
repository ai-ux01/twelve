# Requirements Document

## Introduction

An AI Trade Coach feature at route `/trade-coach` that analyzes a trader's actual stored trades to detect behavioral patterns, compare performance across trade sources (paper, live, backtest), and generate structured coaching reports with strengths, weaknesses, best/worst setups, common mistakes, and actionable recommendations. All insights are derived from real database statistics — never fabricated.

## Glossary

- **Trade_Coach**: The Python backend module at `apps/quant/trade_coach/` that performs behavioral analysis and generates coaching reports.
- **Behavior_Detector**: The component that analyzes trade records to detect 10 specific negative behavioral patterns.
- **Report_Generator**: The component that uses GPT-4 to produce structured coaching reports grounded in factual trade statistics.
- **Source_Comparator**: The component that classifies trades by source (paper, live, backtest) and compares performance metrics across sources.
- **Coach_Report**: The structured output containing strengths, weaknesses, best setups, worst setups, best conditions, common mistakes, and recommendations.
- **Behavior_Detection**: A single detected instance of a negative trading pattern with severity, count, and affected trade IDs.
- **Trade_Repository**: The shared in-memory storage for trade records, provided by the trade_analysis module.
- **Performance_Calculator**: The existing `TradePerformanceCalculator` from trade_analysis that computes aggregate metrics (win rate, profit factor, expectancy, max drawdown, average R).
- **Grouping_Engine**: The existing `GroupingEngine` from trade_analysis that partitions trades by dimension and computes per-group metrics.
- **Frontend_Page**: The Next.js page at `apps/web/app/trade-coach/page.tsx` providing the UI for coaching interaction.
- **Source_Metrics**: Performance metrics computed for a single trade source (paper, live, or backtest).

## Requirements

### Requirement 1: Behavioral Pattern Detection

**User Story:** As a trader, I want the system to analyze my actual trades and detect negative behavioral patterns, so that I can identify and correct recurring mistakes.

#### Acceptance Criteria

1. WHEN trade records are provided, THE Behavior_Detector SHALL analyze them for overtrading (more than 5 trades per day or more than 20 per week).
2. WHEN trade records are provided, THE Behavior_Detector SHALL detect revenge trading (a new trade entered within 5 minutes of a losing trade exit).
3. WHEN trade records are provided, THE Behavior_Detector SHALL detect oversizing (position value exceeding 3% of portfolio value).
4. WHEN trade records are provided, THE Behavior_Detector SHALL detect chasing (entry price more than 1% away from fair value based on stop-loss midpoint).
5. WHEN trade records contain probability data, THE Behavior_Detector SHALL detect weak setups (probability below 50%).
6. WHEN trade records contain market regime and RSI data, THE Behavior_Detector SHALL detect counter-trend trades (direction opposing the dominant trend).
7. WHEN trade records contain stop-loss data, THE Behavior_Detector SHALL detect poor risk/reward (R:R ratio below 1.5).
8. WHEN trade records contain MAE data and stop-loss, THE Behavior_Detector SHALL detect potential stop-loss movement (MAE exceeding initial stop distance by more than 20%).
9. WHEN trade records contain MFE data, THE Behavior_Detector SHALL detect early exits (realized P&L below 50% of maximum favorable excursion for winning trades).
10. WHEN trade records are provided, THE Behavior_Detector SHALL detect late exits (holding period exceeding 30 days).
11. THE Behavior_Detector SHALL assign a severity level (low, medium, high, critical) to each detected pattern based on occurrence count.
12. THE Behavior_Detector SHALL return an empty list when no behavioral patterns are detected.

### Requirement 2: AI Coaching Report Generation

**User Story:** As a trader, I want an AI-generated coaching report that summarizes my strengths, weaknesses, best/worst setups, and provides actionable recommendations, so that I have a clear improvement plan.

#### Acceptance Criteria

1. WHEN trades and detected behaviors are provided, THE Report_Generator SHALL produce a Coach_Report containing strengths, weaknesses, best setups, worst setups, best conditions, common mistakes, and recommendations.
2. THE Report_Generator SHALL compute aggregate performance metrics and grouped breakdowns (by strategy, market regime, time of day, and setup) using Performance_Calculator and Grouping_Engine before generating the report.
3. THE Report_Generator SHALL pass factual trade statistics and detected behavior patterns as context to GPT-4.
4. THE Report_Generator SHALL instruct GPT-4 to reference only the provided statistics and to not fabricate data.
5. IF GPT-4 is unavailable or returns an error, THEN THE Report_Generator SHALL produce a fallback report using rule-based logic derived from metrics and behaviors.
6. WHEN no trade data exists for the user, THE Report_Generator SHALL return a report indicating no data is available with a recommendation to import trades.

### Requirement 3: Source Comparison Mode

**User Story:** As a trader, I want to compare my performance across paper trades, live trades, and backtest results, so that I can identify discrepancies between simulated and real execution.

#### Acceptance Criteria

1. WHEN trade records are provided, THE Source_Comparator SHALL classify each trade as paper, live, or backtest based on strategy and setup metadata fields.
2. WHEN trades are classified, THE Source_Comparator SHALL compute separate performance metrics (win rate, profit factor, expectancy, average R, total P&L, max drawdown) for each available source.
3. WHEN metrics for at least two sources are available, THE Source_Comparator SHALL generate comparison insights identifying significant gaps between sources.
4. WHEN paper trading win rate exceeds live trading win rate by more than 5 percentage points, THE Source_Comparator SHALL generate an insight about potential emotional interference in live trading.
5. WHEN backtest win rate exceeds live win rate by more than 10 percentage points, THE Source_Comparator SHALL generate an insight about potential slippage, emotions, or curve-fitting.
6. IF fewer than two sources have trade data, THEN THE Source_Comparator SHALL return an insight indicating insufficient data for comparison.

### Requirement 4: Backend API Endpoints

**User Story:** As a frontend developer, I want API endpoints for coaching analysis, behavior detection, and source comparison, so that the UI can retrieve coaching data.

#### Acceptance Criteria

1. THE Trade_Coach SHALL expose a POST endpoint at `/api/trade-coach/analyze` that accepts a user ID and optional time range, runs behavior detection and report generation, and returns the full coaching response.
2. THE Trade_Coach SHALL expose a GET endpoint at `/api/trade-coach/behaviors` that accepts a user ID query parameter and returns all detected behavior patterns.
3. THE Trade_Coach SHALL expose a GET endpoint at `/api/trade-coach/compare` that accepts a user ID query parameter and returns source comparison metrics and insights.
4. THE Trade_Coach SHALL share the Trade_Repository instance with the trade_analysis module to access the same stored trades.
5. WHEN no trade records exist for the requested user, THE Trade_Coach SHALL return a success response with empty results and a descriptive message.
6. WHEN the router module is created, THE Trade_Coach SHALL register the router in `apps/quant/main.py`.

### Requirement 5: Frontend Trade Coach Page

**User Story:** As a trader, I want a web page at `/trade-coach` with an "Analyze My Trading" button that displays my coaching report, detected behaviors, and source comparison, so that I can review my coaching insights visually.

#### Acceptance Criteria

1. THE Frontend_Page SHALL display an "Analyze My Trading" button that triggers all three API calls (analyze, behaviors, compare) in parallel.
2. WHEN analysis is in progress, THE Frontend_Page SHALL display a loading state and disable the analyze button.
3. WHEN the coaching report is received, THE Frontend_Page SHALL display strengths, weaknesses, best setups, worst setups, best conditions, common mistakes, and recommendations in organized sections.
4. WHEN behavior detections are received, THE Frontend_Page SHALL display each detected pattern with its severity, count, and description.
5. WHEN source comparison data is received, THE Frontend_Page SHALL display per-source metrics and generated insights.
6. IF an API call fails, THEN THE Frontend_Page SHALL display an error message without crashing.
7. THE Frontend_Page SHALL include a sidebar navigation link for the `/trade-coach` route.

### Requirement 6: Data Integrity

**User Story:** As a trader, I want all coaching insights to be derived from my actual stored trades, so that I can trust the accuracy of the analysis.

#### Acceptance Criteria

1. THE Trade_Coach SHALL read trade records exclusively from the Trade_Repository (shared in-memory storage).
2. THE Trade_Coach SHALL pass only factual, computed statistics as context to GPT-4 — the system prompt SHALL explicitly forbid hallucination.
3. THE Behavior_Detector SHALL base all pattern detection on measurable trade record fields (dates, prices, quantities, P&L, stop-loss, MFE, MAE, probability, market regime).
4. WHEN a detection requires enrichment data (MFE, MAE, market regime, RSI) that is absent from a trade record, THE Behavior_Detector SHALL skip that trade for that specific detection rather than fabricating values.

# Requirements Document

## Introduction

The Prompt Library is a centralized system for managing, versioning, and evaluating AI trading prompts used by the AI Trading Lab pipeline. It provides full CRUD operations with immutable versioning, category-based organization, performance tracking per prompt version, and a comparison interface. The system integrates with the AI Trading Lab (Phase 10) for prompt execution and Paper Trading (Phase 11) for performance metric collection.

## Glossary

- **Prompt_Library**: The backend module (`apps/quant/prompt_library/`) responsible for storing, versioning, and serving prompts via FastAPI endpoints.
- **Prompt_Manager**: The frontend page and components (`apps/web/app/prompts/`, `apps/web/components/prompt-library/`) that provide the user interface for managing prompts.
- **Prompt**: A structured text template used by the AI Trading Lab pipeline to generate trading recommendations.
- **Prompt_Version**: An immutable snapshot of a prompt's content at a specific point in time, identified by a version number.
- **Prompt_Category**: One of the predefined categories that classify prompts by their role in the trading pipeline (e.g., MASTER_AGENT, SWING_HUNTER, RISK_REVIEW).
- **Performance_Metrics**: A set of trading outcome measurements (win rate, profit factor, expectancy, average R, drawdown) associated with a specific prompt version.
- **In_Memory_Store**: A dictionary-based storage system used by the backend to persist prompt data during runtime.

## Requirements

### Requirement 1: Create Prompt

**User Story:** As a trader, I want to create new prompts with a category and content, so that I can define AI behavior for specific trading scenarios.

#### Acceptance Criteria

1. WHEN a user submits a valid prompt with a name, category, and content, THE Prompt_Library SHALL create a new prompt record with version 1 and return the created prompt with its identifier.
2. WHEN a user submits a prompt with an empty name or empty content, THE Prompt_Library SHALL reject the request and return a validation error indicating the missing field.
3. WHEN a user submits a prompt with an invalid category, THE Prompt_Library SHALL reject the request and return an error listing valid categories.
4. THE Prompt_Library SHALL assign a unique identifier (UUID) to each newly created prompt.
5. WHEN a prompt is created, THE Prompt_Library SHALL record the creation timestamp on the initial version.

### Requirement 2: Edit Prompt (Version Creation)

**User Story:** As a trader, I want to edit a prompt's content, so that I can improve its effectiveness while preserving the complete history.

#### Acceptance Criteria

1. WHEN a user submits an edit to an existing prompt's content, THE Prompt_Library SHALL create a new version with an incremented version number and store the updated content.
2. THE Prompt_Library SHALL preserve all previous versions unchanged when a new version is created.
3. WHEN a user attempts to edit a prompt that does not exist, THE Prompt_Library SHALL return a not-found error.
4. WHEN a new version is created, THE Prompt_Library SHALL record the creation timestamp on that version.
5. THE Prompt_Library SHALL allow updating the prompt name and category alongside content in a single edit operation.

### Requirement 3: Duplicate Prompt

**User Story:** As a trader, I want to duplicate an existing prompt, so that I can create variations without modifying the original.

#### Acceptance Criteria

1. WHEN a user duplicates an existing prompt, THE Prompt_Library SHALL create a new prompt with a new unique identifier, copying the latest version content from the source prompt.
2. WHEN a user duplicates a prompt, THE Prompt_Library SHALL set the duplicated prompt's version to 1.
3. WHEN a user attempts to duplicate a prompt that does not exist, THE Prompt_Library SHALL return a not-found error.
4. WHEN a prompt is duplicated, THE Prompt_Library SHALL append " (Copy)" to the original name for the new prompt's name.

### Requirement 4: Archive Prompt

**User Story:** As a trader, I want to archive prompts that are no longer active, so that I can keep my library organized without losing historical data.

#### Acceptance Criteria

1. WHEN a user archives a prompt, THE Prompt_Library SHALL mark the prompt as archived and exclude it from default listing queries.
2. WHEN a user requests the prompt list without a filter, THE Prompt_Library SHALL return only non-archived prompts.
3. WHEN a user requests the prompt list with an archived filter, THE Prompt_Library SHALL return only archived prompts.
4. WHEN a user attempts to archive a prompt that does not exist, THE Prompt_Library SHALL return a not-found error.
5. WHEN a user unarchives a prompt, THE Prompt_Library SHALL mark the prompt as active and include it in default listing queries.

### Requirement 5: Version Immutability

**User Story:** As a trader, I want prompt versions to be immutable, so that I can trust that historical performance data corresponds to exact prompt content.

#### Acceptance Criteria

1. THE Prompt_Library SHALL store each version as an immutable record that is never modified after creation.
2. WHEN a request attempts to modify an existing version's content, THE Prompt_Library SHALL reject the request and return an error.
3. THE Prompt_Library SHALL retain all versions of a prompt indefinitely, including versions of archived prompts.
4. WHEN a user requests a specific version of a prompt, THE Prompt_Library SHALL return the exact content stored at that version number.

### Requirement 6: Prompt Listing and Retrieval

**User Story:** As a trader, I want to list and filter prompts by category, so that I can quickly find the prompts relevant to my current trading strategy.

#### Acceptance Criteria

1. WHEN a user requests the prompt list, THE Prompt_Library SHALL return all non-archived prompts with their latest version information.
2. WHEN a user filters prompts by category, THE Prompt_Library SHALL return only prompts matching that category.
3. WHEN a user requests a specific prompt by identifier, THE Prompt_Library SHALL return the prompt metadata and all its version history.
4. WHEN a user requests a prompt that does not exist, THE Prompt_Library SHALL return a not-found error.

### Requirement 7: Test/Run Prompt

**User Story:** As a trader, I want to test a prompt version with sample inputs, so that I can evaluate its output quality before using it in live trading.

#### Acceptance Criteria

1. WHEN a user submits a test request with a prompt version identifier and sample input, THE Prompt_Library SHALL execute the prompt through the AI pipeline and return the generated output.
2. WHEN a user submits a test request for a prompt version that does not exist, THE Prompt_Library SHALL return a not-found error.
3. WHEN the AI pipeline returns an error during test execution, THE Prompt_Library SHALL return the error details to the user.
4. WHEN a test is executed, THE Prompt_Library SHALL record the test execution timestamp and input/output pair in memory.

### Requirement 8: Performance Tracking

**User Story:** As a trader, I want to track performance metrics per prompt version, so that I can identify which prompt versions produce better trading outcomes.

#### Acceptance Criteria

1. WHEN performance metrics are submitted for a prompt version, THE Prompt_Library SHALL store the metrics (trades count, win rate, profit factor, expectancy, average R, drawdown) associated with that version.
2. WHEN a user requests performance data for a prompt version, THE Prompt_Library SHALL return all recorded metrics for that version.
3. WHEN performance metrics are submitted for a prompt version that does not exist, THE Prompt_Library SHALL return a not-found error.
4. THE Prompt_Library SHALL accept incremental metric updates as new paper trades complete, recalculating aggregate metrics.

### Requirement 9: Compare Versions

**User Story:** As a trader, I want to compare performance metrics between prompt versions, so that I can determine which version produces better trading results.

#### Acceptance Criteria

1. WHEN a user requests a comparison between two or more prompt versions, THE Prompt_Library SHALL return the performance metrics of each version side by side.
2. WHEN a user requests a comparison including a version that does not exist, THE Prompt_Library SHALL return a not-found error.
3. WHEN a user requests a comparison, THE Prompt_Library SHALL include the content diff between the compared versions.

### Requirement 10: Category Management

**User Story:** As a trader, I want prompts organized by predefined categories, so that I can easily locate prompts by their role in the trading pipeline.

#### Acceptance Criteria

1. THE Prompt_Library SHALL support the following categories: MASTER_AGENT, MARKET_REGIME, SWING_HUNTER, INTRADAY, OPTIONS_SCALPING, TRADE_DETECTIVE, STRATEGY_RESEARCH, STRATEGY_BUILDER, BACKTEST_ANALYST, PROBABILITY_CALIBRATION, AGENT_SELF_EVALUATION, RISK_REVIEW, AGENT_SUPERVISOR.
2. WHEN a user requests the category list, THE Prompt_Library SHALL return all available categories.
3. THE Prompt_Library SHALL validate that every prompt belongs to exactly one category from the supported list.

### Requirement 11: Frontend Prompt Manager Page

**User Story:** As a trader, I want a dedicated page at /prompts to manage my prompt library, so that I can perform all prompt operations through a visual interface.

#### Acceptance Criteria

1. WHEN a user navigates to /prompts, THE Prompt_Manager SHALL display the prompt library interface with a list of prompts organized by category.
2. THE Prompt_Manager SHALL provide controls to create, edit, duplicate, archive, and test prompts.
3. THE Prompt_Manager SHALL display version history for each prompt with the ability to view and compare versions.
4. THE Prompt_Manager SHALL be accessible from the application sidebar navigation.
5. WHEN a user selects a prompt, THE Prompt_Manager SHALL display the prompt content, version history, and associated performance metrics.

### Requirement 12: Serialization

**User Story:** As a developer, I want prompts and versions to be serializable to JSON, so that the API can reliably transport prompt data between frontend and backend.

#### Acceptance Criteria

1. THE Prompt_Library SHALL serialize prompt records to JSON for API responses.
2. THE Prompt_Library SHALL deserialize JSON request bodies into prompt records for creation and editing.
3. FOR ALL valid prompt records, serializing then deserializing SHALL produce an equivalent prompt record (round-trip property).

# Implementation Plan: Prompt Library

## Overview

Build the Prompt Library system as a FastAPI backend module (`apps/quant/prompt_library/`) with in-memory storage and a Next.js frontend page at `/prompts`. Implementation follows the same patterns as `trading_lab` and `paper_trading` modules. Property-based tests use `hypothesis`.

## Tasks

- [ ] 1. Set up backend module structure and data models
  - [ ] 1.1 Create `apps/quant/prompt_library/__init__.py`, `models.py`, `store.py`, `router.py`
    - Define `PromptCategory` enum with all 13 categories
    - Define `PromptVersion`, `PromptRecord`, `PerformanceMetrics`, `TestExecution` dataclasses
    - Define all Pydantic request/response models (`CreatePromptRequest`, `EditPromptRequest`, `TestPromptRequest`, `UpdateMetricsRequest`, `PromptResponse`, `PromptDetailResponse`, `PromptVersionResponse`, `PerformanceMetricsResponse`, `CompareVersionsRequest`, `CompareVersionsResponse`)
    - _Requirements: 1.1, 1.4, 10.1, 12.1, 12.2_

  - [ ]* 1.2 Write property test for serialization round-trip
    - **Property 9: Serialization round-trip**
    - Generate random valid PromptRecord instances with hypothesis, serialize to JSON via Pydantic, deserialize back, verify equivalence
    - **Validates: Requirements 12.3**

- [ ] 2. Implement PromptStore with CRUD operations
  - [ ] 2.1 Implement `PromptStore.create_prompt`
    - Generate UUID, create initial PromptVersion with version=1, store in dict
    - Validate name and content are non-empty, category is valid
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.2 Implement `PromptStore.edit_prompt`
    - Validate prompt exists, create new PromptVersion with incremented version number
    - Optionally update name and category on the PromptRecord
    - Preserve all previous versions untouched
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1_

  - [ ] 2.3 Implement `PromptStore.duplicate_prompt`
    - Validate source exists, create new PromptRecord with new UUID, copy latest version content, set version=1, append " (Copy)" to name
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 2.4 Implement `PromptStore.archive_prompt` and `PromptStore.unarchive_prompt`
    - Set `is_archived` flag, retain all versions
    - _Requirements: 4.1, 4.4, 4.5, 5.3_

  - [ ] 2.5 Implement `PromptStore.list_prompts` with category and archived filters
    - Default: return non-archived only
    - Filter by category if provided
    - Filter by archived flag if provided
    - _Requirements: 4.2, 4.3, 6.1, 6.2_

  - [ ] 2.6 Implement `PromptStore.get_prompt` and `PromptStore.get_version`
    - Return full prompt with all versions, or specific version by number
    - _Requirements: 5.4, 6.3, 6.4_

  - [ ]* 2.7 Write property tests for prompt creation invariants
    - **Property 1: Prompt creation invariants**
    - Generate random valid name/category/content, create prompt, verify UUID, version=1, content match, timestamp present
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 2.8 Write property test for invalid input rejection
    - **Property 2: Invalid input rejection**
    - Generate whitespace-only names, empty content, invalid category strings, verify rejection
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.9 Write property test for version immutability and increment
    - **Property 3: Version immutability and increment**
    - Create a prompt, apply N random edits, verify version numbers are sequential 1..N+1 and all previous versions are unchanged
    - **Validates: Requirements 2.1, 2.2, 5.1, 5.4**

  - [ ]* 2.10 Write property test for duplication correctness
    - **Property 4: Duplication correctness**
    - Create prompts with K random edits, duplicate, verify new UUID, version=1, content=source latest, name has " (Copy)"
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [ ]* 2.11 Write property test for archive/unarchive listing partition
    - **Property 5: Archive/unarchive listing partition**
    - Create random prompts, archive a random subset, verify default list = active only, archived list = archived only, unarchive restores
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**

  - [ ]* 2.12 Write property test for category filter correctness
    - **Property 6: Category filter correctness**
    - Create prompts across random categories, filter by each, verify only matching returned
    - **Validates: Requirements 6.2**

- [ ] 3. Checkpoint - Ensure all store tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement performance metrics and comparison
  - [ ] 4.1 Implement `PromptStore.store_metrics` and `PromptStore.get_metrics`
    - Store metrics keyed by (prompt_id, version)
    - Validate prompt and version exist before storing
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 4.2 Implement comparison logic in store
    - Accept list of (prompt_id, version) pairs
    - Return metrics for each, compute unified diff between version contents
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 4.3 Write property test for performance metrics round-trip
    - **Property 7: Performance metrics round-trip**
    - Generate random valid metrics, store for a version, retrieve, verify equality
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 4.4 Write property test for version comparison completeness
    - **Property 8: Version comparison completeness**
    - Create versions with random content and metrics, compare, verify all metrics present and diff contains changes
    - **Validates: Requirements 9.1, 9.3**

- [ ] 5. Implement FastAPI router and register in main.py
  - [ ] 5.1 Create `prompt_library/router.py` with all endpoints
    - Implement GET /api/prompts (list with category/archived query params)
    - Implement POST /api/prompts (create)
    - Implement GET /api/prompts/{id} (detail with versions)
    - Implement PUT /api/prompts/{id} (edit/new version)
    - Implement POST /api/prompts/{id}/duplicate
    - Implement POST /api/prompts/{id}/archive
    - Implement POST /api/prompts/{id}/unarchive
    - Implement GET /api/prompts/{id}/versions/{version}
    - Implement POST /api/prompts/{id}/versions/{version}/test (call AI pipeline)
    - Implement GET /api/prompts/{id}/versions/{version}/metrics
    - Implement PUT /api/prompts/{id}/versions/{version}/metrics
    - Implement POST /api/prompts/compare
    - Implement GET /api/prompts/categories
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.4, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 9.1, 9.3, 10.2_

  - [ ] 5.2 Register router in `apps/quant/main.py`
    - Import and include prompt_library router following the paper_trading pattern
    - _Requirements: 6.1_

  - [ ]* 5.3 Write integration tests for router endpoints
    - Test create, edit, duplicate, archive, list, filter, metrics, compare endpoints
    - Use FastAPI TestClient
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 6.1, 8.1, 9.1_

- [ ] 6. Checkpoint - Ensure backend is complete and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement frontend prompt library page
  - [ ] 7.1 Create `apps/web/app/prompts/page.tsx`
    - Fetch prompt list from `/api/prompts`
    - Render category filter tabs and prompt grid
    - _Requirements: 11.1_

  - [ ] 7.2 Create `apps/web/components/prompt-library/PromptList.tsx` and `PromptCard.tsx`
    - Display prompt cards in a responsive grid
    - Each card shows name, category badge, latest version number, action buttons
    - _Requirements: 11.1, 11.2_

  - [ ] 7.3 Create `apps/web/components/prompt-library/PromptEditor.tsx`
    - Modal/dialog for creating and editing prompts
    - Name field, category dropdown, content textarea
    - Submit calls POST /api/prompts or PUT /api/prompts/{id}
    - _Requirements: 11.2_

  - [ ] 7.4 Create `apps/web/components/prompt-library/VersionHistory.tsx`
    - Display version list for a selected prompt
    - Show version number, timestamp, content preview
    - Allow selecting versions for comparison
    - _Requirements: 11.3_

  - [ ] 7.5 Create `apps/web/components/prompt-library/PerformancePanel.tsx`
    - Display performance metrics for selected version
    - Show trades count, win rate, profit factor, expectancy, average R, drawdown
    - _Requirements: 11.5_

  - [ ] 7.6 Create `apps/web/components/prompt-library/CompareView.tsx`
    - Side-by-side view of two versions with content diff and metrics comparison
    - _Requirements: 11.3_

  - [ ] 7.7 Create `apps/web/components/prompt-library/TestRunner.tsx`
    - Input area for test prompt input text
    - Execute button calls POST /api/prompts/{id}/versions/{version}/test
    - Display output result
    - _Requirements: 11.2_

  - [ ] 7.8 Create `apps/web/components/prompt-library/CategoryFilter.tsx`
    - Horizontal tab bar with all 13 categories plus "All" option
    - Clicking a category filters the prompt list
    - _Requirements: 11.1_

  - [ ] 7.9 Add sidebar navigation link for Prompts
    - Add `<Link href="/prompts">Prompts</Link>` to `apps/web/app/layout.tsx` sidebar nav
    - _Requirements: 11.4_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Backend uses Python/FastAPI with in-memory storage (same pattern as trading_lab and paper_trading)
- Frontend uses Next.js/TypeScript with React components
- Property tests use the `hypothesis` library with minimum 100 examples per test
- The test/run endpoint (7.1) integrates with the AI Trading Lab pipeline
- Performance metrics are intended to be updated by the Paper Trading system as trades complete

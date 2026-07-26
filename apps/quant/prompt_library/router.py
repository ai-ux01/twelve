"""
Prompt Library FastAPI Router.

Provides endpoints for prompt CRUD, versioning, performance metrics,
testing, and comparison.

Requirements: 1.1, 2.1, 3.1, 4.1, 5.4, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4,
              8.1, 8.2, 9.1, 9.3, 10.2
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from .models import (
    CompareVersionsRequest,
    CompareVersionsResponse,
    CreatePromptRequest,
    EditPromptRequest,
    PerformanceMetrics,
    PerformanceMetricsResponse,
    PromptCategory,
    PromptDetailResponse,
    PromptResponse,
    PromptVersionResponse,
    TestExecution,
    TestPromptRequest,
    UpdateMetricsRequest,
)
from .store import PromptStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/prompts", tags=["prompt-library"])

# Module-level store instance
_store = PromptStore()


def get_store() -> PromptStore:
    """Get the module-level PromptStore instance."""
    return _store


def _record_to_response(record) -> PromptResponse:
    """Convert a PromptRecord to a PromptResponse."""
    latest = record.versions[-1]
    return PromptResponse(
        id=record.id,
        name=record.name,
        category=record.category,
        latest_version=latest.version,
        latest_content=latest.content,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _version_to_response(version) -> PromptVersionResponse:
    """Convert a PromptVersion to a PromptVersionResponse."""
    return PromptVersionResponse(
        version=version.version,
        content=version.content,
        created_at=version.created_at,
        name=version.name,
        category=version.category,
    )


def _metrics_to_response(metrics: PerformanceMetrics) -> PerformanceMetricsResponse:
    """Convert PerformanceMetrics to PerformanceMetricsResponse."""
    return PerformanceMetricsResponse(
        prompt_id=metrics.prompt_id,
        version=metrics.version,
        trades_count=metrics.trades_count,
        win_rate=metrics.win_rate,
        profit_factor=metrics.profit_factor,
        expectancy=metrics.expectancy,
        average_r=metrics.average_r,
        max_drawdown=metrics.max_drawdown,
        updated_at=metrics.updated_at,
    )


# === Endpoints ===


@router.get("/categories", response_model=List[str])
async def list_categories():
    """
    List all available prompt categories.

    Returns:
        List of category values.
    """
    return [c.value for c in PromptCategory]


@router.get("", response_model=List[PromptResponse])
async def list_prompts(
    category: Optional[PromptCategory] = Query(None),
    archived: Optional[bool] = Query(None),
):
    """
    List prompts with optional filtering.

    Args:
        category: Optional category filter.
        archived: If true, show only archived. Default shows non-archived.

    Returns:
        List of prompts matching filters.
    """
    store = get_store()
    include_archived = archived if archived is not None else False
    records = store.list_prompts(category=category, include_archived=include_archived)
    return [_record_to_response(r) for r in records]


@router.post("", response_model=PromptResponse, status_code=201)
async def create_prompt(request: CreatePromptRequest):
    """
    Create a new prompt.

    Args:
        request: CreatePromptRequest with name, category, and content.

    Returns:
        The created prompt.

    Raises:
        HTTPException 422: If validation fails.
    """
    store = get_store()
    try:
        record = store.create_prompt(
            name=request.name,
            category=request.category,
            content=request.content,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return _record_to_response(record)


@router.get("/{prompt_id}", response_model=PromptDetailResponse)
async def get_prompt(prompt_id: str):
    """
    Get a prompt with full version history.

    Args:
        prompt_id: The prompt identifier.

    Returns:
        Detailed prompt with all versions and performance data.

    Raises:
        HTTPException 404: If prompt not found.
    """
    store = get_store()
    record = store.get_prompt(prompt_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    # Build version responses
    versions = [_version_to_response(v) for v in record.versions]

    # Gather performance metrics for all versions
    performance = {}
    for v in record.versions:
        m = store.get_metrics(prompt_id, v.version)
        if m is not None:
            performance[v.version] = _metrics_to_response(m)

    return PromptDetailResponse(
        id=record.id,
        name=record.name,
        category=record.category,
        is_archived=record.is_archived,
        created_at=record.created_at,
        updated_at=record.updated_at,
        versions=versions,
        performance=performance if performance else None,
    )


@router.put("/{prompt_id}", response_model=PromptResponse)
async def edit_prompt(prompt_id: str, request: EditPromptRequest):
    """
    Edit a prompt (creates a new version).

    Args:
        prompt_id: The prompt identifier.
        request: EditPromptRequest with new content and optional name/category.

    Returns:
        The updated prompt.

    Raises:
        HTTPException 404: If prompt not found.
        HTTPException 422: If validation fails.
    """
    store = get_store()
    try:
        record = store.edit_prompt(
            prompt_id=prompt_id,
            content=request.content,
            name=request.name,
            category=request.category,
        )
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return _record_to_response(record)


@router.post("/{prompt_id}/duplicate", response_model=PromptResponse, status_code=201)
async def duplicate_prompt(prompt_id: str):
    """
    Duplicate a prompt.

    Args:
        prompt_id: The source prompt identifier.

    Returns:
        The newly created duplicate prompt.

    Raises:
        HTTPException 404: If source prompt not found.
    """
    store = get_store()
    try:
        record = store.duplicate_prompt(prompt_id)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    return _record_to_response(record)


@router.post("/{prompt_id}/archive", response_model=PromptResponse)
async def archive_prompt(prompt_id: str):
    """
    Archive a prompt.

    Args:
        prompt_id: The prompt identifier.

    Returns:
        The updated prompt.

    Raises:
        HTTPException 404: If prompt not found.
    """
    store = get_store()
    try:
        record = store.archive_prompt(prompt_id)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    return _record_to_response(record)


@router.post("/{prompt_id}/unarchive", response_model=PromptResponse)
async def unarchive_prompt(prompt_id: str):
    """
    Unarchive a prompt.

    Args:
        prompt_id: The prompt identifier.

    Returns:
        The updated prompt.

    Raises:
        HTTPException 404: If prompt not found.
    """
    store = get_store()
    try:
        record = store.unarchive_prompt(prompt_id)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    return _record_to_response(record)


@router.get(
    "/{prompt_id}/versions/{version}", response_model=PromptVersionResponse
)
async def get_version(prompt_id: str, version: int):
    """
    Get a specific version of a prompt.

    Args:
        prompt_id: The prompt identifier.
        version: The version number.

    Returns:
        The prompt version.

    Raises:
        HTTPException 404: If prompt or version not found.
    """
    store = get_store()

    # Check prompt exists
    record = store.get_prompt(prompt_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    version_obj = store.get_version(prompt_id, version)
    if version_obj is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version} not found for prompt {prompt_id}",
        )

    return _version_to_response(version_obj)


@router.post("/{prompt_id}/versions/{version}/test")
async def test_prompt(prompt_id: str, version: int, request: TestPromptRequest):
    """
    Test/run a prompt version with sample input.

    This is a placeholder that will be connected to the AI pipeline later.

    Args:
        prompt_id: The prompt identifier.
        version: The version number.
        request: TestPromptRequest with input_text.

    Returns:
        Test execution result.

    Raises:
        HTTPException 404: If prompt or version not found.
    """
    store = get_store()

    # Validate prompt exists
    record = store.get_prompt(prompt_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    version_obj = store.get_version(prompt_id, version)
    if version_obj is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version} not found for prompt {prompt_id}",
        )

    # Placeholder: In production, this would call the AI pipeline
    now = datetime.utcnow()
    output_text = (
        f"[Placeholder] AI pipeline response for prompt '{version_obj.name}' "
        f"v{version} with input: {request.input_text}"
    )

    # Record the test execution
    execution = TestExecution(
        prompt_id=prompt_id,
        version=version,
        input_text=request.input_text,
        output_text=output_text,
        executed_at=now,
    )
    store.record_test(execution)

    return {
        "prompt_id": prompt_id,
        "version": version,
        "input_text": request.input_text,
        "output_text": output_text,
        "executed_at": now.isoformat(),
    }


@router.get(
    "/{prompt_id}/versions/{version}/metrics",
    response_model=Optional[PerformanceMetricsResponse],
)
async def get_metrics(prompt_id: str, version: int):
    """
    Get performance metrics for a prompt version.

    Args:
        prompt_id: The prompt identifier.
        version: The version number.

    Returns:
        Performance metrics, or null if none recorded.

    Raises:
        HTTPException 404: If prompt or version not found.
    """
    store = get_store()

    # Validate prompt and version exist
    record = store.get_prompt(prompt_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Prompt not found: {prompt_id}",
        )

    version_obj = store.get_version(prompt_id, version)
    if version_obj is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version} not found for prompt {prompt_id}",
        )

    metrics = store.get_metrics(prompt_id, version)
    if metrics is None:
        return None

    return _metrics_to_response(metrics)


@router.put(
    "/{prompt_id}/versions/{version}/metrics",
    response_model=PerformanceMetricsResponse,
)
async def update_metrics(
    prompt_id: str, version: int, request: UpdateMetricsRequest
):
    """
    Update performance metrics for a prompt version.

    Args:
        prompt_id: The prompt identifier.
        version: The version number.
        request: UpdateMetricsRequest with metrics data.

    Returns:
        The stored performance metrics.

    Raises:
        HTTPException 404: If prompt or version not found.
    """
    store = get_store()

    now = datetime.utcnow()
    metrics = PerformanceMetrics(
        prompt_id=prompt_id,
        version=version,
        trades_count=request.trades_count,
        win_rate=request.win_rate,
        profit_factor=request.profit_factor,
        expectancy=request.expectancy,
        average_r=request.average_r,
        max_drawdown=request.max_drawdown,
        updated_at=now,
    )

    try:
        store.store_metrics(prompt_id, version, metrics)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return _metrics_to_response(metrics)


@router.post("/compare", response_model=CompareVersionsResponse)
async def compare_versions(request: CompareVersionsRequest):
    """
    Compare multiple prompt versions.

    Args:
        request: CompareVersionsRequest with version_ids list.

    Returns:
        Comparison data including versions, metrics, and content diffs.

    Raises:
        HTTPException 404: If any prompt or version not found.
    """
    store = get_store()

    try:
        versions, metrics, diffs = store.compare_versions(request.version_ids)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return CompareVersionsResponse(
        versions=[_version_to_response(v) for v in versions],
        metrics=[_metrics_to_response(m) if m else None for m in metrics],
        content_diffs=diffs,
    )

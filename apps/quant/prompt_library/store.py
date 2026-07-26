"""
Prompt Library Store.

In-memory storage for prompt records, versions, performance metrics,
and test executions. Data is persisted to JSON file.

Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5,
              3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5,
              5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 8.3,
              9.1, 9.2, 9.3
"""

from __future__ import annotations

import dataclasses
import difflib
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from .models import (
    PerformanceMetrics,
    PromptCategory,
    PromptRecord,
    PromptVersion,
    TestExecution,
)

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from persistence.json_store import JsonFileStore

logger = logging.getLogger(__name__)


class PromptStore:
    """
    In-memory store for Prompt Library records with JSON file persistence.

    Stores prompt records with immutable versioning, performance metrics,
    and test execution history. Automatically persists to data/prompt_library.json.
    """

    def __init__(self):
        """Initialize the prompt store with empty storage and load persisted data."""
        self._store = JsonFileStore("prompt_library")
        self._prompts: Dict[str, PromptRecord] = {}
        self._metrics: Dict[str, Dict[int, PerformanceMetrics]] = {}
        self._test_executions: List[TestExecution] = []
        self._load()

    def _load(self) -> None:
        """Load persisted data from JSON file."""
        raw_data = self._store.get_all()
        if not raw_data:
            return

        # Load prompts
        prompts_data = raw_data.get("prompts", {})
        for prompt_id, pdata in prompts_data.items():
            versions = [
                PromptVersion(
                    version=v["version"],
                    content=v["content"],
                    created_at=datetime.fromisoformat(v["created_at"]) if isinstance(v["created_at"], str) else v["created_at"],
                    name=v["name"],
                    category=PromptCategory(v["category"]) if isinstance(v["category"], str) else v["category"],
                )
                for v in pdata.get("versions", [])
            ]
            self._prompts[prompt_id] = PromptRecord(
                id=pdata["id"],
                name=pdata["name"],
                category=PromptCategory(pdata["category"]) if isinstance(pdata["category"], str) else pdata["category"],
                versions=versions,
                is_archived=pdata.get("is_archived", False),
                created_at=datetime.fromisoformat(pdata["created_at"]) if isinstance(pdata.get("created_at"), str) else pdata.get("created_at", datetime.utcnow()),
                updated_at=datetime.fromisoformat(pdata["updated_at"]) if isinstance(pdata.get("updated_at"), str) else pdata.get("updated_at", datetime.utcnow()),
            )

        # Load metrics
        metrics_data = raw_data.get("metrics", {})
        for prompt_id, versions_metrics in metrics_data.items():
            self._metrics[prompt_id] = {}
            for ver_str, mdata in versions_metrics.items():
                self._metrics[prompt_id][int(ver_str)] = PerformanceMetrics(
                    prompt_id=mdata["prompt_id"],
                    version=mdata["version"],
                    trades_count=mdata["trades_count"],
                    win_rate=mdata["win_rate"],
                    profit_factor=mdata["profit_factor"],
                    expectancy=mdata["expectancy"],
                    average_r=mdata["average_r"],
                    max_drawdown=mdata["max_drawdown"],
                    updated_at=datetime.fromisoformat(mdata["updated_at"]) if isinstance(mdata.get("updated_at"), str) else mdata.get("updated_at", datetime.utcnow()),
                )

        # Load test executions
        test_data = raw_data.get("test_executions", [])
        for tdata in test_data:
            self._test_executions.append(TestExecution(
                prompt_id=tdata["prompt_id"],
                version=tdata["version"],
                input_text=tdata["input_text"],
                output_text=tdata["output_text"],
                executed_at=datetime.fromisoformat(tdata["executed_at"]) if isinstance(tdata.get("executed_at"), str) else tdata.get("executed_at", datetime.utcnow()),
            ))

    def _save(self) -> None:
        """Persist all data to JSON file."""
        # Serialize prompts
        prompts_data: Dict[str, Any] = {}
        for prompt_id, record in self._prompts.items():
            versions = [
                {
                    "version": v.version,
                    "content": v.content,
                    "created_at": v.created_at.isoformat() if isinstance(v.created_at, datetime) else v.created_at,
                    "name": v.name,
                    "category": v.category.value if isinstance(v.category, PromptCategory) else v.category,
                }
                for v in record.versions
            ]
            prompts_data[prompt_id] = {
                "id": record.id,
                "name": record.name,
                "category": record.category.value if isinstance(record.category, PromptCategory) else record.category,
                "versions": versions,
                "is_archived": record.is_archived,
                "created_at": record.created_at.isoformat() if isinstance(record.created_at, datetime) else record.created_at,
                "updated_at": record.updated_at.isoformat() if isinstance(record.updated_at, datetime) else record.updated_at,
            }

        # Serialize metrics
        metrics_data: Dict[str, Any] = {}
        for prompt_id, versions_metrics in self._metrics.items():
            metrics_data[prompt_id] = {}
            for ver, m in versions_metrics.items():
                metrics_data[prompt_id][str(ver)] = {
                    "prompt_id": m.prompt_id,
                    "version": m.version,
                    "trades_count": m.trades_count,
                    "win_rate": m.win_rate,
                    "profit_factor": m.profit_factor,
                    "expectancy": m.expectancy,
                    "average_r": m.average_r,
                    "max_drawdown": m.max_drawdown,
                    "updated_at": m.updated_at.isoformat() if isinstance(m.updated_at, datetime) else m.updated_at,
                }

        # Serialize test executions
        test_data = [
            {
                "prompt_id": t.prompt_id,
                "version": t.version,
                "input_text": t.input_text,
                "output_text": t.output_text,
                "executed_at": t.executed_at.isoformat() if isinstance(t.executed_at, datetime) else t.executed_at,
            }
            for t in self._test_executions
        ]

        self._store.set_all({
            "prompts": prompts_data,
            "metrics": metrics_data,
            "test_executions": test_data,
        })

    def create_prompt(
        self, name: str, category: PromptCategory, content: str
    ) -> PromptRecord:
        """
        Create a new prompt with initial version.

        Args:
            name: The prompt name (must be non-empty).
            category: The prompt category.
            content: The prompt content (must be non-empty).

        Returns:
            The created PromptRecord.

        Raises:
            ValueError: If name or content is empty/whitespace-only.
        """
        # Validate inputs
        if not name or not name.strip():
            raise ValueError("Prompt name cannot be empty")
        if not content or not content.strip():
            raise ValueError("Prompt content cannot be empty")

        now = datetime.utcnow()
        prompt_id = str(uuid4())

        # Create initial version
        version = PromptVersion(
            version=1,
            content=content,
            created_at=now,
            name=name,
            category=category,
        )

        # Create prompt record
        record = PromptRecord(
            id=prompt_id,
            name=name,
            category=category,
            versions=[version],
            is_archived=False,
            created_at=now,
            updated_at=now,
        )

        self._prompts[prompt_id] = record
        self._save()
        logger.debug(f"Created prompt {prompt_id}: {name} ({category.value})")
        return record

    def edit_prompt(
        self,
        prompt_id: str,
        content: str,
        name: Optional[str] = None,
        category: Optional[PromptCategory] = None,
    ) -> PromptRecord:
        """
        Edit a prompt by creating a new version.

        Args:
            prompt_id: The prompt identifier.
            content: The new content (must be non-empty).
            name: Optional new name for the prompt.
            category: Optional new category for the prompt.

        Returns:
            The updated PromptRecord.

        Raises:
            KeyError: If prompt does not exist.
            ValueError: If content is empty/whitespace-only.
        """
        if prompt_id not in self._prompts:
            raise KeyError(f"Prompt not found: {prompt_id}")

        if not content or not content.strip():
            raise ValueError("Prompt content cannot be empty")

        if name is not None and not name.strip():
            raise ValueError("Prompt name cannot be empty")

        record = self._prompts[prompt_id]
        now = datetime.utcnow()

        # Update name and category on the record if provided
        if name is not None:
            record.name = name
        if category is not None:
            record.category = category

        # Create new version with incremented number
        new_version_number = len(record.versions) + 1
        new_version = PromptVersion(
            version=new_version_number,
            content=content,
            created_at=now,
            name=record.name,
            category=record.category,
        )

        record.versions.append(new_version)
        record.updated_at = now

        self._save()
        logger.debug(
            f"Edited prompt {prompt_id}: created version {new_version_number}"
        )
        return record

    def duplicate_prompt(self, prompt_id: str) -> PromptRecord:
        """
        Duplicate an existing prompt.

        Creates a new prompt with a new UUID, copies the latest version content,
        sets version=1, and appends " (Copy)" to the name.

        Args:
            prompt_id: The source prompt identifier.

        Returns:
            The newly created PromptRecord.

        Raises:
            KeyError: If source prompt does not exist.
        """
        if prompt_id not in self._prompts:
            raise KeyError(f"Prompt not found: {prompt_id}")

        source = self._prompts[prompt_id]
        latest_version = source.versions[-1]

        # Create new prompt with copied content
        new_name = f"{source.name} (Copy)"
        return self.create_prompt(
            name=new_name,
            category=source.category,
            content=latest_version.content,
        )

    def archive_prompt(self, prompt_id: str) -> PromptRecord:
        """
        Archive a prompt.

        Args:
            prompt_id: The prompt identifier.

        Returns:
            The updated PromptRecord.

        Raises:
            KeyError: If prompt does not exist.
        """
        if prompt_id not in self._prompts:
            raise KeyError(f"Prompt not found: {prompt_id}")

        record = self._prompts[prompt_id]
        record.is_archived = True
        record.updated_at = datetime.utcnow()

        self._save()
        logger.debug(f"Archived prompt {prompt_id}")
        return record

    def unarchive_prompt(self, prompt_id: str) -> PromptRecord:
        """
        Unarchive a prompt.

        Args:
            prompt_id: The prompt identifier.

        Returns:
            The updated PromptRecord.

        Raises:
            KeyError: If prompt does not exist.
        """
        if prompt_id not in self._prompts:
            raise KeyError(f"Prompt not found: {prompt_id}")

        record = self._prompts[prompt_id]
        record.is_archived = False
        record.updated_at = datetime.utcnow()

        self._save()
        logger.debug(f"Unarchived prompt {prompt_id}")
        return record

    def list_prompts(
        self,
        category: Optional[PromptCategory] = None,
        include_archived: bool = False,
    ) -> List[PromptRecord]:
        """
        List prompts with optional filtering.

        Args:
            category: Optional category filter.
            include_archived: If True, return only archived prompts.
                If False (default), return only non-archived prompts.

        Returns:
            List of matching PromptRecords.
        """
        results = []
        for record in self._prompts.values():
            # Filter by archived status
            if include_archived:
                if not record.is_archived:
                    continue
            else:
                if record.is_archived:
                    continue

            # Filter by category if specified
            if category is not None and record.category != category:
                continue

            results.append(record)

        return results

    def get_prompt(self, prompt_id: str) -> Optional[PromptRecord]:
        """
        Get a prompt by identifier.

        Args:
            prompt_id: The prompt identifier.

        Returns:
            The PromptRecord, or None if not found.
        """
        return self._prompts.get(prompt_id)

    def get_version(
        self, prompt_id: str, version: int
    ) -> Optional[PromptVersion]:
        """
        Get a specific version of a prompt.

        Args:
            prompt_id: The prompt identifier.
            version: The version number (1-indexed).

        Returns:
            The PromptVersion, or None if not found.
        """
        record = self._prompts.get(prompt_id)
        if record is None:
            return None

        for v in record.versions:
            if v.version == version:
                return v

        return None

    def store_metrics(
        self, prompt_id: str, version: int, metrics: PerformanceMetrics
    ) -> None:
        """
        Store performance metrics for a prompt version.

        Args:
            prompt_id: The prompt identifier.
            version: The version number.
            metrics: The performance metrics to store.

        Raises:
            KeyError: If prompt or version does not exist.
        """
        if prompt_id not in self._prompts:
            raise KeyError(f"Prompt not found: {prompt_id}")

        # Validate version exists
        version_obj = self.get_version(prompt_id, version)
        if version_obj is None:
            raise KeyError(
                f"Version {version} not found for prompt {prompt_id}"
            )

        if prompt_id not in self._metrics:
            self._metrics[prompt_id] = {}

        self._metrics[prompt_id][version] = metrics
        self._save()
        logger.debug(f"Stored metrics for prompt {prompt_id} v{version}")

    def get_metrics(
        self, prompt_id: str, version: int
    ) -> Optional[PerformanceMetrics]:
        """
        Get performance metrics for a prompt version.

        Args:
            prompt_id: The prompt identifier.
            version: The version number.

        Returns:
            The PerformanceMetrics, or None if not found.
        """
        prompt_metrics = self._metrics.get(prompt_id)
        if prompt_metrics is None:
            return None
        return prompt_metrics.get(version)

    def compare_versions(
        self, version_ids: List[Dict]
    ) -> Tuple[List[PromptVersion], List[Optional[PerformanceMetrics]], List[str]]:
        """
        Compare multiple prompt versions.

        Args:
            version_ids: List of dicts with 'prompt_id' and 'version' keys.

        Returns:
            Tuple of (versions, metrics, content_diffs).

        Raises:
            KeyError: If any prompt or version does not exist.
        """
        versions: List[PromptVersion] = []
        metrics: List[Optional[PerformanceMetrics]] = []

        for item in version_ids:
            pid = item["prompt_id"]
            ver = item["version"]

            version_obj = self.get_version(pid, ver)
            if version_obj is None:
                if pid not in self._prompts:
                    raise KeyError(f"Prompt not found: {pid}")
                raise KeyError(f"Version {ver} not found for prompt {pid}")

            versions.append(version_obj)
            metrics.append(self.get_metrics(pid, ver))

        # Compute unified diffs between consecutive versions
        content_diffs: List[str] = []
        for i in range(1, len(versions)):
            prev_content = versions[i - 1].content.splitlines(keepends=True)
            curr_content = versions[i].content.splitlines(keepends=True)
            diff = difflib.unified_diff(
                prev_content,
                curr_content,
                fromfile=f"v{versions[i-1].version}",
                tofile=f"v{versions[i].version}",
            )
            content_diffs.append("".join(diff))

        return versions, metrics, content_diffs

    def record_test(self, execution: TestExecution) -> None:
        """
        Record a test execution.

        Args:
            execution: The TestExecution record.
        """
        self._test_executions.append(execution)
        self._save()
        logger.debug(
            f"Recorded test for prompt {execution.prompt_id} v{execution.version}"
        )

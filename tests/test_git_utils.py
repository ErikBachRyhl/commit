"""Tests for git_utils module."""

import pytest
from pathlib import Path

from renforce.git_utils import (
    GitError,
    get_repo,
    _filter_by_patterns,
)


class TestFilterByPatterns:
    """Tests for _filter_by_patterns function."""

    def test_single_pattern_match(self):
        """Test filtering with single pattern."""
        files = ["math214/ch1.tex", "math214/ch2.tex", "pde/notes.tex"]
        patterns = ["math214/**/*.tex"]

        result = _filter_by_patterns(files, patterns)

        assert len(result) == 2
        assert "math214/ch1.tex" in result
        assert "math214/ch2.tex" in result

    def test_multiple_patterns(self):
        """Test filtering with multiple patterns."""
        files = ["math214/ch1.tex", "pde/ch1.tex", "other/file.tex"]
        patterns = ["math214/**/*.tex", "pde/**/*.tex"]

        result = _filter_by_patterns(files, patterns)

        assert len(result) == 2
        assert "math214/ch1.tex" in result
        assert "pde/ch1.tex" in result

    def test_no_match(self):
        """Test filtering with no matches."""
        files = ["math214/ch1.tex", "pde/notes.tex"]
        patterns = ["physics/**/*.tex"]

        result = _filter_by_patterns(files, patterns)

        assert len(result) == 0

    def test_wildcard_pattern(self):
        """Test with simple wildcard pattern."""
        files = ["notes.tex", "dir/file.tex", "dir/subdir/other.tex"]
        patterns = ["*.tex"]

        result = _filter_by_patterns(files, patterns)

        assert "notes.tex" in result

    def test_empty_patterns(self):
        """Test with empty patterns list."""
        files = ["file1.tex", "file2.tex"]
        patterns = []

        result = _filter_by_patterns(files, patterns)

        assert len(result) == 2  # All files returned when no patterns


class TestGetRepo:
    """Tests for get_repo function."""

    def test_invalid_repo(self):
        """Test with invalid repository path."""
        with pytest.raises(GitError):
            get_repo(Path("/nonexistent/path"))


# Note: Testing actual Git operations would require setting up test repositories.
# For a full test suite, you'd want to use pytest fixtures to create temporary
# Git repos with test commits. Example:
#
# @pytest.fixture
# def test_repo(tmp_path):
#     repo = Repo.init(tmp_path)
#     # Create test files and commits
#     return tmp_path
#
# def test_get_changed_files(test_repo):
#     # Test with actual repo
#     pass


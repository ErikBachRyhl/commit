"""Git utilities for detecting changed files."""

from pathlib import Path
from typing import List, Optional

from git import Repo
from git.exc import GitCommandError, InvalidGitRepositoryError, NoSuchPathError


class GitError(Exception):
    """Base exception for Git-related errors."""

    pass


def get_repo(repo_path: Path) -> Repo:
    """
    Get Git repository object.

    Args:
        repo_path: Path to repository root

    Returns:
        Git repository object

    Raises:
        GitError: If path is not a valid Git repository
    """
    try:
        return Repo(repo_path, search_parent_directories=True)
    except InvalidGitRepositoryError as e:
        raise GitError(f"Not a valid Git repository: {repo_path}") from e
    except NoSuchPathError as e:
        raise GitError(f"Path does not exist: {repo_path}") from e


def get_current_sha(repo_path: Path) -> str:
    """
    Get the current HEAD commit SHA.

    Args:
        repo_path: Path to repository root

    Returns:
        Current HEAD commit SHA (full 40-character hash)

    Raises:
        GitError: If repository is invalid or has no commits
    """
    try:
        repo = get_repo(repo_path)
        if repo.head.is_detached:
            return repo.head.commit.hexsha
        return repo.head.commit.hexsha
    except (GitCommandError, ValueError) as e:
        raise GitError(f"Failed to get current SHA: {e}") from e


def get_parent_commit(repo_path: Path, sha: str) -> Optional[str]:
    """
    Get the parent commit SHA of a given commit.
    
    Args:
        repo_path: Path to Git repository
        sha: Commit SHA to get parent of
    
    Returns:
        Parent commit SHA, or None if commit has no parents (initial commit)
    
    Raises:
        GitError: If unable to get parent commit
    """
    try:
        repo = get_repo(repo_path)
        commit = repo.commit(sha)
        if commit.parents:
            return commit.parents[0].hexsha
        return None
    except Exception as e:
        raise GitError(f"Failed to get parent of {sha}: {e}") from e


def get_changed_files(
    repo_path: Path,
    since_sha: Optional[str] = None,
    path_patterns: Optional[List[str]] = None,
) -> List[str]:
    """
    Get list of changed .tex files since a specific commit.

    Args:
        repo_path: Path to repository root
        since_sha: Start commit SHA. If None, returns files from HEAD commit only
        path_patterns: Optional list of path patterns to filter (e.g., ["math214/**/*.tex"])

    Returns:
        List of relative file paths that changed

    Raises:
        GitError: If Git operations fail
    """
    try:
        repo = get_repo(repo_path)

        if since_sha is None:
            # Get files from HEAD commit only
            changed_files = _get_files_from_head(repo)
        else:
            # Get diff between since_sha and HEAD
            changed_files = _get_diff_files(repo, since_sha)

        # Filter for .tex files
        tex_files = [f for f in changed_files if f.endswith(".tex")]

        # Apply path patterns if provided
        if path_patterns:
            tex_files = _filter_by_patterns(tex_files, path_patterns)

        return tex_files

    except GitCommandError as e:
        raise GitError(f"Git command failed: {e}") from e


def _get_files_from_head(repo: Repo) -> List[str]:
    """Get files modified in HEAD commit."""
    try:
        head_commit = repo.head.commit

        # If this is the first commit, get all files
        if not head_commit.parents:
            return [item.path for item in head_commit.tree.traverse() if item.type == "blob"]

        # Get diff with parent
        parent = head_commit.parents[0]
        diffs = parent.diff(head_commit)

        changed_files = []
        for diff in diffs:
            # Include new files (a_path) and modified files (b_path)
            if diff.new_file or diff.renamed or diff.a_blob:
                path = diff.b_path if diff.b_path else diff.a_path
                if path:
                    changed_files.append(path)

        return changed_files
    except (AttributeError, IndexError) as e:
        raise GitError(f"Failed to get HEAD commit files: {e}") from e


def _get_diff_files(repo: Repo, since_sha: str) -> List[str]:
    """Get files that changed between since_sha and HEAD."""
    try:
        # Validate that since_sha exists
        try:
            since_commit = repo.commit(since_sha)
        except (ValueError, GitCommandError) as e:
            raise GitError(f"Invalid commit SHA: {since_sha}") from e

        head_commit = repo.head.commit

        # If they're the same commit, return empty list
        if since_commit.hexsha == head_commit.hexsha:
            return []

        # Get diff
        diffs = since_commit.diff(head_commit)

        changed_files = []
        for diff in diffs:
            # Include new, modified, and renamed files
            if diff.new_file or diff.renamed or diff.a_blob:
                path = diff.b_path if diff.b_path else diff.a_path
                if path:
                    changed_files.append(path)

        return changed_files
    except GitCommandError as e:
        raise GitError(f"Failed to get diff: {e}") from e


def _filter_by_patterns(files: List[str], patterns: List[str]) -> List[str]:
    """
    Filter files by glob patterns with ** support.

    Args:
        files: List of file paths
        patterns: List of glob patterns (e.g., ["math214/**/*.tex", "pde/**/*.tex"])

    Returns:
        Filtered list of files matching at least one pattern
    """
    import re
    
    if not patterns:
        return files

    # Convert glob patterns to regex patterns
    def glob_to_regex(pattern: str) -> re.Pattern:
        """Convert glob pattern with ** support to regex."""
        # Escape special regex characters except * and ?
        pattern = pattern.replace('.', r'\.')
        pattern = pattern.replace('+', r'\+')
        pattern = pattern.replace('(', r'\(')
        pattern = pattern.replace(')', r'\)')
        pattern = pattern.replace('[', r'\[')
        pattern = pattern.replace(']', r'\]')
        pattern = pattern.replace('^', r'\^')
        pattern = pattern.replace('$', r'\$')
        
        # Replace ** with regex that matches zero or more path segments
        # IMPORTANT: Must replace longer patterns first before **
        pattern = pattern.replace('**/', '__DOUBLESTAR_SLASH__')
        pattern = pattern.replace('/**', '__SLASH_DOUBLESTAR__')
        pattern = pattern.replace('**', '__DOUBLESTAR__')
        
        # Replace remaining * and ?
        pattern = pattern.replace('*', '[^/]*')  # * matches anything except /
        pattern = pattern.replace('?', '[^/]')   # ? matches single char except /
        
        # Now replace the placeholders
        pattern = pattern.replace('__DOUBLESTAR_SLASH__', '(.*/)?' )  # **/ matches zero or more dirs
        pattern = pattern.replace('__SLASH_DOUBLESTAR__', '(/.*)?')    # /** matches zero or more dirs  
        pattern = pattern.replace('__DOUBLESTAR__', '.*')               # ** matches anything
        
        return re.compile(f'^{pattern}$')

    compiled_patterns = [glob_to_regex(p.lstrip('./')) for p in patterns]

    filtered = []
    for file_path in files:
        normalized_file = file_path.lstrip("./")
        
        for regex_pattern in compiled_patterns:
            if regex_pattern.match(normalized_file):
                filtered.append(file_path)
                break  # File matches at least one pattern

    return filtered


def get_file_at_commit(repo_path: Path, file_path: str, commit_sha: Optional[str] = None) -> str:
    """
    Get file contents at a specific commit.

    Args:
        repo_path: Path to repository root
        file_path: Relative path to file
        commit_sha: Commit SHA. If None, uses HEAD

    Returns:
        File contents as string

    Raises:
        GitError: If file doesn't exist at that commit
    """
    try:
        repo = get_repo(repo_path)
        commit = repo.commit(commit_sha) if commit_sha else repo.head.commit

        # Get blob for file
        blob = commit.tree / file_path
        return blob.data_stream.read().decode("utf-8")

    except (KeyError, GitCommandError, UnicodeDecodeError) as e:
        raise GitError(f"Failed to read file {file_path} at commit {commit_sha}: {e}") from e


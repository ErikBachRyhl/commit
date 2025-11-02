"""Hashing utilities for generating stable GUIDs and content hashes."""

import hashlib
from typing import Optional


def compute_guid(env_name: str, normalized_body: str, file_path: str) -> str:
    """
    Compute a stable GUID for a LaTeX environment block.

    The GUID is based on the environment name, normalized content, and file path.
    This ensures that the same content in the same location always produces
    the same GUID, enabling idempotent operations.

    Args:
        env_name: Environment type (e.g., "definition", "theorem")
        normalized_body: Normalized LaTeX content
        file_path: Relative path to the source file

    Returns:
        40-character hexadecimal SHA1 hash

    Examples:
        >>> guid = compute_guid("definition", "A metric space", "math/ch1.tex")
        >>> len(guid)
        40
        >>> # Same inputs produce same GUID
        >>> guid2 = compute_guid("definition", "A metric space", "math/ch1.tex")
        >>> guid == guid2
        True
    """
    # Concatenate components with delimiter
    content = f"{env_name}|{normalized_body}|{file_path}"

    # Compute SHA1 hash
    hash_obj = hashlib.sha1(content.encode("utf-8"))
    return hash_obj.hexdigest()


def compute_content_hash(normalized_body: str) -> str:
    """
    Compute a hash of just the content body.

    This is used to detect when content has changed, even if the GUID
    (which includes file path) remains the same.

    Args:
        normalized_body: Normalized LaTeX content

    Returns:
        40-character hexadecimal SHA1 hash

    Examples:
        >>> h1 = compute_content_hash("A metric space")
        >>> h2 = compute_content_hash("A metric space")
        >>> h1 == h2
        True
        >>> h3 = compute_content_hash("A different space")
        >>> h1 == h3
        False
    """
    hash_obj = hashlib.sha1(normalized_body.encode("utf-8"))
    return hash_obj.hexdigest()


def short_hash(full_hash: str, length: int = 12) -> str:
    """
    Get a shortened version of a hash for display/storage in LaTeX.
    
    Uses first N characters of the full hash. With 12 chars (48 bits):
    - Collision probability for 10,000 cards: ~1 in 281 trillion
    - Safe for typical user scale (thousands of cards over years)
    - Much more readable in LaTeX source than 40-char GUIDs

    Args:
        full_hash: Full hash string (40-char SHA1)
        length: Number of characters to return (default: 12)

    Returns:
        Truncated hash

    Examples:
        >>> short_hash("abcdef1234567890abcdef1234567890abcdef12", length=12)
        'abcdef123456'
    """
    return full_hash[:length]


def match_short_guid_to_full(short_guid: str, full_guids: list[str]) -> Optional[str]:
    """
    Match a short GUID (from LaTeX comment) to a full GUID (from state).
    
    If multiple matches exist (collision), returns None to force regeneration.
    This should be extremely rare with 12+ char prefixes.

    Args:
        short_guid: Short GUID from LaTeX (12-16 chars)
        full_guids: List of full GUIDs to search

    Returns:
        Full GUID if unique match found, None otherwise

    Examples:
        >>> full = ["abc123def4567890abcdef1234567890abcdef12", "def789abc1234567890def789abc1234567890de"]
        >>> match_short_guid_to_full("abc123def456", full)
        'abc123def4567890abcdef1234567890abcdef12'
    """
    matches = [g for g in full_guids if g.startswith(short_guid)]
    
    if len(matches) == 1:
        return matches[0]
    elif len(matches) == 0:
        return None
    else:
        # Collision detected - return None to force new GUID generation
        return None


def compute_block_signature(
    env_name: str,
    file_path: str,
    start_line: int,
    title: Optional[str] = None,
) -> str:
    """
    Compute a human-readable signature for a block.

    Useful for logging and debugging.

    Args:
        env_name: Environment type
        file_path: Source file path
        start_line: Starting line number
        title: Optional environment title

    Returns:
        Human-readable signature string

    Examples:
        >>> sig = compute_block_signature("theorem", "math.tex", 42, "Pythagorean")
        >>> sig
        'theorem[Pythagorean]@math.tex:42'
        >>> sig2 = compute_block_signature("definition", "notes.tex", 10)
        >>> sig2
        'definition@notes.tex:10'
    """
    if title:
        return f"{env_name}[{title}]@{file_path}:{start_line}"
    return f"{env_name}@{file_path}:{start_line}"


"""Security utilities for sanitizing LaTeX content before LLM processing."""

import re
from typing import List


# Dangerous LaTeX commands that could execute code or read files
DANGEROUS_COMMANDS = [
    r"\\write18",  # Shell execution
    r"\\input",  # File reading
    r"\\include",  # File inclusion
    r"\\def",  # Macro definition
    r"\\let",  # Command aliasing
    r"\\expandafter",  # Macro expansion
    r"\\csname",  # Command name construction
    r"\\catcode",  # Category code changes
    r"\\read",  # File reading
    r"\\openin",  # File opening
    r"\\openout",  # File writing
    r"\\immediate",  # Immediate execution
    r"\\special",  # Special driver commands
]

# Shell-escape patterns
SHELL_ESCAPE_PATTERNS = [
    r"--shell-escape",
    r"-shell-escape",
    r"--enable-write18",
]


def strip_dangerous_latex(content: str) -> str:
    """
    Remove dangerous LaTeX commands that could execute code or access files.

    This is a security measure to prevent potential code execution when
    sending LaTeX content to LLMs.

    Args:
        content: Raw LaTeX content

    Returns:
        Sanitized content with dangerous commands removed

    Examples:
        >>> strip_dangerous_latex(r"\\write18{rm -rf /}")
        ''
        >>> strip_dangerous_latex(r"$x^2$ is \\textbf{important}")
        '$x^2$ is \\\\textbf{important}'
    """
    sanitized = content

    # Remove shell-escape flags
    for pattern in SHELL_ESCAPE_PATTERNS:
        sanitized = re.sub(pattern, "", sanitized, flags=re.IGNORECASE)

    # Remove dangerous commands with their arguments
    for cmd in DANGEROUS_COMMANDS:
        # Remove command with braced argument: \cmd{...}
        sanitized = re.sub(
            rf"{cmd}\s*\{{[^}}]*\}}",
            "",
            sanitized,
            flags=re.IGNORECASE
        )
        # Remove command with optional argument: \cmd[...]
        sanitized = re.sub(
            rf"{cmd}\s*\[[^\]]*\]",
            "",
            sanitized,
            flags=re.IGNORECASE
        )
        # Remove standalone command
        sanitized = re.sub(
            rf"{cmd}\b",
            "",
            sanitized,
            flags=re.IGNORECASE
        )

    return sanitized


def is_safe_latex(content: str) -> bool:
    """
    Check if LaTeX content appears safe (doesn't contain dangerous commands).

    Args:
        content: LaTeX content to check

    Returns:
        True if safe, False if dangerous commands detected
    """
    content_lower = content.lower()

    # Check for shell escape
    for pattern in SHELL_ESCAPE_PATTERNS:
        if pattern.lower() in content_lower:
            return False

    # Check for dangerous commands
    for cmd in DANGEROUS_COMMANDS:
        # Simple check for command name
        if cmd.lower() in content_lower:
            return False

    return True


def get_safe_subset(content: str, max_length: int = 100000) -> str:
    """
    Get a safe subset of content, sanitized and truncated.

    Args:
        content: Original content
        max_length: Maximum length to return

    Returns:
        Sanitized and truncated content
    """
    # Sanitize first
    safe = strip_dangerous_latex(content)

    # Truncate if needed
    if len(safe) > max_length:
        safe = safe[:max_length] + "\n... (truncated)"

    return safe


def validate_latex_for_llm(content: str, max_length: int = 100000) -> tuple[bool, str]:
    """
    Validate and sanitize LaTeX content for LLM processing.

    Args:
        content: LaTeX content
        max_length: Maximum allowed length

    Returns:
        Tuple of (is_valid, sanitized_content_or_error_message)
    """
    if not content or not content.strip():
        return False, "Empty content"

    if len(content) > max_length * 2:  # Way too large
        return False, f"Content too large ({len(content)} chars, max {max_length})"

    # Check for dangerous patterns
    if not is_safe_latex(content):
        # Sanitize and warn
        sanitized = strip_dangerous_latex(content)
        print("Warning: Dangerous LaTeX commands detected and removed")
        return True, sanitized

    # Truncate if needed
    if len(content) > max_length:
        content = content[:max_length] + "\n... (truncated for LLM)"

    return True, content


# List of safe LaTeX commands (for reference/documentation)
SAFE_COMMANDS = [
    # Math
    r"\frac", r"\sqrt", r"\sum", r"\int", r"\prod", r"\lim",
    r"\sin", r"\cos", r"\tan", r"\log", r"\exp",
    r"\alpha", r"\beta", r"\gamma", r"\delta", r"\epsilon",
    
    # Formatting
    r"\textbf", r"\textit", r"\emph", r"\texttt", r"\textrm",
    r"\underline", r"\textsc",
    
    # Structure
    r"\section", r"\subsection", r"\chapter",
    r"\begin", r"\end",  # Environment delimiters
    
    # References (safe for reading, not writing)
    r"\label", r"\ref", r"\cite",
    
    # Lists
    r"\item", r"\enumerate", r"\itemize",
]


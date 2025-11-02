"""LaTeX parser for extracting structured environments."""

import re
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ExtractedEnvironment:
    """Represents an extracted LaTeX environment."""

    env: str  # Environment name (e.g., "definition", "theorem")
    title: Optional[str]  # Optional title from [...]
    body: str  # Environment content
    start_line: int  # Line number where environment starts
    end_line: int  # Line number where environment ends
    raw_text: str  # Original text including \begin and \end
    guid: Optional[str] = None  # Persistent GUID from LaTeX comment, if found


def extract_environments(
    file_content: str, env_names: List[str]
) -> List[ExtractedEnvironment]:
    """
    Extract specified LaTeX environments from file content.

    Args:
        file_content: Full content of .tex file
        env_names: List of environment names to extract (e.g., ["definition", "theorem"])

    Returns:
        List of extracted environments with metadata

    Examples:
        >>> content = r'''
        ... \\begin{definition}[Metric Space]
        ... A metric space is a set $M$ with a distance function.
        ... \\end{definition}
        ... '''
        >>> envs = extract_environments(content, ["definition"])
        >>> len(envs)
        1
        >>> envs[0].env
        'definition'
        >>> envs[0].title
        'Metric Space'
    """
    if not env_names:
        return []

    # Pre-process: Remove commented lines (lines starting with %)
    # This prevents matching commented-out environments
    lines = file_content.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.lstrip()
        if not stripped.startswith('%'):
            cleaned_lines.append(line)
        else:
            # Keep the line as empty to preserve line numbers
            cleaned_lines.append('')
    
    file_content = '\n'.join(cleaned_lines)

    # Create regex pattern for all environment names
    env_pattern = "|".join(re.escape(name) for name in env_names)

    # Pattern explanation:
    # \\begin\{(?P<env>...)\}  - Match \begin{env}
    # (?:\[(?P<title>.*?)\])?  - Optional [title] (non-capturing group)
    # (?P<body>.*?)            - Body content (non-greedy)
    # \\end\{(?P=env)\}        - Match \end{env} with same name
    pattern = re.compile(
        r"\\begin\{(?P<env>" + env_pattern + r")\}"
        r"(?:\[(?P<title>.*?)\])?"
        r"(?P<body>.*?)"
        r"\\end\{(?P=env)\}",
        re.DOTALL,
    )

    extracted = []
    lines = file_content.split('\n')
    
    for match in pattern.finditer(file_content):
        env_name = match.group("env")
        title = match.group("title")
        body = match.group("body")
        raw_text = match.group(0)

        # Calculate line numbers
        start_pos = match.start()
        end_pos = match.end()
        start_line = file_content[:start_pos].count("\n") + 1
        end_line = file_content[:end_pos].count("\n") + 1
        
        # Extract GUID from comments in context window (up to 20 lines before)
        # Pattern: % anki-tex-guid: <guid> or %GUID: <guid>
        # Accepts 8-40 character hex strings (shortened GUIDs for readability)
        context_start = max(0, start_line - 21)  # Look up to 20 lines before
        context_lines = lines[context_start:start_line]
        
        guid = None
        # Match 8-40 hex characters (8 = minimum, 12 = recommended, 40 = full)
        guid_pattern = re.compile(r'%\s*(?:anki-tex-)?guid:\s*([a-f0-9]{8,40})', re.IGNORECASE)
        
        # Search backwards through context lines
        for line in reversed(context_lines):
            guid_match = guid_pattern.search(line)
            if guid_match:
                guid = guid_match.group(1)
                break

        extracted.append(
            ExtractedEnvironment(
                env=env_name,
                title=title,
                body=body,
                start_line=start_line,
                end_line=end_line,
                raw_text=raw_text,
                guid=guid,
            )
        )

    return extracted


def normalize_tex(content: str) -> str:
    """
    Normalize LaTeX content for consistent hashing and display.

    Preserves mathematical content while standardizing whitespace.

    Args:
        content: Raw LaTeX content

    Returns:
        Normalized content

    Examples:
        >>> normalize_tex("  A metric    space  ")
        'A metric space'
        >>> normalize_tex("$x^2 + y^2$")
        '$x^2 + y^2$'
    """
    # Step 1: Trim leading/trailing whitespace
    content = content.strip()

    # Step 2: Preserve math environments by temporarily replacing them
    math_blocks = []
    
    # Protect display math: \[ ... \]
    def save_display_math(match):
        math_blocks.append(match.group(0))
        return f"__MATH_BLOCK_{len(math_blocks) - 1}__"
    
    content = re.sub(r"\\\[.*?\\\]", save_display_math, content, flags=re.DOTALL)
    
    # Protect display math: $$ ... $$
    content = re.sub(r"\$\$.*?\$\$", save_display_math, content, flags=re.DOTALL)
    
    # Protect inline math: $ ... $
    content = re.sub(r"\$[^\$]+?\$", save_display_math, content)

    # Step 3: Collapse multiple spaces/newlines (but preserve single newlines)
    # Replace multiple spaces with single space
    content = re.sub(r"[ \t]+", " ", content)
    
    # Replace 3+ newlines with 2 newlines (paragraph break)
    content = re.sub(r"\n\n+", "\n\n", content)

    # Step 4: Restore math blocks
    for i, math_block in enumerate(math_blocks):
        content = content.replace(f"__MATH_BLOCK_{i}__", math_block)

    return content.strip()


def extract_metadata(content: str) -> dict:
    """
    Extract metadata from LaTeX content (labels, citations, etc.).

    Args:
        content: LaTeX content

    Returns:
        Dictionary with metadata:
        - labels: List of \\label{...} values
        - citations: List of \\cite{...} values
        - refs: List of \\ref{...} values

    Examples:
        >>> meta = extract_metadata(r"See \\cite{knuth1984} and \\label{thm:main}")
        >>> meta['citations']
        ['knuth1984']
        >>> meta['labels']
        ['thm:main']
    """
    metadata = {
        "labels": [],
        "citations": [],
        "refs": [],
    }

    # Extract labels
    label_pattern = re.compile(r"\\label\{([^}]+)\}")
    metadata["labels"] = label_pattern.findall(content)

    # Extract citations (cite, citep, citet, etc.)
    cite_pattern = re.compile(r"\\cite[a-z]*\{([^}]+)\}")
    for match in cite_pattern.finditer(content):
        # Split multiple citations: \cite{foo,bar}
        citations = [c.strip() for c in match.group(1).split(",")]
        metadata["citations"].extend(citations)

    # Extract references
    ref_pattern = re.compile(r"\\ref\{([^}]+)\}")
    metadata["refs"] = ref_pattern.findall(content)

    return metadata


def get_first_sentence(text: str, max_length: int = 100) -> str:
    """
    Extract first sentence or first N characters from text.

    Useful for generating card fronts from body content.
    Handles LaTeX by preserving math and removing some commands.

    Args:
        text: Input text
        max_length: Maximum length to return

    Returns:
        First sentence or truncated text

    Examples:
        >>> get_first_sentence("This is first. This is second.")
        'This is first.'
        >>> get_first_sentence("A" * 200, max_length=50)
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...'
    """
    # Normalize whitespace first
    text = re.sub(r"\s+", " ", text.strip())
    
    # Remove common LaTeX commands that don't add meaning to preview
    # But keep the text content
    text = re.sub(r"\\label\{[^}]+\}", "", text)
    text = re.sub(r"\\cite[a-z]*\{[^}]+\}", "[citation]", text)
    text = re.sub(r"\\ref\{[^}]+\}", "[ref]", text)
    
    # Clean up excessive whitespace again after removals
    text = re.sub(r"\s+", " ", text.strip())

    # Try to find first sentence (ending with . ! ?)
    # But be careful not to split on periods inside math mode
    # Simple approach: find sentence end that's not followed by another letter immediately
    sentence_match = re.match(r"^([^.!?]+[.!?])(?:\s|$)", text)
    if sentence_match:
        sentence = sentence_match.group(1).strip()
        if len(sentence) <= max_length:
            return sentence

    # Fall back to truncation
    if len(text) <= max_length:
        return text

    # Truncate at word boundary
    truncated = text[:max_length].rsplit(" ", 1)[0]
    return truncated + "..."


def inject_guid_comment(file_path: str, line_number: int, full_guid: str) -> bool:
    """
    Inject or update a GUID comment in a LaTeX file.
    
    Inserts a comment like '% anki-tex-guid: <short-guid>' right before the
    environment at the specified line number. Uses a shortened 12-character
    version for better readability. If a GUID comment already exists in the
    context window, it updates that comment instead.
    
    Args:
        file_path: Path to the LaTeX file
        line_number: Line number where environment starts (1-indexed)
        full_guid: Full GUID to inject (40-char hex string, will be shortened)
    
    Returns:
        True if file was modified, False otherwise
    
    Raises:
        IOError: If file cannot be read or written
    """
    from .hashing import short_hash
    
    # Use shortened version for readability in LaTeX source
    short_guid = short_hash(full_guid, length=12)
    from pathlib import Path
    
    path = Path(file_path)
    if not path.exists():
        raise IOError(f"File not found: {file_path}")
    
    # Read file
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Convert to 0-indexed
    target_idx = line_number - 1
    
    if target_idx < 0 or target_idx >= len(lines):
        raise ValueError(f"Line {line_number} out of range (file has {len(lines)} lines)")
    
    # Check if GUID already exists in context window (up to 20 lines before)
    context_start = max(0, target_idx - 20)
    context_lines = lines[context_start:target_idx]
    
    # Match any GUID length (8-40 chars) for finding existing comments
    guid_pattern = re.compile(r'%\s*(?:anki-tex-)?guid:\s*[a-f0-9]{8,40}', re.IGNORECASE)
    # Pattern for updating (captures comment prefix, replaces GUID)
    guid_comment_pattern = re.compile(r'(%\s*(?:anki-tex-)?guid:\s*)([a-f0-9]{8,40})', re.IGNORECASE)
    
    modified = False
    
    # Check if GUID exists and update it
    for i in range(len(context_lines) - 1, -1, -1):
        line = context_lines[i]
        if guid_pattern.search(line):
            # GUID exists, update it with shortened version
            new_line = guid_comment_pattern.sub(rf'\1{short_guid}', line.rstrip('\n'))
            actual_idx = context_start + i
            if lines[actual_idx].rstrip('\n') != new_line:
                lines[actual_idx] = new_line + '\n'
                modified = True
            return modified
    
    # No GUID found, insert new comment right before \begin
    comment = f"% anki-tex-guid: {short_guid}\n"
    lines.insert(target_idx, comment)
    modified = True
    
    # Write back
    if modified:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
    
    return modified


def extract_neighbor_context(
    file_content: str,
    start_line: int,
    end_line: int,
    total_context_lines: int = 20
) -> str:
    """
    Extract context lines around a block for LLM understanding.
    
    Args:
        file_content: Full file content
        start_line: Block start line (1-indexed)
        end_line: Block end line (1-indexed)
        total_context_lines: Total lines to include (split half above, half below)
    
    Returns:
        Context lines as string (empty if not enough context exists)
    
    Examples:
        >>> content = "\\n".join([f"line{i}" for i in range(1, 51)])
        >>> context = extract_neighbor_context(content, 20, 30, total_context_lines=10)
        >>> "line15" in context  # 5 lines before
        True
        >>> "line35" in context  # 5 lines after
        True
    """
    lines = file_content.split('\n')
    
    # Calculate how many lines to grab before and after
    context_before = total_context_lines // 2
    context_after = total_context_lines - context_before
    
    # Convert to 0-indexed
    start_idx = start_line - 1
    end_idx = end_line - 1
    
    # Calculate context bounds (don't go negative or beyond file)
    context_start = max(0, start_idx - context_before)
    context_end = min(len(lines), end_idx + 1 + context_after)
    
    # Extract context lines (before and after, excluding the block itself)
    before_lines = lines[context_start:start_idx]
    after_lines = lines[end_idx + 1:context_end]
    
    # Combine and return
    context_parts = []
    
    if before_lines:
        context_parts.append("% Context before:\n" + "\n".join(before_lines))
    
    if after_lines:
        context_parts.append("% Context after:\n" + "\n".join(after_lines))
    
    return "\n\n".join(context_parts)


def strip_latex_commands(text: str, preserve_math: bool = True) -> str:
    """
    Remove LaTeX commands while preserving content.

    Args:
        text: LaTeX text
        preserve_math: If True, keep math environments intact

    Returns:
        Text with commands removed

    Examples:
        >>> strip_latex_commands(r"\\textbf{bold} text")
        'bold text'
        >>> strip_latex_commands(r"$x^2$ is \\emph{important}")
        '$x^2$ is important'
    """
    result = text

    # Preserve math if requested
    math_blocks = []
    if preserve_math:
        def save_math(match):
            math_blocks.append(match.group(0))
            return f"__MATH_{len(math_blocks) - 1}__"
        
        result = re.sub(r"\$\$.*?\$\$", save_math, result, flags=re.DOTALL)
        result = re.sub(r"\$[^\$]+?\$", save_math, result)
        result = re.sub(r"\\\[.*?\\\]", save_math, result, flags=re.DOTALL)

    # Remove common formatting commands but keep their content
    # Pattern: \command{content} -> content
    formatting_cmds = [
        "textbf", "textit", "emph", "texttt", "textrm", "textsf",
        "underline", "textsc", "textcolor"
    ]
    for cmd in formatting_cmds:
        result = re.sub(rf"\\{cmd}\{{([^}}]*)\}}", r"\1", result)

    # Remove standalone commands (like \noindent, \\, etc.)
    result = re.sub(r"\\\\(?:\[[^\]]*\])?", " ", result)  # Line breaks
    result = re.sub(r"\\[a-zA-Z]+(?:\[[^\]]*\])?\s*", "", result)  # Other commands

    # Clean up whitespace
    result = re.sub(r"\s+", " ", result).strip()

    # Restore math
    if preserve_math:
        for i, math_block in enumerate(math_blocks):
            result = result.replace(f"__MATH_{i}__", math_block)

    return result


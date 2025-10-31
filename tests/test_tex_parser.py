"""Tests for tex_parser module."""

import pytest

from renforce.tex_parser import (
    extract_environments,
    normalize_tex,
    extract_metadata,
    get_first_sentence,
    strip_latex_commands,
)


class TestExtractEnvironments:
    """Tests for extract_environments function."""

    def test_simple_definition(self):
        """Test extracting a simple definition."""
        content = r"""
\begin{definition}
A metric space is a set with a distance function.
\end{definition}
"""
        envs = extract_environments(content, ["definition"])

        assert len(envs) == 1
        assert envs[0].env == "definition"
        assert envs[0].title is None
        assert "metric space" in envs[0].body

    def test_definition_with_title(self):
        """Test extracting definition with optional title."""
        content = r"""
\begin{definition}[Metric Space]
A set $M$ with a distance function $d: M \times M \to \mathbb{R}$.
\end{definition}
"""
        envs = extract_environments(content, ["definition"])

        assert len(envs) == 1
        assert envs[0].env == "definition"
        assert envs[0].title == "Metric Space"
        assert "$M$" in envs[0].body

    def test_multiple_environments(self):
        """Test extracting multiple environments."""
        content = r"""
\begin{definition}
First definition.
\end{definition}

Some text in between.

\begin{theorem}
A theorem statement.
\end{theorem}

\begin{definition}
Second definition.
\end{definition}
"""
        envs = extract_environments(content, ["definition", "theorem"])

        assert len(envs) == 3
        assert envs[0].env == "definition"
        assert envs[1].env == "theorem"
        assert envs[2].env == "definition"

    def test_nested_math(self):
        """Test handling nested math environments."""
        content = r"""
\begin{theorem}[Pythagorean]
For a right triangle:
\[
    a^2 + b^2 = c^2
\]
where $c$ is the hypotenuse.
\end{theorem}
"""
        envs = extract_environments(content, ["theorem"])

        assert len(envs) == 1
        assert "a^2 + b^2" in envs[0].body
        assert "$c$" in envs[0].body

    def test_line_numbers(self):
        """Test that line numbers are correctly computed."""
        content = """Line 1
Line 2
\\begin{definition}
Line 4
\\end{definition}
Line 6
"""
        envs = extract_environments(content, ["definition"])

        assert len(envs) == 1
        assert envs[0].start_line == 3
        assert envs[0].end_line == 5

    def test_empty_environment(self):
        """Test extracting empty environment."""
        content = r"""
\begin{remark}
\end{remark}
"""
        envs = extract_environments(content, ["remark"])

        assert len(envs) == 1
        assert envs[0].body.strip() == ""

    def test_no_matching_environments(self):
        """Test when no matching environments exist."""
        content = r"""
\begin{proof}
This is a proof.
\end{proof}
"""
        envs = extract_environments(content, ["definition", "theorem"])

        assert len(envs) == 0

    def test_environment_with_commands(self):
        """Test environment containing LaTeX commands."""
        content = r"""
\begin{definition}
Let $X$ be a \textbf{topological space} and $A \subseteq X$.
We say $A$ is \emph{open} if...
\end{definition}
"""
        envs = extract_environments(content, ["definition"])

        assert len(envs) == 1
        assert r"\textbf" in envs[0].body
        assert r"\emph" in envs[0].body


class TestNormalizeTex:
    """Tests for normalize_tex function."""

    def test_trim_whitespace(self):
        """Test trimming leading/trailing whitespace."""
        content = "   A metric space   \n\n"
        normalized = normalize_tex(content)

        assert normalized == "A metric space"

    def test_collapse_spaces(self):
        """Test collapsing multiple spaces."""
        content = "A    metric     space"
        normalized = normalize_tex(content)

        assert normalized == "A metric space"

    def test_preserve_math(self):
        """Test that math is preserved."""
        content = r"Let $x^2 + y^2 = r^2$ be a circle."
        normalized = normalize_tex(content)

        assert "$x^2 + y^2 = r^2$" in normalized

    def test_preserve_display_math(self):
        """Test that display math is preserved."""
        content = r"""
Let us consider:
\[
    \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
\]
This is the Gaussian integral.
"""
        normalized = normalize_tex(content)

        assert r"\int_0^\infty" in normalized
        assert r"\frac{\sqrt{\pi}}{2}" in normalized

    def test_multiple_newlines(self):
        """Test collapsing multiple newlines."""
        content = "Paragraph 1\n\n\n\nParagraph 2"
        normalized = normalize_tex(content)

        assert normalized == "Paragraph 1\n\nParagraph 2"


class TestExtractMetadata:
    """Tests for extract_metadata function."""

    def test_extract_labels(self):
        """Test extracting labels."""
        content = r"Let $X$ be a space. \label{def:space}"
        metadata = extract_metadata(content)

        assert "def:space" in metadata["labels"]

    def test_extract_citations(self):
        """Test extracting citations."""
        content = r"According to \cite{knuth1984} and \cite{lamport1994}."
        metadata = extract_metadata(content)

        assert "knuth1984" in metadata["citations"]
        assert "lamport1994" in metadata["citations"]

    def test_extract_refs(self):
        """Test extracting references."""
        content = r"By Theorem \ref{thm:main}, we have..."
        metadata = extract_metadata(content)

        assert "thm:main" in metadata["refs"]


class TestGetFirstSentence:
    """Tests for get_first_sentence function."""

    def test_simple_sentence(self):
        """Test extracting first sentence."""
        text = "This is first. This is second."
        result = get_first_sentence(text)

        assert result == "This is first."

    def test_truncate_long_text(self):
        """Test truncating long text."""
        text = "A" * 200
        result = get_first_sentence(text, max_length=50)

        assert len(result) <= 53  # 50 + "..."
        assert result.endswith("...")

    def test_short_text(self):
        """Test with text shorter than max_length."""
        text = "Short text"
        result = get_first_sentence(text, max_length=100)

        assert result == "Short text"


class TestStripLatexCommands:
    """Tests for strip_latex_commands function."""

    def test_strip_formatting(self):
        """Test stripping formatting commands."""
        text = r"\textbf{bold} and \emph{italic}"
        result = strip_latex_commands(text)

        assert result == "bold and italic"

    def test_preserve_math(self):
        """Test preserving math environments."""
        text = r"Let $x^2$ be \textbf{important}"
        result = strip_latex_commands(text, preserve_math=True)

        assert "$x^2$" in result
        assert "important" in result
        assert r"\textbf" not in result


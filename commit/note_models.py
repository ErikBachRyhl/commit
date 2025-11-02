"""Data models for extracted blocks and Anki notes."""

from dataclasses import dataclass
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from .hashing import compute_content_hash, compute_guid
from .tex_parser import ExtractedEnvironment, get_first_sentence, normalize_tex


@dataclass
class ExtractedBlock:
    """Represents a parsed LaTeX block with computed hashes."""

    env: str
    title: Optional[str]
    body: str
    normalized_body: str
    file_path: str
    line_number: int
    guid: str
    content_hash: str
    raw_text: str
    neighbor_context: Optional[str] = None  # For LLM context

    @classmethod
    def from_environment(
        cls, env: ExtractedEnvironment, file_path: str
    ) -> "ExtractedBlock":
        """
        Create ExtractedBlock from ExtractedEnvironment.

        Args:
            env: Extracted environment from parser
            file_path: Relative path to source file

        Returns:
            ExtractedBlock with computed hashes
        """
        normalized = normalize_tex(env.body)
        
        # Use persistent GUID from LaTeX comment if available, otherwise generate
        if env.guid:
            # GUID extracted from LaTeX (might be short 12-char version)
            guid = env.guid
        else:
            # Generate GUID based on content+location (will be injected later)
            guid = compute_guid(env.env, normalized, file_path)
        
        content_hash = compute_content_hash(normalized)

        return cls(
            env=env.env,
            title=env.title,
            body=env.body,
            normalized_body=normalized,
            file_path=file_path,
            line_number=env.start_line,
            guid=guid,
            content_hash=content_hash,
            raw_text=env.raw_text,
        )


class AnkiNote(BaseModel):
    """Represents an Anki note ready to be synced."""

    guid: str = Field(description="Stable GUID for idempotency")
    deck_name: str = Field(description="Target deck")
    model_name: str = Field(description="Note type (Basic, Cloze, etc.)")
    fields: Dict[str, str] = Field(description="Field name to content mapping")
    tags: List[str] = Field(default_factory=list, description="List of tags")
    content_hash: str = Field(description="Hash of content for change detection")

    def to_anki_connect_format(self) -> Dict:
        """
        Convert to AnkiConnect API format.

        Returns:
            Dictionary ready for AnkiConnect addNotes action
        """
        return {
            "deckName": self.deck_name,
            "modelName": self.model_name,
            "fields": self.fields,
            "options": {
                "allowDuplicate": True,  # We handle duplicates via GUID tracking
                "duplicateScope": "deck",
            },
            "tags": self.tags,
            "audio": [],
            "video": [],
            "picture": [],
        }


class NoteMapper:
    """Maps ExtractedBlocks to AnkiNotes based on environment type."""

    # Environment types that should use Basic model with theorem-style formatting
    THEOREM_LIKE = {"theorem", "proposition", "lemma", "corollary"}

    # Environment types that should use Basic model with definition-style formatting
    DEFINITION_LIKE = {"definition", "remark"}

    # Environment types that should use example-style formatting
    EXAMPLE_LIKE = {"example"}

    def __init__(self, course_name: str, commit_sha: str):
        """
        Initialize note mapper.

        Args:
            course_name: Name of the course (for tagging)
            commit_sha: Current commit SHA (for tagging)
        """
        self.course_name = course_name
        self.commit_sha = commit_sha

    def map_block(self, block: ExtractedBlock, deck_name: str) -> AnkiNote:
        """
        Map an extracted block to an Anki note.

        Args:
            block: Extracted LaTeX block
            deck_name: Target Anki deck

        Returns:
            AnkiNote ready for syncing
        """
        env_lower = block.env.lower()

        # Determine note type and create fields
        if env_lower in self.DEFINITION_LIKE:
            front, back = self._format_definition(block)
            model_name = "Basic"
        elif env_lower in self.THEOREM_LIKE:
            front, back = self._format_theorem(block)
            model_name = "Basic"
        elif env_lower in self.EXAMPLE_LIKE:
            front, back = self._format_example(block)
            model_name = "Basic"
        else:
            # Generic fallback
            front, back = self._format_generic(block)
            model_name = "Basic"

        # Build tags
        tags = self._build_tags(block)
        
        # Validate that front/back are not empty
        if not front.strip():
            # This shouldn't happen, but log it
            print(f"[WARNING] Empty front field for {block.file_path}:{block.line_number}")
            front = f"[Empty front - env: {block.env}]"
        
        if not back.strip():
            print(f"[WARNING] Empty back field for {block.file_path}:{block.line_number}")
            back = f"[Empty back - check source at {block.file_path}:{block.line_number}]"

        return AnkiNote(
            guid=block.guid,
            deck_name=deck_name,
            model_name=model_name,
            fields={"Front": front, "Back": back},
            tags=tags,
            content_hash=block.content_hash,
        )

    def _format_definition(self, block: ExtractedBlock) -> tuple[str, str]:
        """Format definition-style environments."""
        env_title = block.env.title()

        # Front: "Definition: {title}" or first sentence
        if block.title:
            front = f"{env_title}: {block.title}"
        else:
            # Use first sentence or beginning of body
            first_sent = get_first_sentence(block.body, max_length=80)
            front = f"{env_title}: {first_sent}"

        # Back: Full content + source
        source = f"<div style='margin-top: 1em; font-size: 0.9em; color: #666;'>Source: <code>{block.file_path}:{block.line_number}</code></div>"

        back = f"""<div class="latex-content">
{block.body}
</div>
{source}"""

        return front, back

    def _format_theorem(self, block: ExtractedBlock) -> tuple[str, str]:
        """Format theorem-style environments."""
        env_title = block.env.title()

        # Front: "Theorem: {title}" or statement
        if block.title:
            front = f"{env_title}: {block.title}"
        else:
            # For theorems, try to extract a short statement
            first_sent = get_first_sentence(block.body, max_length=100)
            front = f"{env_title}: {first_sent}"

        # Back: Full statement + source
        source = f"<div style='margin-top: 1em; font-size: 0.9em; color: #666;'>Source: <code>{block.file_path}:{block.line_number}</code></div>"

        back = f"""<div class="latex-content">
<strong>{env_title}{' (' + block.title + ')' if block.title else ''}:</strong>
<div style="margin-top: 0.5em;">
{block.body}
</div>
</div>
{source}"""

        return front, back

    def _format_example(self, block: ExtractedBlock) -> tuple[str, str]:
        """Format example environments."""
        # Front: Show the example setup/context (first part)
        if block.title:
            # If there's a title, use it prominently
            front = f"<strong>Example: {block.title}</strong>"
            # Add a preview of the content
            preview = get_first_sentence(block.body, max_length=150)
            if preview:
                front += f"<div style='margin-top: 0.5em;'>{preview}</div>"
        else:
            # No title: show a substantial preview of the example
            preview = get_first_sentence(block.body, max_length=200)
            if preview:
                front = f"<strong>Example:</strong><div style='margin-top: 0.5em;'>{preview}</div>"
            else:
                # Fallback if extraction fails
                front = f"Example from {block.file_path}:{block.line_number}"
        
        front += "<div style='margin-top: 1em; color: #666; font-size: 0.9em;'>What does this example demonstrate?</div>"

        # Back: Full example content
        source = f"<div style='margin-top: 1em; font-size: 0.9em; color: #666;'>Source: <code>{block.file_path}:{block.line_number}</code></div>"

        back = f"""<div class="latex-content">
<strong>Example{': ' + block.title if block.title else ''}:</strong>
<div style="margin-top: 0.5em;">
{block.body}
</div>
</div>
{source}"""

        return front, back

    def _format_generic(self, block: ExtractedBlock) -> tuple[str, str]:
        """Generic fallback formatting."""
        env_title = block.env.title()

        if block.title:
            front = f"{env_title}: {block.title}"
        else:
            front = f"{env_title}: {get_first_sentence(block.body, max_length=80)}"

        source = f"<div style='margin-top: 1em; font-size: 0.9em; color: #666;'>Source: <code>{block.file_path}:{block.line_number}</code></div>"

        back = f"""<div class="latex-content">
{block.body}
</div>
{source}"""

        return front, back

    def _build_tags(self, block: ExtractedBlock) -> List[str]:
        """Build tags for a note."""
        tags = [
            "auto",
            "from-tex",
            f"course:{self.course_name}",
            f"commit:{self.commit_sha[:8]}",  # Short commit hash
            f"env:{block.env}",
        ]

        # Add file tag (sanitize path for tag format)
        file_tag = block.file_path.replace("/", "_").replace("\\", "_").replace(".", "_")
        tags.append(f"file:{file_tag}")

        # Add GUID tag for lookup
        tags.append(f"guid:{block.guid[:12]}")  # Short GUID for readability

        return tags


def create_revision_tag() -> str:
    """
    Create a revision tag with current date.

    Returns:
        Tag in format "rev:YYYYMMDD"
    """
    from datetime import datetime

    return f"rev:{datetime.now().strftime('%Y%m%d')}"


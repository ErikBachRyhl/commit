"""Build .apkg files for offline Anki import using genanki."""

import random
from pathlib import Path
from typing import Dict, List

try:
    import genanki
    GENANKI_AVAILABLE = True
except ImportError:
    GENANKI_AVAILABLE = False

from .note_models import AnkiNote


class APKGBuilderError(Exception):
    """Exception raised for APKG building errors."""

    pass


# Predefined model IDs (stable hashes)
BASIC_MODEL_ID = 1607392319
CLOZE_MODEL_ID = 1607392320


def _create_basic_model() -> "genanki.Model":
    """Create a Basic note model for genanki."""
    if not GENANKI_AVAILABLE:
        raise APKGBuilderError("genanki is not installed. Install with: pip install genanki")

    return genanki.Model(
        BASIC_MODEL_ID,
        "Basic (anki-tex)",
        fields=[
            {"name": "Front"},
            {"name": "Back"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Front}}",
                "afmt": '{{FrontSide}}<hr id="answer">{{Back}}',
            },
        ],
        css="""
.card {
    font-family: arial;
    font-size: 20px;
    text-align: center;
    color: black;
    background-color: white;
}

.latex-content {
    text-align: left;
    max-width: 600px;
    margin: 0 auto;
}
""",
    )


def _create_cloze_model() -> "genanki.Model":
    """Create a Cloze note model for genanki."""
    if not GENANKI_AVAILABLE:
        raise APKGBuilderError("genanki is not installed. Install with: pip install genanki")

    return genanki.Model(
        CLOZE_MODEL_ID,
        "Cloze (anki-tex)",
        fields=[
            {"name": "Text"},
            {"name": "Extra"},
        ],
        templates=[
            {
                "name": "Cloze",
                "qfmt": "{{cloze:Text}}",
                "afmt": "{{cloze:Text}}<br>{{Extra}}",
            },
        ],
        model_type=genanki.Model.CLOZE,
        css="""
.card {
    font-family: arial;
    font-size: 20px;
    text-align: center;
    color: black;
    background-color: white;
}

.cloze {
    font-weight: bold;
    color: blue;
}
""",
    )


class APKGBuilder:
    """Builder for creating .apkg files."""

    def __init__(self):
        """Initialize APKG builder."""
        if not GENANKI_AVAILABLE:
            raise APKGBuilderError(
                "genanki is not installed. Install with: pip install genanki"
            )

        self.decks: Dict[str, genanki.Deck] = {}
        self.basic_model = _create_basic_model()
        self.cloze_model = _create_cloze_model()

    def _get_or_create_deck(self, deck_name: str) -> "genanki.Deck":
        """Get or create a deck by name."""
        if deck_name not in self.decks:
            # Generate stable deck ID from name
            deck_id = abs(hash(deck_name)) % (10**9)
            self.decks[deck_name] = genanki.Deck(deck_id, deck_name)
        return self.decks[deck_name]

    def add_note(self, anki_note: AnkiNote) -> None:
        """
        Add an Anki note to the appropriate deck.

        Args:
            anki_note: AnkiNote to add

        Raises:
            APKGBuilderError: If note format is invalid
        """
        deck = self._get_or_create_deck(anki_note.deck_name)

        # Select model
        if anki_note.model_name == "Cloze":
            model = self.cloze_model
            # For Cloze, map Front to Text and Back to Extra
            fields = [
                anki_note.fields.get("Text", anki_note.fields.get("Front", "")),
                anki_note.fields.get("Extra", anki_note.fields.get("Back", "")),
            ]
        else:
            # Default to Basic model
            model = self.basic_model
            fields = [
                anki_note.fields.get("Front", ""),
                anki_note.fields.get("Back", ""),
            ]

        # Create genanki note
        # Use GUID for note ID (convert hex to int)
        try:
            note_id = int(anki_note.guid[:16], 16) % (10**15)
        except ValueError:
            # Fallback to random ID
            note_id = random.randint(1, 10**15)

        note = genanki.Note(
            model=model,
            fields=fields,
            tags=anki_note.tags,
            guid=anki_note.guid,  # Use our GUID for deduplication
        )

        deck.add_note(note)

    def add_notes(self, notes: List[AnkiNote]) -> None:
        """
        Add multiple notes.

        Args:
            notes: List of AnkiNote objects
        """
        for note in notes:
            self.add_note(note)

    def build(self, output_path: Path) -> str:
        """
        Build the .apkg file.

        Args:
            output_path: Path where .apkg should be saved

        Returns:
            Path to created .apkg file

        Raises:
            APKGBuilderError: If build fails
        """
        if not self.decks:
            raise APKGBuilderError("No decks to export")

        try:
            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Create package with all decks
            package = genanki.Package(list(self.decks.values()))
            package.write_to_file(str(output_path))

            return str(output_path)

        except Exception as e:
            raise APKGBuilderError(f"Failed to build APKG: {e}") from e


def build_apkg(notes: List[AnkiNote], output_path: Path) -> str:
    """
    Convenience function to build an APKG from notes.

    Args:
        notes: List of AnkiNote objects
        output_path: Path where .apkg should be saved

    Returns:
        Path to created .apkg file

    Raises:
        APKGBuilderError: If build fails

    Example:
        >>> from pathlib import Path
        >>> notes = [...]  # List of AnkiNote objects
        >>> apkg_path = build_apkg(notes, Path("output/notes.apkg"))
        >>> print(f"Created: {apkg_path}")
    """
    builder = APKGBuilder()
    builder.add_notes(notes)
    return builder.build(output_path)


def is_genanki_available() -> bool:
    """
    Check if genanki is available.

    Returns:
        True if genanki can be imported
    """
    return GENANKI_AVAILABLE


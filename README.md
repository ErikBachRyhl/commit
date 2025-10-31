# Renforce

> **Reinforce** concepts from LaTeX notes with intelligent Anki flashcards  
> *renforce* = reinforce + enforce + renforcer (French: to strengthen)

> Automatically sync LaTeX notes to Anki flashcards with LLM-powered generation

Renforce is a production-ready command-line tool that monitors your Git repository of LaTeX notes, extracts structured content (definitions, theorems, propositions, examples), and automatically generates high-quality Anki flashcards. Now with optional LLM-powered card generation for active recall and permanent GUID tracking to preserve review history.

**📚 New here?** Start with [`COMPLETE_OVERVIEW.md`](COMPLETE_OVERVIEW.md) - comprehensive guide to everything!

**📑 Documentation Index:** See [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md) for all available guides.

## Quick Links

- **[Complete Overview](COMPLETE_OVERVIEW.md)** ⭐ - Everything in one place (start here!)
- **[GUID Persistence Guide](GUID_PERSISTENCE.md)** 🔒 - How cards track edits (preserves review history!)
- **[LLM Features](LLM_PRODUCTION_READY.md)** 🤖 - AI-powered card generation
- **[Setup Instructions](SETUP.md)** - Detailed installation guide
- **[Quick Start](QUICKSTART.md)** - Get running in 5 minutes

## Key Features

- 🤖 **LLM-Powered Cards**: Generate 2-3 paraphrased, active-recall cards per LaTeX block (OpenAI/Anthropic/Gemini)
- 🔒 **GUID Persistence**: Stores tracking IDs in LaTeX source (preserves review history through edits!)
- 🔄 **Git Integration**: Automatically detects changes in your LaTeX files
- 📝 **Smart Extraction**: Parses definitions, theorems, propositions, lemmas, corollaries, examples, and remarks
- 🎯 **Idempotent**: Re-running on the same commit won't create duplicates
- 🔌 **AnkiConnect Support**: Direct sync to Anki via AnkiConnect
- 📦 **Offline Mode**: Generate `.apkg` files for manual import
- 🏷️ **Automatic Tagging**: Adds course, file, commit, and environment tags
- 🔄 **Update-in-Place**: Updates existing notes when content changes (preserves review history!)
- 📊 **Progress Tracking**: Rich CLI output with progress bars and tables

## Installation

### Using pip

```bash
pip install -r requirements.txt
```

### From source

```bash
git clone <repository-url>
cd AnkiChat
pip install -e .
```

### Dependencies

- Python 3.11+
- gitpython
- pydantic
- httpx
- pyyaml
- typer
- rich
- genanki (optional, for offline mode)

## Quick Start

### 1. Install AnkiConnect (for online mode)

Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on in Anki:

1. Open Anki
2. Go to Tools → Add-ons → Get Add-ons
3. Enter code: `2055492159`
4. Restart Anki

### 2. Create Configuration File

Create `renforce.yml` in your repository root:

```yaml
courses:
  M214:
    paths: ["math214/**/*.tex"]
    deck: "M214"
  PDE:
    paths: ["pde/**/*.tex"]
    deck: "PDE"

envs_to_extract:
  - definition
  - theorem
  - proposition
  - lemma
  - corollary
  - example
  - remark

llm_generated:
  enabled: false
  max_per_commit: 8
  types: ["cloze", "why"]

daily_new_limit: 30

priorities:
  M214: 2
  PDE: 1

tags:
  - auto
  - from-tex
  - commit:{sha}
  - file:{file}
```

### 3. Run Renforce

```bash
# Process changes and sync to Anki
python -m renforce.cli process --repo .

# Dry run (preview without syncing)
python -m renforce.cli process --repo . --dry-run

# Offline mode (generate .apkg file)
python -m renforce.cli process --repo . --offline --output dist/notes.apkg
```

## Usage

### Commands

#### `process`

Main command to process LaTeX notes and sync to Anki.

```bash
python -m renforce.cli process [OPTIONS]

Options:
  --repo, -r PATH         Path to Git repository (default: current directory)
  --dry-run, -n          Preview notes without syncing
  --offline              Build .apkg file instead of syncing via AnkiConnect
  --since, -s SHA        Process commits since this SHA (overrides state)
  --output, -o PATH      Output path for .apkg file (default: dist/notes.apkg)
```

#### `set-since`

Manually set the last processed commit SHA.

```bash
python -m renforce.cli set-since <SHA>
```

#### `clear-cache`

Clear the state cache (WARNING: may create duplicates).

```bash
python -m renforce.cli clear-cache [--force]
```

#### `stats`

Display statistics about tracked notes.

```bash
python -m renforce.cli stats
```

#### `reconcile-state`

Reconcile state file with Anki. Shows differences and lets you choose ground truth.

Use when:
- You deleted decks/cards in Anki but state still tracks them
- State file and Anki are out of sync
- Need to verify tracking is correct

```bash
python -m renforce.cli reconcile-state --repo /path/to/notes

# Non-interactive (just show differences)
python -m renforce.cli reconcile-state --repo /path/to/notes --force
```

See [`STATE_RECONCILIATION.md`](STATE_RECONCILIATION.md) for detailed guide.

#### `sync-state`

Rebuild state file from Anki (one-way: Anki → State).

Use when:
- State file was lost or corrupted
- Need to rebuild tracking from existing Anki cards

```bash
python -m renforce.cli sync-state --repo /path/to/notes
```

#### `check-orphans`

Check for orphaned cards (cards in Anki but not in current LaTeX files).

```bash
python -m renforce.cli check-orphans --repo /path/to/notes
```

#### `version`

Display version information.

```bash
python -m renforce.cli version
```

## Configuration

### Course Configuration

Each course maps file paths to Anki decks:

```yaml
courses:
  CourseName:
    paths: ["path/pattern/**/*.tex"]  # Glob patterns
    deck: "DeckName"                   # Target Anki deck
```

### Environment Extraction

Specify which LaTeX environments to extract:

```yaml
envs_to_extract:
  - definition
  - theorem
  - proposition
  - lemma
  - corollary
  - example
  - remark
```

### Tags

Tags are automatically generated from templates:

- `{sha}`: Commit hash (short form)
- `{file}`: File path (sanitized)

## LaTeX Format

Renforce recognizes standard LaTeX environments:

```latex
\begin{definition}[Optional Title]
Content goes here with $math$ support.
\end{definition}

\begin{theorem}[Pythagorean Theorem]
For a right triangle with sides $a, b$ and hypotenuse $c$:
\[
    a^2 + b^2 = c^2
\]
\end{theorem}

\begin{example}
Let $X = \mathbb{R}^2$ with the Euclidean metric...
\end{example}
```

## How It Works

1. **Detect Changes**: Uses Git to find `.tex` files modified since last run
2. **Extract Environments**: Parses LaTeX files for specified environments
3. **Generate GUIDs**: Creates stable identifiers based on content and location
4. **Check State**: Determines if notes are new, updated, or unchanged
5. **Create Cards**: Maps environments to Anki note formats
6. **Sync**: Sends to Anki via AnkiConnect or exports as `.apkg`
7. **Update State**: Records processed commit and note hashes

## Card Format

### Definitions, Theorems, Propositions, Lemmas, Corollaries

- **Front**: Environment type + title (or first sentence)
- **Back**: Full content + source reference

### Examples

- **Front**: "Recall the example from {file}:{line}. What happens and why?"
- **Back**: Full example content + source reference

## State Management

Renforce maintains state in `~/.renforce_state.json`:

```json
{
  "last_processed_sha": "abc123...",
  "note_hashes": {
    "guid": {
      "anki_note_id": 1234567890,
      "deck": "M214",
      "content_hash": "def456...",
      "created_at": "2025-10-31T12:00:00",
      "updated_at": "2025-10-31T12:00:00"
    }
  }
}
```

## Idempotence

Renforce ensures idempotent operations:

- **Same content**: Uses GUID based on `env_name|body|file_path`
- **Content changes**: Updates existing note, adds `rev:YYYYMMDD` tag
- **First run**: Processes only HEAD commit by default

## Troubleshooting

### AnkiConnect connection failed

**Error**: "Cannot connect to AnkiConnect"

**Solution**:
1. Make sure Anki is running
2. Install AnkiConnect add-on (code: 2055492159)
3. Check that Anki isn't blocking the connection
4. Alternative: Use `--offline` mode

### genanki not installed

**Error**: "genanki is not installed"

**Solution**:
```bash
pip install genanki
```

### No environments found

**Cause**: LaTeX files don't contain recognized environments

**Solution**:
1. Check `envs_to_extract` in config
2. Verify LaTeX syntax (e.g., `\begin{definition}...\end{definition}`)
3. Run with `--dry-run` to see what's being processed

### Duplicate notes

**Cause**: State file was cleared or corrupted

**Solution**:
- Delete duplicates manually in Anki
- AnkiConnect has duplicate detection, but it's not perfect
- Use `--dry-run` before running to preview

## Development

### Running Tests

```bash
pytest tests/
```

### Project Structure

```
renforce/
├── renforce/
│   ├── __init__.py
│   ├── cli.py              # CLI interface
│   ├── processor.py        # Main processing logic
│   ├── config.py           # Configuration loading
│   ├── git_utils.py        # Git operations
│   ├── tex_parser.py       # LaTeX parsing
│   ├── note_models.py      # Data models
│   ├── hashing.py          # GUID generation
│   ├── state.py            # State management
│   ├── anki_connect.py     # AnkiConnect client
│   └── apkg_builder.py     # Offline APKG export
├── tests/
│   ├── test_tex_parser.py
│   ├── test_hashing.py
│   └── test_git_utils.py
├── example/
│   ├── renforce.yml
│   └── samples.tex
├── pyproject.toml
├── requirements.txt
└── README.md
```

## Limitations

- Only processes environments at the top level (no nested environments)
- LaTeX rendering depends on Anki's built-in support
- No support for custom theorem styles (yet)
- Images must be handled separately

## Future Enhancements

- LLM-generated cloze deletions and "why" questions
- Custom theorem style detection
- Image extraction and embedding
- Web UI for reviewing changes
- Intake throttling based on priorities

## License

MIT

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Acknowledgments

- [AnkiConnect](https://foosoft.net/projects/anki-connect/) for the Anki API
- [genanki](https://github.com/kerrickstaley/genanki) for offline APKG generation
- [gitpython](https://github.com/gitpython-developers/GitPython) for Git integration


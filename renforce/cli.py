"""Command-line interface for anki-tex."""

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich import print as rprint

from . import __version__

app = typer.Typer(
    name="renforce",
    help="Renforce - Reinforce concepts from LaTeX notes with intelligent Anki flashcards",
    add_completion=False,
)

def version_callback(value: bool):
    """Show version and exit."""
    if value:
        console.print("Renforce version 0.1.0")
        raise typer.Exit()

@app.callback()
def main(
    version: bool = typer.Option(
        None,
        "--version",
        "-v",
        callback=version_callback,
        is_eager=True,
        help="Show version and exit",
    )
):
    """Renforce - Reinforce concepts from LaTeX notes with intelligent Anki flashcards."""
    pass

console = Console()


@app.command()
def process(
    repo: Path = typer.Option(
        Path.cwd(),
        "--repo",
        "-r",
        help="Path to Git repository containing LaTeX notes",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        "-n",
        help="Preview notes without syncing to Anki or updating state",
    ),
    offline: bool = typer.Option(
        False,
        "--offline",
        help="Build .apkg file instead of syncing via AnkiConnect",
    ),
    since: Optional[str] = typer.Option(
        None,
        "--since",
        "-s",
        help="Process commits since this SHA (overrides state file)",
    ),
    output: Path = typer.Option(
        Path("dist/notes.apkg"),
        "--output",
        "-o",
        help="Output path for .apkg file (only used with --offline)",
    ),
    enable_llm: Optional[bool] = typer.Option(
        None,
        "--enable-llm/--disable-llm",
        help="Enable/disable LLM card generation (overrides config)",
    ),
    provider: Optional[str] = typer.Option(
        None,
        "--provider",
        help="LLM provider: openai, anthropic, or gemini (overrides config)",
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model",
        help="LLM model name (overrides config)",
    ),
    limit: Optional[int] = typer.Option(
        None,
        "--limit",
        "-l",
        help="Limit number of blocks to process (useful for testing)",
    ),
):
    """
    Process LaTeX notes and sync to Anki.

    Detects changed files since last commit, extracts LaTeX environments,
    and creates/updates Anki flashcards.
    """
    from .processor import process_repository

    try:
        stats = process_repository(
            repo_path=repo,
            dry_run=dry_run,
            offline=offline,
            since_sha=since,
            apkg_output=output,
            enable_llm=enable_llm,
            llm_provider=provider,
            llm_model=model,
            limit_blocks=limit,
        )

        # Display results
        if dry_run:
            console.print("\n[yellow]DRY RUN - No changes made[/yellow]\n")

        _display_stats(stats, dry_run, offline)

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def set_since(
    sha: str = typer.Argument(..., help="Commit SHA to set as last processed"),
    state_file: Optional[Path] = typer.Option(
        None,
        "--state-file",
        help="Path to state file (default: ~/.anki_tex_state.json)",
    ),
):
    """
    Manually set the last processed commit SHA.

    Useful for skipping commits or resetting state.
    """
    from .state import StateManager

    try:
        manager = StateManager(state_file)
        old_sha = manager.get_last_processed_sha()

        manager.set_last_processed_sha(sha)
        manager.save()

        console.print(f"[green]Updated last processed SHA[/green]")
        console.print(f"  Old: {old_sha or '(none)'}")
        console.print(f"  New: {sha}")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def clear_cache(
    state_file: Optional[Path] = typer.Option(
        None,
        "--state-file",
        help="Path to state file (default: ~/.anki_tex_state.json)",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Skip confirmation prompt",
    ),
):
    """
    Clear the state cache.

    This will cause all notes to be reprocessed on the next run.
    WARNING: This may create duplicate notes if you're not careful!
    """
    from .state import StateManager

    if not force:
        confirm = typer.confirm(
            "Are you sure you want to clear the cache? This may create duplicates!"
        )
        if not confirm:
            console.print("[yellow]Cancelled[/yellow]")
            raise typer.Exit()

    try:
        manager = StateManager(state_file)
        stats = manager.get_stats()

        manager.delete_state_file()

        console.print("[green]State cache cleared[/green]")
        console.print(f"  Removed {stats['total_notes']} tracked notes")
        console.print(f"  Last SHA: {stats['last_processed_sha'] or '(none)'}")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def stats(
    state_file: Optional[Path] = typer.Option(
        None,
        "--state-file",
        help="Path to state file (default: ~/.anki_tex_state.json)",
    ),
):
    """
    Display statistics about tracked notes.
    """
    from .state import StateManager

    try:
        manager = StateManager(state_file)
        stats_data = manager.get_stats()

        console.print("\n[bold]AnkiTex State Statistics[/bold]\n")
        console.print(f"  Total notes tracked: {stats_data['total_notes']}")
        console.print(f"  Last processed SHA: {stats_data['last_processed_sha'] or '(none)'}")

        if stats_data['decks']:
            console.print(f"  Decks: {', '.join(stats_data['decks'])}")

        console.print()

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(code=1)


@app.command()
def reconcile_state(
    repo: Path = typer.Option(
        Path.cwd(),
        "--repo",
        "-r",
        help="Path to Git repository",
    ),
    state_file: Optional[Path] = typer.Option(
        None,
        "--state-file",
        help="Path to state file (default: ~/.anki_tex_state.json)",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Skip confirmation prompts",
    ),
):
    """
    Reconcile state file with Anki.
    
    Compares state file vs. Anki and shows differences:
    - Notes in state but missing in Anki (deleted cards)
    - Notes in Anki but missing in state (orphaned cards)
    
    Allows you to choose ground truth and sync accordingly:
    - Use Anki as truth → Update state to match Anki
    - Use state as truth → Keep state, note what's missing in Anki
    """
    from .anki_connect import SyncAnkiConnectClient
    from .state import StateManager
    from .config import find_config, load_config
    
    console.print("\n[cyan]Reconciling state with Anki...[/cyan]\n")
    
    try:
        # Connect to Anki
        client = SyncAnkiConnectClient()
        if not client.check_connection():
            console.print("[red]Cannot connect to AnkiConnect![/red]")
            console.print("Make sure Anki is running with AnkiConnect installed.")
            raise typer.Exit(code=1)
        
        console.print("✓ Connected to Anki\n")
        
        # Load state
        state = StateManager(state_file)
        state_data = state._state.get("note_hashes", {})
        
        if not state_data:
            console.print("[yellow]State file is empty. Nothing to reconcile.[/yellow]")
            console.print("Use 'sync-state' to rebuild from Anki if needed.")
            return
        
        console.print(f"[cyan]State file tracks {len(state_data)} note(s)[/cyan]")
        
        # Get all notes from Anki with our tags
        query = "tag:auto tag:from-tex"
        anki_note_ids = client.find_notes(query)
        
        if not anki_note_ids:
            console.print("[yellow]No notes found in Anki with tags 'auto' and 'from-tex'[/yellow]")
            console.print("\n[bold]Differences:[/bold]")
            console.print(f"  • State has {len(state_data)} notes, Anki has 0")
            console.print(f"  • All {len(state_data)} notes in state are missing from Anki")
            
            if not force:
                try:
                    choice = typer.confirm(
                        "\nDo you want to clear state file to match Anki? (all tracked notes will be lost)",
                        default=False
                    )
                    if choice:
                        state._state["note_hashes"] = {}
                        state.save()
                        console.print("[green]✓ State file cleared[/green]")
                    else:
                        console.print("[yellow]State file unchanged[/yellow]")
                except (KeyboardInterrupt, EOFError):
                    console.print("\n[yellow]Cancelled. State file unchanged.[/yellow]")
                    raise typer.Exit()
            return
        
        console.print(f"[cyan]Anki has {len(anki_note_ids)} note(s) with matching tags[/cyan]\n")
        
        # Get note info from Anki
        anki_notes_info = client.notes_info(anki_note_ids)
        
        # Build maps for comparison
        # State: GUID → Anki Note ID
        state_guid_to_anki_id = {}
        state_anki_ids = set()
        for guid, info in state_data.items():
            anki_id = info.get("anki_note_id")
            if anki_id:
                state_guid_to_anki_id[guid] = anki_id
                state_anki_ids.add(anki_id)
        
        # Anki: Note ID → GUID (from tags or note fields)
        # Note: We can't directly get GUID from Anki, but we can match by Note ID
        anki_id_set = set(anki_note_ids)
        
        # Find differences
        # 1. Notes in state but not in Anki (deleted from Anki)
        missing_in_anki = []
        for guid, info in state_data.items():
            anki_id = info.get("anki_note_id")
            if anki_id and anki_id not in anki_id_set:
                missing_in_anki.append((guid, anki_id, info))
        
        # 2. Notes in Anki but not in state (orphaned)
        orphaned_in_anki = []
        for note_id in anki_id_set:
            if note_id not in state_anki_ids:
                # Find note info
                note_info = next((n for n in anki_notes_info if n.get("noteId") == note_id), None)
                if note_info:
                    orphaned_in_anki.append((note_id, note_info))
        
        # Display differences
        console.print("[bold]Differences Found:[/bold]\n")
        
        if missing_in_anki:
            console.print(f"[yellow]⚠ {len(missing_in_anki)} note(s) in state but missing from Anki:[/yellow]")
            table = Table(show_header=True)
            table.add_column("GUID (first 24 chars)")
            table.add_column("Deck")
            table.add_column("Anki Note ID")
            
            for guid, anki_id, info in missing_in_anki[:10]:  # Show first 10
                table.add_row(
                    guid[:24] + "...",
                    info.get("deck", "unknown"),
                    str(anki_id)
                )
            
            if len(missing_in_anki) > 10:
                table.add_row(f"... and {len(missing_in_anki) - 10} more", "", "")
            
            console.print(table)
        
        if orphaned_in_anki:
            console.print(f"\n[yellow]⚠ {len(orphaned_in_anki)} note(s) in Anki but not in state:[/yellow]")
            table = Table(show_header=True)
            table.add_column("Anki Note ID")
            table.add_column("Deck")
            table.add_column("Front Preview")
            
            for note_id, note_info in orphaned_in_anki[:10]:  # Show first 10
                fields = note_info.get("fields", {})
                front = fields.get("Front", {}).get("value", "")[:50]
                tags = note_info.get("tags", [])
                deck = note_info.get("deckName", "unknown")
                
                table.add_row(
                    str(note_id),
                    deck,
                    front + "..." if len(front) > 50 else front
                )
            
            if len(orphaned_in_anki) > 10:
                table.add_row(f"... and {len(orphaned_in_anki) - 10} more", "", "")
            
            console.print(table)
        
        if not missing_in_anki and not orphaned_in_anki:
            console.print("[green]✓ State and Anki are in sync![/green]")
            return
        
        # Ask user what to do
        console.print("\n[bold]Reconciliation Options:[/bold]\n")
        console.print("1. [cyan]Use Anki as ground truth[/cyan]")
        console.print("   → Remove missing notes from state")
        console.print("   → Add orphaned notes to state (with pseudo-GUIDs)")
        console.print("   → Result: State matches Anki\n")
        
        console.print("2. [cyan]Keep state as-is[/cyan]")
        console.print("   → State file unchanged")
        console.print("   → Missing notes remain tracked (may be recreated on next process)")
        console.print("   → Orphaned notes remain untracked\n")
        
        console.print("3. [cyan]Manual cleanup[/cyan]")
        console.print("   → Use 'check-orphans' to handle orphaned cards")
        console.print("   → Delete missing cards from state manually\n")
        
        if force:
            console.print("[yellow]--force flag set, skipping interactive prompt[/yellow]")
            console.print("[dim]Run without --force to see interactive options[/dim]")
            return
        
        try:
            choice = typer.prompt(
                "Choose action (1/2/3)",
                type=str,
                default="2"
            )
        except (KeyboardInterrupt, EOFError):
            console.print("\n[yellow]Cancelled. State file unchanged.[/yellow]")
            raise typer.Exit()
        
        if choice == "1":
            # Use Anki as ground truth
            console.print("\n[cyan]Updating state to match Anki...[/cyan]")
            
            # Remove missing notes from state
            removed_count = 0
            for guid, anki_id, info in missing_in_anki:
                if guid in state_data:
                    del state_data[guid]
                    removed_count += 1
            
            # Add orphaned notes to state (with pseudo-GUIDs)
            added_count = 0
            for note_id, note_info in orphaned_in_anki:
                pseudo_guid = f"anki-{note_id}"
                fields = note_info.get("fields", {})
                front = fields.get("Front", {}).get("value", "")
                
                from .hashing import compute_content_hash
                content_hash = compute_content_hash(front)
                
                state_data[pseudo_guid] = {
                    "anki_note_id": note_id,
                    "deck": note_info.get("deckName", "unknown"),
                    "content_hash": content_hash,
                    "created_at": state_data.get(pseudo_guid, {}).get("created_at"),
                    "updated_at": state_data.get(pseudo_guid, {}).get("updated_at"),
                }
                added_count += 1
            
            state._state["note_hashes"] = state_data
            state.save()
            
            console.print(f"[green]✓ State updated:[/green]")
            console.print(f"   • Removed {removed_count} missing note(s)")
            console.print(f"   • Added {added_count} orphaned note(s)")
        
        elif choice == "2":
            console.print("[yellow]State file unchanged[/yellow]")
            console.print("\n[dim]Tip: Missing notes will be recreated if you reprocess from their commit.[/dim]")
            console.print("[dim]Orphaned notes can be handled with 'check-orphans' command.[/dim]")
        
        elif choice == "3":
            console.print("\n[cyan]Manual cleanup recommended:[/cyan]")
            console.print(f"   • Run 'check-orphans' to find orphaned cards")
            console.print(f"   • Review and delete if needed")
            console.print(f"   • Missing notes will be handled on next 'process' run")
        
        else:
            console.print("[yellow]Invalid choice. State unchanged.[/yellow]")
    
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        import traceback
        console.print(traceback.format_exc())
        raise typer.Exit(code=1)


@app.command()
def version():
    """Display version information."""
    console.print(f"anki-tex version {__version__}")


@app.command()
def check_orphans(
    repo: Path = typer.Option(
        Path.cwd(),
        "--repo",
        "-r",
        help="Path to Git repository containing LaTeX notes",
    ),
):
    """
    Check for orphaned cards (notes in Anki but not in current LaTeX files).
    
    This compares the state file with a fresh extraction of all current .tex files
    to identify cards that should potentially be deleted from Anki.
    """
    from .processor import ProcessorError
    from .state import StateManager
    from .config import find_config, load_config
    from .tex_parser import extract_environments
    from .note_models import ExtractedBlock
    from .hashing import compute_guid
    
    try:
        # Load config
        config_path = find_config(repo)
        if not config_path:
            raise ProcessorError(f"Config file not found in {repo}")
        
        config = load_config(config_path)
        
        # Load state
        state = StateManager()
        tracked_guids = set(state._state.get("note_hashes", {}).keys())
        
        if not tracked_guids:
            console.print("[yellow]No tracked notes in state file[/yellow]")
            return
        
        console.print(f"[cyan]Found {len(tracked_guids)} tracked notes in state[/cyan]")
        
        # Extract all current GUIDs from repo
        current_guids = set()
        
        from pathlib import Path as PathlibPath
        for course_name, course_config in config.courses.items():
            for pattern in course_config.paths:
                # Find all matching tex files
                for tex_file in repo.rglob("*.tex"):
                    rel_path = str(tex_file.relative_to(repo))
                    
                    # Check if matches pattern
                    from .git_utils import _filter_by_patterns
                    if _filter_by_patterns([rel_path], [pattern]):
                        # Extract environments
                        with open(tex_file, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        envs = extract_environments(content, config.envs_to_extract)
                        
                        for env in envs:
                            block = ExtractedBlock.from_environment(env, rel_path)
                            current_guids.add(block.guid)
        
        console.print(f"[cyan]Found {len(current_guids)} notes in current LaTeX files[/cyan]")
        
        # Find orphans
        orphaned = tracked_guids - current_guids
        
        if not orphaned:
            console.print("[green]✓ No orphaned notes found![/green]")
            return
        
        console.print(f"\n[yellow]Found {len(orphaned)} potentially orphaned note(s):[/yellow]\n")
        
        table = Table(title="Orphaned Notes")
        table.add_column("GUID (first 24 chars)", style="cyan", no_wrap=True)
        table.add_column("Deck", style="magenta")
        table.add_column("Anki Note ID", style="green")
        
        # Collect note IDs for search query
        note_ids = []
        
        for guid in orphaned:
            note_info = state.get_note_info(guid)
            anki_id = note_info.get("anki_note_id")
            
            table.add_row(
                guid[:24] + "...",
                note_info.get("deck", "unknown"),
                str(anki_id) if anki_id else "N/A"
            )
            
            if anki_id:
                note_ids.append(anki_id)
        
        console.print(table)
        
        # Generate Anki search query
        if note_ids:
            # Use nid: search with comma-separated IDs (no spaces!)
            search_query = f"nid:{','.join(str(nid) for nid in note_ids)}"
            
            console.print("\n[bold green]📋 Copy this search query for Anki:[/bold green]")
            console.print(f"[bold cyan]{search_query}[/bold cyan]")
            
            # Try to copy to clipboard
            try:
                import pyperclip
                pyperclip.copy(search_query)
                console.print("\n[green]✓ Copied to clipboard![/green]")
            except ImportError:
                console.print("\n[dim]Tip: Install pyperclip for automatic clipboard copy: pip install pyperclip[/dim]")
            
            console.print("\n[bold]How to use:[/bold]")
            console.print("  1. Open Anki")
            console.print("  2. Click 'Browse'")
            console.print("  3. Paste the search query above into the search box")
            console.print("  4. Review the cards and delete if appropriate")
        else:
            console.print("\n[yellow]Note: No Anki note IDs found (might be from offline mode)[/yellow]")
        
        console.print("\n[yellow]⚠️  These notes exist in Anki but not in current LaTeX files.[/yellow]")
        console.print("[yellow]   This may be intentional (deleted content) or a false positive (renamed files).[/yellow]")
        
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(code=1)


def _display_stats(stats: dict, dry_run: bool, offline: bool):
    """Display processing statistics."""
    console.print("\n[bold]Processing Results[/bold]\n")

    # Summary
    console.print(f"  Files processed: {stats.get('files_processed', 0)}")
    console.print(f"  Blocks extracted: {stats.get('blocks_extracted', 0)}")
    console.print(f"  Notes created: {stats.get('notes_created', 0)}")
    console.print(f"  Notes updated: {stats.get('notes_updated', 0)}")
    console.print(f"  Notes skipped: {stats.get('notes_skipped', 0)}")

    # Show commit info
    if stats.get('commit_range'):
        console.print(f"\n  Commit range: {stats['commit_range']}")

    # Offline mode info
    if offline and not dry_run:
        apkg_path = stats.get('apkg_path')
        if apkg_path:
            console.print(f"\n[green]Created APKG: {apkg_path}[/green]")
            console.print("Import this file into Anki manually.")

    # Notes table (if any notes were processed)
    notes = stats.get('notes', [])
    if notes and len(notes) <= 20:  # Only show table for reasonable number of notes
        table = Table(title="Processed Notes")
        table.add_column("Environment", style="cyan")
        table.add_column("Title/Preview", style="magenta")
        table.add_column("File", style="green")
        table.add_column("Action", style="yellow")

        for note_info in notes:
            table.add_row(
                note_info.get('env', ''),
                note_info.get('preview', '')[:50],
                f"{note_info.get('file', '')}:{note_info.get('line', '')}",
                note_info.get('action', ''),
            )

        console.print("\n")
        console.print(table)

    elif notes:
        console.print(f"\n  ({len(notes)} notes processed - too many to display)")

    # Warnings
    if stats.get('warnings'):
        console.print("\n[yellow]Warnings:[/yellow]")
        for warning in stats['warnings']:
            console.print(f"  - {warning}")

    # Errors
    if stats.get('errors'):
        console.print("\n[red]Errors:[/red]")
        for error in stats['errors']:
            console.print(f"  - {error}")

    console.print()


def main():
    """Entry point for the CLI."""
    app()


if __name__ == "__main__":
    main()


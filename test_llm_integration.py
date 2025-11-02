#!/usr/bin/env python3
"""
Test script for LLM integration with anki-tex.

This script tests the full pipeline:
1. Loads config with LLM settings
2. Initializes git repo in example/
3. Commits sample LaTeX file
4. Runs processor with LLM enabled (dry-run)
5. Displays generated cards

Run with: python test_llm_integration.py
"""

import os
import sys
import shutil
from pathlib import Path
import subprocess

# Add anki_tex to path
sys.path.insert(0, str(Path(__file__).parent))

from commit.processor import process_repository
from rich.console import Console
from rich.table import Table

console = Console()


def setup_test_repo():
    """Set up a test Git repository in example/."""
    example_dir = Path(__file__).parent / "example"
    
    # Check if already a git repo
    git_dir = example_dir / ".git"
    if git_dir.exists():
        console.print("[dim]Git repo already exists in example/[/dim]")
        return example_dir
    
    console.print("[cyan]Setting up test Git repository...[/cyan]")
    
    # Initialize git
    os.chdir(example_dir)
    subprocess.run(["git", "init"], check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test User"], check=True, capture_output=True)
    
    # Add and commit files
    subprocess.run(["git", "add", "anki-tex.yml", "samples.tex"], check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial commit with sample LaTeX"], check=True, capture_output=True)
    
    console.print("[green]✓ Test repo set up[/green]")
    return example_dir


def test_llm_integration():
    """Test LLM integration with a dry run."""
    import os
    import subprocess
    
    console.print("\n" + "=" * 60)
    console.print("🧪 Testing LLM Integration with AnkiTex")
    console.print("=" * 60 + "\n")
    
    # Step 1: Check for API key
    console.print("[cyan]Step 1: Checking API key...[/cyan]")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        console.print("[red]❌ OPENAI_API_KEY not found in environment[/red]")
        console.print("Please set it in .env or export it:")
        console.print("  export OPENAI_API_KEY=sk-...")
        return False
    console.print(f"[green]✓ API key found (length: {len(api_key)})[/green]")
    
    # Step 2: Set up test repo
    console.print("\n[cyan]Step 2: Setting up test repository...[/cyan]")
    try:
        repo_path = setup_test_repo()
    except Exception as e:
        console.print(f"[red]❌ Failed to set up test repo: {e}[/red]")
        return False
    
    # Step 3: Clear state file (avoid SHA conflicts between repos)
    console.print("\n[cyan]Step 3: Clearing state file...[/cyan]")
    state_file = Path.home() / ".anki_tex_state.json"
    if state_file.exists():
        os.remove(state_file)
        console.print(f"[green]✓ Removed old state file[/green]")
    else:
        console.print(f"[dim]No state file to clear[/dim]")
    
    # Step 4: Run processor with LLM enabled (dry-run)
    console.print("\n[cyan]Step 4: Running processor with LLM (dry-run)...[/cyan]")
    try:
        stats = process_repository(
            repo_path=repo_path,
            dry_run=True,
            offline=False,
            since_sha=None,  # Use default behavior (HEAD only for new repo)
            enable_llm=True,
            llm_provider="openai",
            llm_model="gpt-4o-mini",
        )
        
        # Display results
        console.print("\n" + "=" * 60)
        console.print("📊 Results")
        console.print("=" * 60)
        
        table = Table(show_header=True)
        table.add_column("Metric")
        table.add_column("Value", justify="right")
        
        table.add_row("Files processed", str(stats.get("files_processed", 0)))
        table.add_row("Blocks extracted", str(stats.get("blocks_extracted", 0)))
        table.add_row("Notes created", str(stats.get("notes_created", 0)))
        table.add_row("Notes updated", str(stats.get("notes_updated", 0)))
        table.add_row("Notes skipped", str(stats.get("notes_skipped", 0)))
        
        console.print(table)
        
        # Show some example notes
        if stats.get("notes"):
            console.print("\n[cyan]Sample Notes:[/cyan]")
            for i, note in enumerate(stats["notes"][:3], 1):
                console.print(f"\n{i}. [{note['env']}] {note['preview']}")
                console.print(f"   File: {note['file']}:{note['line']}")
                console.print(f"   Action: {note['action']}")
        
        console.print("\n[green]✅ Test completed successfully![/green]")
        return True
        
    except Exception as e:
        console.print(f"\n[red]❌ Test failed: {e}[/red]")
        import traceback
        console.print(traceback.format_exc())
        return False


if __name__ == "__main__":
    # Load .env if it exists
    from dotenv import load_dotenv
    load_dotenv()
    
    success = test_llm_integration()
    sys.exit(0 if success else 1)


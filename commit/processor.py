"""Main processing logic for anki-tex."""

import json
from pathlib import Path
from typing import Dict, List, Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .anki_connect import AnkiConnectError, SyncAnkiConnectClient
from .apkg_builder import APKGBuilderError, build_apkg, is_genanki_available
from .config import find_config, load_config
from .git_utils import GitError, get_changed_files, get_current_sha
from .llm_client import LLMClient, create_llm_client
from .note_models import AnkiNote, ExtractedBlock, NoteMapper, create_revision_tag, validate_card_content
from .prompts import CARDS_SYSTEM_PROMPT, BATCH_CARDS_SYSTEM_PROMPT
from .security import strip_dangerous_latex
from .state import StateManager
from .tex_parser import extract_environments, extract_neighbor_context, inject_guid_comment

console = Console()


class ProcessorError(Exception):
    """Exception raised during processing."""

    pass


def process_repository(
    repo_path: Path,
    dry_run: bool = False,
    offline: bool = False,
    since_sha: Optional[str] = None,
    apkg_output: Path = Path("dist/notes.apkg"),
    enable_llm: Optional[bool] = None,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
    limit_blocks: Optional[int] = None,
) -> Dict:
    """
    Main processing function for repository.

    Args:
        repo_path: Path to Git repository
        dry_run: If True, don't modify Anki or state
        offline: If True, build .apkg instead of using AnkiConnect
        since_sha: Override state file to process from this SHA
        apkg_output: Path for offline .apkg output

    Returns:
        Dictionary with processing statistics

    Raises:
        ProcessorError: If processing fails
    """
    stats = {
        "files_processed": 0,
        "blocks_extracted": 0,
        "notes_created": 0,
        "notes_updated": 0,
        "notes_skipped": 0,
        "notes": [],
        "warnings": [],
        "errors": [],
    }

    # Step 1: Load configuration
    console.print("[cyan]Loading configuration...[/cyan]")
    config_path = find_config(repo_path)
    if not config_path:
        raise ProcessorError(
            f"Config file not found in {repo_path}. "
            "Create commit.yml with your course configuration."
        )

    try:
        config = load_config(config_path)
    except Exception as e:
        raise ProcessorError(f"Failed to load config: {e}") from e

    console.print(f"  Loaded config from {config_path.name}")
    console.print(f"  Courses: {', '.join(config.courses.keys())}")
    console.print(f"  Environments: {', '.join(config.envs_to_extract)}")

    # Initialize LLM if enabled
    llm_client: Optional[LLMClient] = None
    use_llm = enable_llm if enable_llm is not None else config.llm.enable_generated
    
    if use_llm:
        provider = llm_provider or config.llm.provider
        model = llm_model or config.llm.model
        
        console.print(f"\n[cyan]Initializing LLM...[/cyan]")
        console.print(f"  Provider: {provider}")
        console.print(f"  Model: {model}")
        
        try:
            # Get API key from environment
            from .config import get_api_key
            api_key = get_api_key(provider)
            
            # Create client using factory
            llm_client = create_llm_client(
                provider=provider,
                api_key=api_key,
                model=model,
                temperature=config.llm.temperature,
                max_tokens=config.llm.max_output_tokens,
            )
            console.print("  [green]✓ LLM client ready[/green]")
        except Exception as e:
            if dry_run:
                console.print(f"  [yellow]⚠ LLM init failed: {e} (continuing in dry-run)[/yellow]")
                use_llm = False
            else:
                raise ProcessorError(f"Failed to initialize LLM: {e}") from e
    else:
        console.print(f"\n[dim]LLM disabled - using basic card generation[/dim]")

    # Step 2: Load state
    console.print("\n[cyan]Loading state...[/cyan]")
    state = StateManager()
    last_sha = state.get_last_processed_sha()

    # Override with --since if provided
    if since_sha:
        last_sha = since_sha
        console.print(f"  Using SHA from --since: {since_sha[:8]}")
    elif last_sha:
        console.print(f"  Last processed: {last_sha[:8]}")
    else:
        console.print("  No previous state (will process HEAD commit only)")

    # Step 3: Get current SHA and changed files
    console.print("\n[cyan]Detecting changes...[/cyan]")
    try:
        current_sha = get_current_sha(repo_path)
        console.print(f"  Current HEAD: {current_sha[:8]}")

        if last_sha == current_sha and not since_sha:
            console.print("[yellow]No new commits to process[/yellow]")
            return stats

        # Collect all path patterns from courses
        all_patterns = []
        for course_config in config.courses.values():
            all_patterns.extend(course_config.paths)

        changed_files = get_changed_files(
            repo_path, since_sha=last_sha, path_patterns=all_patterns
        )

        if not changed_files:
            console.print("[yellow]No .tex files changed[/yellow]")
            # Still update SHA even if no files changed
            if not dry_run:
                state.set_last_processed_sha(current_sha)
                state.save()
            return stats

        console.print(f"  Found {len(changed_files)} changed .tex file(s)")
        stats["commit_range"] = f"{last_sha[:8] if last_sha else 'initial'}..{current_sha[:8]}"

    except GitError as e:
        raise ProcessorError(f"Git error: {e}") from e

    # Step 4: Process each file
    console.print("\n[cyan]Extracting LaTeX environments...[/cyan]")

    all_blocks: List[ExtractedBlock] = []
    course_blocks: Dict[str, List[ExtractedBlock]] = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Processing files...", total=len(changed_files))

        for file_path in changed_files:
            try:
                # Determine which course this file belongs to
                course_name = _match_file_to_course(file_path, config.courses)
                if not course_name:
                    stats["warnings"].append(
                        f"File {file_path} doesn't match any course pattern"
                    )
                    continue

                # Read file content
                full_path = repo_path / file_path
                if not full_path.exists():
                    stats["warnings"].append(f"File not found: {file_path}")
                    continue

                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Extract environments
                environments = extract_environments(content, config.envs_to_extract)

                # Convert to ExtractedBlocks and extract context if LLM enabled
                for env in environments:
                    block = ExtractedBlock.from_environment(env, file_path)
                    
                    # If GUID was extracted from LaTeX (short version), match to full GUID in state
                    if env.guid and len(env.guid) < 40:
                        # Short GUID extracted - match to full GUID in state
                        from .hashing import match_short_guid_to_full
                        state_guids = list(state.state.get("note_hashes", {}).keys())
                        matched_full_guid = match_short_guid_to_full(env.guid, state_guids)
                        
                        if matched_full_guid:
                            # Found unique match - use full GUID
                            block.guid = matched_full_guid
                        # If no match or collision, keep generated GUID (will inject new one)
                    
                    # Extract neighbor context for LLM if enabled
                    if use_llm:
                        neighbor_context = extract_neighbor_context(
                            content,
                            env.start_line,
                            env.end_line,
                            total_context_lines=config.llm.neighbor_context_lines,
                        )
                        # Store context in block for later use
                        block.neighbor_context = neighbor_context
                    
                    # Apply limit if specified (for testing)
                    if limit_blocks is None or len(all_blocks) < limit_blocks:
                        all_blocks.append(block)

                        if course_name not in course_blocks:
                            course_blocks[course_name] = []
                        course_blocks[course_name].append(block)
                    
                    # Stop early if limit reached
                    if limit_blocks and len(all_blocks) >= limit_blocks:
                        break

                stats["files_processed"] += 1
                stats["blocks_extracted"] += len(environments)
                
                # Stop processing files if limit reached
                if limit_blocks and len(all_blocks) >= limit_blocks:
                    break

            except Exception as e:
                stats["errors"].append(f"Error processing {file_path}: {e}")

            progress.update(task, advance=1)

    console.print(f"  Extracted {stats['blocks_extracted']} block(s)")

    if not all_blocks:
        console.print("[yellow]No environments found[/yellow]")
        # Still update SHA
        if not dry_run:
            state.set_last_processed_sha(current_sha)
            state.save()
        return stats

    # Step 5: Generate Anki notes
    console.print("\n[cyan]Generating Anki notes...[/cyan]")

    anki_notes: List[AnkiNote] = []
    note_actions: List[Dict] = []

    if use_llm and llm_client:
        # BATCH PROCESSING MODE: Process all blocks at once with LLM
        # Collect all blocks with metadata
        all_blocks_with_meta = []
        for course_name, blocks in course_blocks.items():
            course_config = config.courses[course_name]
            deck_name = course_config.deck
            priority = config.priorities.get(course_name, 1)
            
            for block in blocks:
                all_blocks_with_meta.append({
                    "block": block,
                    "course": course_name,
                    "priority": priority,
                    "deck": deck_name
                })
        
        # Call batch generation function
        note_actions = _generate_cards_batch_with_llm(
            all_blocks_with_meta,
            llm_client,
            config,
            state,
            current_sha
        )
        
        # Update stats
        for na in note_actions:
            action = na["action"]
            block = na["block"]
            note = na["note"]
            
            if action == "create":
                stats["notes_created"] += 1
            elif action == "update":
                stats["notes_updated"] += 1
            else:
                stats["notes_skipped"] += 1
            
            anki_notes.append(note)
            
            stats["notes"].append({
                "env": block.env,
                "preview": block.title or block.normalized_body[:50],
                "file": block.file_path,
                "line": block.line_number,
                "action": "llm-batch"
            })
    
    else:
        # BASIC MODE: Process blocks one at a time without LLM
        for course_name, blocks in course_blocks.items():
            course_config = config.courses[course_name]
            deck_name = course_config.deck
            mapper = NoteMapper(course_name, current_sha)

            for block in blocks:
                # Check if note exists and has changed
                if state.is_note_seen(block.guid):
                    if state.has_note_changed(block.guid, block.content_hash):
                        action = "update"
                        stats["notes_updated"] += 1
                    else:
                        action = "skip"
                        stats["notes_skipped"] += 1
                else:
                    action = "create"
                    stats["notes_created"] += 1

                # Generate note
                anki_note = mapper.map_block(block, deck_name)
                anki_notes.append(anki_note)

                # Track for display
                note_actions.append({
                    "note": anki_note,
                    "action": action,
                    "block": block,
                })

                stats["notes"].append({
                    "env": block.env,
                    "preview": block.title or block.normalized_body[:50],
                    "file": block.file_path,
                    "line": block.line_number,
                    "action": "basic"
                })

    # Step 6: Sync to Anki (if not dry-run)
    if dry_run:
        console.print("[yellow]Dry run - skipping sync[/yellow]")
        return stats

    if offline:
        # Offline mode: build .apkg
        console.print("\n[cyan]Building .apkg file...[/cyan]")

        if not is_genanki_available():
            raise ProcessorError(
                "genanki is not installed. Install with: pip install genanki"
            )

        try:
            # Only include notes that are new or updated
            notes_to_export = [
                na["note"]
                for na in note_actions
                if na["action"] in ("create", "update")
            ]

            if not notes_to_export:
                console.print("[yellow]No notes to export[/yellow]")
                return stats

            apkg_path = build_apkg(notes_to_export, apkg_output)
            stats["apkg_path"] = apkg_path

            console.print(f"[green]Created {apkg_path}[/green]")

            # Update state (even in offline mode)
            for na in note_actions:
                if na["action"] in ("create", "update"):
                    block = na["block"]
                    state.record_note(
                        block.guid,
                        None,  # No Anki note ID in offline mode
                        na["note"].deck_name,
                        block.content_hash,
                    )

            state.set_last_processed_sha(current_sha)
            state.save()

        except APKGBuilderError as e:
            raise ProcessorError(f"Failed to build APKG: {e}") from e

    else:
        # Online mode: sync via AnkiConnect
        console.print("\n[cyan]Syncing to Anki via AnkiConnect...[/cyan]")

        client = SyncAnkiConnectClient()

        # Check connection
        if not client.check_connection():
            raise ProcessorError(
                "Cannot connect to AnkiConnect. "
                "Make sure Anki is running with AnkiConnect installed, "
                "or use --offline to generate an .apkg file instead."
            )

        try:
            # Create decks if needed
            for course_config in config.courses.values():
                client.create_deck(course_config.deck)

            # Track which blocks have had GUIDs injected (to avoid duplicates)
            blocks_with_injected_guids = set()

            # Process notes
            for na in note_actions:
                note = na["note"]
                action = na["action"]
                block = na["block"]

                if action == "create":
                    # Validate note before sending to AnkiConnect
                    front = note.fields.get("Front", "")
                    back = note.fields.get("Back", "")
                    
                    is_valid, error_msg = validate_card_content(front, back, note.model_name)
                    if not is_valid:
                        console.print(f"[yellow]  Warning: Skipping invalid note from {block.file_path}:{block.line_number}[/yellow]")
                        console.print(f"[yellow]    Reason: {error_msg}[/yellow]")
                        console.print(f"[yellow]    Front: '{front[:50]}...' Back: '{back[:50]}...'[/yellow]")
                        stats["warnings"].append(
                            f"Skipped invalid note ({error_msg}): {block.file_path}:{block.line_number}"
                        )
                        continue
                    
                    # Double-check: skip if already in state (safety net)
                    if state.is_note_seen(note.guid):
                        console.print(f"[dim]  Skipping duplicate GUID: {note.guid[:16]}...[/dim]")
                        stats["notes_skipped"] += 1
                        continue
                    
                    # Add new note
                    anki_format = [note.to_anki_connect_format()]
                    note_ids = client.add_notes(anki_format)

                    if note_ids and note_ids[0]:
                        state.record_note(
                            block.guid,
                            note_ids[0],
                            note.deck_name,
                            block.content_hash,
                        )
                        
                        # Inject GUID into source file if it doesn't exist
                        # Only inject once per block (even if multiple LLM cards)
                        block_key = (block.file_path, block.line_number)
                        if block_key not in blocks_with_injected_guids:
                            full_path = repo_path / block.file_path
                            if full_path.exists():
                                try:
                                    # Check if GUID comment exists in context window
                                    with open(full_path, 'r', encoding='utf-8') as f:
                                        lines = f.readlines()
                                    
                                    context_start = max(0, block.line_number - 21)
                                    context_lines = lines[context_start:block.line_number - 1]
                                    
                                    import re
                                    # Match any GUID length (8-40 chars)
                                    guid_pattern = re.compile(r'%\s*(?:anki-tex-)?guid:\s*[a-f0-9]{8,40}', re.IGNORECASE)
                                    has_guid = any(guid_pattern.search(line) for line in context_lines)
                                    
                                    if not has_guid:
                                        # Inject GUID comment
                                        inject_guid_comment(str(full_path), block.line_number, block.guid)
                                        console.print(f"[dim]  ✓ Injected GUID into {block.file_path}:{block.line_number}[/dim]")
                                        blocks_with_injected_guids.add(block_key)
                                except Exception as e:
                                    # Non-fatal: log but continue
                                    stats["warnings"].append(
                                        f"Could not inject GUID into {block.file_path}:{block.line_number}: {e}"
                                    )
                    else:
                        stats["warnings"].append(
                            f"Failed to add note for {block.file_path}:{block.line_number}"
                        )

                elif action == "update":
                    # Update existing note
                    anki_note_id = state.get_anki_note_id(block.guid)

                    if anki_note_id:
                        client.update_note_fields(anki_note_id, note.fields)

                        # Add revision tag
                        rev_tag = create_revision_tag()
                        client.add_tags([anki_note_id], rev_tag)

                        # Update state
                        state.record_note(
                            block.guid,
                            anki_note_id,
                            note.deck_name,
                            block.content_hash,
                        )
                    else:
                        stats["warnings"].append(
                            f"Note {block.guid[:8]} has no Anki ID, treating as new"
                        )
                        # Try to add as new
                        anki_format = [note.to_anki_connect_format()]
                        note_ids = client.add_notes(anki_format)
                        if note_ids and note_ids[0]:
                            state.record_note(
                                block.guid,
                                note_ids[0],
                                note.deck_name,
                                block.content_hash,
                            )

            # Update state
            state.set_last_processed_sha(current_sha)
            state.save()

            console.print("[green]Sync complete[/green]")

        except AnkiConnectError as e:
            raise ProcessorError(f"AnkiConnect error: {e}") from e

    return stats


def _generate_cards_with_llm(
    block: ExtractedBlock,
    course_name: str,
    deck_name: str,
    llm_client: LLMClient,
    config,
    state: StateManager,
) -> List[AnkiNote]:
    """
    Use LLM to generate cards from a block.
    
    Args:
        block: Extracted block to generate cards from
        course_name: Course name for tagging
        deck_name: Deck to add cards to
        llm_client: Initialized LLM client
        config: App configuration
        state: State manager for logging
    
    Returns:
        List of AnkiNote objects (may be empty if LLM fails)
    """
    # Prepare user payload
    user_payload = {
        "course": course_name,
        "file": block.file_path,
        "env": block.env,
        "title": block.title or "",
        "body": strip_dangerous_latex(block.body),
        "neighbor_context": strip_dangerous_latex(block.neighbor_context or ""),
        "allow_generated": config.llm.enable_generated,
        "max_cards": config.llm.max_cards_per_block,
    }
    
    # Generate system prompt with config values
    system_prompt = CARDS_SYSTEM_PROMPT.format(
        max_cards=config.llm.max_cards_per_block,
        paraphrase_strength=config.llm.paraphrase_strength
    )
    
    try:
        # Call LLM
        cards = llm_client.generate_cards(system_prompt, user_payload)
        
        # Log generation to state for audit
        state.record_llm_generation(
            guid=block.guid,
            response={"cards": cards},
            model=config.llm.model,
            provider=config.llm.provider,
        )
        
        # Convert LLM cards to AnkiNote objects
        anki_notes = []
        for i, card in enumerate(cards):
            model_name = card.get("model", "Basic")
            front = card.get("front", "").strip()
            back = card.get("back", "").strip()
            tags = card.get("tags", [])
            
            # Skip empty cards (LLM sometimes returns incomplete cards)
            if not front:
                console.print(f"[yellow]  Warning: Skipping card {i+1} with empty front[/yellow]")
                continue
            
            # For Basic cards, back is required; for Cloze, back is optional
            if model_name == "Basic" and not back:
                console.print(f"[yellow]  Warning: Skipping Basic card {i+1} with empty back[/yellow]")
                continue
            
            # Add standard tags
            if "auto" not in tags:
                tags.append("auto")
            if "from-tex" not in tags:
                tags.append("from-tex")
            tags.append(f"course:{course_name}")
            tags.append(f"file:{block.file_path.split('/')[0]}")  # First dir as tag
            
            # Create note
            # For LLM-generated cards, create GUID based on CONTENT (not index)
            # This ensures the same card content always gets the same GUID
            from .hashing import compute_content_hash, compute_guid
            card_content = f"{front}|{back}"
            content_hash = compute_content_hash(card_content)
            
            # Generate stable GUID from block + card content
            # This prevents duplicates even if LLM generates same card multiple times
            note_guid = compute_guid(
                env_name=f"{block.env}::llm",
                normalized_body=card_content,
                file_path=block.file_path
            )
            
            note = AnkiNote(
                guid=note_guid,
                model_name=model_name,
                deck_name=deck_name,
                fields={"Front": front, "Back": back},
                tags=tags,
                content_hash=content_hash,
            )
            anki_notes.append(note)
        
        return anki_notes
        
    except Exception as e:
        console.print(f"[yellow]LLM generation failed for {block.file_path}:{block.line_number}: {e}[/yellow]")
        return []


def _create_anki_note_from_card(
    card: Dict,
    block: ExtractedBlock,
    course_name: str,
    deck_name: str
) -> Optional[AnkiNote]:
    """
    Create an AnkiNote from a card dict generated by LLM.
    
    Args:
        card: Dict with model, front, back, tags
        block: The source block
        course_name: Course name
        deck_name: Deck name
    
    Returns:
        AnkiNote or None if invalid
    """
    from .hashing import compute_content_hash, compute_guid
    
    model_name = card.get("model", "Basic")
    front = card.get("front", "").strip()
    back = card.get("back", "").strip()
    tags = card.get("tags", [])
    
    # Validate card content
    is_valid, error_msg = validate_card_content(front, back, model_name)
    if not is_valid:
        console.print(f"[yellow]  Skipping invalid card: {error_msg}[/yellow]")
        return None
    
    # Add standard tags
    if "auto" not in tags:
        tags.append("auto")
    if "from-tex" not in tags:
        tags.append("from-tex")
    tags.append(f"course:{course_name}")
    tags.append(f"file:{block.file_path.split('/')[0]}")
    
    # Create stable GUID based on card content
    card_content = f"{front}|{back}"
    content_hash = compute_content_hash(card_content)
    note_guid = compute_guid(
        env_name=f"{block.env}::llm",
        normalized_body=card_content,
        file_path=block.file_path
    )
    
    return AnkiNote(
        guid=note_guid,
        model_name=model_name,
        deck_name=deck_name,
        fields={"Front": front, "Back": back},
        tags=tags,
        content_hash=content_hash,
    )


def _generate_cards_batch_with_llm(
    blocks_with_meta: List[Dict],
    llm_client: LLMClient,
    config,
    state: StateManager,
    current_sha: str
) -> List[Dict]:
    """
    Generate cards from multiple blocks in batch mode.
    LLM sees all blocks and decides which deserve cards based on quality and priorities.
    
    Args:
        blocks_with_meta: List of dicts with block, course, priority, deck
        llm_client: LLM client
        config: App config
        state: State manager
        current_sha: Current commit SHA
    
    Returns:
        List of note action dicts with note, action, block
    """
    if not blocks_with_meta:
        return []
    
    console.print(f"[cyan]Processing {len(blocks_with_meta)} blocks in batch mode...[/cyan]")
    
    # Build batch payload
    batch_payload = {
        "blocks": [],
        "priorities": {},
        "daily_limit": config.daily_new_limit,
        "constraints": {
            "max_cards_per_block": config.llm.max_cards_per_block,
            "paraphrase_strength": config.llm.paraphrase_strength,
        }
    }
    
    for i, meta in enumerate(blocks_with_meta):
        block = meta["block"]
        batch_payload["blocks"].append({
            "index": i,
            "course": meta["course"],
            "priority": meta["priority"],
            "env": block.env,
            "title": block.title or "",
            "body": strip_dangerous_latex(block.body)[:2000],  # Truncate very long blocks
            "file": block.file_path,
            "line": block.line_number,
            "neighbor_context": strip_dangerous_latex(block.neighbor_context or "")[:1000]
        })
        batch_payload["priorities"][meta["course"]] = meta["priority"]
    
    # Format batch prompt
    system_prompt = BATCH_CARDS_SYSTEM_PROMPT.format(
        total_blocks=len(blocks_with_meta),
        daily_limit=config.daily_new_limit,
        max_cards_per_block=config.llm.max_cards_per_block,
        paraphrase_strength=config.llm.paraphrase_strength
    )
    
    # Call LLM
    try:
        response = llm_client.generate_cards_batch(system_prompt, batch_payload)
        
        # Log response for audit
        state.record_llm_generation(
            guid=f"batch_{current_sha}",
            response=response,
            model=config.llm.model,
            provider=config.llm.provider,
        )
        
        # Parse response and create AnkiNotes
        note_actions = []
        selected_blocks = response.get("selected_blocks", [])
        skipped_blocks = response.get("skipped_blocks", [])
        
        console.print(f"[green]✓ LLM selected {len(selected_blocks)} blocks, skipped {len(skipped_blocks)}[/green]")
        
        for selected in selected_blocks:
            block_idx = selected.get("block_index")
            if block_idx is None or block_idx >= len(blocks_with_meta):
                continue
                
            meta = blocks_with_meta[block_idx]
            block = meta["block"]
            
            console.print(f"[dim]  ✓ Block {block_idx}: {block.file_path}:{block.line_number} ({selected.get('reasoning', 'No reason')})[/dim]")
            
            for card in selected.get("cards", []):
                note = _create_anki_note_from_card(
                    card, block, meta["course"], meta["deck"]
                )
                if note:
                    # Check if note already exists to determine action
                    if state.is_note_seen(note.guid):
                        if state.has_note_changed(note.guid, note.content_hash):
                            action = "update"
                        else:
                            action = "skip"
                    else:
                        action = "create"
                    
                    note_actions.append({
                        "note": note,
                        "action": action,
                        "block": block
                    })
        
        # Log skipped blocks
        for skipped in skipped_blocks:
            block_idx = skipped.get("block_index")
            reasoning = skipped.get("reasoning", "No reason provided")
            if block_idx is not None and block_idx < len(blocks_with_meta):
                meta = blocks_with_meta[block_idx]
                block = meta["block"]
                console.print(f"[dim]  Skipped block {block_idx}: {block.file_path}:{block.line_number} - {reasoning}[/dim]")
        
        # Show summary if available
        summary = response.get("summary", {})
        if summary:
            console.print(f"\n[cyan]Batch Summary:[/cyan]")
            console.print(f"  Total blocks: {summary.get('total_blocks', len(blocks_with_meta))}")
            console.print(f"  Selected: {summary.get('selected_count', len(selected_blocks))}")
            console.print(f"  Cards generated: {summary.get('total_cards', len(note_actions))}")
            console.print(f"  Daily limit: {summary.get('daily_limit', config.daily_new_limit)}")
            if summary.get('quality_threshold_met'):
                console.print(f"  [green]✓ Quality threshold maintained[/green]")
        
        return note_actions
        
    except Exception as e:
        console.print(f"[yellow]Batch LLM failed: {e}. Falling back to basic mapping.[/yellow]")
        # Fallback: create basic cards for all blocks
        note_actions = []
        mapper = NoteMapper("", current_sha)  # Temporary mapper
        
        for meta in blocks_with_meta:
            block = meta["block"]
            note = mapper.map_block(block, meta["deck"])
            note_actions.append({
                "note": note,
                "action": "create" if not state.is_note_seen(note.guid) else "skip",
                "block": block
            })
        
        return note_actions


def _match_file_to_course(file_path: str, courses: Dict) -> Optional[str]:
    """
    Match a file path to a course based on path patterns.

    Args:
        file_path: Relative file path
        courses: Dictionary of course configurations

    Returns:
        Course name or None if no match
    """
    # Import the fixed pattern matching from git_utils
    from .git_utils import _filter_by_patterns

    for course_name, course_config in courses.items():
        # Use the fixed glob matching that supports **
        matched = _filter_by_patterns([file_path], course_config.paths)
        if matched:
            return course_name

    return None


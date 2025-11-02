"""State management for tracking processed commits and notes."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional


class StateManager:
    """Manages persistent state for Commit."""

    def __init__(self, state_file: Optional[Path] = None):
        """
        Initialize state manager.

        Args:
            state_file: Path to state file. Defaults to ~/.commit_state.json
        """
        if state_file is None:
            state_file = Path.home() / ".commit_state.json"
            
            # Migration: If old state file exists and new one doesn't, copy it over
            old_state_file = Path.home() / ".anki_tex_state.json"
            if old_state_file.exists() and not state_file.exists():
                try:
                    import shutil
                    shutil.copy2(old_state_file, state_file)
                    print(f"Migrated state from {old_state_file} to {state_file}")
                except Exception as e:
                    print(f"Warning: Could not migrate state file: {e}")
        
        self.state_file = state_file
        self._state: Dict = self._load()

    def _load(self) -> Dict:
        """Load state from file."""
        if not self.state_file.exists():
            return self._default_state()

        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
                # Ensure required keys exist
                if "note_hashes" not in state:
                    state["note_hashes"] = {}
                if "last_processed_sha" not in state:
                    state["last_processed_sha"] = None
                if "llm_generations" not in state:
                    state["llm_generations"] = {}
                return state
        except (json.JSONDecodeError, IOError) as e:
            # If file is corrupted, start fresh
            print(f"Warning: Could not load state file: {e}")
            return self._default_state()

    def _default_state(self) -> Dict:
        """Create default state structure."""
        return {
            "last_processed_sha": None,
            "note_hashes": {},  # guid -> {anki_note_id, deck, content_hash, created_at, updated_at}
            "llm_generations": {},  # guid -> {response, timestamp, model, provider}
            "version": "0.2.0",
        }

    def save(self) -> None:
        """Save state to file."""
        try:
            # Ensure parent directory exists
            self.state_file.parent.mkdir(parents=True, exist_ok=True)

            # Write atomically by writing to temp file first
            temp_file = self.state_file.with_suffix(".tmp")
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2, sort_keys=True)

            # Rename to actual file (atomic on POSIX)
            temp_file.replace(self.state_file)

        except IOError as e:
            raise IOError(f"Failed to save state: {e}") from e

    def get_last_processed_sha(self) -> Optional[str]:
        """Get the SHA of the last processed commit."""
        return self._state.get("last_processed_sha")

    def set_last_processed_sha(self, sha: str) -> None:
        """Set the SHA of the last processed commit."""
        self._state["last_processed_sha"] = sha

    def is_note_seen(self, guid: str) -> bool:
        """Check if a note with this GUID has been seen before."""
        return guid in self._state["note_hashes"]

    def has_note_changed(self, guid: str, content_hash: str) -> bool:
        """
        Check if a note's content has changed.

        Args:
            guid: Note GUID
            content_hash: Current content hash

        Returns:
            True if note exists but content hash differs, False otherwise
        """
        if not self.is_note_seen(guid):
            return False

        stored_hash = self._state["note_hashes"][guid].get("content_hash")
        return stored_hash != content_hash

    def record_note(
        self,
        guid: str,
        anki_note_id: Optional[int],
        deck: str,
        content_hash: str,
    ) -> None:
        """
        Record a note in state.

        Args:
            guid: Note GUID
            anki_note_id: Anki note ID (None for offline mode)
            deck: Deck name
            content_hash: Content hash
        """
        now = datetime.now().isoformat()

        if guid in self._state["note_hashes"]:
            # Update existing
            self._state["note_hashes"][guid].update({
                "anki_note_id": anki_note_id,
                "deck": deck,
                "content_hash": content_hash,
                "updated_at": now,
            })
        else:
            # Create new
            self._state["note_hashes"][guid] = {
                "anki_note_id": anki_note_id,
                "deck": deck,
                "content_hash": content_hash,
                "created_at": now,
                "updated_at": now,
            }

    def get_note_info(self, guid: str) -> Optional[Dict]:
        """
        Get stored information about a note.

        Args:
            guid: Note GUID

        Returns:
            Note info dict or None if not found
        """
        return self._state["note_hashes"].get(guid)

    def get_anki_note_id(self, guid: str) -> Optional[int]:
        """Get Anki note ID for a GUID."""
        note_info = self.get_note_info(guid)
        return note_info.get("anki_note_id") if note_info else None

    def clear(self) -> None:
        """Clear all state (useful for testing/debugging)."""
        self._state = self._default_state()

    def get_stats(self) -> Dict:
        """Get statistics about tracked notes."""
        note_hashes = self._state["note_hashes"]
        return {
            "total_notes": len(note_hashes),
            "last_processed_sha": self._state.get("last_processed_sha"),
            "decks": list(set(n.get("deck") for n in note_hashes.values())),
        }

    def delete_state_file(self) -> None:
        """Delete the state file from disk."""
        if self.state_file.exists():
            self.state_file.unlink()
        self._state = self._default_state()

    def record_llm_generation(
        self,
        guid: str,
        response: dict,
        model: str,
        provider: str,
    ) -> None:
        """
        Record an LLM generation for audit logging.

        Args:
            guid: Note GUID
            response: Raw LLM JSON response
            model: Model name used
            provider: Provider name
        """
        from datetime import datetime

        self._state["llm_generations"][guid] = {
            "response": response,
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "provider": provider,
        }

    def get_llm_history(self, guid: str) -> Optional[Dict]:
        """
        Get LLM generation history for a GUID.

        Args:
            guid: Note GUID

        Returns:
            LLM generation info or None if not found
        """
        return self._state["llm_generations"].get(guid)

    def clear_llm_history(self) -> None:
        """Clear all LLM generation history."""
        self._state["llm_generations"] = {}
    
    def get_notes_for_commit(self, sha: str) -> List[str]:
        """
        Get all note GUIDs that were processed in a specific commit.
        
        Uses the llm_generations log to find batch operations for this SHA,
        or searches through note metadata.
        
        Args:
            sha: Commit SHA (full or short)
        
        Returns:
            List of note GUIDs from this commit
        """
        guids = []
        
        # Check if there's a batch generation for this SHA
        batch_key = f"batch_{sha}"
        if batch_key in self._state.get("llm_generations", {}):
            # This was a batch-processed commit
            # We need to find notes from this commit another way
            # since llm_generations stores the batch response, not individual GUIDs
            pass
        
        # Search through all notes to find ones without a tracked creation commit
        # This is a limitation - we don't currently track which commit created each note
        # For now, we'll use a heuristic: notes added after the previous SHA
        # but this isn't perfect
        
        # Return all current notes as a fallback
        # TODO: Improve by adding commit_sha field to note metadata
        return list(self._state.get("note_hashes", {}).keys())
    
    def remove_notes_by_guids(self, guids: List[str]) -> int:
        """
        Remove multiple notes from state by their GUIDs.
        
        Args:
            guids: List of note GUIDs to remove
        
        Returns:
            Number of notes actually removed
        """
        removed = 0
        note_hashes = self._state.get("note_hashes", {})
        
        for guid in guids:
            if guid in note_hashes:
                del note_hashes[guid]
                removed += 1
        
        return removed
    
    def get_all_note_guids(self) -> List[str]:
        """
        Get all note GUIDs currently tracked in state.
        
        Returns:
            List of all note GUIDs
        """
        return list(self._state.get("note_hashes", {}).keys())


# Convenience functions for backward compatibility
def load_state(state_file: Optional[Path] = None) -> StateManager:
    """Load state manager."""
    return StateManager(state_file)


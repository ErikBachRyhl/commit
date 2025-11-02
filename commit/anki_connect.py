"""AnkiConnect HTTP client for syncing notes to Anki."""

from typing import Any, Dict, List, Optional

import httpx


class AnkiConnectError(Exception):
    """Exception raised for AnkiConnect API errors."""

    pass


class AnkiConnectClient:
    """Client for interacting with Anki via AnkiConnect."""

    def __init__(self, base_url: str = "http://127.0.0.1:8765", timeout: int = 30):
        """
        Initialize AnkiConnect client.

        Args:
            base_url: AnkiConnect API URL
            timeout: Request timeout in seconds
        """
        self.base_url = base_url
        self.timeout = timeout

    async def invoke(self, action: str, **params) -> Any:
        """
        Invoke an AnkiConnect action.

        Args:
            action: AnkiConnect action name
            **params: Action parameters

        Returns:
            Result from AnkiConnect

        Raises:
            AnkiConnectError: If connection fails or API returns error
        """
        payload = {
            "action": action,
            "version": 6,
            "params": params,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.base_url, json=payload)
                response.raise_for_status()

                result = response.json()

                if "error" in result and result["error"] is not None:
                    raise AnkiConnectError(f"AnkiConnect error: {result['error']}")

                return result.get("result")

        except httpx.ConnectError as e:
            raise AnkiConnectError(
                f"Cannot connect to AnkiConnect at {self.base_url}. "
                "Is Anki running with AnkiConnect installed?"
            ) from e
        except httpx.HTTPError as e:
            raise AnkiConnectError(f"HTTP error: {e}") from e
        except Exception as e:
            raise AnkiConnectError(f"Unexpected error: {e}") from e

    async def check_connection(self) -> bool:
        """
        Check if AnkiConnect is available.

        Returns:
            True if connection is successful, False otherwise
        """
        try:
            await self.invoke("version")
            return True
        except AnkiConnectError:
            return False

    async def add_notes(self, notes: List[Dict]) -> List[Optional[int]]:
        """
        Add multiple notes to Anki.

        Args:
            notes: List of note dictionaries in AnkiConnect format

        Returns:
            List of note IDs (None for duplicates/errors)

        Raises:
            AnkiConnectError: If API call fails
        """
        if not notes:
            return []

        result = await self.invoke("addNotes", notes=notes)
        return result

    async def update_note_fields(self, note_id: int, fields: Dict[str, str]) -> None:
        """
        Update fields of an existing note.

        Args:
            note_id: Anki note ID
            fields: Dictionary of field name to content

        Raises:
            AnkiConnectError: If update fails
        """
        note_data = {
            "id": note_id,
            "fields": fields,
        }
        await self.invoke("updateNoteFields", note=note_data)

    async def add_tags(self, note_ids: List[int], tags: str) -> None:
        """
        Add tags to notes.

        Args:
            note_ids: List of note IDs
            tags: Space-separated tag string

        Raises:
            AnkiConnectError: If operation fails
        """
        if not note_ids:
            return

        await self.invoke("addTags", notes=note_ids, tags=tags)

    async def remove_tags(self, note_ids: List[int], tags: str) -> None:
        """
        Remove tags from notes.

        Args:
            note_ids: List of note IDs
            tags: Space-separated tag string

        Raises:
            AnkiConnectError: If operation fails
        """
        if not note_ids:
            return

        await self.invoke("removeTags", notes=note_ids, tags=tags)

    async def find_notes(self, query: str) -> List[int]:
        """
        Find notes matching a query.

        Args:
            query: Anki search query

        Returns:
            List of note IDs

        Raises:
            AnkiConnectError: If search fails
        """
        result = await self.invoke("findNotes", query=query)
        return result if result else []

    async def notes_info(self, note_ids: List[int]) -> List[Dict]:
        """
        Get information about notes.

        Args:
            note_ids: List of note IDs

        Returns:
            List of note info dictionaries

        Raises:
            AnkiConnectError: If operation fails
        """
        if not note_ids:
            return []

        result = await self.invoke("notesInfo", notes=note_ids)
        return result if result else []
    
    async def delete_notes(self, note_ids: List[int]) -> None:
        """
        Delete notes from Anki.

        Args:
            note_ids: List of note IDs to delete

        Raises:
            AnkiConnectError: If deletion fails
        """
        if not note_ids:
            return
        
        await self.invoke("deleteNotes", notes=note_ids)

    async def create_deck(self, deck_name: str) -> int:
        """
        Create a deck if it doesn't exist.

        Args:
            deck_name: Name of the deck

        Returns:
            Deck ID

        Raises:
            AnkiConnectError: If creation fails
        """
        result = await self.invoke("createDeck", deck=deck_name)
        return result

    async def get_deck_names(self) -> List[str]:
        """
        Get list of all deck names.

        Returns:
            List of deck names

        Raises:
            AnkiConnectError: If operation fails
        """
        result = await self.invoke("deckNames")
        return result if result else []

    async def store_media_file(
        self, filename: str, data: str, delete_existing: bool = True
    ) -> str:
        """
        Store a media file in Anki's media collection.

        Args:
            filename: Name of the file
            data: Base64-encoded file data
            delete_existing: Whether to delete existing file with same name

        Returns:
            Filename

        Raises:
            AnkiConnectError: If operation fails
        """
        result = await self.invoke(
            "storeMediaFile",
            filename=filename,
            data=data,
            deleteExisting=delete_existing,
        )
        return result

    async def find_notes_by_guid(self, guid_prefix: str) -> List[int]:
        """
        Find notes by GUID tag prefix.

        Args:
            guid_prefix: GUID prefix (e.g., first 12 characters)

        Returns:
            List of matching note IDs
        """
        query = f"tag:guid:{guid_prefix}*"
        return await self.find_notes(query)

    async def sync(self) -> None:
        """
        Trigger Anki sync.

        Raises:
            AnkiConnectError: If sync fails
        """
        await self.invoke("sync")


# Synchronous wrapper for simple use cases
class SyncAnkiConnectClient:
    """Synchronous wrapper for AnkiConnectClient."""

    def __init__(self, base_url: str = "http://127.0.0.1:8765", timeout: int = 30):
        self.client = AnkiConnectClient(base_url, timeout)

    def _run_async(self, coro):
        """Helper to run async coroutines."""
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(coro)

    def check_connection(self) -> bool:
        """Check if AnkiConnect is available."""
        return self._run_async(self.client.check_connection())

    def add_notes(self, notes: List[Dict]) -> List[Optional[int]]:
        """Add multiple notes to Anki."""
        return self._run_async(self.client.add_notes(notes))

    def update_note_fields(self, note_id: int, fields: Dict[str, str]) -> None:
        """Update fields of an existing note."""
        return self._run_async(self.client.update_note_fields(note_id, fields))

    def add_tags(self, note_ids: List[int], tags: str) -> None:
        """Add tags to notes."""
        return self._run_async(self.client.add_tags(note_ids, tags))

    def find_notes(self, query: str) -> List[int]:
        """Find notes matching a query."""
        return self._run_async(self.client.find_notes(query))

    def create_deck(self, deck_name: str) -> int:
        """Create a deck if it doesn't exist."""
        return self._run_async(self.client.create_deck(deck_name))

    def get_deck_names(self) -> List[str]:
        """Get list of all deck names."""
        return self._run_async(self.client.get_deck_names())
    
    def notes_info(self, note_ids: List[int]) -> List[Dict]:
        """Get information about notes."""
        return self._run_async(self.client.notes_info(note_ids))
    
    def delete_notes(self, note_ids: List[int]) -> None:
        """Delete notes from Anki."""
        return self._run_async(self.client.delete_notes(note_ids))


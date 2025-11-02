"""Tests for hashing module."""

import pytest

from commit.hashing import (
    compute_guid,
    compute_content_hash,
    short_hash,
    compute_block_signature,
)


class TestComputeGuid:
    """Tests for compute_guid function."""

    def test_guid_consistency(self):
        """Test that same inputs produce same GUID."""
        guid1 = compute_guid("definition", "A metric space", "math/ch1.tex")
        guid2 = compute_guid("definition", "A metric space", "math/ch1.tex")

        assert guid1 == guid2

    def test_guid_length(self):
        """Test that GUID is 40 characters (SHA1)."""
        guid = compute_guid("theorem", "Content", "file.tex")

        assert len(guid) == 40

    def test_guid_different_content(self):
        """Test that different content produces different GUID."""
        guid1 = compute_guid("definition", "Content A", "file.tex")
        guid2 = compute_guid("definition", "Content B", "file.tex")

        assert guid1 != guid2

    def test_guid_different_file(self):
        """Test that different file path produces different GUID."""
        guid1 = compute_guid("definition", "Content", "file1.tex")
        guid2 = compute_guid("definition", "Content", "file2.tex")

        assert guid1 != guid2

    def test_guid_different_env(self):
        """Test that different environment produces different GUID."""
        guid1 = compute_guid("definition", "Content", "file.tex")
        guid2 = compute_guid("theorem", "Content", "file.tex")

        assert guid1 != guid2


class TestComputeContentHash:
    """Tests for compute_content_hash function."""

    def test_content_hash_consistency(self):
        """Test that same content produces same hash."""
        hash1 = compute_content_hash("A metric space")
        hash2 = compute_content_hash("A metric space")

        assert hash1 == hash2

    def test_content_hash_length(self):
        """Test that content hash is 40 characters (SHA1)."""
        content_hash = compute_content_hash("Some content")

        assert len(content_hash) == 40

    def test_content_hash_different_content(self):
        """Test that different content produces different hash."""
        hash1 = compute_content_hash("Content A")
        hash2 = compute_content_hash("Content B")

        assert hash1 != hash2

    def test_content_hash_whitespace_sensitive(self):
        """Test that content hash is sensitive to whitespace."""
        hash1 = compute_content_hash("A B")
        hash2 = compute_content_hash("A  B")

        assert hash1 != hash2


class TestShortHash:
    """Tests for short_hash function."""

    def test_default_length(self):
        """Test default short hash length."""
        full_hash = "abcdef1234567890"
        short = short_hash(full_hash)

        assert len(short) == 12  # Default is 12 for better collision resistance
        assert short == "abcdef123456"

    def test_custom_length(self):
        """Test custom short hash length."""
        full_hash = "abcdef1234567890"
        short = short_hash(full_hash, length=12)

        assert len(short) == 12
        assert short == "abcdef123456"


class TestComputeBlockSignature:
    """Tests for compute_block_signature function."""

    def test_signature_with_title(self):
        """Test signature with title."""
        sig = compute_block_signature("theorem", "math.tex", 42, "Pythagorean")

        assert sig == "theorem[Pythagorean]@math.tex:42"

    def test_signature_without_title(self):
        """Test signature without title."""
        sig = compute_block_signature("definition", "notes.tex", 10)

        assert sig == "definition@notes.tex:10"

    def test_signature_format(self):
        """Test that signature has correct format."""
        sig = compute_block_signature("lemma", "file.tex", 5, "Main Lemma")

        assert "lemma[Main Lemma]" in sig
        assert "@file.tex:5" in sig


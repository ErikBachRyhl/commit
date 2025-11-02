"""Configuration management for anki-tex."""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from pydantic import BaseModel, Field, field_validator

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, rely on system env vars


class CourseConfig(BaseModel):
    """Configuration for a single course."""

    paths: List[str] = Field(description="List of glob patterns for .tex files")
    deck: str = Field(description="Target Anki deck name")


class LLMConfig(BaseModel):
    """Configuration for LLM-generated cards."""

    enabled: bool = Field(default=False, description="Enable LLM-generated cards")
    max_per_commit: int = Field(
        default=8, description="Maximum LLM-generated cards per commit"
    )
    types: List[str] = Field(
        default=["cloze", "why"], description="Types of generated cards"
    )


class ChunkingConfig(BaseModel):
    """Configuration for chunking large content."""

    mode: str = Field(
        default="auto",
        description="Chunking mode: 'auto' or 'off'"
    )
    max_chars: int = Field(
        default=80000,
        description="Maximum characters before splitting"
    )
    overlap_lines: int = Field(
        default=10,
        description="Number of lines to overlap between chunks"
    )

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        """Validate chunking mode."""
        if v not in ("auto", "off"):
            raise ValueError("Chunking mode must be 'auto' or 'off'")
        return v


class LLMConfig(BaseModel):
    """Configuration for LLM-based card generation."""

    provider: str = Field(
        default="none",
        description="LLM provider: 'openai', 'anthropic', 'gemini', or 'none'"
    )
    model: str = Field(
        default="gpt-4o-mini",
        description="Model name for the provider"
    )
    temperature: float = Field(
        default=0.2,
        description="Temperature for generation (0-1)"
    )
    max_output_tokens: int = Field(
        default=1200,
        description="Maximum tokens to generate"
    )
    enable_generated: bool = Field(
        default=False,
        description="Enable LLM-generated cards"
    )
    paraphrase_strength: float = Field(
        default=0.6,
        description="Paraphrasing strength: 0=literal, 1=strongly rephrased"
    )
    max_cards_per_block: int = Field(
        default=3,
        description="Maximum cards to generate per LaTeX block"
    )
    neighbor_context_lines: int = Field(
        default=20,
        description="Total lines of context around blocks (split evenly)"
    )
    full_diff: bool = Field(
        default=False,
        description="Send full git diff chunks instead of extracted blocks"
    )
    chunking: ChunkingConfig = Field(
        default_factory=ChunkingConfig,
        description="Chunking configuration"
    )
    log_raw: bool = Field(
        default=True,
        description="Log raw LLM JSON responses in state"
    )

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        """Validate LLM provider."""
        valid_providers = ("openai", "anthropic", "gemini", "none")
        if v not in valid_providers:
            raise ValueError(f"Provider must be one of {valid_providers}")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float) -> float:
        """Validate temperature range."""
        if not 0 <= v <= 2:
            raise ValueError("Temperature must be between 0 and 2")
        return v

    @field_validator("paraphrase_strength")
    @classmethod
    def validate_paraphrase_strength(cls, v: float) -> float:
        """Validate paraphrase strength range."""
        if not 0 <= v <= 1:
            raise ValueError("Paraphrase strength must be between 0 and 1")
        return v


class ChatConfig(BaseModel):
    """Configuration for chat mentor mode."""

    enabled: bool = Field(
        default=True,
        description="Enable chat mode"
    )
    default_scope: str = Field(
        default="latest",
        description="Default scope: 'latest', 'lastN', 'sinceSha', or 'all'"
    )
    lastN: int = Field(
        default=1,
        description="Number of commits to include when scope is 'lastN'"
    )
    mentor_auto_add: bool = Field(
        default=False,
        description="Automatically add JSON cards proposed in chat"
    )

    @field_validator("default_scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        """Validate default scope."""
        valid_scopes = ("latest", "lastN", "sinceSha", "all")
        if v not in valid_scopes:
            raise ValueError(f"Default scope must be one of {valid_scopes}")
        return v


class AppConfig(BaseModel):
    """Main application configuration."""

    courses: Dict[str, CourseConfig] = Field(
        description="Dictionary of course configurations"
    )
    envs_to_extract: List[str] = Field(
        default=[
            "definition",
            "theorem",
            "proposition",
            "lemma",
            "corollary",
            "example",
            "remark",
        ],
        description="LaTeX environments to extract",
    )
    daily_new_limit: int = Field(
        default=30, description="Daily limit for new cards"
    )
    priorities: Dict[str, int] = Field(
        default_factory=dict, description="Priority weights per course"
    )
    tags: List[str] = Field(
        default=["auto", "from-tex", "commit:{sha}", "file:{file}"],
        description="Tag templates for generated notes",
    )
    llm: LLMConfig = Field(
        default_factory=LLMConfig,
        description="LLM configuration"
    )
    chat: ChatConfig = Field(
        default_factory=ChatConfig,
        description="Chat mode configuration"
    )

    @field_validator("envs_to_extract")
    @classmethod
    def validate_envs(cls, v: List[str]) -> List[str]:
        """Ensure at least one environment is specified."""
        if not v:
            raise ValueError("At least one environment must be specified")
        return v


def load_config(config_path: Path) -> AppConfig:
    """
    Load and validate configuration from YAML file.

    Args:
        config_path: Path to commit.yml

    Returns:
        Validated AppConfig instance

    Raises:
        FileNotFoundError: If config file doesn't exist
        yaml.YAMLError: If config is invalid YAML
        ValueError: If config validation fails
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        config_data = yaml.safe_load(f)

    if config_data is None:
        raise ValueError(f"Empty config file: {config_path}")

    return AppConfig(**config_data)


def find_config(repo_path: Path) -> Optional[Path]:
    """
    Find commit.yml in repository (supports legacy names too).

    Args:
        repo_path: Root directory of the repository

    Returns:
        Path to config file, or None if not found
    """
    candidates = [
        repo_path / "commit.yml",
        repo_path / "commit.yaml",
        repo_path / ".commit.yml",
        # Legacy support for old config names
        repo_path / "renforce.yml",
        repo_path / "renforce.yaml",
        repo_path / ".renforce.yml",
        repo_path / "anki-tex.yml",
        repo_path / "anki-tex.yaml",
        repo_path / ".anki-tex.yml",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def get_api_key(provider: str) -> Optional[str]:
    """
    Get API key for LLM provider from environment variables.

    Args:
        provider: LLM provider name

    Returns:
        API key if found, None otherwise
    """
    env_var_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "gemini": "GEMINI_API_KEY",
    }

    env_var = env_var_map.get(provider.lower())
    if not env_var:
        return None

    return os.getenv(env_var)


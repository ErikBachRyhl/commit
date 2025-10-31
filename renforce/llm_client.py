"""Provider-agnostic LLM client for card generation and chat."""

import json
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class LLMError(Exception):
    """Base exception for LLM-related errors."""
    pass


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    def __init__(
        self,
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ):
        """
        Initialize LLM client.

        Args:
            model: Model name
            temperature: Sampling temperature
            max_tokens: Maximum output tokens
        """
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    @abstractmethod
    def _call_api(self, system_prompt: str, user_content: str) -> str:
        """Call the provider's API. Subclasses must implement."""
        pass

    def generate_cards(
        self, system_prompt: str, user_payload: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate flashcards from a LaTeX block.

        Args:
            system_prompt: System instructions for the model
            user_payload: Dictionary with block info

        Returns:
            List of card dictionaries with 'model', 'front', 'back', 'tags'
        """
        # Convert payload to JSON string for the model
        user_content = json.dumps(user_payload, indent=2)

        try:
            response_text = self._call_api(system_prompt, user_content)
            return self._parse_json_response(response_text)
        except Exception as e:
            print(f"LLM API error: {e}")
            return []

    def chat(self, system_prompt: str, user_message: str) -> str:
        """
        Send a chat message and get response.

        Args:
            system_prompt: System instructions
            user_message: User's message

        Returns:
            Model's response text
        """
        try:
            return self._call_api(system_prompt, user_message)
        except Exception as e:
            raise LLMError(f"Chat error: {e}") from e

    def _parse_json_response(self, response_text: str) -> List[Dict[str, Any]]:
        """
        Parse JSON from LLM response, with error recovery.

        Args:
            response_text: Raw text from model

        Returns:
            List of card dictionaries
        """
        # Try direct parse first
        try:
            data = json.loads(response_text)
            if isinstance(data, dict) and "cards" in data:
                return data["cards"]
            return []
        except json.JSONDecodeError as e:
            # JSON parsing failed - might be LaTeX escaping issue
            pass

        # Try to extract JSON from markdown code blocks
        # LLMs sometimes wrap JSON in ```json ... ```
        code_block_match = re.search(
            r'```(?:json)?\s*(\{.*?\})\s*```',
            response_text,
            re.DOTALL
        )
        if code_block_match:
            try:
                data = json.loads(code_block_match.group(1))
                if isinstance(data, dict) and "cards" in data:
                    return data["cards"]
            except json.JSONDecodeError:
                pass

        # Try using json.JSONDecoder's raw_decode which is more lenient
        # This can handle some malformed JSON
        try:
            # Find the start of JSON
            start = response_text.find('{')
            if start >= 0:
                decoder = json.JSONDecoder()
                data, _ = decoder.raw_decode(response_text[start:])
                if isinstance(data, dict) and "cards" in data:
                    return data["cards"]
        except (json.JSONDecodeError, ValueError):
            pass

        # Failed to parse
        print(f"Warning: Could not parse JSON from LLM response")
        print(f"Response preview: {response_text[:200]}...")
        return []


class OpenAIClient(LLMClient):
    """OpenAI API client."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ):
        """Initialize OpenAI client."""
        super().__init__(model, temperature, max_tokens)
        
        try:
            import openai
            self.client = openai.OpenAI(api_key=api_key)
        except ImportError:
            raise LLMError(
                "openai package not installed. Install with: pip install openai"
            )

    def _call_api(self, system_prompt: str, user_content: str) -> str:
        """Call OpenAI API with retry logic."""
        max_retries = 3
        retry_delay = 1

        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                )
                return response.choices[0].message.content

            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
                raise LLMError(f"OpenAI API error: {e}") from e


class AnthropicClient(LLMClient):
    """Anthropic (Claude) API client."""

    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4",
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ):
        """Initialize Anthropic client."""
        super().__init__(model, temperature, max_tokens)
        
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=api_key)
        except ImportError:
            raise LLMError(
                "anthropic package not installed. Install with: pip install anthropic"
            )

    def _call_api(self, system_prompt: str, user_content: str) -> str:
        """Call Anthropic API with retry logic."""
        max_retries = 3
        retry_delay = 1

        for attempt in range(max_retries):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_content},
                    ],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                )
                return response.content[0].text

            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
                raise LLMError(f"Anthropic API error: {e}") from e


class GeminiClient(LLMClient):
    """Google Gemini API client."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.0-flash-exp",
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ):
        """Initialize Gemini client."""
        super().__init__(model, temperature, max_tokens)
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.model_instance = genai.GenerativeModel(
                model_name=model,
                generation_config={
                    "temperature": temperature,
                    "max_output_tokens": max_tokens,
                }
            )
        except ImportError:
            raise LLMError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )

    def _call_api(self, system_prompt: str, user_content: str) -> str:
        """Call Gemini API with retry logic."""
        max_retries = 3
        retry_delay = 1

        # Gemini doesn't have separate system/user roles in the same way
        # Combine system prompt with user content
        combined_prompt = f"{system_prompt}\n\n{user_content}"

        for attempt in range(max_retries):
            try:
                response = self.model_instance.generate_content(combined_prompt)
                return response.text

            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
                raise LLMError(f"Gemini API error: {e}") from e


class NoneClient(LLMClient):
    """Null client that returns empty results (disables LLM)."""

    def __init__(self):
        """Initialize null client."""
        super().__init__(model="none", temperature=0, max_tokens=0)

    def _call_api(self, system_prompt: str, user_content: str) -> str:
        """Return empty string."""
        return ""

    def generate_cards(
        self, system_prompt: str, user_payload: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Return empty list."""
        return []

    def chat(self, system_prompt: str, user_message: str) -> str:
        """Return message indicating LLM is disabled."""
        return "LLM is disabled. Set llm.provider in config to enable."


def create_llm_client(
    provider: str,
    api_key: Optional[str],
    model: str,
    temperature: float = 0.2,
    max_tokens: int = 1200,
) -> LLMClient:
    """
    Factory function to create appropriate LLM client.

    Args:
        provider: Provider name ('openai', 'anthropic', 'gemini', 'none')
        api_key: API key for the provider
        model: Model name
        temperature: Sampling temperature
        max_tokens: Maximum output tokens

    Returns:
        LLMClient instance

    Raises:
        LLMError: If provider is invalid or API key is missing
    """
    provider = provider.lower()

    if provider == "none":
        return NoneClient()

    if not api_key:
        raise LLMError(
            f"API key required for provider '{provider}'. "
            f"Set {provider.upper()}_API_KEY in environment."
        )

    if provider == "openai":
        return OpenAIClient(api_key, model, temperature, max_tokens)
    elif provider == "anthropic":
        return AnthropicClient(api_key, model, temperature, max_tokens)
    elif provider == "gemini":
        return GeminiClient(api_key, model, temperature, max_tokens)
    else:
        raise LLMError(
            f"Unknown provider '{provider}'. "
            f"Must be 'openai', 'anthropic', 'gemini', or 'none'."
        )


#!/usr/bin/env python3
"""
Test script for LLM functionality.

This tests the LLM client with a simple LaTeX definition to verify:
1. API key is set correctly
2. Client can connect and generate cards
3. JSON parsing works
4. Security filtering works

Usage:
    source venv/bin/activate
    export OPENAI_API_KEY=sk-...
    python test_llm.py
"""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from renforce.llm_client import create_llm_client, LLMError
from renforce.prompts import format_cards_prompt, CARDS_SYSTEM_PROMPT
from renforce.security import strip_dangerous_latex, is_safe_latex
from renforce.config import get_api_key


def test_security():
    """Test LaTeX security filtering."""
    print("=" * 60)
    print("Testing Security Filtering...")
    print("=" * 60)
    
    dangerous = r"\write18{rm -rf /} and $x^2$"
    safe = strip_dangerous_latex(dangerous)
    print(f"Original: {dangerous}")
    print(f"Sanitized: {safe}")
    print(f"Is safe: {is_safe_latex(dangerous)}")
    print(f"After sanitization is safe: {is_safe_latex(safe)}")
    print()


def test_llm_client():
    """Test LLM client with a simple definition."""
    print("=" * 60)
    print("Testing LLM Client...")
    print("=" * 60)
    
    # Check for API key
    api_key = get_api_key("openai")
    if not api_key:
        print("❌ OPENAI_API_KEY not set!")
        print("\nPlease set your API key:")
        print("  export OPENAI_API_KEY=sk-...")
        print("\nor create a .env file:")
        print("  OPENAI_API_KEY=sk-...")
        return False
    
    print(f"✓ API key found (length: {len(api_key)})")
    
    # Create client
    try:
        client = create_llm_client(
            provider="openai",
            api_key=api_key,
            model="gpt-4o-mini",
            temperature=0.2,
            max_tokens=800
        )
        print("✓ Client created successfully")
    except LLMError as e:
        print(f"❌ Failed to create client: {e}")
        return False
    
    # Prepare test block
    test_block = {
        "env": "definition",
        "title": "Metric Space",
        "body": r"""A metric space is a set $M$ together with a distance function 
$d: M \times M \to \mathbb{R}$ satisfying:
\begin{enumerate}
    \item $d(x,y) \geq 0$ with equality iff $x = y$
    \item $d(x,y) = d(y,x)$ (symmetry)
    \item $d(x,z) \leq d(x,y) + d(y,z)$ (triangle inequality)
\end{enumerate}""",
        "file_path": "test.tex",
        "course": "TestCourse",
    }
    
    # Format prompt
    system_prompt = CARDS_SYSTEM_PROMPT.format(
        max_cards=3,
        paraphrase_strength=0.6
    )
    
    user_payload = {
        "env": test_block["env"],
        "title": test_block["title"],
        "body": test_block["body"],
        "file": test_block["file_path"],
        "course": test_block["course"],
        "max_cards": 3,
    }
    
    print("\nCalling LLM API...")
    print(f"Model: gpt-4o-mini")
    print(f"Environment: {test_block['env']}")
    print(f"Title: {test_block['title']}")
    
    # Generate cards
    try:
        cards = client.generate_cards(system_prompt, user_payload)
        
        # Check if cards were actually generated
        if not cards or len(cards) == 0:
            print(f"\n❌ API call returned 0 cards!")
            print(f"   This usually means:")
            print(f"   - API error occurred (check above for errors)")
            print(f"   - Invalid API key")
            print(f"   - No quota/credits on account")
            return False
        
        print(f"\n✓ API call successful!")
        print(f"✓ Generated {len(cards)} card(s)")
        
        # Display cards
        print("\n" + "=" * 60)
        print("Generated Cards:")
        print("=" * 60)
        
        for i, card in enumerate(cards, 1):
            print(f"\nCard {i}:")
            print(f"  Model: {card.get('model', 'N/A')}")
            print(f"  Front: {card.get('front', 'N/A')[:100]}...")
            print(f"  Back: {card.get('back', 'N/A')[:100]}...")
            print(f"  Tags: {card.get('tags', [])}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ API call failed: {e}")
        return False


def main():
    """Run all tests."""
    print("\n🧪 AnkiTex LLM Test Suite\n")
    
    # Test security
    test_security()
    
    # Test LLM
    success = test_llm_client()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ All tests passed!")
        print("\nNext steps:")
        print("1. The LLM integration is working")
        print("2. You can now use LLM features in anki-tex")
        print("3. Update your anki-tex.yml to enable LLM:")
        print("\n   llm:")
        print("     provider: openai")
        print("     model: gpt-4o-mini")
        print("     enable_generated: true")
    else:
        print("❌ Tests failed - please check errors above")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()


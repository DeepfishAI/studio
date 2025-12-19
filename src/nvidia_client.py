# -----------------------------------------------------------
# nvidia_client.py
# -----------------------------------------------------------
"""
NVIDIA LLM Client for DeepFish

Provides unified access to 56+ enterprise LLMs through NVIDIA's API.
Features:
- Environment variable validation with .env fallback
- Retry logic with exponential backoff
- Streaming support with thinking mode
- Oracle-compatible model routing

IMPORTANT: Set NVIDIA_API_KEY in your environment or Railway.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, Iterator, List, Optional, Tuple

# --- Optional dependencies ---
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
    HAS_TENACITY = True
except ImportError:
    HAS_TENACITY = False

# -----------------------------------------------------------
# Logging configuration
# -----------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("nvidia_client")

# -----------------------------------------------------------
# Configuration
# -----------------------------------------------------------
@dataclass
class NvidiaConfig:
    """Runtime configuration for NVIDIA LLM client."""
    api_key: str
    base_url: str = "https://integrate.api.nvidia.com/v1"
    timeout: int = 30
    max_retries: int = 3
    
    # Model tiers (from nvidia_llm.json)
    default_model: str = "meta/llama-3.1-70b-instruct"
    reasoning_model: str = "nvidia/nemotron-3-nano-30b-a3b"
    fast_model: str = "microsoft/phi-3-mini-4k-instruct"
    powerful_model: str = "meta/llama-3.1-405b-instruct"


def load_config() -> NvidiaConfig:
    """Load config from environment, with .env fallback."""
    api_key = os.getenv("NVIDIA_API_KEY")
    
    if not api_key:
        try:
            from dotenv import load_dotenv
            load_dotenv()
            api_key = os.getenv("NVIDIA_API_KEY")
        except ImportError:
            pass
    
    if not api_key:
        log.error("NVIDIA_API_KEY environment variable not set.")
        raise EnvironmentError("NVIDIA_API_KEY is required. Set it in your environment or .env file.")
    
    return NvidiaConfig(api_key=api_key)


# -----------------------------------------------------------
# OpenAI SDK Client (Recommended - supports streaming)
# -----------------------------------------------------------
class NvidiaOpenAIClient:
    """NVIDIA client using OpenAI SDK (recommended for streaming)."""
    
    def __init__(self, config: Optional[NvidiaConfig] = None):
        if not HAS_OPENAI:
            raise ImportError("openai package required. Run: pip install openai")
        
        self.config = config or load_config()
        self.client = OpenAI(
            base_url=self.config.base_url,
            api_key=self.config.api_key
        )
    
    def chat(
        self,
        message: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        stream: bool = False,
        enable_thinking: bool = False
    ) -> str | Iterator[str]:
        """
        Send a chat message to NVIDIA LLM.
        
        Args:
            message: User message
            model: Model ID (default: llama-3.1-70b)
            system_prompt: Optional system prompt
            max_tokens: Max response tokens
            temperature: Creativity (0-1)
            stream: If True, yields chunks
            enable_thinking: Enable chain-of-thought for Nemotron
        
        Returns:
            Response string, or iterator of chunks if streaming
        """
        model = model or self.config.default_model
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": message})
        
        extra_body = {}
        if enable_thinking:
            extra_body["chat_template_kwargs"] = {"enable_thinking": True}
            model = self.config.reasoning_model  # Force Nemotron for thinking
        
        log.info(f"Calling NVIDIA model: {model}")
        
        completion = self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=stream,
            extra_body=extra_body if extra_body else None
        )
        
        if stream:
            return self._stream_response(completion, enable_thinking)
        else:
            return completion.choices[0].message.content
    
    def _stream_response(self, completion, show_thinking: bool = False) -> Iterator[str]:
        """Yield response chunks, optionally including thinking."""
        for chunk in completion:
            if show_thinking:
                reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
                if reasoning:
                    yield f"[THINKING] {reasoning}"
            
            content = chunk.choices[0].delta.content
            if content:
                yield content
    
    def chat_with_thinking(self, message: str, **kwargs) -> Iterator[str]:
        """Convenience method for Nemotron with visible thinking."""
        return self.chat(
            message,
            enable_thinking=True,
            stream=True,
            **kwargs
        )
    
    def quick_chat(self, message: str) -> str:
        """Fast response using smallest model."""
        return self.chat(message, model=self.config.fast_model, max_tokens=1024)
    
    def deep_chat(self, message: str) -> str:
        """Powerful response using largest model."""
        return self.chat(message, model=self.config.powerful_model, max_tokens=16384)


# -----------------------------------------------------------
# Requests-based Client (Fallback - no streaming)
# -----------------------------------------------------------
class NvidiaRequestsClient:
    """NVIDIA client using requests (fallback, no streaming)."""
    
    def __init__(self, config: Optional[NvidiaConfig] = None):
        if not HAS_REQUESTS:
            raise ImportError("requests package required. Run: pip install requests")
        
        self.config = config or load_config()
        self._session = None
    
    @property
    def session(self) -> "requests.Session":
        if self._session is None:
            self._session = requests.Session()
            if HAS_REQUESTS:
                retries = Retry(
                    total=self.config.max_retries,
                    backoff_factor=0.5,
                    status_forcelist=[429, 500, 502, 503, 504]
                )
                self._session.mount("https://", HTTPAdapter(max_retries=retries))
        return self._session
    
    def chat(
        self,
        message: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Send a chat message and return the response."""
        model = model or self.config.default_model
        
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": message})
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        log.info(f"Calling NVIDIA model: {model}")
        
        response = self.session.post(
            f"{self.config.base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=self.config.timeout
        )
        response.raise_for_status()
        
        result = response.json()
        return result["choices"][0]["message"]["content"]


# -----------------------------------------------------------
# Factory function
# -----------------------------------------------------------
def create_nvidia_client(prefer_openai: bool = True) -> NvidiaOpenAIClient | NvidiaRequestsClient:
    """
    Create the best available NVIDIA client.
    
    Args:
        prefer_openai: If True, prefer OpenAI SDK (supports streaming)
    
    Returns:
        NvidiaOpenAIClient or NvidiaRequestsClient
    """
    if prefer_openai and HAS_OPENAI:
        return NvidiaOpenAIClient()
    elif HAS_REQUESTS:
        return NvidiaRequestsClient()
    else:
        raise ImportError("Neither openai nor requests package available. Install one.")


# -----------------------------------------------------------
# CLI / Testing
# -----------------------------------------------------------
if __name__ == "__main__":
    print("🚀 NVIDIA LLM Client Test\n")
    
    try:
        client = create_nvidia_client()
        print(f"✅ Created client: {type(client).__name__}")
        
        # Quick test
        print("\n📤 Sending test message...")
        response = client.quick_chat("Say 'Hello from NVIDIA!' in exactly 5 words.")
        print(f"📥 Response: {response}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

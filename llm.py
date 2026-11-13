"""LLM backends. Choose with env vars so keys/URLs never reach the browser.

LLM_BACKEND=openai   -> any OpenAI-compatible server (Ollama, vLLM, llama.cpp, Groq...)
LLM_BACKEND=claude   -> Anthropic API

Self-hosted examples:
  Ollama: LLM_BASE_URL=http://localhost:11434/v1  LLM_MODEL=qwen2.5:7b
  vLLM:   LLM_BASE_URL=http://gpu-box:8000/v1     LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
"""
from __future__ import annotations

import os
from collections.abc import Iterator

BACKEND = os.getenv("LLM_BACKEND", "openai")
BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("LLM_API_KEY", "not-needed")  # Ollama/vLLM ignore this
MODEL = os.getenv(
    "LLM_MODEL", "claude-sonnet-5-5" if BACKEND == "claude" else "qwen2.5:7b"
)
MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "800"))


def stream_answer(system: str, messages: list[dict]) -> Iterator[str]:
    """Yield answer text pieces as they are generated."""
    if BACKEND == "claude":
        from anthropic import Anthropic

        client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", API_KEY))
        with client.messages.stream(
            model=MODEL, max_tokens=MAX_TOKENS, system=system, messages=messages
        ) as stream:
            yield from stream.text_stream
        return

    from openai import OpenAI

    client = OpenAI(base_url=BASE_URL, api_key=API_KEY, timeout=120)
    stream = client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=0.2,
        stream=True,
        messages=[{"role": "system", "content": system}, *messages],
    )
    for event in stream:
        if event.choices and event.choices[0].delta.content:
            yield event.choices[0].delta.content

"""
Dynamic chat-model factory.

One entry point, `get_model(provider, model=None, **kwargs)`, returns a
LangChain `BaseChatModel` for any of the supported providers. Every agent in
this codebase (legal, engineering, accounting, ...) should build its model
through this function instead of importing a provider SDK directly, so that
swapping providers is a config change, not a code change.

Supported providers: "openai", "google" (Gemini), "anthropic" (Claude),
"openrouter", "moonshot". OpenRouter and Moonshot are OpenAI-compatible APIs,
so they're both served by `ChatOpenAI` pointed at a different `base_url`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from langchain_core.language_models.chat_models import BaseChatModel

ModelProvider = Literal["openai", "google", "anthropic", "openrouter", "moonshot"]


@dataclass(frozen=True)
class ProviderSpec:
    """Static config for one provider: where its key lives, its base URL
    (None for native SDKs), its env-configurable default model, and the
    builder function that turns those into a chat model instance."""

    api_key_env: str
    default_model_env: str
    fallback_model: str
    build: Callable[[str, str, dict[str, Any]], BaseChatModel]
    base_url: str | None = None


def _build_openai_compatible(base_url: str | None):
    def _build(api_key: str, model: str, kwargs: dict[str, Any]) -> BaseChatModel:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(api_key=api_key, model=model, base_url=base_url, **kwargs)

    return _build


def _build_anthropic(api_key: str, model: str, kwargs: dict[str, Any]) -> BaseChatModel:
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(api_key=api_key, model=model, **kwargs)


def _build_google(api_key: str, model: str, kwargs: dict[str, Any]) -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(google_api_key=api_key, model=model, **kwargs)


_PROVIDERS: dict[ModelProvider, ProviderSpec] = {
    "openai": ProviderSpec(
        api_key_env="OPENAI_API_KEY",
        default_model_env="OPENAI_DEFAULT_MODEL",
        fallback_model="gpt-4.1",
        build=_build_openai_compatible(None),
    ),
    "google": ProviderSpec(
        api_key_env="GOOGLE_API_KEY",
        default_model_env="GOOGLE_DEFAULT_MODEL",
        fallback_model="gemini-3.7-flash",
        build=_build_google,
    ),
    "anthropic": ProviderSpec(
        api_key_env="ANTHROPIC_API_KEY",
        default_model_env="ANTHROPIC_DEFAULT_MODEL",
        fallback_model="claude-sonnet-4-5-20250929",
        build=_build_anthropic,
    ),
    "openrouter": ProviderSpec(
        api_key_env="OPENROUTER_API_KEY",
        default_model_env="OPENROUTER_DEFAULT_MODEL",
        fallback_model="google/gemini-3.7-flash",
        base_url="https://openrouter.ai/api/v1",
        build=_build_openai_compatible("https://openrouter.ai/api/v1"),
    ),
    "moonshot": ProviderSpec(
        api_key_env="MOONSHOT_API_KEY",
        default_model_env="MOONSHOT_DEFAULT_MODEL",
        fallback_model="moonshot-v1-32k",
        base_url="https://api.moonshot.ai/v1",
        build=_build_openai_compatible("https://api.moonshot.ai/v1"),
    ),
}


def list_providers() -> list[str]:
    return list(_PROVIDERS.keys())


# Curated, static model lists per provider for the Model Management UI's
# model dropdown (app/routers/admin_models.py). Not fetched live from each
# provider's API - that would need a per-provider "list models" call (and a
# valid key) just to render a settings form - so this is deliberately a
# maintained shortlist of commonly-used models, not the provider's full
# catalog. `model` in an override/request is always a free string underneath
# (models/factory.py:get_model), so a value not in this list still works;
# the dropdown just won't offer it.
AVAILABLE_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3", "o3-mini"],
    "google": ["gemini-3.7-flash", "gemini-3.7-pro", "gemini-2.5-flash", "gemini-2.5-pro"],
    "anthropic": [
        "claude-sonnet-4-5-20250929",
        "claude-opus-4-1-20250805",
        "claude-haiku-4-5-20251001",
    ],
    "openrouter": [
        "openai/gpt-4.1",
        "openai/gpt-4o-mini",
        "anthropic/claude-sonnet-4.5",
        "google/gemini-3.7-flash",
        "meta-llama/llama-3.3-70b-instruct",
    ],
    "moonshot": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
}


def list_models_for_provider(provider: str) -> list[str]:
    return AVAILABLE_MODELS.get(provider, [])


def get_model(
    provider: ModelProvider,
    model: str | None = None,
    *,
    temperature: float = 0.7,
    max_tokens: int | None = 4096,
    timeout: float | None = 120.0,
    max_retries: int = 2,
    **extra: Any,
) -> BaseChatModel:
    """Build a chat model for `provider`, dynamically, from env-configured
    credentials.

    - `model` overrides the provider's default model (env var or hardcoded
      fallback) if given.
    - `temperature`/`max_tokens`/`timeout`/`max_retries` are normalized
      across providers so callers don't need to know each SDK's kwarg names.
    - `extra` is passed straight through to the underlying LangChain
      constructor for provider-specific options.

    Raises `ValueError` if the provider is unknown or its API key isn't set.
    """
    spec = _PROVIDERS.get(provider)
    if spec is None:
        raise ValueError(
            f"Unknown model provider '{provider}'. Available: {list_providers()}"
        )

    api_key = os.environ.get(spec.api_key_env)
    if not api_key:
        raise ValueError(
            f"Missing API key for provider '{provider}': set {spec.api_key_env}"
        )

    resolved_model = model or os.environ.get(spec.default_model_env) or spec.fallback_model

    kwargs: dict[str, Any] = {
        "temperature": temperature,
        "timeout": timeout,
        "max_retries": max_retries,
        **extra,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    return spec.build(api_key, resolved_model, kwargs)

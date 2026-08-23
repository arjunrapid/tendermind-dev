"""
Reusable deep-agent builder.

Every domain agent in this project (legal, engineering, accounting, ...) is
just a system prompt + a set of tools + a model, run over a LangGraph "deep
agent" (from the `deepagents` package, itself a compiled LangGraph graph
with planning/sub-agent/file-system scaffolding built in). Rather than each
agent module wiring up `create_deep_agent` itself, they call `run_deep_agent`
below with their own prompt/tools/state and get back the final state.

This keeps provider choice, tool list, and state shape as *inputs* rather
than something hardcoded per agent - swap the model, add a tool, or extend
the state schema without touching the agent's own code.
"""

from __future__ import annotations

from typing import Any, Sequence

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import BaseTool


def build_deep_agent(
    system_prompt: str,
    tools: Sequence[BaseTool] | None = None,
    model: BaseChatModel | None = None,
    state_schema: type | None = None,
    **deep_agent_kwargs: Any,
):
    """Construct a compiled deep-agent graph.

    Args:
        system_prompt: the agent's instructions (its full "system prompt").
        tools: LangChain tools the agent may call. Empty/omitted for a pure
            analysis agent that only reasons over the input text.
        model: a LangChain chat model, typically built via
            `models.get_model(...)`. If omitted, deepagents falls back to
            its own default model.
        state_schema: optional custom state schema (e.g. a TypedDict) so the
            agent can read/write extra keys beyond the default
            messages/todos/files state. Passed straight through to
            `create_deep_agent`.
        **deep_agent_kwargs: any other `create_deep_agent` kwarg (e.g.
            `subagents=[...]` to compose this agent from sub-agents).

    Returns:
        A compiled, invokable LangGraph graph (`.invoke(...)` /
        `.ainvoke(...)`).
    """
    from deepagents import create_deep_agent

    return create_deep_agent(
        tools=list(tools or []),
        system_prompt=system_prompt,
        model=model,
        state_schema=state_schema,
        **deep_agent_kwargs,
    )


async def run_deep_agent(
    system_prompt: str,
    user_message: str,
    tools: Sequence[BaseTool] | None = None,
    model: BaseChatModel | None = None,
    state_schema: type | None = None,
    extra_state: dict[str, Any] | None = None,
    run_name: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
    **deep_agent_kwargs: Any,
) -> dict[str, Any]:
    """Build a deep agent and run it once on a single user message.

    This is the shape every domain agent (legal/engineering/accounting/...)
    is expected to call: hand it a system prompt, a user message, the tools
    it's allowed to use, the model to run it on, and (optionally) extra
    initial state - and get back the final graph state, from which the
    caller pulls `messages[-1].content` (or whatever custom state key it
    asked the agent to populate).

    Runs async so the LangGraph pipeline can fan this out in parallel across
    several agents (see graph/pipeline.py).

    `run_name`/`tags`/`metadata` are forwarded to LangGraph's run config.
    When LangSmith tracing is enabled (see `agents/tracing.py`), every model
    call this agent makes - full message list in, full response out, plus
    every tool call - shows up as a trace labeled with these, so a run can
    be found by agent name/bid_id/doc_type instead of scrolling through
    every trace to find it.
    """
    agent = build_deep_agent(
        system_prompt=system_prompt,
        tools=tools,
        model=model,
        state_schema=state_schema,
        **deep_agent_kwargs,
    )

    initial_state: dict[str, Any] = {
        "messages": [{"role": "user", "content": user_message}],
        **(extra_state or {}),
    }

    config: dict[str, Any] = {}
    if run_name:
        config["run_name"] = run_name
    if tags:
        config["tags"] = tags
    if metadata:
        config["metadata"] = metadata

    return await agent.ainvoke(initial_state, config=config or None)


def last_message_text(result_state: dict[str, Any]) -> str:
    """Convenience accessor: pull the text of the final assistant message
    out of a deep-agent result state."""
    messages = result_state.get("messages", [])
    if not messages:
        return ""
    last = messages[-1]
    content = getattr(last, "content", None) if not isinstance(last, dict) else last.get("content")
    return content or ""

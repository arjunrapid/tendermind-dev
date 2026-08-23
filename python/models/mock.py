"""A scripted BaseChatModel for exercising the full agent pipeline (deep
agent scaffold, tool-calling loop, risk aggregation, FastAPI request/response
cycle) without spending on - or needing - a real LLM provider key.

Select it with `provider="mock"` (per-request, e.g. in the /api/analyze body)
or `DEFAULT_LLM_PROVIDER=mock` (every request) - see agents/nodes.py
_model_for(). Local dev / testing only; never a real deployment default.
"""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.callbacks.manager import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import PrivateAttr

_FINAL_RESPONSES: dict[str, str] = {
    "legal": """{
  "compliance_issues": ["[MOCK] Insurance certificate must be filed within 10 days of award [page:4, section:2.3]"],
  "contract_terms": ["[MOCK] Liquidated damages capped at 10% of contract value [page:6, section:5.1]"],
  "risks": ["[MOCK] Indemnity clause is broad and uncapped [page:7, section:5.4]"],
  "overall_assessment": "YELLOW: [MOCK] Standard EPC terms with one uncapped indemnity clause worth negotiating [page:7]"
}""",
    "engineering": """{
  "scope_analysis": ["[MOCK] Scope covers civil works and MEP installation [page:2, section:1.1]"],
  "structural_concerns": ["[MOCK] Soil report referenced but not attached [page:3, section:1.4]"],
  "timeline_estimate": "[MOCK] 18 months, moderately aggressive given wet-season site access [page:5]",
  "feasibility": "MEDIUM - [MOCK] Feasible with a soil report obtained before mobilization [page:3]",
  "site_requirements": ["[MOCK] Site is in a flood-prone zone requiring elevated foundations [page:3, section:1.5]"]
}""",
    # Accounting's final answer is produced by _accounting_final_json() below,
    # once (and if) it has a verify_counterparty tool result to reference.
}


def _latest_human_text(messages: list[BaseMessage]) -> str:
    for message in reversed(messages):
        if message.__class__.__name__ == "HumanMessage":
            return str(message.content or "")
    return ""


# Common ways a tender names its issuing client/awarding authority - used
# only to decide what name to hand the mock's scripted verify_counterparty
# call, so the mock exercises the real tool against whatever a real uploaded
# document says, not a hardcoded test name.
_CLIENT_NAME_PATTERN = re.compile(
    r"(?:client|owner|employer|awarding authority|procuring entity)\s*[:\-]\s*([^\n,.;]{2,80})",
    re.IGNORECASE,
)


def _extract_client_name(text: str) -> str | None:
    match = _CLIENT_NAME_PATTERN.search(text)
    return match.group(1).strip() if match else None


def _accounting_final_json(tool_result_raw: str | None) -> str:
    # Pull just the human-readable `summary` out of the tool's JSON result
    # for the rating text - json.dumps (not an f-string) builds the overall
    # response so nothing here needs manual escaping.
    note = "[MOCK] No counterparty name found in document; verification skipped."
    if tool_result_raw:
        try:
            note = f"[MOCK] Counterparty check: {json.loads(tool_result_raw).get('summary', tool_result_raw)}"
        except (TypeError, ValueError):
            note = f"[MOCK] Counterparty check (unparsed): {tool_result_raw}"

    return json.dumps(
        {
            "cost_analysis": ["[MOCK] Direct costs ~70% of contract value [page:8, section:3.1]"],
            "payment_terms": ["[MOCK] 10% retention released on final acceptance [page:9, section:3.4]"],
            "qualification_requirements": ["[MOCK] Minimum 3 similar projects in last 5 years [page:10, section:4.1]"],
            "cash_flow_analysis": "[MOCK] Retention creates moderate working-capital pressure [page:9]",
            "financial_risk": f"MEDIUM - {note} [page:9]",
        }
    )


class MockChatModel(BaseChatModel):
    """Replays a scripted response per model call. `bind_tools` is a no-op
    (accepts and ignores whatever tools deepagents binds) since the script,
    not the model, decides when to emit a `tool_calls`-bearing message."""

    agent: str = "legal"
    _tool_call_made: bool = PrivateAttr(default=False)
    _tool_call_name: str | None = PrivateAttr(default=None)

    def bind_tools(self, tools: list[Any], **kwargs: Any) -> "MockChatModel":
        return self

    @property
    def _llm_type(self) -> str:
        return "mock-chat-model"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        message = self._next_message(messages)
        return ChatResult(generations=[ChatGeneration(message=message)])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    def _next_message(self, messages: list[BaseMessage]) -> AIMessage:
        if self.agent != "accounting":
            return AIMessage(content=_FINAL_RESPONSES[self.agent])

        if not self._tool_call_made:
            client_name = _extract_client_name(_latest_human_text(messages))
            if client_name:
                self._tool_call_made = True
                self._tool_call_name = client_name
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "verify_counterparty",
                            "args": {"company_name": client_name},
                            "id": "mock-verify-counterparty-1",
                            "type": "tool_call",
                        }
                    ],
                )
            # No client name found in the document - go straight to the
            # final answer without exercising the tool.
            return AIMessage(content=_accounting_final_json(None))

        # Second turn: the ToolMessage from verify_counterparty is now in
        # `messages` - find it and fold its summary into the final answer.
        for message in reversed(messages):
            if message.__class__.__name__ == "ToolMessage" and getattr(message, "name", None) == "verify_counterparty":
                return AIMessage(content=_accounting_final_json(str(message.content)))
        return AIMessage(content=_accounting_final_json(None))


def mock_model_for(agent: str) -> MockChatModel:
    return MockChatModel(agent=agent)

'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

interface AgentOverride {
  provider: string | null;
  model: string | null;
}

interface ModelOverridesResponse {
  agents: string[];
  providers: string[];
  models_by_provider: Record<string, string[]>;
  overrides: Record<string, AgentOverride>;
}

const AGENT_LABELS: Record<string, string> = {
  orchestrator: 'Orchestrator (document routing)',
  legal: 'Legal Agent',
  engineering: 'Engineering Agent',
  accounting: 'Accounting Agent',
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  orchestrator: 'Reads the whole document and routes each section to the right agent below.',
  legal: 'Contract compliance, liabilities, terms.',
  engineering: 'Scope, technical feasibility, timeline.',
  accounting: 'Costs, payment terms, financial qualification.',
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google (Gemini)',
  anthropic: 'Anthropic (Claude)',
  openrouter: 'OpenRouter',
  moonshot: 'Moonshot',
};

export default function AdminModelsPage() {
  const [agents, setAgents] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({});
  const [overrides, setOverrides] = useState<Record<string, AgentOverride>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverrides = async () => {
      try {
        const response = await fetch('/api/admin/models');
        if (!response.ok) throw new Error('Failed to load model overrides');
        const data: ModelOverridesResponse = await response.json();
        setAgents(data.agents);
        setProviders(data.providers);
        setModelsByProvider(data.models_by_provider || {});
        setOverrides(data.overrides);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverrides();
  }, []);

  const updateProvider = (agent: string, provider: string) => {
    setOverrides((prev) => ({
      ...prev,
      [agent]: {
        provider: provider === '' ? null : provider,
        // Changing provider invalidates the previously-selected model (it
        // belongs to the old provider's list) - always reset it rather
        // than risk saving a provider/model pair that don't match.
        model: null,
      },
    }));
  };

  const updateModel = (agent: string, model: string) => {
    setOverrides((prev) => ({
      ...prev,
      [agent]: {
        ...prev[agent],
        model: model === '' ? null : model,
      },
    }));
  };

  const clearOverride = (agent: string) => {
    setOverrides((prev) => ({ ...prev, [agent]: { provider: null, model: null } }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrides: agents.map((agent) => ({
            agent,
            provider: overrides[agent]?.provider ?? null,
            model: overrides[agent]?.model ?? null,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to save model overrides');
      const data: ModelOverridesResponse = await response.json();
      setOverrides(data.overrides);
      setSavedMessage('Model overrides saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      title="Model Management"
      subtitle="Override the LLM provider/model used by each agent"
      requireAdmin
    >
      <div className="max-w-5xl space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading model overrides...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {agents.map((agent) => {
                const override = overrides[agent] || { provider: null, model: null };
                const hasOverride = Boolean(override.provider || override.model);

                return (
                  <div key={agent} className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {AGENT_LABELS[agent] || agent}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {AGENT_DESCRIPTIONS[agent]}
                        </p>
                      </div>
                      {hasOverride && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded whitespace-nowrap">
                          Overridden
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Provider
                        </label>
                        <select
                          value={override.provider || ''}
                          onChange={(e) => updateProvider(agent, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Use server default</option>
                          {providers.map((provider) => (
                            <option key={provider} value={provider}>
                              {PROVIDER_LABELS[provider] || provider}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Model
                        </label>
                        <select
                          value={override.model || ''}
                          onChange={(e) => updateModel(agent, e.target.value)}
                          disabled={!override.provider}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">
                            {override.provider ? "Use provider's default model" : 'Select a provider first'}
                          </option>
                          {(modelsByProvider[override.provider || ''] || []).map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <button
                          onClick={() => clearOverride(agent)}
                          disabled={!hasOverride}
                          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Clear override
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <div>
                {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
                {savedMessage && (
                  <p className="text-green-600 dark:text-green-400 text-sm">{savedMessage}</p>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Overrides'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            Leave a field blank to use the server&apos;s default (
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">DEFAULT_LLM_PROVIDER</code>).
          </p>
          <p>
            An override applies to every new analysis run through the Python backend. A request
            that explicitly sets its own <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">provider</code>/
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">model</code> (e.g. for testing) takes
            priority over these saved overrides for that one run.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

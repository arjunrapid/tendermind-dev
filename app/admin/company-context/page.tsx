'use client';

import { useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';

interface ContextItem {
  id: string;
  category: string;
  title: string;
  content: string;
  source_type: 'text' | 'markdown' | 'pdf';
  file_name: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal',
  engineering: 'Engineering',
  accounting: 'Accounting',
  risk: 'Risk',
};

const CATEGORIES = ['legal', 'engineering', 'accounting', 'risk'];

export default function CompanyContextPage() {
  const [items, setItems] = useState<ContextItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/company-context');
      if (!response.ok) throw new Error('Failed to load company context');
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (inputMode === 'text' && !content.trim()) {
      setError('Enter some content, or switch to file upload.');
      return;
    }
    if (inputMode === 'file' && !file) {
      setError('Choose a file to upload, or switch to pasted text.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (inputMode === 'text') {
        formData.append('content', content);
      } else if (file) {
        formData.append('file', file);
      }

      const response = await fetch('/api/company-context', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save company context');
      }

      resetForm();
      const detectedLabel = CATEGORY_LABELS[data.category] || data.category;
      setSavedMessage(
        `Saved under category "${detectedLabel}" (auto-detected) - it will be applied to every new analysis for that category.`,
      );
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: ContextItem) => {
    if (!confirm(`Remove "${item.title}"? This can't be undone.`)) return;
    try {
      const response = await fetch(`/api/company-context/${item.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete company context');
    }
  };

  return (
    <AppShell
      title="Company Context"
      subtitle="Reference material injected into every analysis - category is detected automatically"
      requireAdmin
    >
      <div className="max-w-5xl space-y-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Context</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standard liability clause policy"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Category (Legal / Engineering / Accounting / Risk) is detected automatically from the
              content - no need to pick one.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                inputMode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Paste text / Markdown
            </button>
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                inputMode === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Upload .md/.txt/.pdf file
            </button>
          </div>

          {inputMode === 'text' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Paste the reference content here (plain text or Markdown)..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono"
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 file:text-sm file:font-medium"
            />
          )}

          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          {savedMessage && <p className="text-green-600 dark:text-green-400 text-sm">{savedMessage}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Add Context'}
          </button>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {CATEGORY_LABELS[cat]}{' '}
                      <span className="text-gray-400 dark:text-gray-500 font-normal text-sm">
                        ({catItems.length})
                      </span>
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {catItems.map((item) => (
                      <div key={item.id} className="px-6 py-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {item.source_type}
                            {item.file_name ? ` - ${item.file_name}` : ''} - added{' '}
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                            {item.content.slice(0, 200)}
                            {item.content.length > 200 ? '...' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-red-600 dark:text-red-400 hover:underline text-sm shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
                No company context uploaded yet. Add reference material above so every future
                analysis has it available.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

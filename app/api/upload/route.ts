import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python/FastAPI backend (python/app/routers/upload.py)
 * rather than running the TypeScript PDF extraction locally.
 *
 * The Python upload endpoint also stores the file in the document store
 * (agents/tools.py DocumentStore) and returns a `documentId` so the
 * analysis pipeline agents can re-extract their own domain slice directly,
 * instead of relying solely on the text pasted into the prompt. Routing
 * through the old TS path would silently skip the document store step and
 * make `documentId` unavailable during analysis.
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Request-ID': correlationId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to process file' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python upload backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

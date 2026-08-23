import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python/FastAPI backend (python/app/routers/company_context.py).
 * POST is multipart/form-data (category/title/content fields plus an
 * optional file) - re-built into a fresh FormData rather than piped raw,
 * since Next.js's Request body can only be consumed once and `formData()`
 * is the simplest way to inspect+forward it faithfully (fetch sets its own
 * correct multipart boundary from the FormData instance).
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');
    const url = new URL(`${PYTHON_BACKEND_URL}/api/company-context`);
    if (category) url.searchParams.set('category', category);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.detail || 'Failed to fetch company context' }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to Python company-context backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const outgoing = new FormData();
    for (const [key, value] of incoming.entries()) {
      outgoing.append(key, value);
    }

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/company-context`, {
      method: 'POST',
      body: outgoing,
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.detail || 'Failed to save company context' }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to Python company-context backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

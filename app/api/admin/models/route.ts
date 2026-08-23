import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python/FastAPI backend (python/app/routers/admin_models.py)
 * rather than talking to Postgres directly the way app/api/admin/boq does -
 * the list of available providers (models/factory.py's list_providers())
 * only exists on the Python side, so duplicating it in TypeScript would
 * just be a second place for the provider list to drift out of sync.
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/admin/models`);
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to fetch model overrides' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to Python admin/models backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/admin/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to save model overrides' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to Python admin/models backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

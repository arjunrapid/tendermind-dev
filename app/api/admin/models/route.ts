import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python/FastAPI backend (python/app/routers/admin_models.py)
 * rather than talking to Postgres directly the way app/api/admin/boq does -
 * the list of available providers (models/factory.py's list_providers())
 * only exists on the Python side, so duplicating it in TypeScript would
 * just be a second place for the provider list to drift out of sync.
 * Requires an admin JWT (enforced on the Python side).
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/admin/models`, {
      headers: {
        'X-Request-ID': correlationId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to fetch model overrides' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
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
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/admin/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': correlationId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to save model overrides' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python admin/models backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

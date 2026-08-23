import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python/FastAPI backend (python/app/routers/admin_boq.py).
 * Previously called lib/db.ts directly from Next.js; consolidated here so
 * all DB access goes through the Python layer and the TS DB layer is no
 * longer needed at runtime. Requires an admin JWT (enforced on the Python side).
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/admin/boq`, {
      headers: {
        'X-Request-ID': correlationId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to fetch BOQ defaults' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python admin/boq backend:', error);
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

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/admin/boq`, {
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
        { error: data.detail || 'Failed to save BOQ defaults' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python admin/boq backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

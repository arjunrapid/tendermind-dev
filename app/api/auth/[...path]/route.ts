import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for /api/auth/login and /api/auth/me — forwards to the Python
 * backend's JWT auth endpoints (python/app/routers/auth.py).
 *
 * - POST /api/auth/login  → returns { access_token, token_type, user }
 * - GET  /api/auth/me     → returns { id, username, role, name }
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

async function proxy(request: NextRequest, path: string): Promise<NextResponse> {
  try {
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';
    const method = request.method;

    const headers: Record<string, string> = {
      'X-Request-ID': correlationId,
    };
    if (authHeader) headers['Authorization'] = authHeader;

    let body: BodyInit | undefined;
    if (method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        headers['Content-Type'] = 'application/json';
        body = await request.text();
      }
    }

    const response = await fetch(`${PYTHON_BACKEND_URL}${path}`, {
      method,
      headers,
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Authentication error' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python auth backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(request, `/api/auth/${path.join('/')}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(request, `/api/auth/${path.join('/')}`);
}

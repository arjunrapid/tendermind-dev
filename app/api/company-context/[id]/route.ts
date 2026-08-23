import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/company-context/${id}`, {
      method: 'DELETE',
      headers: {
        'X-Request-ID': correlationId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.detail || 'Failed to delete company context' }, { status: response.status, headers: { 'X-Request-ID': correlationId } });
    }
    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python company-context backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

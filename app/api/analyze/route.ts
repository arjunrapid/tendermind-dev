import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the Python/FastAPI backend (python/app/routers/analyze.py)
 * instead of running the TypeScript agent pipeline (lib/agents/*.ts).
 *
 * The Python pipeline is the one with LangGraph + LangSmith tracing and the
 * pgvector-backed company-knowledge retrieval (python/app/knowledge.py) -
 * routing through the old TS agents here would silently skip both. Request/
 * response shapes are kept identical between the two backends (fileName,
 * classification, legalAssessment, engineeringAssessment,
 * accountingAssessment, riskAssessment, pricingBreakdown, bidRecommendation,
 * id) specifically so this can be a thin proxy with no shape translation.
 */
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
    const authHeader = request.headers.get('authorization') || '';

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/analyze`, {
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
        { error: data.detail || 'Failed to analyze document' },
        { status: response.status, headers: { 'X-Request-ID': correlationId } },
      );
    }

    return NextResponse.json(data, { headers: { 'X-Request-ID': correlationId } });
  } catch (error) {
    console.error('Error proxying to Python analyze backend:', error);
    return NextResponse.json(
      { error: 'Failed to reach analysis backend - is the Python server running (uvicorn app.main:app --port 8000)?' },
      { status: 502 },
    );
  }
}

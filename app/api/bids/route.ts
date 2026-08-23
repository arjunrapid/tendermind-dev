import { NextRequest, NextResponse } from 'next/server';
import { getBids } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const bids = await getBids(limit, offset);

    return NextResponse.json({
      bids,
      count: bids.length,
      hasMore: bids.length === limit,
    });
  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bids' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getBidById, deleteBid } from '@/lib/db';
import { getMemoryManager } from '@/lib/memory';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bid = await getBidById(id);

    if (!bid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }

    return NextResponse.json(bid);
  } catch (error) {
    console.error('Error fetching bid:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bid' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteBid(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }

    // Remove any agent memories learned from this bid's document so stale
    // learnings from a deleted document don't keep getting injected into
    // future analyses.
    const memoriesRemoved = await getMemoryManager().deleteMemoriesForBid(id);

    return NextResponse.json({ id, deleted: true, memoriesRemoved });
  } catch (error) {
    console.error('Error deleting bid:', error);
    return NextResponse.json(
      { error: 'Failed to delete bid' },
      { status: 500 },
    );
  }
}

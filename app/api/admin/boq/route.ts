import { NextRequest, NextResponse } from 'next/server';
import { getBoqDefaults, saveBoqDefaults } from '@/lib/db';
import { BoqItem, calculateBoqCosts, DEFAULT_BOQ_CONTINGENCY_PERCENTAGE } from '@/lib/boq';

export async function GET() {
  try {
    const items = await getBoqDefaults();
    const summary = calculateBoqCosts(items, DEFAULT_BOQ_CONTINGENCY_PERCENTAGE);
    return NextResponse.json({ items, summary });
  } catch (error) {
    console.error('Error fetching BOQ defaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BOQ defaults' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = body.items as BoqItem[];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items must be a non-empty array' },
        { status: 400 },
      );
    }

    for (const item of items) {
      if (!item.key || !item.name || !item.item_type) {
        return NextResponse.json(
          { error: 'Each item requires key, name, and item_type' },
          { status: 400 },
        );
      }
    }

    await saveBoqDefaults(items);
    const summary = calculateBoqCosts(items, DEFAULT_BOQ_CONTINGENCY_PERCENTAGE);
    return NextResponse.json({ items, summary });
  } catch (error) {
    console.error('Error saving BOQ defaults:', error);
    return NextResponse.json(
      { error: 'Failed to save BOQ defaults' },
      { status: 500 },
    );
  }
}

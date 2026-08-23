import { sql } from '@vercel/postgres';
import { BoqItem, BoqItemType, DEFAULT_BOQ_ITEMS } from './boq';

/**
 * Enhanced Bid interface for Tendermind
 * Includes citations, pricing breakdown, and LLM provider tracking
 */
export interface Bid {
  id: string;
  file_name: string;
  doc_type: string;
  extracted_text: string;
  classification_confidence: number;
  legal_assessment: Record<string, unknown>;
  engineering_assessment: Record<string, unknown>;
  accounting_assessment: Record<string, unknown>;
  pricing_breakdown: Record<string, unknown>;
  risk_score: number;
  risk_factors: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  llm_provider_used: string;
  processing_time_ms: number;
  created_at: string;
}

export interface ExtractedClause {
  id: string;
  bid_id: string;
  clause_type: string;
  text: string;
  page_number: number;
  section_reference: string;
  confidence: number;
  created_at: string;
}

export async function initializeDatabase() {
  try {
    // Create bids table with enhanced schema
    await sql`
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        extracted_text TEXT,
        classification_confidence FLOAT,
        legal_assessment JSONB,
        engineering_assessment JSONB,
        accounting_assessment JSONB,
        pricing_breakdown JSONB,
        risk_score FLOAT,
        risk_factors JSONB,
        recommendation JSONB,
        llm_provider_used TEXT,
        processing_time_ms INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create extracted clauses table for citations
    await sql`
      CREATE TABLE IF NOT EXISTS extracted_clauses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
        clause_type TEXT,
        text TEXT,
        page_number INT,
        section_reference TEXT,
        confidence FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create index for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_clauses_bid_id ON extracted_clauses(bid_id);
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

/**
 * Saves a bid. Pass `id` explicitly when the same id was already used to tag
 * this document's agent memories (see app/api/analyze/route.ts) so bid
 * deletion can find and remove those memories by the same id later.
 */
export async function saveBid(bid: Omit<Bid, 'id' | 'created_at'> & { id?: string }) {
  try {
    const result = bid.id
      ? await sql`
          INSERT INTO bids (
            id, file_name, doc_type, extracted_text, classification_confidence,
            legal_assessment, engineering_assessment, accounting_assessment,
            pricing_breakdown, risk_score, risk_factors, recommendation,
            llm_provider_used, processing_time_ms
          ) VALUES (
            ${bid.id}, ${bid.file_name}, ${bid.doc_type}, ${bid.extracted_text},
            ${bid.classification_confidence}, ${JSON.stringify(bid.legal_assessment)},
            ${JSON.stringify(bid.engineering_assessment)}, ${JSON.stringify(bid.accounting_assessment)},
            ${JSON.stringify(bid.pricing_breakdown)}, ${bid.risk_score},
            ${JSON.stringify(bid.risk_factors)}, ${JSON.stringify(bid.recommendation)},
            ${bid.llm_provider_used}, ${bid.processing_time_ms}
          )
          RETURNING *;
        `
      : await sql`
          INSERT INTO bids (
            file_name, doc_type, extracted_text, classification_confidence,
            legal_assessment, engineering_assessment, accounting_assessment,
            pricing_breakdown, risk_score, risk_factors, recommendation,
            llm_provider_used, processing_time_ms
          ) VALUES (
            ${bid.file_name}, ${bid.doc_type}, ${bid.extracted_text},
            ${bid.classification_confidence}, ${JSON.stringify(bid.legal_assessment)},
            ${JSON.stringify(bid.engineering_assessment)}, ${JSON.stringify(bid.accounting_assessment)},
            ${JSON.stringify(bid.pricing_breakdown)}, ${bid.risk_score},
            ${JSON.stringify(bid.risk_factors)}, ${JSON.stringify(bid.recommendation)},
            ${bid.llm_provider_used}, ${bid.processing_time_ms}
          )
          RETURNING *;
        `;
    return result.rows[0];
  } catch (error) {
    console.error('Error saving bid:', error);
    throw error;
  }
}

export async function saveExtractedClause(clause: Omit<ExtractedClause, 'id' | 'created_at'>) {
  try {
    const result = await sql`
      INSERT INTO extracted_clauses (
        bid_id, clause_type, text, page_number, section_reference, confidence
      ) VALUES (
        ${clause.bid_id}, ${clause.clause_type}, ${clause.text},
        ${clause.page_number}, ${clause.section_reference}, ${clause.confidence}
      )
      RETURNING *;
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error saving extracted clause:', error);
    throw error;
  }
}

export async function getBids(limit: number = 50, offset: number = 0) {
  try {
    const result = await sql`
      SELECT * FROM bids
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching bids:', error);
    throw error;
  }
}

export async function getBidById(id: string) {
  try {
    const result = await sql`
      SELECT * FROM bids WHERE id = ${id};
    `;
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching bid:', error);
    throw error;
  }
}

/**
 * Deletes a bid and its extracted clauses (which cascade via FK).
 * Returns the deleted row, or null if no bid with that id existed.
 */
export async function deleteBid(id: string) {
  try {
    const result = await sql`
      DELETE FROM bids WHERE id = ${id}
      RETURNING *;
    `;
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting bid:', error);
    throw error;
  }
}

let boqTableReady: Promise<void> | null = null;

/**
 * Lazily creates the boq_defaults table on first use, since this project
 * doesn't currently call initializeDatabase() on startup.
 */
function ensureBoqDefaultsTable(): Promise<void> {
  if (!boqTableReady) {
    boqTableReady = sql`
      CREATE TABLE IF NOT EXISTS boq_defaults (
        item_key TEXT PRIMARY KEY,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        quantity FLOAT,
        unit TEXT,
        unit_rate FLOAT,
        lump_sum_amount FLOAT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `.then(() => undefined);
  }
  return boqTableReady;
}

export async function getBoqDefaults(): Promise<BoqItem[]> {
  await ensureBoqDefaultsTable();

  const result = await sql`
    SELECT item_key, item_name, item_type, quantity, unit, unit_rate, lump_sum_amount
    FROM boq_defaults;
  `;

  if (result.rows.length === 0) {
    await saveBoqDefaults(DEFAULT_BOQ_ITEMS);
    return DEFAULT_BOQ_ITEMS;
  }

  const byKey = new Map(
    result.rows.map((row) => [
      row.item_key as string,
      {
        key: row.item_key as string,
        name: row.item_name as string,
        item_type: row.item_type as BoqItemType,
        quantity: row.quantity as number | null,
        unit: row.unit as string | null,
        unit_rate: row.unit_rate as number | null,
        lump_sum_amount: row.lump_sum_amount as number | null,
      },
    ]),
  );

  // Preserve the canonical item order regardless of row order.
  return DEFAULT_BOQ_ITEMS.map((defaultItem) => byKey.get(defaultItem.key) || defaultItem);
}

export async function saveBoqDefaults(items: BoqItem[]): Promise<void> {
  await ensureBoqDefaultsTable();

  for (const item of items) {
    await sql`
      INSERT INTO boq_defaults (
        item_key, item_name, item_type, quantity, unit, unit_rate, lump_sum_amount, updated_at
      ) VALUES (
        ${item.key}, ${item.name}, ${item.item_type}, ${item.quantity},
        ${item.unit}, ${item.unit_rate}, ${item.lump_sum_amount}, NOW()
      )
      ON CONFLICT (item_key) DO UPDATE SET
        item_name = EXCLUDED.item_name,
        item_type = EXCLUDED.item_type,
        quantity = EXCLUDED.quantity,
        unit = EXCLUDED.unit,
        unit_rate = EXCLUDED.unit_rate,
        lump_sum_amount = EXCLUDED.lump_sum_amount,
        updated_at = NOW();
    `;
  }
}

export async function getClausesForBid(bidId: string): Promise<ExtractedClause[]> {
  try {
    const result = await sql`
      SELECT * FROM extracted_clauses
      WHERE bid_id = ${bidId}
      ORDER BY page_number ASC;
    `;
    return result.rows as unknown as ExtractedClause[];
  } catch (error) {
    console.error('Error fetching extracted clauses:', error);
    throw error;
  }
}

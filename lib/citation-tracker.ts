/**
 * Citation Tracker
 * Tracks and validates citations for all extracted facts
 * Ensures 100% citation coverage per Tendermind PRD
 */

export interface ExtractedFact {
  fact: string;
  page_number?: number;
  section_reference?: string;
  confidence?: number;
  quote?: string;
}

export interface Citation {
  page_number: number;
  section_reference: string;
  quote?: string;
}

export interface CitationReport {
  total_facts: number;
  cited_facts: number;
  uncited_facts: string[];
  citation_coverage_percent: number;
  is_compliant: boolean;
}

/**
 * Validates that all facts have citations
 */
export function validateCitations(facts: ExtractedFact[]): CitationReport {
  const uncitedFacts: string[] = [];

  facts.forEach((fact) => {
    if (!fact.page_number && !fact.section_reference) {
      uncitedFacts.push(fact.fact);
    }
  });

  const citedFacts = facts.length - uncitedFacts.length;
  const coverage = facts.length > 0 ? (citedFacts / facts.length) * 100 : 100;

  return {
    total_facts: facts.length,
    cited_facts: citedFacts,
    uncited_facts: uncitedFacts,
    citation_coverage_percent: Math.round(coverage * 100) / 100,
    is_compliant: uncitedFacts.length === 0, // 100% citation required
  };
}

/**
 * Formats citations for display in reports
 */
export function formatCitation(citation: Citation): string {
  const parts: string[] = [];

  if (citation.page_number) {
    parts.push(`p. ${citation.page_number}`);
  }

  if (citation.section_reference) {
    parts.push(citation.section_reference);
  }

  return parts.join(', ');
}

/**
 * Extracts citations from LLM response using pattern matching.
 * Accepts any label after the page number - "section", "Clause", "Art.",
 * or no label at all (e.g. [page:5], [p5, Art. 6.2], [page:3, Clause 3.2]) -
 * since LLM output varies in wording even when the prompt asks for a
 * specific format.
 */
export function extractCitationsFromText(text: string): Citation[] {
  const citations: Citation[] = [];

  const pattern = /\[p(?:age)?[:\s]*(\d+)(?:[,\s]+([^\]]+))?\]/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    citations.push({
      page_number: parseInt(match[1], 10),
      section_reference: match[2]?.trim() || '',
    });
  }

  // Remove duplicates
  const uniqueCitations = Array.from(
    new Map(
      citations.map((c) => [
        `${c.page_number}_${c.section_reference}`,
        c,
      ]),
    ).values(),
  );

  return uniqueCitations;
}

/**
 * Ensures facts include citations, optionally enriching from extracted text
 */
export function enrichFactsWithCitations(
  facts: ExtractedFact[],
  extractedText: string,
): ExtractedFact[] {
  const enrichedFacts = facts.map((fact) => {
    // If already has citation, return as-is
    if (fact.page_number || fact.section_reference) {
      return fact;
    }

    // Try to find matching text in document to extract page/section
    // This is a simplified approach - in production, would need better matching
    const searchText = fact.fact.substring(0, 50); // First 50 chars
    const pageMatch = extractedText.match(
      new RegExp(`(?:page|p\\.?|p\\s+)(\\d+).*?${searchText}`, 'i'),
    );

    if (pageMatch) {
      return {
        ...fact,
        page_number: parseInt(pageMatch[1], 10),
      };
    }

    return fact;
  });

  return enrichedFacts;
}

/**
 * Generates citation statistics
 */
export function getCitationStats(facts: ExtractedFact[]) {
  const cited = facts.filter((f) => f.page_number || f.section_reference);
  const byPage = new Map<number, number>();

  cited.forEach((fact) => {
    if (fact.page_number) {
      byPage.set(fact.page_number, (byPage.get(fact.page_number) || 0) + 1);
    }
  });

  return {
    total_facts: facts.length,
    cited_facts: cited.length,
    coverage_percent: facts.length > 0 ? (cited.length / facts.length) * 100 : 100,
    pages_with_citations: Array.from(byPage.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([page, count]) => ({ page, count })),
  };
}

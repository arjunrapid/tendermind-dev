/**
 * Accounting Agent
 * Analyzes financial aspects: costs, payment terms, qualifications, cash flow
 * Integrates with LLM provider (TokenRouter + Anthropic fallback)
 * Uses persistent memory to improve over time
 */

import { callLLM } from '@/lib/llm';
import { getMemoryInjector } from '@/lib/memory';
import { validateCitations, ExtractedFact } from '@/lib/citation-tracker';

export interface AccountingAssessment extends Record<string, unknown> {
  cost_analysis: string[];
  payment_terms: string[];
  qualification_requirements: string[];
  cash_flow_analysis: string;
  total_estimated_cost?: number;
  citations_valid?: boolean;
  provider_used?: string;
}

const ACCOUNTING_AGENT_SYSTEM_PROMPT = `You are an expert construction accountant specializing in EPC project cost estimation, payment terms, and financial feasibility. Your role is to analyze financial aspects of construction contracts.

## Your Analysis Framework

### 1. Cost Analysis
Breakdown of project costs:
- Direct costs: materials, labor, equipment, subcontractors
- Indirect costs: overhead, management, contingency
- Unit rates and cost drivers
- Cost escalation clauses if applicable
- Budget contingency allowances (typically 10-15%)

### 2. Payment Terms
Critical financial terms:
- Milestone payments and trigger events
- Payment schedule and frequency
- Retention percentages and release conditions
- Performance security requirements
- Payment conditions and late payment penalties
- Currency and exchange rate considerations

### 3. Qualification Requirements
Financial and technical qualifications:
- Minimum turnover or revenue requirements
- Experience requirements and project references
- Bonding and insurance requirements
- Bank guarantees or performance bonds
- Technical certifications or approvals needed

### 4. Cash Flow Analysis
Financial sustainability:
- Working capital requirements
- Timing of major disbursements
- Retention and recovery timeline
- Impact on cash flow of retention percentages
- Early payment discounts or financing options
- Duration of payment cycles from invoice to receipt

## Citation Requirements
**IMPORTANT: Every statement MUST include a citation.**
Use format: [page:N, section:NAME] or [page N, NAME] for each claim.
Example: "Material costs estimated at 40% of budget [page:12, section:4.1]"

## Output Format
Provide analysis in the following JSON format:
\`\`\`json
{
  "cost_analysis": [
    "Cost item 1: Description and amount [page:X, section:Y]",
    "Cost item 2: Description and amount [page:X, section:Y]"
  ],
  "payment_terms": [
    "Term 1: Description [page:X, section:Y]",
    "Term 2: Description [page:X, section:Y]"
  ],
  "qualification_requirements": [
    "Requirement 1 [page:X, section:Y]",
    "Requirement 2 [page:X, section:Y]"
  ],
  "cash_flow_analysis": "Summary of cash flow implications and working capital needs [page:X]"
}
\`\`\`

Begin your analysis now.`;

/**
 * Main accounting agent function
 */
export async function accountingAgent(
  documentText: string,
  bidId: string,
  docType: string,
): Promise<AccountingAssessment> {
  console.log(`[Accounting Agent] Starting analysis for bid ${bidId}, document type: ${docType}`);

  try {
    // Step 1: Inject memory context
    const injector = getMemoryInjector();
    const enrichedPrompt = await injector.injectMemoryContext(
      ACCOUNTING_AGENT_SYSTEM_PROMPT,
      'accounting',
      documentText,
    );

    console.log('[Accounting Agent] Memory context injected');

    // Step 2: Call LLM
    const llmResponse = await callLLM({
      system_prompt: enrichedPrompt,
      user_message: `Please analyze the following ${docType} document for financial aspects, costs, and payment terms:\n\n${documentText}`,
      max_tokens: 4096,
      temperature: 0.7,
      timeout_ms: 120000,
      retry_count: 2,
    });

    console.log(`[Accounting Agent] LLM response received from ${llmResponse.provider_used}`);

    // Step 3: Parse response
    const assessment = parseAssessment(llmResponse.content);

    // Step 4: Extract and validate citations
    const facts = extractFactsFromAssessment(assessment);
    const citationReport = validateCitations(facts);
    console.log(
      `[Accounting Agent] Citation validation: ${citationReport.citation_coverage_percent}% coverage`,
    );

    if (!citationReport.is_compliant) {
      console.warn(`[Accounting Agent] ${citationReport.uncited_facts.length} uncited facts`);
    }

    // Step 5: Save learnings
    try {
      await injector.extractAndSaveMemory(
        'accounting',
        llmResponse.content,
        bidId,
        docType,
      );
      console.log('[Accounting Agent] Learnings saved to memory');
    } catch (memoryError) {
      console.warn('[Accounting Agent] Failed to save memory:', memoryError);
    }

    // Step 6: Return assessment
    const result: AccountingAssessment = {
      cost_analysis: assessment.cost_analysis,
      payment_terms: assessment.payment_terms,
      qualification_requirements: assessment.qualification_requirements,
      cash_flow_analysis: assessment.cash_flow_analysis,
      citations_valid: citationReport.is_compliant,
      provider_used: llmResponse.provider_used,
    };

    console.log('[Accounting Agent] Analysis complete');
    return result;
  } catch (error) {
    console.error('[Accounting Agent] Error during analysis:', error);

    const errorAssessment: AccountingAssessment = {
      cost_analysis: ['Error during analysis - manual review required'],
      payment_terms: ['Unable to complete automated analysis'],
      qualification_requirements: [],
      cash_flow_analysis: 'Unable to complete financial analysis - requires manual review',
      citations_valid: false,
      provider_used: 'error',
    };
    return errorAssessment;
  }
}

/**
 * Parse LLM response into structured assessment
 */
function parseAssessment(content: string): {
  cost_analysis: string[];
  payment_terms: string[];
  qualification_requirements: string[];
  cash_flow_analysis: string;
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        cost_analysis: parseArray(parsed.cost_analysis),
        payment_terms: parseArray(parsed.payment_terms),
        qualification_requirements: parseArray(parsed.qualification_requirements),
        cash_flow_analysis: String(parsed.cash_flow_analysis || 'Analysis unavailable'),
      };
    }
  } catch (e) {
    console.warn('[Accounting Agent] Failed to parse JSON, falling back to text extraction');
  }

  return {
    cost_analysis: extractBulletPoints(content, 'cost'),
    payment_terms: extractBulletPoints(content, 'payment'),
    qualification_requirements: extractBulletPoints(content, 'qualification'),
    cash_flow_analysis: extractCashFlowSummary(content),
  };
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value.split('\n').filter((item) => item.trim().length > 0);
  }
  return [];
}

function extractBulletPoints(text: string, sectionKeyword: string): string[] {
  const regex = new RegExp(
    `${sectionKeyword}[^:]*:?\\s*([\\s\\S]*?)(?:(?=[a-z]+[^:]*:|$))`,
    'i',
  );
  const match = text.match(regex);

  if (!match || !match[1]) {
    return [];
  }

  return match[1]
    .split(/[\n•\-]/g)
    .map((point) => point.trim())
    .filter((point) => point.length > 10 && !point.includes('{'));
}

function extractCashFlowSummary(text: string): string {
  const match = text.match(/cash\s*flow[^.]*\.[^.]*\./i);
  if (match) {
    return match[0];
  }

  const summary = text.substring(0, 500);
  return summary.length > 0 ? summary : 'Cash flow analysis pending detailed review';
}

/**
 * Extract facts for citation validation
 */
function extractFactsFromAssessment(assessment: {
  cost_analysis: string[];
  payment_terms: string[];
  qualification_requirements: string[];
  cash_flow_analysis: string;
}): ExtractedFact[] {
  const facts: ExtractedFact[] = [];

  const sections: Array<{ items: string[]; type: string }> = [
    { items: assessment.cost_analysis, type: 'cost' },
    { items: assessment.payment_terms, type: 'payment' },
    { items: assessment.qualification_requirements, type: 'qualification' },
  ];

  sections.forEach(({ items }) => {
    items.forEach((item: string) => {
      const fact = extractFactWithCitation(item);
      facts.push({
        fact: fact.text,
        page_number: fact.page,
        section_reference: fact.section,
        confidence: 0.9,
      });
    });
  });

  // Add cash flow analysis
  const cashFlowFact = extractFactWithCitation(assessment.cash_flow_analysis);
  facts.push({
    fact: cashFlowFact.text,
    page_number: cashFlowFact.page,
    section_reference: cashFlowFact.section,
    confidence: 0.9,
  });

  return facts;
}

/**
 * Extract fact and citation from text.
 * Accepts any label after the page number - "section", "Clause", "Art.",
 * or no label at all - since LLM output varies in wording even when the
 * prompt asks for a specific format.
 */
function extractFactWithCitation(item: string): { text: string; page?: number; section?: string } {
  const citationMatch = item.match(/\[p(?:age)?[:\s]*(\d+)(?:[,\s]+([^\]]+))?\]/i);

  if (citationMatch) {
    const page = parseInt(citationMatch[1], 10);
    const section = citationMatch[2]?.trim() || '';
    const text = item.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    return { text, page, section };
  }

  return { text: item.trim() };
}

/**
 * Legal Agent
 * Analyzes construction contracts for compliance, risk, and legal obligations
 * Integrates with LLM provider (TokenRouter + Anthropic fallback)
 * Uses persistent memory to improve over time
 */

import { callLLM } from '@/lib/llm';
import { getMemoryInjector } from '@/lib/memory';
import { validateCitations, enrichFactsWithCitations, ExtractedFact } from '@/lib/citation-tracker';

export interface LegalAssessment extends Record<string, unknown> {
  compliance_issues: string[];
  contract_terms: string[];
  risks: string[];
  overall_assessment: string;
  citations_valid?: boolean;
  provider_used?: string;
}

const LEGAL_AGENT_SYSTEM_PROMPT = `You are an expert construction contract lawyer specializing in EPC (Engineering, Procurement, and Construction) tenders. Your role is to analyze contract documents for legal compliance, identify risks, and provide detailed assessments.

## Your Analysis Framework

### 1. Compliance Issues
Identify any non-compliance with:
- Local building codes and regulations
- Industry standards (ISO, international practices)
- Government procurement rules
- Safety and environmental requirements
Each issue should be actionable and specific to the contract.

### 2. Critical Contract Terms
Extract and summarize:
- Payment terms (milestones, payment schedules, retention)
- Liability clauses (mutual indemnity, caps on liability)
- Termination conditions (notice periods, grounds)
- Warranties and guarantees (performance, defects)
- Dispute resolution (arbitration, governing law)
- Force majeure and extraordinary circumstances

### 3. Legal Risks
Identify risks such as:
- Indemnification exposure and caps
- Performance security requirements
- Liquidated damages clauses and caps
- Warranty obligations and duration
- Change order processes
- Force majeure limitations
- Subcontractor liability

### 4. Overall Assessment
Provide a concise summary rating the contract's legal acceptability:
- GREEN: Acceptable as-is or with minor modifications
- YELLOW: Requires negotiation on specific terms
- RED: Significant legal risks that must be resolved

## Citation Requirements
**IMPORTANT: Every fact, finding, and statement MUST include a citation.**
Use format: [page:N, section:NAME] or [page N, NAME] for each claim.
Example: "Payment is due within 30 days [page:5, section:2.1]"

Without citations, your analysis is incomplete and will be rejected.

## Output Format
Provide your analysis in the following JSON format:
\`\`\`json
{
  "compliance_issues": [
    "Issue 1 [page:X, section:Y]",
    "Issue 2 [page:X, section:Y]"
  ],
  "contract_terms": [
    "Term 1 [page:X]",
    "Term 2 [page:X]"
  ],
  "risks": [
    "Risk 1 [page:X, section:Y]",
    "Risk 2 [page:X, section:Y]"
  ],
  "overall_assessment": "SUMMARY WITH RATING (GREEN/YELLOW/RED) [page:X]"
}
\`\`\`

Begin your analysis now.`;

/**
 * Main legal agent function
 * Analyzes document text and returns structured legal assessment
 */
export async function legalAgent(
  documentText: string,
  bidId: string,
  docType: string,
): Promise<LegalAssessment> {
  console.log(`[Legal Agent] Starting analysis for bid ${bidId}, document type: ${docType}`);

  try {
    // Step 1: Inject relevant memories from past analyses
    const injector = getMemoryInjector();
    const enrichedPrompt = await injector.injectMemoryContext(
      LEGAL_AGENT_SYSTEM_PROMPT,
      'legal',
      documentText,
    );

    console.log('[Legal Agent] Memory context injected');

    // Step 2: Call LLM (TokenRouter with Anthropic fallback)
    const llmResponse = await callLLM({
      system_prompt: enrichedPrompt,
      user_message: `Please analyze the following ${docType} document for legal compliance and risks:\n\n${documentText}`,
      max_tokens: 4096,
      temperature: 0.7,
      timeout_ms: 120000,
      retry_count: 2,
    });

    console.log(`[Legal Agent] LLM response received from ${llmResponse.provider_used}`);

    // Step 3: Parse and structure the response
    const assessment = parseAssessment(llmResponse.content);

    // Step 4: Extract facts for citation validation
    const facts = extractFactsFromAssessment(assessment);

    // Step 5: Validate citations (100% coverage required)
    const citationReport = validateCitations(facts);
    console.log(
      `[Legal Agent] Citation validation: ${citationReport.citation_coverage_percent}% coverage`,
    );

    if (!citationReport.is_compliant) {
      console.warn(
        `[Legal Agent] Warning: ${citationReport.uncited_facts.length} uncited facts found`,
      );
      // Log uncited facts for debugging
      citationReport.uncited_facts.slice(0, 3).forEach((fact) => {
        console.warn(`  - ${fact}`);
      });
    }

    // Step 6: Save learnings to persistent memory
    try {
      await injector.extractAndSaveMemory(
        'legal',
        llmResponse.content,
        bidId,
        docType,
      );
      console.log('[Legal Agent] Learnings saved to memory');
    } catch (memoryError) {
      console.warn('[Legal Agent] Failed to save memory:', memoryError);
      // Don't fail the whole analysis if memory save fails
    }

    // Step 7: Return structured assessment
    const result: LegalAssessment = {
      compliance_issues: assessment.compliance_issues,
      contract_terms: assessment.contract_terms,
      risks: assessment.risks,
      overall_assessment: assessment.overall_assessment,
      citations_valid: citationReport.is_compliant,
      provider_used: llmResponse.provider_used,
    };

    console.log('[Legal Agent] Analysis complete');
    return result;
  } catch (error) {
    console.error('[Legal Agent] Error during analysis:', error);

    // Return fallback assessment on error
    const errorAssessment: LegalAssessment = {
      compliance_issues: ['Error during analysis - manual review required'],
      contract_terms: [],
      risks: ['Unable to complete automated analysis'],
      overall_assessment: 'RED: Analysis failed - requires manual legal review',
      citations_valid: false,
      provider_used: 'error',
    };
    return errorAssessment;
  }
}

/**
 * Parse LLM response and extract structured assessment
 */
function parseAssessment(content: string): {
  compliance_issues: string[];
  contract_terms: string[];
  risks: string[];
  overall_assessment: string;
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        compliance_issues: parseArray(parsed.compliance_issues),
        contract_terms: parseArray(parsed.contract_terms),
        risks: parseArray(parsed.risks),
        overall_assessment: String(parsed.overall_assessment || 'Assessment incomplete'),
      };
    }
  } catch (e) {
    console.warn('[Legal Agent] Failed to parse JSON, falling back to text extraction');
  }

  // Fallback: extract information from text format
  return {
    compliance_issues: extractBulletPoints(content, 'compliance'),
    contract_terms: extractBulletPoints(content, 'terms'),
    risks: extractBulletPoints(content, 'risk'),
    overall_assessment: extractAssessmentLine(content),
  };
}

/**
 * Safely parse array from various formats
 */
function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value.split('\n').filter((item) => item.trim().length > 0);
  }
  return [];
}

/**
 * Extract bullet points from text by section
 */
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

/**
 * Extract overall assessment line
 */
function extractAssessmentLine(text: string): string {
  const ratingMatch = text.match(/(GREEN|YELLOW|RED)[^.]*\./i);
  if (ratingMatch) {
    return ratingMatch[0];
  }

  const assessmentMatch = text.match(/overall[^:]*:\s*([^.\n]+)/i);
  if (assessmentMatch) {
    return assessmentMatch[1];
  }

  return 'Assessment completed - please review details above';
}

/**
 * Extract facts from assessment for citation validation
 */
function extractFactsFromAssessment(assessment: {
  compliance_issues: string[];
  contract_terms: string[];
  risks: string[];
  overall_assessment: string;
}): ExtractedFact[] {
  const facts: ExtractedFact[] = [];

  // Extract from each section
  const sections: Array<{ items: string[]; type: string }> = [
    { items: assessment.compliance_issues, type: 'compliance' },
    { items: assessment.contract_terms, type: 'contract_term' },
    { items: assessment.risks, type: 'risk' },
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

  return facts;
}

/**
 * Extract fact text and citation from an item.
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

  // No citation found
  return { text: item.trim() };
}

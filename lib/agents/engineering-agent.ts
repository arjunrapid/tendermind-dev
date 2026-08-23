/**
 * Engineering Agent
 * Analyzes construction scope, feasibility, timeline, and structural requirements
 * Integrates with LLM provider (TokenRouter + Anthropic fallback)
 * Uses persistent memory to improve over time
 */

import { callLLM } from '@/lib/llm';
import { getMemoryInjector } from '@/lib/memory';
import { validateCitations, ExtractedFact } from '@/lib/citation-tracker';

export interface EngineeringAssessment extends Record<string, unknown> {
  scope_analysis: string[];
  structural_concerns: string[];
  timeline_estimate: string;
  feasibility: string;
  site_requirements?: string[];
  citations_valid?: boolean;
  provider_used?: string;
}

const ENGINEERING_AGENT_SYSTEM_PROMPT = `You are an expert construction engineer specializing in EPC (Engineering, Procurement, and Construction) project feasibility analysis. Your role is to evaluate scope, technical requirements, and execution feasibility.

## Your Analysis Framework

### 1. Scope Analysis
Evaluate the project scope including:
- Scale and complexity of work
- Work breakdown structure clarity
- Material specifications and requirements
- Quality standards and acceptance criteria
- Performance requirements and KPIs
Each point should be specific and grounded in the document.

### 2. Structural & Technical Concerns
Identify engineering challenges:
- Foundation and structural design requirements
- Load calculations and safety factors
- Material grade and quality specifications
- Geotechnical or site-specific issues
- Design verification and approvals needed
- Coordination between different trades

### 3. Timeline Feasibility
Provide realistic timeline estimates:
- Critical path duration
- Major milestones and dependencies
- Weather/seasonal considerations
- Supply chain lead times
- Resource availability constraints
State duration in weeks and identify critical path items.

### 4. Feasibility Assessment
Rate overall feasibility (HIGH/MEDIUM/LOW) based on:
- Technical complexity vs. team capability
- Schedule constraints vs. realistic delivery
- Cost implications vs. market rates
- Resource requirements availability
- Risk factors and mitigation ease

### 5. Site Requirements
Specify needs for project execution:
- Site access and logistics
- Storage and staging areas
- Power, water, and utilities required
- Safety and environmental controls
- Permits and approvals needed

## Citation Requirements
**IMPORTANT: Every statement MUST include a citation.**
Use format: [page:N, section:NAME] or [page N, NAME] for each claim.
Example: "Foundation requires piling [page:8, section:3.2]"

## Output Format
Provide analysis in the following JSON format:
\`\`\`json
{
  "scope_analysis": [
    "Item 1 [page:X, section:Y]",
    "Item 2 [page:X, section:Y]"
  ],
  "structural_concerns": [
    "Concern 1 [page:X, section:Y]",
    "Concern 2 [page:X, section:Y]"
  ],
  "timeline_estimate": "X weeks, critical path: Y weeks [page:X]",
  "feasibility": "HIGH/MEDIUM/LOW - Rationale [page:X]",
  "site_requirements": [
    "Requirement 1 [page:X]",
    "Requirement 2 [page:X]"
  ]
}
\`\`\`

Begin your analysis now.`;

/**
 * Main engineering agent function
 */
export async function engineeringAgent(
  documentText: string,
  bidId: string,
  docType: string,
): Promise<EngineeringAssessment> {
  console.log(`[Engineering Agent] Starting analysis for bid ${bidId}, document type: ${docType}`);

  try {
    // Step 1: Inject memory context
    const injector = getMemoryInjector();
    const enrichedPrompt = await injector.injectMemoryContext(
      ENGINEERING_AGENT_SYSTEM_PROMPT,
      'engineering',
      documentText,
    );

    console.log('[Engineering Agent] Memory context injected');

    // Step 2: Call LLM
    const llmResponse = await callLLM({
      system_prompt: enrichedPrompt,
      user_message: `Please analyze the following ${docType} document for engineering feasibility, scope, and timeline:\n\n${documentText}`,
      max_tokens: 4096,
      temperature: 0.7,
      timeout_ms: 120000,
      retry_count: 2,
    });

    console.log(`[Engineering Agent] LLM response received from ${llmResponse.provider_used}`);

    // Step 3: Parse response
    const assessment = parseAssessment(llmResponse.content);

    // Step 4: Extract and validate citations
    const facts = extractFactsFromAssessment(assessment);
    const citationReport = validateCitations(facts);
    console.log(
      `[Engineering Agent] Citation validation: ${citationReport.citation_coverage_percent}% coverage`,
    );

    if (!citationReport.is_compliant) {
      console.warn(`[Engineering Agent] ${citationReport.uncited_facts.length} uncited facts`);
    }

    // Step 5: Save learnings
    try {
      await injector.extractAndSaveMemory(
        'engineering',
        llmResponse.content,
        bidId,
        docType,
      );
      console.log('[Engineering Agent] Learnings saved to memory');
    } catch (memoryError) {
      console.warn('[Engineering Agent] Failed to save memory:', memoryError);
    }

    // Step 6: Return assessment
    const result: EngineeringAssessment = {
      scope_analysis: assessment.scope_analysis,
      structural_concerns: assessment.structural_concerns,
      timeline_estimate: assessment.timeline_estimate,
      feasibility: assessment.feasibility,
      site_requirements: assessment.site_requirements || [],
      citations_valid: citationReport.is_compliant,
      provider_used: llmResponse.provider_used,
    };

    console.log('[Engineering Agent] Analysis complete');
    return result;
  } catch (error) {
    console.error('[Engineering Agent] Error during analysis:', error);

    const errorAssessment: EngineeringAssessment = {
      scope_analysis: ['Error during analysis - manual review required'],
      structural_concerns: ['Unable to complete automated analysis'],
      timeline_estimate: 'Unable to estimate - requires manual review',
      feasibility: 'UNKNOWN: Analysis failed - requires manual engineering review',
      site_requirements: [],
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
  scope_analysis: string[];
  structural_concerns: string[];
  timeline_estimate: string;
  feasibility: string;
  site_requirements: string[];
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        scope_analysis: parseArray(parsed.scope_analysis),
        structural_concerns: parseArray(parsed.structural_concerns),
        timeline_estimate: String(parsed.timeline_estimate || 'Unable to estimate'),
        feasibility: String(parsed.feasibility || 'Assessment incomplete'),
        site_requirements: parseArray(parsed.site_requirements),
      };
    }
  } catch (e) {
    console.warn('[Engineering Agent] Failed to parse JSON, falling back to text extraction');
  }

  return {
    scope_analysis: extractBulletPoints(content, 'scope'),
    structural_concerns: extractBulletPoints(content, 'concern'),
    timeline_estimate: extractTimelineEstimate(content),
    feasibility: extractFeasibilityAssessment(content),
    site_requirements: extractBulletPoints(content, 'requirement'),
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

function extractTimelineEstimate(text: string): string {
  const match = text.match(/(\d+)\s*(?:weeks?|months?|days?)/i);
  if (match) {
    const fullContext = text.substring(Math.max(0, match.index! - 50), match.index! + 100);
    return fullContext.trim();
  }
  return 'Timeline to be determined based on detailed scope';
}

function extractFeasibilityAssessment(text: string): string {
  const match = text.match(/(HIGH|MEDIUM|LOW)[^.\n]*/i);
  if (match) {
    return match[0];
  }
  return 'Feasibility assessment pending detailed review';
}

/**
 * Extract facts for citation validation
 */
function extractFactsFromAssessment(assessment: {
  scope_analysis: string[];
  structural_concerns: string[];
  timeline_estimate: string;
  feasibility: string;
  site_requirements: string[];
}): ExtractedFact[] {
  const facts: ExtractedFact[] = [];

  const sections: Array<{ items: string[]; type: string }> = [
    { items: assessment.scope_analysis, type: 'scope' },
    { items: assessment.structural_concerns, type: 'concern' },
    { items: assessment.site_requirements, type: 'requirement' },
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

  // Add timeline and feasibility as facts
  const timelineFact = extractFactWithCitation(assessment.timeline_estimate);
  facts.push({
    fact: timelineFact.text,
    page_number: timelineFact.page,
    section_reference: timelineFact.section,
    confidence: 0.9,
  });

  const feasibilityFact = extractFactWithCitation(assessment.feasibility);
  facts.push({
    fact: feasibilityFact.text,
    page_number: feasibilityFact.page,
    section_reference: feasibilityFact.section,
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

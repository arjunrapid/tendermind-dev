/**
 * Pricing Engine
 * Deterministic financial calculations for EPC bid pricing.
 *
 * NO LLM IS USED HERE. Per PRD: math must be deterministic and auditable.
 * Contract terms (LD rate, retention %, security %) are extracted from the
 * source document via regex, falling back to industry-standard defaults
 * when a term isn't explicitly stated.
 */

export interface PricingInputs {
  contract_value: number;
  estimated_duration_weeks: number;
  material_cost_percentage: number; // fraction of contract value spent on materials
  labor_cost_percentage: number; // fraction of contract value spent on labor
  contingency_percentage: number; // fraction added as risk buffer
  target_margin_percentage: number; // desired profit margin on bid price
  ld_rate_per_week_percentage: number; // % of contract value deducted per week of delay
  ld_cap_percentage: number; // max % of contract value exposed to LD
  performance_security_percentage: number; // % of contract value held as performance bond
  retention_rate_per_invoice_percentage: number; // % withheld from each invoice
  retention_cap_percentage: number; // max % of contract value withheld as retention
  invoices_count: number; // number of progress invoices expected over the project
}

export interface PricingBreakdown {
  contract_value: number;

  // Cost buildup
  material_cost: number;
  labor_cost: number;
  contingency_amount: number;
  total_estimated_cost: number;

  // Bid pricing
  target_margin_percentage: number;
  recommended_bid_price: number;

  // Liquidated damages
  ld_rate_per_week_percentage: number;
  ld_exposure_per_week: number;
  ld_cap_percentage: number;
  ld_cap_amount: number;
  weeks_to_reach_cap: number;

  // Performance security
  performance_security_percentage: number;
  performance_security_amount: number;

  // Retention
  estimated_invoice_amount: number;
  retention_rate_per_invoice_percentage: number;
  retention_per_invoice: number;
  retention_cap_percentage: number;
  retention_cap_amount: number;
  total_retention_held: number;

  // Cash flow / lock-up
  total_lockup: number;
  lockup_as_percentage_of_contract: number;

  // Assumptions used (for auditability)
  assumptions_used: string[];
}

/**
 * Industry-standard defaults, used only when a term cannot be extracted
 * from the source document.
 */
export const DEFAULT_PRICING_PARAMETERS = {
  material_cost_percentage: 0.5,
  labor_cost_percentage: 0.3,
  contingency_percentage: 0.1,
  target_margin_percentage: 0.15,
  ld_rate_per_week_percentage: 0.01, // 1% per week
  ld_cap_percentage: 0.1, // capped at 10%
  performance_security_percentage: 0.1, // 10%
  retention_rate_per_invoice_percentage: 0.1, // 10% per RA bill
  retention_cap_percentage: 0.05, // capped at 5%
  invoices_count: 12,
};

/**
 * Core deterministic pricing calculation.
 * No LLM calls - pure math per PRD requirement.
 */
export function calculatePricing(inputs: PricingInputs): PricingBreakdown {
  const {
    contract_value,
    estimated_duration_weeks,
    material_cost_percentage,
    labor_cost_percentage,
    contingency_percentage,
    target_margin_percentage,
    ld_rate_per_week_percentage,
    ld_cap_percentage,
    performance_security_percentage,
    retention_rate_per_invoice_percentage,
    retention_cap_percentage,
    invoices_count,
  } = inputs;

  // --- Cost buildup ---
  const material_cost = round2(contract_value * material_cost_percentage);
  const labor_cost = round2(contract_value * labor_cost_percentage);
  const base_cost = material_cost + labor_cost;
  const contingency_amount = round2(base_cost * contingency_percentage);
  const total_estimated_cost = round2(base_cost + contingency_amount);

  // --- Bid pricing ---
  const recommended_bid_price = round2(
    total_estimated_cost * (1 + target_margin_percentage),
  );

  // --- Liquidated damages ---
  const ld_exposure_per_week = round2(contract_value * ld_rate_per_week_percentage);
  const ld_cap_amount = round2(contract_value * ld_cap_percentage);
  const weeks_to_reach_cap =
    ld_exposure_per_week > 0
      ? Math.ceil(ld_cap_amount / ld_exposure_per_week)
      : Infinity;

  // --- Performance security ---
  const performance_security_amount = round2(
    contract_value * performance_security_percentage,
  );

  // --- Retention ---
  // Compute on unrounded values to avoid compounding rounding error across
  // `invoices_count` installments; round only once, for the returned totals.
  const raw_invoice_amount = invoices_count > 0 ? contract_value / invoices_count : 0;
  const raw_retention_per_invoice = raw_invoice_amount * retention_rate_per_invoice_percentage;
  const estimated_invoice_amount = round2(raw_invoice_amount);
  const retention_per_invoice = round2(raw_retention_per_invoice);
  const retention_cap_amount = round2(contract_value * retention_cap_percentage);
  const total_retention_held = Math.min(
    round2(raw_retention_per_invoice * invoices_count),
    retention_cap_amount,
  );

  // --- Total lock-up (cash tied up during project execution) ---
  const total_lockup = round2(performance_security_amount + total_retention_held);
  const lockup_as_percentage_of_contract = round4(
    contract_value > 0 ? total_lockup / contract_value : 0,
  );

  return {
    contract_value,
    material_cost,
    labor_cost,
    contingency_amount,
    total_estimated_cost,
    target_margin_percentage,
    recommended_bid_price,
    ld_rate_per_week_percentage,
    ld_exposure_per_week,
    ld_cap_percentage,
    ld_cap_amount,
    weeks_to_reach_cap,
    performance_security_percentage,
    performance_security_amount,
    estimated_invoice_amount,
    retention_rate_per_invoice_percentage,
    retention_per_invoice,
    retention_cap_percentage,
    retention_cap_amount,
    total_retention_held,
    total_lockup,
    lockup_as_percentage_of_contract,
    assumptions_used: [],
  };
}

/**
 * Extracts pricing parameters from raw document text using regex.
 * Falls back to DEFAULT_PRICING_PARAMETERS for anything not found.
 * Returns the resolved inputs plus a human-readable list of which
 * values were extracted vs. defaulted (for auditability).
 */
export function extractPricingInputs(
  documentText: string,
  estimatedDurationWeeksFallback: number = 24,
): { inputs: PricingInputs; assumptionsUsed: string[] } {
  const assumptionsUsed: string[] = [];

  const contract_value = extractContractValue(documentText, assumptionsUsed);
  const estimated_duration_weeks = extractDurationWeeks(
    documentText,
    estimatedDurationWeeksFallback,
    assumptionsUsed,
  );

  const ld_rate_per_week_percentage = extractPercentage(
    documentText,
    /(\d+(?:\.\d+)?)\s*%\s*(?:of\s*(?:the\s*)?contract\s*value\s*)?per\s*week(?:\s*(?:of\s*)?delay)?/i,
    DEFAULT_PRICING_PARAMETERS.ld_rate_per_week_percentage,
    'ld_rate_per_week_percentage',
    assumptionsUsed,
  );

  const ld_cap_percentage = extractPercentage(
    documentText,
    /(?:liquidated\s*damages|delay\s*penalt(?:y|ies))[\s\S]{0,120}?capped\s*at\s*(\d+(?:\.\d+)?)\s*%/i,
    DEFAULT_PRICING_PARAMETERS.ld_cap_percentage,
    'ld_cap_percentage',
    assumptionsUsed,
  );

  const performance_security_percentage = extractPercentage(
    documentText,
    /performance\s*(?:bond|security)[:\s]*(?:is\s*)?(\d+(?:\.\d+)?)\s*%/i,
    DEFAULT_PRICING_PARAMETERS.performance_security_percentage,
    'performance_security_percentage',
    assumptionsUsed,
  );

  const retention_rate_per_invoice_percentage = extractPercentage(
    documentText,
    /retention[:\s]*(?:is\s*)?(\d+(?:\.\d+)?)\s*%/i,
    DEFAULT_PRICING_PARAMETERS.retention_rate_per_invoice_percentage,
    'retention_rate_per_invoice_percentage',
    assumptionsUsed,
  );

  const retention_cap_percentage = extractPercentage(
    documentText,
    /retention[\s\S]{0,80}?capped\s*at\s*(\d+(?:\.\d+)?)\s*%/i,
    DEFAULT_PRICING_PARAMETERS.retention_cap_percentage,
    'retention_cap_percentage',
    assumptionsUsed,
  );

  const inputs: PricingInputs = {
    contract_value,
    estimated_duration_weeks,
    material_cost_percentage: DEFAULT_PRICING_PARAMETERS.material_cost_percentage,
    labor_cost_percentage: DEFAULT_PRICING_PARAMETERS.labor_cost_percentage,
    contingency_percentage: DEFAULT_PRICING_PARAMETERS.contingency_percentage,
    target_margin_percentage: DEFAULT_PRICING_PARAMETERS.target_margin_percentage,
    ld_rate_per_week_percentage,
    ld_cap_percentage,
    performance_security_percentage,
    retention_rate_per_invoice_percentage,
    retention_cap_percentage,
    invoices_count: DEFAULT_PRICING_PARAMETERS.invoices_count,
  };

  return { inputs, assumptionsUsed };
}

/**
 * Convenience wrapper: extract inputs from document text and calculate
 * pricing in one call. Attaches the assumptions list to the result.
 */
export function calculatePricingFromDocument(
  documentText: string,
  estimatedDurationWeeksFallback: number = 24,
): PricingBreakdown {
  const { inputs, assumptionsUsed } = extractPricingInputs(
    documentText,
    estimatedDurationWeeksFallback,
  );

  const breakdown = calculatePricing(inputs);
  breakdown.assumptions_used = assumptionsUsed;
  return breakdown;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function extractContractValue(text: string, assumptionsUsed: string[]): number {
  // Matches: "Contract Value: USD 12,500,000" / "Project Value: USD 12.5 Million"
  const millionMatch = text.match(
    /(?:contract|project)\s*value[:\s]*(?:USD|US\$|\$)?\s*([\d,]+(?:\.\d+)?)\s*million/i,
  );
  if (millionMatch) {
    return parseFloat(millionMatch[1].replace(/,/g, '')) * 1_000_000;
  }

  const exactMatch = text.match(
    /(?:contract|project)\s*value[:\s]*(?:USD|US\$|\$)?\s*([\d,]+(?:\.\d+)?)/i,
  );
  if (exactMatch) {
    return parseFloat(exactMatch[1].replace(/,/g, ''));
  }

  assumptionsUsed.push(
    'contract_value: not found in document, defaulted to 0 - caller must supply explicitly',
  );
  return 0;
}

function extractDurationWeeks(
  text: string,
  fallback: number,
  assumptionsUsed: string[],
): number {
  const monthsMatch = text.match(/duration[:\s]*(\d+)\s*months?/i);
  if (monthsMatch) {
    return Math.round(parseInt(monthsMatch[1], 10) * 4.345);
  }

  const weeksMatch = text.match(/duration[:\s]*(\d+)\s*weeks?/i);
  if (weeksMatch) {
    return parseInt(weeksMatch[1], 10);
  }

  assumptionsUsed.push(
    `estimated_duration_weeks: not found in document, defaulted to ${fallback} weeks`,
  );
  return fallback;
}

function extractPercentage(
  text: string,
  regex: RegExp,
  fallback: number,
  fieldName: string,
  assumptionsUsed: string[],
): number {
  const match = text.match(regex);
  if (match) {
    return parseFloat(match[1]) / 100;
  }

  assumptionsUsed.push(
    `${fieldName}: not found in document, defaulted to ${(fallback * 100).toFixed(1)}%`,
  );
  return fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

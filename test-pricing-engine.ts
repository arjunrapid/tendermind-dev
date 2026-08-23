/**
 * Pricing Engine Test
 * Verifies deterministic math against the EBTSL 7187 reference tender terms:
 *   Contract Value: USD 12,500,000
 *   LD: 0.5% per week, capped at 5%
 *   Performance Security: 10%
 *   Retention: 5% holdback (stated as "Retention: 5% holdback", cap not explicit)
 */

import { calculatePricing, calculatePricingFromDocument, PricingInputs } from './lib/pricing-engine';

function assertEqual(actual: number, expected: number, label: string) {
  const diff = Math.abs(actual - expected);
  const pass = diff < 0.01;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: expected ${expected}, got ${actual}`);
  if (!pass) process.exitCode = 1;
}

function testDeterministicMath() {
  console.log('='.repeat(70));
  console.log('TEST 1: Deterministic Math (explicit inputs)');
  console.log('='.repeat(70));

  const inputs: PricingInputs = {
    contract_value: 12_500_000,
    estimated_duration_weeks: 104, // 24 months
    material_cost_percentage: 0.5,
    labor_cost_percentage: 0.3,
    contingency_percentage: 0.1,
    target_margin_percentage: 0.15,
    ld_rate_per_week_percentage: 0.005, // 0.5% per week
    ld_cap_percentage: 0.05, // capped at 5%
    performance_security_percentage: 0.1, // 10%
    retention_rate_per_invoice_percentage: 0.05, // 5% holdback
    retention_cap_percentage: 0.05, // assume same as stated rate (no separate cap given)
    invoices_count: 12,
  };

  const result = calculatePricing(inputs);

  console.log('\nCost Buildup:');
  assertEqual(result.material_cost, 6_250_000, 'material_cost (50% of 12.5M)');
  assertEqual(result.labor_cost, 3_750_000, 'labor_cost (30% of 12.5M)');
  assertEqual(result.contingency_amount, 1_000_000, 'contingency_amount (10% of 10M base)');
  assertEqual(result.total_estimated_cost, 11_000_000, 'total_estimated_cost');

  console.log('\nBid Price:');
  assertEqual(result.recommended_bid_price, 12_650_000, 'recommended_bid_price (11M * 1.15)');

  console.log('\nLiquidated Damages:');
  assertEqual(result.ld_exposure_per_week, 62_500, 'ld_exposure_per_week (0.5% of 12.5M)');
  assertEqual(result.ld_cap_amount, 625_000, 'ld_cap_amount (5% of 12.5M)');
  assertEqual(result.weeks_to_reach_cap, 10, 'weeks_to_reach_cap');

  console.log('\nPerformance Security:');
  assertEqual(result.performance_security_amount, 1_250_000, 'performance_security_amount (10% of 12.5M)');

  console.log('\nRetention:');
  assertEqual(result.estimated_invoice_amount, 1_041_666.67, 'estimated_invoice_amount (12.5M / 12)');
  assertEqual(result.retention_per_invoice, 52_083.33, 'retention_per_invoice (5% of invoice)');
  assertEqual(result.retention_cap_amount, 625_000, 'retention_cap_amount (5% of 12.5M)');
  assertEqual(result.total_retention_held, 625_000, 'total_retention_held (capped)');

  console.log('\nTotal Lock-up:');
  assertEqual(result.total_lockup, 1_875_000, 'total_lockup (security + retention)');
  assertEqual(result.lockup_as_percentage_of_contract, 0.15, 'lockup_as_percentage_of_contract (15%)');

  console.log();
}

function testDocumentExtraction() {
  console.log('='.repeat(70));
  console.log('TEST 2: Extraction from Document Text (EBTSL 7187 language)');
  console.log('='.repeat(70));

  const documentText = `
  2. FINANCIAL REQUIREMENTS
  Contract Value: USD 12,500,000 (fixed price lump sum)
  Duration: 24 months from Notice to Proceed

  6.1 Performance Bond: 10% of contract value

  2.4 Retention: 5% holdback from each invoice, released 6 months after project completion

  8.1 Schedule Delay Penalties
  0.5% of contract value per week of delay, capped at 5% total
  `;

  const result = calculatePricingFromDocument(documentText);

  console.log('\nExtracted values:');
  assertEqual(result.contract_value, 12_500_000, 'contract_value extracted from "USD 12,500,000"');
  assertEqual(result.ld_rate_per_week_percentage, 0.005, 'ld_rate_per_week_percentage extracted (0.5%)');
  assertEqual(result.ld_cap_percentage, 0.05, 'ld_cap_percentage extracted (capped at 5%)');
  assertEqual(result.performance_security_percentage, 0.1, 'performance_security_percentage extracted (10%)');
  assertEqual(result.retention_rate_per_invoice_percentage, 0.05, 'retention_rate_per_invoice_percentage extracted (5%)');

  console.log('\nDerived totals:');
  assertEqual(result.ld_cap_amount, 625_000, 'ld_cap_amount');
  assertEqual(result.performance_security_amount, 1_250_000, 'performance_security_amount');

  console.log('\nAssumptions used (values not found in doc, defaulted):');
  result.assumptions_used.forEach((a) => console.log(`  - ${a}`));
  console.log();
}

function testMissingData() {
  console.log('='.repeat(70));
  console.log('TEST 3: Graceful Fallback (document with no financial terms)');
  console.log('='.repeat(70));

  const result = calculatePricingFromDocument('This document has no financial terms at all.');

  console.log(`\ncontract_value: ${result.contract_value} (expected 0 - caller must supply)`);
  console.log(`ld_rate_per_week_percentage: ${result.ld_rate_per_week_percentage} (expected default 0.01)`);
  console.log(`performance_security_percentage: ${result.performance_security_percentage} (expected default 0.1)`);
  console.log('\nAssumptions used:');
  result.assumptions_used.forEach((a) => console.log(`  - ${a}`));
  console.log();
}

console.log('\n' + '#'.repeat(70));
console.log('# PRICING ENGINE TEST SUITE');
console.log('#'.repeat(70) + '\n');

testDeterministicMath();
testDocumentExtraction();
testMissingData();

console.log('='.repeat(70));
console.log(process.exitCode === 1 ? '❌ SOME TESTS FAILED' : '✅ ALL TESTS PASSED');
console.log('='.repeat(70));

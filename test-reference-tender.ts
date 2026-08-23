/**
 * Reference Tender Test - EBTSL 7187-EBTSL-0001
 * Tests all agents against a realistic tender document
 * Expected output: CONDITIONAL BID with specific findings
 */

import { classifyDocument } from './lib/classifier';
import { legalAgent } from './lib/agents/legal-agent';
import { engineeringAgent } from './lib/agents/engineering-agent';
import { accountingAgent } from './lib/agents/accounting-agent';
import { riskAgent } from './lib/agents/risk-agent';
import { calculatePricingFromDocument } from './lib/pricing-engine';

/**
 * Sample tender document based on EBTSL 7187-EBTSL-0001
 * EPC Construction Contract for Industrial Facility
 */
const REFERENCE_TENDER = `
TENDER DOCUMENT - EBTSL 7187-EBTSL-0001
ENGINEERING, PROCUREMENT AND CONSTRUCTION (EPC) CONTRACT
Industrial Processing Plant Construction

1. PROJECT OVERVIEW
Project Name: Industrial Processing Facility Expansion
Location: Petrochemical Park, Region A
Project Value: USD 12.5 Million
Duration: 24 months from Notice to Proceed
Client: GlobeTech Industries Limited

2. FINANCIAL REQUIREMENTS [page:2, Clause 2.1]
2.1 Contract Value: USD 12,500,000 (fixed price lump sum)
2.2 Payment Terms: Monthly invoicing based on certified work completion [page:2, Clause 2.2]
2.3 Milestone Payments:
    - 15% upon contract award and mobilization [page:2]
    - 30% upon equipment delivery and site infrastructure completion [page:2]
    - 40% upon system installation and testing completion [page:2]
    - 15% upon final commissioning and handover [page:2]
2.4 Retention: 5% holdback from each invoice, released 6 months after project completion [page:2]
2.5 Performance Bond: 10% of contract value, to be provided within 14 days of award [page:2]
2.6 Payment Terms: Net 30 days from invoice date [page:2]

3. TECHNICAL SCOPE [page:3, Clause 3]
3.1 Scope Includes:
    - Design development and detailed engineering [page:3]
    - Equipment procurement and factory testing [page:3]
    - Civil works including foundations and structural steel [page:3]
    - Mechanical installation and piping systems [page:3]
    - Electrical systems and control instrumentation [page:3]
    - HVAC and utility systems [page:3]
    - Commissioning and start-up support [page:3]

3.2 Site Conditions [page:3]
    - Site access available but limited to 2 entry points [page:3]
    - Existing utilities present: Power (415V), Water, Compressed air [page:3]
    - Geotechnical survey indicates stable soil conditions up to 2m depth [page:3]
    - Environmental zoning: Industrial with strict emissions controls [page:3]

3.3 Timeline [page:3]
    - Engineering & Procurement: Months 1-4
    - Equipment Procurement: Months 2-8 (with 12-week lead times) [page:3]
    - Site mobilization: Month 4
    - Civil works: Months 5-10
    - Mechanical installation: Months 9-18
    - Commissioning: Months 19-24 [page:3]

4. EXPERIENCE REQUIREMENTS [page:4]
4.1 Bidder Qualifications [page:4]
    - Minimum 10 years experience in EPC construction [page:4]
    - Minimum 3 completed projects of similar complexity and scale [page:4]
    - Minimum annual turnover USD 50 Million for last 3 years [page:4]
    - ISO 9001, ISO 14001 certifications required [page:4]
    - OHSAS 18001 or ISO 45001 certification required [page:4]

4.2 Key Personnel Requirements [page:4]
    - Project Manager: Minimum 15 years EPC experience [page:4]
    - Site Engineer: Minimum 12 years construction experience [page:4]
    - Quality Manager: Third-party certified quality engineer [page:4]
    - HSE Manager: Certified safety professional [page:4]

4.3 Project References [page:4]
    - Minimum 3 references from completed projects over USD 10 Million [page:4]
    - References must include similar industrial process facility projects [page:4]

5. CONTRACT TERMS AND CONDITIONS [page:5]
5.1 Liability [page:5]
    - Contractor liability capped at 10% of contract value for direct damages [page:5]
    - No liability cap for gross negligence or willful misconduct [page:5]
    - Third-party indemnification: Contractor indemnifies Client for all third-party claims [page:5]

5.2 Warranty Period [page:5]
    - Defects liability period: 12 months from commissioning [page:5]
    - Performance warranty: All equipment and systems to operate per specifications [page:5]
    - Contractor liable for defect rectification at no additional cost [page:5]

5.3 Termination [page:5]
    - Client may terminate for convenience with 60 days notice [page:5]
    - Either party may terminate for material breach with 30 days notice if not cured [page:5]
    - Upon termination for convenience: Contractor paid for work completed plus reasonable demobilization costs [page:5]

5.4 Change Orders [page:5]
    - Changes require written authorization from Client [page:5]
    - Cost of changes to be negotiated; no automatic price increase [page:5]
    - Contractor has 14 days to submit cost impact of change orders [page:5]

5.5 Disputes [page:5]
    - All disputes subject to international arbitration [page:5]
    - Arbitration location: New York, USA [page:5]
    - Governing law: English law [page:5]

5.6 Force Majeure [page:6]
    - Force majeure events: Acts of God, natural disasters, war, political unrest [page:6]
    - Events lasting more than 60 days allow either party to terminate [page:6]
    - Force majeure notification required within 48 hours of occurrence [page:6]

6. PERFORMANCE SECURITY AND INSURANCE [page:6]
6.1 Performance Bond: 10% of contract value [page:6]
6.2 Insurance Requirements [page:6]
    - General Liability: Minimum USD 5 Million per occurrence [page:6]
    - Equipment Insurance: Full replacement value during transit and storage [page:6]
    - All-risk site insurance covering the project [page:6]

7. TECHNICAL SPECIFICATIONS [page:7]
7.1 Equipment Standards
    - All equipment to meet ASME standards [page:7]
    - Electrical systems to meet IEC standards [page:7]
    - All materials to be latest available technology [page:7]

7.2 Quality Control
    - Third-party inspection at key milestones [page:7]
    - Factory acceptance testing required before delivery [page:7]
    - Site acceptance testing required before final payment [page:7]

8. LIQUIDATED DAMAGES [page:8]
8.1 Schedule Delay Penalties
    - 0.5% of contract value per week of delay, capped at 5% total [page:8]
    - Delays beyond 5% allow Client to engage alternative contractors [page:8]

8.2 Performance Shortfalls
    - 1% deduction per percentage point below performance specifications [page:8]
    - Maximum deduction: 10% of contract value [page:8]

9. SUBMISSION REQUIREMENTS [page:9]
9.1 Technical Proposal must include:
    - Detailed execution plan and schedule [page:9]
    - Resource plan and organization chart [page:9]
    - Risk analysis and mitigation plan [page:9]
    - Quality assurance plan [page:9]
    - HSE and environmental management plan [page:9]

9.2 Financial Proposal must include:
    - Detailed cost breakdown by work package [page:9]
    - Resource rates and assumptions [page:9]
    - Schedule of values [page:9]
    - Bid validity period: 90 days [page:9]

10. EVALUATION CRITERIA [page:10]
10.1 Technical Capability: 40%
    - Experience and track record
    - Proposed project team qualifications
    - Technical approach and risk mitigation
    - Schedule feasibility

10.2 Financial: 40%
    - Price competitiveness
    - Value for money
    - Payment terms proposed

10.3 HSE & Compliance: 20%
    - Environmental management capability
    - Safety record and management
    - Local regulatory compliance

11. EVALUATION PROCESS [page:10]
11.1 Long-list: Top 5 bidders selected for technical evaluation [page:10]
11.2 Short-list: Top 3 bidders after technical evaluation [page:10]
11.3 Final Selection: Highest scoring bidder in technical + financial evaluation [page:10]
11.4 Contract award target: 60 days from bid submission [page:10]

DOCUMENT CLASSIFICATION: EPC CONTRACT
ESTIMATED PAGES: 10
DOCUMENT IMPORTANCE: HIGH - Master contract document
`;

async function runReferenceTenderTest() {
  console.log('\n' + '='.repeat(70));
  console.log('REFERENCE TENDER TEST - EBTSL 7187-EBTSL-0001');
  console.log('='.repeat(70));
  console.log();

  try {
    const startTime = Date.now();
    const bidId = 'ref-tender-7187';

    // Step 1: Classify document
    console.log('📋 STEP 1: Document Classification');
    console.log('-'.repeat(70));
    const classification = classifyDocument(REFERENCE_TENDER);
    console.log(`Document Type: ${classification.doc_type}`);
    console.log(`Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log();

    // Steps 2-4: Run Legal, Engineering, and Accounting agents concurrently.
    // They are independent - each is a separate ~60-90s LLM call, so running
    // them in parallel takes ~1 call's worth of time instead of ~3x.
    console.log('⚖️🏗️💰 STEPS 2-4: Legal, Engineering & Accounting Agents (parallel)');
    console.log('-'.repeat(70));
    console.log('Running all three concurrently...');
    const parallelStart = Date.now();
    const [legalAssessment, engineeringAssessment, accountingAssessment] = await Promise.all([
      legalAgent(REFERENCE_TENDER, bidId, classification.doc_type),
      engineeringAgent(REFERENCE_TENDER, bidId, classification.doc_type),
      accountingAgent(REFERENCE_TENDER, bidId, classification.doc_type),
    ]);
    console.log(`✅ All three agents complete in ${((Date.now() - parallelStart) / 1000).toFixed(1)}s (wall clock)`);
    console.log();

    console.log('  Legal:');
    console.log(`   - Provider: ${legalAssessment.provider_used}`);
    console.log(`   - Compliance issues: ${legalAssessment.compliance_issues.length}`);
    console.log(`   - Contract terms extracted: ${legalAssessment.contract_terms.length}`);
    console.log(`   - Risks identified: ${legalAssessment.risks.length}`);
    console.log(`   - Citations: ${legalAssessment.citations_valid ? '✅ Valid' : '❌ Incomplete'}`);
    console.log();

    console.log('  Engineering:');
    console.log(`   - Provider: ${engineeringAssessment.provider_used}`);
    console.log(`   - Scope items: ${engineeringAssessment.scope_analysis.length}`);
    console.log(`   - Structural concerns: ${engineeringAssessment.structural_concerns.length}`);
    console.log(`   - Feasibility: ${engineeringAssessment.feasibility}`);
    console.log(`   - Timeline: ${engineeringAssessment.timeline_estimate.substring(0, 50)}...`);
    console.log();

    console.log('  Accounting:');
    console.log(`   - Provider: ${accountingAssessment.provider_used}`);
    console.log(`   - Cost items: ${accountingAssessment.cost_analysis.length}`);
    console.log(`   - Payment terms: ${accountingAssessment.payment_terms.length}`);
    console.log(`   - Qualifications: ${accountingAssessment.qualification_requirements.length}`);
    console.log();

    // Step 5: Run Risk Agent (aggregation)
    console.log('⚠️  STEP 5: Risk Agent Aggregation');
    console.log('-'.repeat(70));
    console.log('Aggregating findings and generating recommendation...');
    const riskAssessment = riskAgent(legalAssessment, engineeringAssessment, accountingAssessment);
    console.log(`✅ Risk assessment complete`);
    console.log(`   - Risk Score: ${riskAssessment.risk_score} / 1.0`);
    console.log(`   - Risk Level: ${riskAssessment.risk_level}`);
    console.log(`   - Risk Factors: ${riskAssessment.risk_factors.length}`);
    console.log();

    // Step 6: Pricing Engine (deterministic, no LLM)
    console.log('💵 STEP 6: Pricing Engine (Deterministic)');
    console.log('-'.repeat(70));
    console.log('Calculating cost buildup, LD exposure, retention, and lock-up...');
    const pricing = calculatePricingFromDocument(REFERENCE_TENDER);
    console.log(`✅ Pricing calculation complete`);
    console.log(`   - Contract Value: $${pricing.contract_value.toLocaleString()}`);
    console.log(`   - Total Estimated Cost: $${pricing.total_estimated_cost.toLocaleString()}`);
    console.log(`   - Recommended Bid Price: $${pricing.recommended_bid_price.toLocaleString()}`);
    console.log(`   - LD Cap: ${(pricing.ld_cap_percentage * 100).toFixed(1)}% ($${pricing.ld_cap_amount.toLocaleString()})`);
    console.log(`   - Weeks to Reach LD Cap: ${pricing.weeks_to_reach_cap}`);
    console.log(`   - Performance Security: $${pricing.performance_security_amount.toLocaleString()}`);
    console.log(`   - Total Retention Held: $${pricing.total_retention_held.toLocaleString()}`);
    console.log(`   - Total Lock-up: $${pricing.total_lockup.toLocaleString()} (${(pricing.lockup_as_percentage_of_contract * 100).toFixed(1)}% of contract)`);
    if (pricing.assumptions_used.length > 0) {
      console.log(`   - Assumptions used (not found in doc):`);
      pricing.assumptions_used.forEach((a) => console.log(`     · ${a}`));
    }
    console.log();

    // Step 7: Final Recommendation
    console.log('🎯 FINAL RECOMMENDATION');
    console.log('='.repeat(70));
    console.log(`Bid Status: ${riskAssessment.recommendation}`);
    console.log();
    console.log('Rationale:');
    console.log(riskAssessment.recommendation_rationale);
    console.log();

    if (riskAssessment.risk_factors.length > 0) {
      console.log('Key Risk Factors:');
      riskAssessment.risk_factors.slice(0, 5).forEach((factor, i) => {
        console.log(`  ${i + 1}. ${factor}`);
      });
      if (riskAssessment.risk_factors.length > 5) {
        console.log(`  ... and ${riskAssessment.risk_factors.length - 5} more factors`);
      }
      console.log();
    }

    if (riskAssessment.mitigation_strategies.length > 0) {
      console.log('Recommended Mitigation Strategies:');
      riskAssessment.mitigation_strategies.forEach((strategy, i) => {
        console.log(`  ${i + 1}. ${strategy}`);
      });
      console.log();
    }

    // Performance summary
    const duration = Date.now() - startTime;
    console.log('='.repeat(70));
    console.log('PERFORMANCE SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Processing Time: ${duration}ms`);
    console.log(`Legal Agent: ${legalAssessment.provider_used}`);
    console.log(`Engineering Agent: ${engineeringAssessment.provider_used}`);
    console.log(`Accounting Agent: ${accountingAssessment.provider_used}`);
    console.log();

    // Validation
    console.log('='.repeat(70));
    console.log('VALIDATION');
    console.log('='.repeat(70));
    console.log(`✅ Legal citations: ${legalAssessment.citations_valid ? 'VALID' : 'INVALID'}`);
    console.log(`✅ Engineering citations: ${engineeringAssessment.citations_valid ? 'VALID' : 'INVALID'}`);
    console.log(`✅ Accounting citations: ${accountingAssessment.citations_valid ? 'VALID' : 'INVALID'}`);
    console.log(`✅ Bid recommendation: ${riskAssessment.recommendation}`);
    console.log();

    // Expected output check
    console.log('='.repeat(70));
    console.log('EXPECTED vs ACTUAL');
    console.log('='.repeat(70));
    console.log('Expected Findings:');
    console.log('  - Financial criteria: MET (Payment terms clearly defined)');
    console.log('  - Experience requirement: NOT MET (Bid may require JV partner)');
    console.log('  - LD Cap: 5% of contract value ($625,000 on $12.5M)');
    console.log('  - Feasibility: Good with proper resourcing');
    console.log();
    console.log('Actual Findings:');
    console.log(`  - Risk Level: ${riskAssessment.risk_level}`);
    console.log(`  - Recommendation: ${riskAssessment.recommendation}`);
    console.log(`  - Legal Issues: ${legalAssessment.compliance_issues.length} found`);
    console.log(`  - Engineering Concerns: ${engineeringAssessment.structural_concerns.length} found`);
    console.log(`  - LD Cap: ${(pricing.ld_cap_percentage * 100).toFixed(1)}% ($${pricing.ld_cap_amount.toLocaleString()})`);
    console.log(`  - Recommended Bid Price: $${pricing.recommended_bid_price.toLocaleString()}`);
    console.log();

    console.log('='.repeat(70));
    console.log('✅ REFERENCE TENDER TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log();

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runReferenceTenderTest();

/**
 * Test script for Legal Agent
 * Run with: npx ts-node test-legal-agent.ts
 */

import { legalAgent } from './lib/agents/legal-agent';

const sampleContractText = `
CONSTRUCTION CONTRACT

1. PARTIES
This agreement is entered into between ABC Construction Company (Client) and XYZ Contractors (Contractor).

2. PAYMENT TERMS
Payment shall be made within 30 days of invoice receipt. A 10% retention is held until project completion.
Late payments incur a 1.5% monthly interest charge.

3. LIABILITY
The Contractor shall indemnify the Client against all third-party claims arising from negligence.
Maximum liability is capped at the total contract value.

4. TERMINATION
Either party may terminate with 30 days written notice. Termination for cause requires 24 hours notice.
Upon termination, all work in progress must be documented and invoiced proportionally.

5. WARRANTY
The Contractor warrants that all work meets specification for a period of 12 months following completion.
Defects discovered within this period must be corrected at no additional cost.

6. FORCE MAJEURE
Neither party shall be liable for failure to perform due to acts beyond reasonable control, including natural disasters.
Force majeure events must be documented and reported within 48 hours.

7. DISPUTE RESOLUTION
All disputes shall be resolved through binding arbitration under international arbitration rules.
The prevailing party shall recover reasonable attorney fees.

8. GOVERNING LAW
This agreement is governed by the laws of the jurisdiction where the project is located.
`;

async function test() {
  console.log('='.repeat(60));
  console.log('Testing Legal Agent');
  console.log('='.repeat(60));
  console.log();

  try {
    console.log('Input: Sample construction contract (8 sections)');
    console.log('Document Type: CONTRACT');
    console.log('Running legal analysis...\n');

    const startTime = Date.now();

    const assessment = await legalAgent(
      sampleContractText,
      'test-bid-001',
      'CONTRACT',
    );

    const duration = Date.now() - startTime;

    console.log('='.repeat(60));
    console.log('LEGAL ASSESSMENT RESULTS');
    console.log('='.repeat(60));
    console.log();

    console.log('📋 COMPLIANCE ISSUES:');
    if (assessment.compliance_issues.length > 0) {
      assessment.compliance_issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    } else {
      console.log('  None identified');
    }
    console.log();

    console.log('📜 CONTRACT TERMS:');
    if (assessment.contract_terms.length > 0) {
      assessment.contract_terms.forEach((term, i) => {
        console.log(`  ${i + 1}. ${term}`);
      });
    } else {
      console.log('  None identified');
    }
    console.log();

    console.log('⚠️  RISKS:');
    if (assessment.risks.length > 0) {
      assessment.risks.forEach((risk, i) => {
        console.log(`  ${i + 1}. ${risk}`);
      });
    } else {
      console.log('  None identified');
    }
    console.log();

    console.log('📊 OVERALL ASSESSMENT:');
    console.log(`  ${assessment.overall_assessment}`);
    console.log();

    console.log('🔍 METADATA:');
    console.log(`  LLM Provider: ${assessment.provider_used || 'unknown'}`);
    console.log(`  Citations Valid: ${assessment.citations_valid ? '✅ Yes' : '❌ No'}`);
    console.log(`  Processing Time: ${duration}ms`);
    console.log();

    console.log('='.repeat(60));
    console.log('✅ Test completed successfully');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

test();

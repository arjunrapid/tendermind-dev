/**
 * Sample Tender - Strong Bid Candidate
 * Balanced commercial terms, achievable schedule, bidder easily meets
 * qualification criteria. Expected: LOW risk, PROCEED.
 */

import { runTenderScenario } from './lib/test-utils/run-tender-scenario';

const STRONG_BID_TENDER = `
TENDER DOCUMENT - RFT 2201-WWTP-0004
CONSTRUCTION CONTRACT - MUNICIPAL WATER TREATMENT UPGRADE

1. PROJECT OVERVIEW
Project Name: Riverside Water Treatment Plant Upgrade
Location: Riverside Municipal District
Project Value: USD 6.2 Million
Duration: 18 months from Notice to Proceed
Client: Riverside Municipal Water Authority

2. FINANCIAL REQUIREMENTS [page:2, Clause 2.1]
2.1 Contract Value: USD 6,200,000 (fixed price lump sum)
2.2 Payment Terms: Monthly invoicing based on certified work completion [page:2]
2.3 Milestone Payments spread evenly across mobilization, civil works, mechanical
    installation, and commissioning, each with clear acceptance criteria [page:2]
2.4 Retention: 5% holdback, released 3 months after final acceptance [page:2]
2.5 Performance Bond: 10% of contract value, standard industry form [page:2]
2.6 Payment Terms: Net 30 days from invoice date, no history of late payment by this client [page:2]

3. TECHNICAL SCOPE [page:3, Clause 3]
3.1 Scope Includes:
    - Upgrade of existing clarifier and filtration systems [page:3]
    - Replacement of pumps and control instrumentation [page:3]
    - Minor civil works to existing structures, no new foundations required [page:3]
3.2 Site Conditions [page:3]
    - Site fully accessible, existing utilities documented and verified [page:3]
    - Geotechnical survey confirms stable soil, no unusual conditions [page:3]
    - Plant remains partially operational during works; sequencing plan provided by client [page:3]
3.3 Timeline [page:3]
    - Engineering: Months 1-3
    - Procurement: Months 2-6 (standard 8-10 week lead times) [page:3]
    - Installation: Months 6-15
    - Commissioning: Months 16-18, timeline assessed as comfortable and achievable [page:3]

4. EXPERIENCE REQUIREMENTS [page:4]
4.1 Bidder Qualifications [page:4]
    - Minimum 5 years experience in municipal water infrastructure [page:4]
    - Minimum 2 completed projects of similar scale [page:4]
    - Minimum annual turnover USD 10 Million for last 2 years [page:4]
    - ISO 9001 certification required [page:4]
4.2 Key Personnel Requirements [page:4]
    - Project Manager: Minimum 8 years relevant experience [page:4]
    - Site Engineer: Minimum 5 years experience [page:4]
4.3 Project References [page:4]
    - Minimum 2 references from completed municipal projects [page:4]

5. CONTRACT TERMS AND CONDITIONS [page:5]
5.1 Liability [page:5]
    - Contractor liability capped at 20% of contract value for direct damages [page:5]
    - No liability cap for gross negligence or willful misconduct [page:5]
5.2 Warranty Period [page:5]
    - Defects liability period: 12 months from commissioning [page:5]
5.3 Termination [page:5]
    - Client may terminate for convenience with 30 days notice; contractor paid for
      work completed plus reasonable demobilization costs [page:5]
    - Either party may terminate for material breach with 30 days notice if not cured [page:5]
5.4 Change Orders [page:5]
    - Changes require written authorization; cost impact agreed before work proceeds [page:5]
5.5 Disputes [page:5]
    - Disputes resolved by local arbitration under the law of the project jurisdiction [page:5]
5.6 Force Majeure [page:6]
    - Standard force majeure clause with 14-day notification and mutual termination
      rights after 90 days [page:6]

6. PERFORMANCE SECURITY AND INSURANCE [page:6]
6.1 Performance Bond: 10% of contract value [page:6]
6.2 Insurance Requirements: General Liability minimum USD 2 Million per occurrence [page:6]

7. TECHNICAL SPECIFICATIONS [page:7]
7.1 Equipment to meet standard AWWA and local water authority specifications [page:7]
7.2 Factory acceptance testing required before delivery [page:7]

8. LIQUIDATED DAMAGES [page:8]
8.1 Schedule Delay Penalties: 0.25% of contract value per week of delay, capped at 3% total [page:8]

9. SUBMISSION REQUIREMENTS [page:9]
9.1 Technical Proposal: execution plan, resource plan, QA plan [page:9]
9.2 Financial Proposal: cost breakdown, bid validity 60 days [page:9]

10. EVALUATION CRITERIA [page:10]
10.1 Technical Capability: 35%
10.2 Financial: 50%
10.3 HSE & Compliance: 15%

DOCUMENT CLASSIFICATION: CONSTRUCTION CONTRACT
ESTIMATED PAGES: 8
DOCUMENT IMPORTANCE: HIGH
`;

runTenderScenario('STRONG BID SCENARIO - RFT 2201-WWTP-0004', 'sample-strong-bid', STRONG_BID_TENDER).catch(
  (error) => {
    console.error('Scenario failed:', error);
    process.exit(1);
  },
);

/**
 * Sample Tender - Moderate Risk Candidate
 * Workable but tight commercial and schedule terms, a couple of qualification
 * gaps. Expected: MEDIUM risk, PROCEED_WITH_CAUTION.
 */

import { runTenderScenario } from './lib/test-utils/run-tender-scenario';

const MODERATE_RISK_TENDER = `
TENDER DOCUMENT - RFT 5540-DCB-0012
DESIGN-BUILD CONTRACT - COMMERCIAL DISTRIBUTION CENTER

1. PROJECT OVERVIEW
Project Name: Northgate Distribution Center
Location: Northgate Logistics Park
Project Value: USD 9.8 Million
Duration: 15 months from Notice to Proceed
Client: Northgate Logistics Holdings

2. FINANCIAL REQUIREMENTS [page:2, Clause 2.1]
2.1 Contract Value: USD 9,800,000 (fixed price lump sum)
2.2 Payment Terms: Monthly invoicing based on certified work completion [page:2]
2.3 Milestone Payments:
    - 10% upon mobilization [page:2]
    - 50% upon structural completion, tied to a single combined milestone [page:2]
    - 40% upon final handover [page:2]
2.4 Retention: 10% holdback from each invoice, released 9 months after completion [page:2]
2.5 Performance Bond: 10% of contract value, within 10 days of award [page:2]
2.6 Payment Terms: Net 45 days from invoice date [page:2]

3. TECHNICAL SCOPE [page:3, Clause 3]
3.1 Scope Includes:
    - Design development and detailed engineering [page:3]
    - Tilt-up concrete structure and structural steel racking mezzanine [page:3]
    - Electrical, fire protection, and HVAC systems [page:3]
3.2 Site Conditions [page:3]
    - Site access limited to a single entry point shared with an active neighboring facility [page:3]
    - Geotechnical survey indicates variable fill material to 3m depth, further investigation recommended [page:3]
3.3 Timeline [page:3]
    - Engineering & Procurement: Months 1-3
    - Structural works: Months 3-9
    - Fit-out and commissioning: Months 10-15, schedule described by client as aggressive
      given the fill remediation uncertainty [page:3]

4. EXPERIENCE REQUIREMENTS [page:4]
4.1 Bidder Qualifications [page:4]
    - Minimum 8 years experience in design-build commercial construction [page:4]
    - Minimum 3 completed projects of similar scale [page:4]
    - Minimum annual turnover USD 20 Million for last 3 years [page:4]
    - ISO 9001 and ISO 14001 certifications required; local safety accreditation
      considered strict for regional bidders without an existing local presence [page:4]
4.2 Key Personnel Requirements [page:4]
    - Project Manager: Minimum 10 years design-build experience [page:4]
    - Quality Manager: Third-party certified quality engineer [page:4]

5. CONTRACT TERMS AND CONDITIONS [page:5]
5.1 Liability [page:5]
    - Contractor liability capped at 15% of contract value for direct damages [page:5]
    - No liability cap for gross negligence or IP infringement [page:5]
5.2 Warranty Period [page:5]
    - Defects liability period: 18 months from commissioning [page:5]
5.3 Termination [page:5]
    - Client may terminate for convenience with 45 days notice [page:5]
    - Either party may terminate for material breach with 21 days notice if not cured [page:5]
5.4 Change Orders [page:5]
    - Contractor has 7 days to submit cost impact of change orders, shorter than
      typical industry practice [page:5]
5.5 Disputes [page:5]
    - Disputes subject to arbitration in a jurisdiction outside the contractor's home region [page:5]
5.6 Force Majeure [page:6]
    - Force majeure notification required within 24 hours of occurrence [page:6]

6. PERFORMANCE SECURITY AND INSURANCE [page:6]
6.1 Performance Bond: 10% of contract value [page:6]
6.2 Insurance Requirements: General Liability minimum USD 5 Million per occurrence [page:6]

7. TECHNICAL SPECIFICATIONS [page:7]
7.1 Equipment to meet ASME and IEC standards [page:7]
7.2 Third-party inspection required at key milestones [page:7]

8. LIQUIDATED DAMAGES [page:8]
8.1 Schedule Delay Penalties: 0.5% of contract value per week of delay, capped at 7.5% total [page:8]

9. SUBMISSION REQUIREMENTS [page:9]
9.1 Technical Proposal must include risk analysis and mitigation plan for the
    identified fill material uncertainty [page:9]
9.2 Bid validity period: 90 days [page:9]

10. EVALUATION CRITERIA [page:10]
10.1 Technical Capability: 40%
10.2 Financial: 40%
10.3 HSE & Compliance: 20%

DOCUMENT CLASSIFICATION: DESIGN-BUILD CONTRACT
ESTIMATED PAGES: 9
DOCUMENT IMPORTANCE: HIGH
`;

runTenderScenario('MODERATE RISK SCENARIO - RFT 5540-DCB-0012', 'sample-moderate-risk', MODERATE_RISK_TENDER).catch(
  (error) => {
    console.error('Scenario failed:', error);
    process.exit(1);
  },
);

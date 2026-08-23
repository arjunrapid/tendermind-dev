/**
 * Sample Tender - High Risk Candidate
 * Uncapped liability, unfavorable dispute terms, unrealistic schedule against
 * unresolved site conditions, and qualification requirements the bidder is
 * unlikely to meet. Expected: HIGH risk, DO_NOT_PROCEED.
 */

import { runTenderScenario } from './lib/test-utils/run-tender-scenario';

const HIGH_RISK_TENDER = `
TENDER DOCUMENT - RFT 9012-REF-0088
ENGINEERING, PROCUREMENT AND CONSTRUCTION (EPC) CONTRACT
Offshore Refinery Expansion - Remote Site

1. PROJECT OVERVIEW
Project Name: Offshore Refinery Unit 4 Expansion
Location: Remote coastal site, no existing road access
Project Value: USD 42 Million
Duration: 14 months from Notice to Proceed
Client: Consolidated Petrochemical Holdings

2. FINANCIAL REQUIREMENTS [page:2, Clause 2.1]
2.1 Contract Value: USD 42,000,000 (fixed price lump sum, no escalation clause) [page:2]
2.2 Payment Terms: Single payment upon full completion and client acceptance;
    no interim milestone payments during construction [page:2]
2.3 Retention: 15% holdback from final payment, released 18 months after
    project completion pending client discretion [page:2]
2.4 Performance Bond: 25% of contract value, to be provided within 5 days of award [page:2]
2.5 Payment Terms: Net 90 days from invoice date, client has history of disputed invoices [page:2]

3. TECHNICAL SCOPE [page:3, Clause 3]
3.1 Scope Includes:
    - Full EPC for new processing unit including marine works [page:3]
    - Design, procurement, and construction of subsea pipeline tie-ins [page:3]
    - Civil works on unconsolidated coastal fill with no prior geotechnical data [page:3]
3.2 Site Conditions [page:3]
    - No existing road access; all materials via seasonal barge access only [page:3]
    - Geotechnical survey not yet performed; bidder to assume soil conditions
      and bear risk of unforeseen ground conditions [page:3]
    - Environmental zoning: protected coastal area with unresolved permitting status [page:3]
3.3 Timeline [page:3]
    - Full EPC scope, including subsea works, to be completed in 14 months,
      a schedule the client acknowledges as highly aggressive relative to
      comparable projects [page:3]
    - Equipment lead times for specialized subsea components exceed 10 months,
      leaving effectively no float for installation or commissioning [page:3]

4. EXPERIENCE REQUIREMENTS [page:4]
4.1 Bidder Qualifications [page:4]
    - Minimum 20 years experience in offshore EPC construction [page:4]
    - Minimum 5 completed projects of comparable scale and complexity [page:4]
    - Minimum annual turnover USD 200 Million for last 5 years [page:4]
    - Bidder must hold existing marine construction license in this jurisdiction [page:4]
4.2 Key Personnel Requirements [page:4]
    - Project Manager: Minimum 20 years offshore EPC experience [page:4]
    - Marine Superintendent: Certified for subsea pipeline installation [page:4]
4.3 Project References [page:4]
    - Minimum 5 references from completed offshore projects over USD 30 Million [page:4]

5. CONTRACT TERMS AND CONDITIONS [page:5]
5.1 Liability [page:5]
    - Contractor liability uncapped for all damages, direct and consequential [page:5]
    - Contractor indemnifies Client for all third-party claims without limit [page:5]
5.2 Warranty Period [page:5]
    - Defects liability period: 36 months from commissioning [page:5]
5.3 Termination [page:5]
    - Client may terminate for convenience at any time with no notice period
      and no compensation for demobilization costs [page:5]
    - Contractor has no corresponding termination right for client payment default [page:5]
5.4 Change Orders [page:5]
    - Client may issue changes unilaterally; contractor must proceed before
      price is agreed [page:5]
5.5 Disputes [page:5]
    - All disputes subject to litigation in client's home jurisdiction only,
      contractor waives right to arbitration [page:5]
5.6 Force Majeure [page:6]
    - No force majeure relief for weather or marine access disruption, despite
      the site's seasonal barge-only access [page:6]

6. PERFORMANCE SECURITY AND INSURANCE [page:6]
6.1 Performance Bond: 25% of contract value [page:6]
6.2 Insurance Requirements: General Liability minimum USD 50 Million per occurrence,
    with contractor required to self-insure marine transit risk [page:6]

7. TECHNICAL SPECIFICATIONS [page:7]
7.1 Equipment to meet ASME, IEC, and DNV marine standards concurrently [page:7]
7.2 Client reserves right to reject completed work without third-party inspection standard [page:7]

8. LIQUIDATED DAMAGES [page:8]
8.1 Schedule Delay Penalties: 2% of contract value per week of delay, uncapped [page:8]
8.2 Performance Shortfalls: 5% deduction per percentage point below specification,
    uncapped [page:8]

9. SUBMISSION REQUIREMENTS [page:9]
9.1 Bid validity period: 180 days [page:9]

10. EVALUATION CRITERIA [page:10]
10.1 Financial: 60%
10.2 Technical Capability: 30%
10.3 HSE & Compliance: 10%

DOCUMENT CLASSIFICATION: EPC CONTRACT
ESTIMATED PAGES: 9
DOCUMENT IMPORTANCE: HIGH - Master contract document
`;

runTenderScenario('HIGH RISK SCENARIO - RFT 9012-REF-0088', 'sample-high-risk', HIGH_RISK_TENDER).catch((error) => {
  console.error('Scenario failed:', error);
  process.exit(1);
});

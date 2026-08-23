/**
 * Sample data for the screens that have no backend yet.
 *
 * The workspace is designed around a company ("Northstar Infrastructure") with
 * years of accumulated tender history. Features like Company Memory, Team and
 * the integrations list describe that state rather than reading it from the
 * database, so they ship with the illustrative dataset below and every screen
 * marks such rows with a "sample" chip. Anything the app can genuinely compute
 * — analyses, bid history, cost items — is read live and never comes from here.
 */

export const DEMO_WORKSPACE = {
  company: 'Northstar Infrastructure',
  plan: 'Enterprise workspace',
  factCount: '2,841',
  sourceCount: '147',
  teamCount: '34',
  legalCount: '3',
  memoryHealth: 92,
  lastIndexed: '18 minutes ago',
};

export interface DemoPipelineRow {
  tender: string;
  client: string;
  closes: string;
  value: string;
  win: string;
  margin: number;
  risk: 'Low' | 'Medium' | 'High';
  decision: string;
  owner: string;
}

export const DEMO_PIPELINE: DemoPipelineRow[] = [
  {
    tender: 'Southern Region Maintenance Framework',
    client: 'Network Rail',
    closes: '19 days',
    value: '£42.0M',
    win: '68%',
    margin: 19.8,
    risk: 'High',
    decision: 'Proceed conditionally',
    owner: 'S. Mitchell',
  },
  {
    tender: 'Manchester Airport Facilities',
    client: 'MAG Group',
    closes: '27 days',
    value: '£18.0M',
    win: '42%',
    margin: 21.4,
    risk: 'Medium',
    decision: 'Review',
    owner: 'D. Okoye',
  },
  {
    tender: 'TfL Electrical Maintenance',
    client: 'Transport for London',
    closes: '41 days',
    value: '£63.0M',
    win: '71%',
    margin: 17.1,
    risk: 'Medium',
    decision: 'Commercial review',
    owner: 'S. Mitchell',
  },
  {
    tender: 'NHS Estates Framework Lot 3',
    client: 'NHS SBS',
    closes: '52 days',
    value: '£11.8M',
    win: '34%',
    margin: 23.2,
    risk: 'Low',
    decision: 'Bid',
    owner: 'A. Fielding',
  },
  {
    tender: 'Dublin Port Civils Package B',
    client: 'Dublin Port Co.',
    closes: '9 days',
    value: '£8.4M',
    win: '22%',
    margin: 12.6,
    risk: 'High',
    decision: 'No bid',
    owner: 'J. Patel',
  },
  {
    tender: 'ScotRail Depot Upgrade',
    client: 'ScotRail',
    closes: '64 days',
    value: '£15.4M',
    win: '55%',
    margin: 20.1,
    risk: 'Medium',
    decision: 'Qualifying',
    owner: 'D. Okoye',
  },
];

export interface DemoFactSource {
  name: string;
  quote: string;
  loc: string;
}

export interface DemoFact {
  label: string;
  value: string;
  sources: string;
  docs: DemoFactSource[];
}

export const DEMO_PROFILE_FACTS: DemoFact[] = [
  {
    label: 'Operating regions',
    value: 'United Kingdom, Ireland, Benelux',
    sources: 'Verified from 3 sources',
    docs: [
      {
        name: 'Capability_Statement_2026.pdf',
        quote: 'Operations across the United Kingdom, Ireland and the Benelux region.',
        loc: 'p. 2',
      },
      {
        name: 'ISO_9001_Certificate.pdf',
        quote: 'Scope of registration covers UK and Ireland operations.',
        loc: 'p. 1',
      },
    ],
  },
  {
    label: 'Core services',
    value:
      'Rail infrastructure maintenance · Electrical installation · Civil engineering · Emergency maintenance',
    sources: 'Verified from 6 sources',
    docs: [
      {
        name: 'Capability_Statement_2026.pdf',
        quote: 'Four core service lines delivered under RISQS accreditation.',
        loc: 'p. 3',
      },
      {
        name: 'Southern_Region_Capability_Deck.pptx',
        quote: 'Emergency maintenance desk operating 24/7 since 2019.',
        loc: 'slide 8',
      },
    ],
  },
  {
    label: 'Maximum project capacity',
    value: '£28M concurrent contract value',
    sources: 'Verified from 2 sources',
    docs: [
      {
        name: 'Resource_Model_FY26.xlsx',
        quote: 'Peak concurrent delivery capacity modeled at £28.4M.',
        loc: 'tab: Capacity',
      },
      {
        name: 'Bonding_Facility_Letter.pdf',
        quote: 'Surety facility limit £30M aggregate.',
        loc: 'p. 1',
      },
    ],
  },
  {
    label: 'Standard gross-margin floor',
    value: '18%',
    sources: 'Verified from 2 sources',
    docs: [
      {
        name: 'Commercial_Policy_2026.pdf',
        quote: 'No tender shall be submitted below an 18% modeled gross margin.',
        loc: '§2.4',
      },
    ],
  },
  {
    label: 'Accreditations',
    value: 'RISQS · ISO 9001 · ISO 14001 · Cyber Essentials Plus',
    sources: 'Verified from 4 sources',
    docs: [
      {
        name: 'Accreditation_Register.pdf',
        quote: 'Cyber Essentials Plus renewal due 14 November 2026.',
        loc: 'p. 2',
      },
    ],
  },
];

export const DEMO_COMMERCIAL_RULES: Array<[string, string, string]> = [
  ['Minimum acceptable gross margin', '18%', 'Commercial Policy 2026'],
  ['Preferred payment terms', '30 days', 'Standard Terms §4.1'],
  ['Maximum acceptable payment terms', '60 days', 'Standard Terms §4.2'],
  ['Standard mobilization allowance', '4–6% contract value', 'Bid Pricing Manual'],
  ['Default contingency rate', '7.5%', 'Risk Policy 2026'],
  ['Legal review required when liability exceeds', '£10M', 'Delegated Authority Matrix'],
];

export const DEMO_MEMORY_COVERAGE: Array<{ domain: string; pct: number }> = [
  { domain: 'Contracting', pct: 96 },
  { domain: 'Pricing', pct: 91 },
  { domain: 'Operations', pct: 88 },
  { domain: 'Compliance', pct: 94 },
  { domain: 'Cyber security', pct: 74 },
  { domain: 'Sustainability', pct: 69 },
];

export const DEMO_MEMORY_GAPS: string[] = [
  'No evidence of social-value delivery for rail frameworks after 2024',
  'Cyber Essentials Plus certificate expires within the contract term',
  'Carbon reduction plan predates the current PPN 06/21 template',
];

export const DEMO_SOURCE_DOCS: Array<{
  name: string;
  origin: 'Tender' | 'Company Memory';
  size: string;
  facts: string;
  indexed: string;
}> = [
  {
    name: 'NR_Southern_Framework_RFP_2026.pdf',
    origin: 'Tender',
    size: '612 pp',
    facts: '1,204',
    indexed: '18 Aug 14:02',
  },
  {
    name: 'Terms_and_Conditions.pdf',
    origin: 'Tender',
    size: '84 pp',
    facts: '318',
    indexed: '18 Aug 14:04',
  },
  {
    name: 'Commercial_Schedule.xlsx',
    origin: 'Tender',
    size: '14 tabs',
    facts: '96',
    indexed: '18 Aug 14:05',
  },
  {
    name: 'Technical_Specification_SRM.pdf',
    origin: 'Tender',
    size: '186 pp',
    facts: '402',
    indexed: '18 Aug 14:11',
  },
  {
    name: 'Supplier_Questionnaire.docx',
    origin: 'Tender',
    size: '34 questions',
    facts: '34',
    indexed: '18 Aug 14:12',
  },
  {
    name: 'Northstar_Standard_Terms_2026.pdf',
    origin: 'Company Memory',
    size: '48 pp',
    facts: '31',
    indexed: '21 Aug 16:48',
  },
  {
    name: 'Emergency_Response_SOP_v4.pdf',
    origin: 'Company Memory',
    size: '62 pp',
    facts: '88',
    indexed: '02 Jul 09:20',
  },
  {
    name: 'Insurance_Schedule_2026.pdf',
    origin: 'Company Memory',
    size: '9 pp',
    facts: '24',
    indexed: '14 Apr 11:05',
  },
];

export const DEMO_TEAM: Array<{
  initials: string;
  name: string;
  role: string;
  scope: string;
  assigned: string;
  seen: string;
}> = [
  {
    initials: 'SM',
    name: 'Sarah Mitchell',
    role: 'Commercial Director',
    scope: 'Owner · all tenders',
    assigned: '4 open decisions',
    seen: '3 min ago',
  },
  {
    initials: 'JP',
    name: 'James Patel',
    role: 'Finance Manager',
    scope: 'Approver · commercial',
    assigned: '2 cost reviews',
    seen: '18 min ago',
  },
  {
    initials: 'RC',
    name: 'Rachel Coombes',
    role: 'General Counsel',
    scope: 'Approver · legal',
    assigned: '3 clauses',
    seen: '1 hr ago',
  },
  {
    initials: 'DO',
    name: 'Deborah Okoye',
    role: 'Operations Director',
    scope: 'Contributor · delivery',
    assigned: '1 capability gap',
    seen: '2 hr ago',
  },
  {
    initials: 'AF',
    name: 'Alex Fielding',
    role: 'Bid Manager',
    scope: 'Contributor · responses',
    assigned: '22 answers drafted',
    seen: '4 hr ago',
  },
  {
    initials: 'NK',
    name: 'Nadia Karim',
    role: 'IT Security Lead',
    scope: 'Contributor · compliance',
    assigned: 'CE+ renewal',
    seen: 'Yesterday',
  },
];

export const DEMO_INTEGRATIONS: Array<{
  name: string;
  detail: string;
  status: string;
  tone: 'ok' | 'warn' | 'muted';
  action: string;
}> = [
  {
    name: 'SharePoint — Northstar Commercial',
    detail: 'Syncing 4 libraries · 112 documents',
    status: 'Connected',
    tone: 'ok',
    action: 'Configure',
  },
  {
    name: 'Google Drive',
    detail: 'Legal team shared drive',
    status: 'Not connected',
    tone: 'muted',
    action: 'Connect',
  },
  {
    name: 'Microsoft Entra ID (SSO)',
    detail: 'SAML 2.0 · 34 seats enforced',
    status: 'Connected',
    tone: 'ok',
    action: 'Manage',
  },
  {
    name: 'Proactis (e-sourcing)',
    detail: 'Auto-import of published tender packs',
    status: 'Beta',
    tone: 'warn',
    action: 'Enable',
  },
  {
    name: 'API access',
    detail: '2 keys · last used 4 days ago',
    status: 'Active',
    tone: 'ok',
    action: 'Rotate',
  },
];

export const DEMO_APPROVAL_RULES: Array<{ rule: string; owner: string }> = [
  { rule: 'Liability exposure above £10M', owner: 'General Counsel — Rachel Coombes' },
  { rule: 'Modeled gross margin below 18%', owner: 'Commercial Director + Finance' },
  { rule: 'Contract value above £25M', owner: 'Board sub-committee' },
  { rule: 'Payment terms beyond 60 days', owner: 'Finance Manager — James Patel' },
];

export interface DemoClause {
  ref: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  text: string;
  position: string;
}

export const DEMO_CLAUSES: DemoClause[] = [
  {
    ref: '17.4',
    title: 'Uncapped indirect liability',
    severity: 'High',
    text: 'The Contractor shall indemnify the Authority against all indirect and consequential losses arising from any failure to perform, without limitation as to amount.',
    position:
      'Seek a cap at 100% of annual contract value, consistent with Northstar Standard Terms §7.2. Precedent exists on the 2024 Anglia framework.',
  },
  {
    ref: '9.1',
    title: 'Payment dispute window of 10 days',
    severity: 'High',
    text: 'Any disputed sum must be notified in writing within 10 Business Days of receipt of the payment certificate, failing which the certificate is deemed accepted.',
    position:
      'Request 20 Business Days. Current internal certification cycle averages 14 days, so 10 days creates genuine cash-flow exposure.',
  },
  {
    ref: '22.6',
    title: 'Service credits uncapped in aggregate',
    severity: 'High',
    text: 'Service credits shall accrue per Performance Failure and shall not be the sole remedy of the Authority.',
    position:
      'Seek an annual aggregate cap of 5% of charges and confirmation that credits are the exclusive financial remedy.',
  },
  {
    ref: '4.2',
    title: 'Payment terms 45 days',
    severity: 'Medium',
    text: 'The Authority shall pay each undisputed invoice within 45 days of the certification date.',
    position: 'Within policy tolerance (max 60 days) but outside the 30-day preference.',
  },
  {
    ref: '31.1',
    title: 'Termination for convenience on 30 days notice',
    severity: 'Medium',
    text: 'The Authority may terminate this Agreement in whole or in part on 30 days written notice without cause.',
    position: 'Seek recovery of demobilization costs and unrecovered mobilization investment.',
  },
];

export interface DemoRequirement {
  ref: string;
  requirement: string;
  status: 'Meets' | 'Attention' | 'Gap';
  evidence: string;
}

export const DEMO_REQUIREMENTS: DemoRequirement[] = [
  {
    ref: 'SQ 3.1',
    requirement: 'Minimum annual turnover £60M for the last two financial years',
    status: 'Meets',
    evidence: 'Statutory accounts FY24/FY25 — £78.4M, £81.2M',
  },
  {
    ref: 'SQ 4.2',
    requirement: 'RISQS accreditation current for the full contract term',
    status: 'Meets',
    evidence: 'Accreditation register — valid to Mar 2028',
  },
  {
    ref: 'SQ 5.4',
    requirement: 'Cyber Essentials Plus held throughout the term',
    status: 'Attention',
    evidence: 'Certificate expires 14 Nov 2026, inside the contract term',
  },
  {
    ref: 'SQ 6.1',
    requirement: 'Two comparable rail framework references above £30M',
    status: 'Meets',
    evidence: 'Anglia Framework (£38M), Western Route (£33M)',
  },
  {
    ref: 'SQ 7.3',
    requirement: 'Social value delivery plan aligned to PPN 06/20',
    status: 'Gap',
    evidence: 'No rail social-value evidence recorded after 2024',
  },
  {
    ref: 'SQ 8.2',
    requirement: 'Carbon reduction plan per PPN 06/21',
    status: 'Attention',
    evidence: 'Plan predates the current template',
  },
];

export const DEMO_COMMENTS: Array<{
  initials: string;
  name: string;
  role: string;
  time: string;
  body: string;
  isModel?: boolean;
}> = [
  {
    initials: 'SM',
    name: 'Sarah Mitchell',
    role: 'Commercial Director',
    time: '21 Aug 09:14',
    body: '£46.8M probably won’t survive first-round pricing. Can we see the margin at £44M?',
  },
  {
    initials: 'JP',
    name: 'James Patel',
    role: 'Finance',
    time: '21 Aug 09:41',
    body: 'At £44M we’re around 14.7% under the current risk assumptions — and that assumes Schedule 8 credits stay below 20% probability.',
  },
  {
    initials: 'TM',
    name: 'TenderMind',
    role: 'Model updated',
    time: '21 Aug 09:41',
    body: 'Recalculated against Commercial_Schedule.xlsx and Northstar contingency policy.',
    isModel: true,
  },
];

export const DEMO_TENDER = {
  client: 'Network Rail',
  reference: 'NR/SRM/2026/042',
  title: 'Southern Region Maintenance Framework',
  deadline: '17 Sep 2026 · 12:00 BST',
  value: '£42.0M',
  term: '5 years, 2 optional extensions',
  margin: '19.8%',
  marginThreshold: '18%',
  risk: 'High',
  riskDetail: '3 clauses require negotiation',
  recommendation: 'Proceed — with conditions',
  confidence: '84%',
  conditions: 5,
  assessment:
    'Three contractual provisions create material downside exposure: uncapped indirect liability (Clause 17.4), a 10-day payment dispute window, and service credits reaching approximately £1.9M annually. The technical scope sits comfortably within demonstrated capability, and the programme is achievable with the current resource model.',
  documents: [
    { name: 'NR_Southern_Framework_RFP_2026.pdf', pages: '612 pp' },
    { name: 'Terms_and_Conditions.pdf', pages: '84 pp' },
    { name: 'Commercial_Schedule.xlsx', pages: '14 tabs' },
    { name: 'Technical_Specification_SRM.pdf', pages: '186 pp' },
    { name: 'Supplier_Questionnaire.docx', pages: '34 q' },
  ],
};

/**
 * Baseline cost model behind the Commercial tab's scenario sliders (£000s).
 *
 * Calibrated so that at the default lever positions (4.2% labour inflation,
 * 3.5% material inflation, 7.5% contingency) the modelled cost against the
 * £42.0M bid lands on the 19.8% gross margin quoted on the Overview tab —
 * the two views read from the same numbers, so they must not disagree.
 */
export const DEMO_COST_BASE = {
  labour: 16000,
  material: 6800,
  plant: 3100,
  subcontract: 3400,
  overhead: 1124,
};

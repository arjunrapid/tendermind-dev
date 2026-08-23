export interface LegalAssessment extends Record<string, unknown> {
  compliance_issues: string[];
  contract_terms: string[];
  risks: string[];
  overall_assessment: string;
}

export interface EngineeringAssessment extends Record<string, unknown> {
  scope_analysis: string[];
  structural_concerns: string[];
  timeline_estimate: string;
  feasibility: string;
}

export interface AccountingAssessment extends Record<string, unknown> {
  material_costs: number;
  labor_costs: number;
  contingency_percentage: number;
  total_estimated_cost: number;
  cost_per_unit?: number;
}

export interface RiskAssessment {
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_factors: string[];
  mitigation_strategies: string[];
}

export function mockLegalAgent(docType: string): LegalAssessment {
  const baseAssessments: Record<string, LegalAssessment> = {
    CONTRACT: {
      compliance_issues: [
        'Payment terms need clarification',
        'Liability clause requires revision',
      ],
      contract_terms: ['30-day payment terms', 'Binding arbitration clause'],
      risks: ['Indemnification exposure', 'Force majeure clause missing'],
      overall_assessment: 'Contract reviewed - moderate legal risks identified',
    },
    SPECIFICATION: {
      compliance_issues: ['Performance standards need definition'],
      contract_terms: ['Quality assurance required'],
      risks: ['Vague acceptance criteria'],
      overall_assessment: 'Specification is clear - low legal risks',
    },
    BOQ: {
      compliance_issues: [],
      contract_terms: ['Unit pricing defined'],
      risks: ['No price escalation clause'],
      overall_assessment: 'Bill of Quantities - minimal legal concerns',
    },
    DRAWING: {
      compliance_issues: ['Building code compliance should be verified'],
      contract_terms: [],
      risks: ['Coordinate dimensions with specifications'],
      overall_assessment: 'Engineering drawings - standard risk level',
    },
    ADDENDUM: {
      compliance_issues: ['Ensure addendum supersedes original terms'],
      contract_terms: ['Amendment terms defined'],
      risks: ['Conflict with original contract'],
      overall_assessment: 'Addendum review - moderate risk',
    },
  };

  return baseAssessments[docType] || baseAssessments.CONTRACT;
}

export function mockEngineeringAgent(docType: string): EngineeringAssessment {
  const baseAssessments: Record<string, EngineeringAssessment> = {
    CONTRACT: {
      scope_analysis: ['Project scope appears well-defined'],
      structural_concerns: ['Engineering review required before finalization'],
      timeline_estimate: '12-16 weeks',
      feasibility: 'Feasible with standard construction methods',
    },
    SPECIFICATION: {
      scope_analysis: [
        'Material specs are standard grade',
        'Performance requirements defined',
      ],
      structural_concerns: ['Quality certifications needed for materials'],
      timeline_estimate: '8-12 weeks',
      feasibility: 'Highly feasible',
    },
    BOQ: {
      scope_analysis: ['Quantities align with typical projects'],
      structural_concerns: [],
      timeline_estimate: '10-14 weeks',
      feasibility: 'Feasible',
    },
    DRAWING: {
      scope_analysis: ['Dimensions consistent', 'Site plan included'],
      structural_concerns: [
        'Foundation details need engineering approval',
        'Load calculations required',
      ],
      timeline_estimate: '14-18 weeks',
      feasibility: 'Requires geotechnical survey',
    },
    ADDENDUM: {
      scope_analysis: ['Changes documented clearly'],
      structural_concerns: ['Verify compatibility with original design'],
      timeline_estimate: '4-6 weeks',
      feasibility: 'Depends on scope of changes',
    },
  };

  return baseAssessments[docType] || baseAssessments.CONTRACT;
}

export function mockAccountingAgent(docType: string, riskScore: number): AccountingAssessment {
  const baseCosts: Record<string, AccountingAssessment> = {
    CONTRACT: {
      material_costs: 250000,
      labor_costs: 180000,
      contingency_percentage: 10,
      total_estimated_cost: 473000,
    },
    SPECIFICATION: {
      material_costs: 200000,
      labor_costs: 120000,
      contingency_percentage: 8,
      total_estimated_cost: 328000,
    },
    BOQ: {
      material_costs: 300000,
      labor_costs: 150000,
      contingency_percentage: 12,
      total_estimated_cost: 414000,
    },
    DRAWING: {
      material_costs: 350000,
      labor_costs: 200000,
      contingency_percentage: 15,
      total_estimated_cost: 577500,
    },
    ADDENDUM: {
      material_costs: 50000,
      labor_costs: 30000,
      contingency_percentage: 10,
      total_estimated_cost: 88000,
    },
  };

  const base = baseCosts[docType] || baseCosts.CONTRACT;
  const riskMultiplier = 1 + riskScore * 0.1;

  return {
    ...base,
    total_estimated_cost: Math.round(base.total_estimated_cost * riskMultiplier),
  };
}

export function mockRiskAgent(docType: string): RiskAssessment {
  const baseRisks: Record<string, RiskAssessment> = {
    CONTRACT: {
      risk_score: 0.65,
      risk_level: 'MEDIUM',
      risk_factors: [
        'Unclear liability terms',
        'Long project timeline',
        'Weather dependencies',
      ],
      mitigation_strategies: [
        'Establish clear change order process',
        'Increase contingency reserve',
        'Regular progress meetings',
      ],
    },
    SPECIFICATION: {
      risk_score: 0.35,
      risk_level: 'LOW',
      risk_factors: ['Material availability', 'Quality standards compliance'],
      mitigation_strategies: [
        'Supplier qualification',
        'Regular inspections',
        'Certification requirements',
      ],
    },
    BOQ: {
      risk_score: 0.45,
      risk_level: 'LOW',
      risk_factors: ['Price escalation', 'Quantity variations'],
      mitigation_strategies: [
        'Fixed-price agreement',
        'Quantity surveys',
        'Market monitoring',
      ],
    },
    DRAWING: {
      risk_score: 0.7,
      risk_level: 'MEDIUM',
      risk_factors: ['Site conditions unknown', 'Design complexity'],
      mitigation_strategies: [
        'Site investigation',
        'Value engineering',
        'Design review meetings',
      ],
    },
    ADDENDUM: {
      risk_score: 0.55,
      risk_level: 'MEDIUM',
      risk_factors: ['Schedule impact', 'Cost implications'],
      mitigation_strategies: [
        'Formal change management',
        'Impact assessment',
        'Approval chain',
      ],
    },
  };

  return baseRisks[docType] || baseRisks.CONTRACT;
}

/**
 * Bill of Quantities (BOQ) default line items.
 *
 * Admin-configurable defaults used to calculate a deterministic accounting
 * estimate (material/lump-sum costs, contingency, total) when the document
 * itself doesn't provide enough detail for the LLM accounting agent to
 * produce a cost breakdown.
 */

export type BoqItemType = 'measured' | 'lump_sum';

export interface BoqItem {
  key: string;
  name: string;
  item_type: BoqItemType;
  quantity: number | null;
  unit: string | null;
  unit_rate: number | null;
  lump_sum_amount: number | null;
}

export interface BoqItemWithAmount extends BoqItem {
  amount: number;
}

export interface BoqCostSummary {
  items: BoqItemWithAmount[];
  measured_cost: number;
  lump_sum_cost: number;
  contingency_percentage: number;
  contingency_amount: number;
  total_estimated_cost: number;
}

export const DEFAULT_BOQ_ITEMS: BoqItem[] = [
  {
    key: 'excavation',
    name: 'Excavation',
    item_type: 'measured',
    quantity: 5000,
    unit: 'cubic yard',
    unit_rate: 15,
    lump_sum_amount: null,
  },
  {
    key: 'concrete_foundation',
    name: 'Concrete Foundation',
    item_type: 'measured',
    quantity: 2000,
    unit: 'cubic foot',
    unit_rate: 25,
    lump_sum_amount: null,
  },
  {
    key: 'steel_framing',
    name: 'Steel Framing',
    item_type: 'measured',
    quantity: 150,
    unit: 'ton',
    unit_rate: 1200,
    lump_sum_amount: null,
  },
  {
    key: 'electrical_work',
    name: 'Electrical Work',
    item_type: 'lump_sum',
    quantity: null,
    unit: null,
    unit_rate: null,
    lump_sum_amount: 50000,
  },
  {
    key: 'mechanical_systems',
    name: 'Mechanical Systems',
    item_type: 'lump_sum',
    quantity: null,
    unit: null,
    unit_rate: null,
    lump_sum_amount: 45000,
  },
  {
    key: 'finishing',
    name: 'Finishing',
    item_type: 'lump_sum',
    quantity: null,
    unit: null,
    unit_rate: null,
    lump_sum_amount: 30000,
  },
];

export const DEFAULT_BOQ_CONTINGENCY_PERCENTAGE = 0.1;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function boqItemAmount(item: BoqItem): number {
  if (item.item_type === 'lump_sum') {
    return item.lump_sum_amount || 0;
  }
  return (item.quantity || 0) * (item.unit_rate || 0);
}

/**
 * Deterministic cost roll-up from BOQ line items.
 * Measured items (quantity x rate) are treated as material/installation
 * cost; lump-sum trade packages (electrical, mechanical, finishing) are
 * summed separately, then a contingency is applied to the combined base.
 */
export function calculateBoqCosts(
  items: BoqItem[],
  contingencyPercentage: number = DEFAULT_BOQ_CONTINGENCY_PERCENTAGE,
): BoqCostSummary {
  const withAmounts: BoqItemWithAmount[] = items.map((item) => ({
    ...item,
    amount: round2(boqItemAmount(item)),
  }));

  const measured_cost = round2(
    withAmounts
      .filter((item) => item.item_type === 'measured')
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const lump_sum_cost = round2(
    withAmounts
      .filter((item) => item.item_type === 'lump_sum')
      .reduce((sum, item) => sum + item.amount, 0),
  );

  const base_cost = measured_cost + lump_sum_cost;
  const contingency_amount = round2(base_cost * contingencyPercentage);
  const total_estimated_cost = round2(base_cost + contingency_amount);

  return {
    items: withAmounts,
    measured_cost,
    lump_sum_cost,
    contingency_percentage: contingencyPercentage,
    contingency_amount,
    total_estimated_cost,
  };
}

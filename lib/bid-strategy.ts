/**
 * Bid pricing strategy.
 *
 * Turns the accounting-derived Total Project Cost into a recommended bid
 * price by applying a risk-adjusted margin: the margin is the lever that
 * trades off win probability (lower price wins more often) against
 * profitability (higher price earns more per win). Deterministic - no LLM.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BidStrategyResult {
  total_project_cost: number;
  margin_percentage: number; // fraction, e.g. 0.12 = 12%
  recommended_bid_price: number;
  profit_amount: number;
  rationale: string;
}

/**
 * Risk-adjusted margin tiers.
 *
 * LOW risk gets the tightest margin: the project is safe enough that
 * pricing aggressively (still profitable) maximizes the chance of winning.
 * MEDIUM risk (PROCEED_WITH_CAUTION) carries a heavier margin to compensate
 * for the added exposure, even though it slightly reduces win odds.
 * HIGH risk is priced defensively - this tier should generally correspond
 * to a "do not proceed" recommendation, so the price here is a walk-away
 * reference point rather than a competitive bid.
 */
const MARGIN_BY_RISK_LEVEL: Record<RiskLevel, number> = {
  LOW: 0.12,
  MEDIUM: 0.18,
  HIGH: 0.25,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateOptimalBidPrice(
  totalProjectCost: number,
  riskLevel: RiskLevel,
): BidStrategyResult {
  const margin_percentage = MARGIN_BY_RISK_LEVEL[riskLevel] ?? MARGIN_BY_RISK_LEVEL.MEDIUM;
  const recommended_bid_price = round2(totalProjectCost * (1 + margin_percentage));
  const profit_amount = round2(recommended_bid_price - totalProjectCost);

  const rationale =
    riskLevel === 'LOW'
      ? `Priced at a ${(margin_percentage * 100).toFixed(0)}% margin over the $${totalProjectCost.toLocaleString()} project cost. Risk is low, so a tighter margin keeps this bid competitive while remaining solidly profitable.`
      : riskLevel === 'MEDIUM'
        ? `Priced at a ${(margin_percentage * 100).toFixed(0)}% margin over the $${totalProjectCost.toLocaleString()} project cost. The added margin compensates for moderate risk exposure while still leaving room to win the bid.`
        : `Priced at a ${(margin_percentage * 100).toFixed(0)}% margin over the $${totalProjectCost.toLocaleString()} project cost. This is a defensive, walk-away price - risk is high enough that winning at a lower price would not be worth the exposure.`;

  return {
    total_project_cost: totalProjectCost,
    margin_percentage,
    recommended_bid_price,
    profit_amount,
    rationale,
  };
}

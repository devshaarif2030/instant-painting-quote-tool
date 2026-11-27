/**
 * DEMO rate sheet for a fictional US interior painting company.
 * Built from public industry averages (sources below). These are NOT a real
 * contractor's prices. A real contractor replaces this file with their own numbers.
 *
 * Sources
 * - PaintScout, "Don't guess on pricing" (production rates, labour cost, cost structure)
 *   https://www.paintscout.com/guides/post/dont-guess-on-pricing
 * - Angi, "How much does it cost to paint a room" (paint prices, coverage, repairs, state averages)
 *   https://www.angi.com/articles/how-much-does-it-cost-paint-bedroom.htm
 * - BLS Occupational Outlook Handbook, Painters (median wage $23.75/hr, May 2025)
 *   https://www.bls.gov/ooh/construction-and-extraction/painters-construction-and-maintenance.htm
 */

export type PaintTier = "good" | "better" | "best";
export type Condition = "good" | "fair" | "poor";
export type CeilingHeight = "8ft" | "9-10ft" | "vaulted";
export type ColourChange = "same" | "new" | "darkToLight";

export interface RateSheet {
  currency: "USD";
  label: string;
  /** Production rates, 2 coats (PaintScout). */
  production: {
    wallsSqftPerHr: number;
    ceilingSqftPerHr: number;
    trimLfPerHr: number;
    doorHrsEach: number;
    windowHrsEach: number;
  };
  setupHrsPerJob: number;
  setupHrsPerExtraRoom: number;
  /** Billable hourly rate = loaded labour cost / target labour share of price. */
  billableRatePerHr: number;
  loadedLabourCostPerHr: number;
  productiveHrsPerDay: number;
  /** Above this many hours a second painter joins. */
  soloCrewMaxHrs: number;
  openings: { doorSqft: number; windowSqft: number; doorWidthFt: number };
  paint: {
    coverageSqftPerGallon: number;
    wastePct: number;
    pricePerGallon: Record<PaintTier, number>;
    primerPerGallon: number;
    trimQuartPerRoom: number;
  };
  sundriesPerRoom: number;
  patchPerRoom: number;
  drywallRepairAllowance: number;
  materialsMarkupPct: number;
  minimumJob: number;
  wallHeightFt: Record<CeilingHeight, number>;
  multipliers: {
    condition: Record<Condition, number>;
    height: Record<CeilingHeight, number>;
    colour: Record<ColourChange, number>;
    furnished: { empty: number; furnished: number };
  };
  coats: Record<ColourChange, number>;
  /** Shown to the homeowner as a range around the point estimate. */
  range: { lowPct: number; highPct: number };
  /**
   * Regional factor by US state, derived from Angi's average cost to paint a room
   * by state divided by the ~$1,100 national average. States not listed use 1.00.
   */
  regionalFactor: Record<string, number>;
}

export const US_DEMO_RATES: RateSheet = {
  currency: "USD",
  label: "Demo rates (US). Based on public industry averages, not a real contractor's prices.",
  production: {
    wallsSqftPerHr: 90,
    ceilingSqftPerHr: 80,
    trimLfPerHr: 20,
    doorHrsEach: 1.25,
    windowHrsEach: 0.5,
  },
  setupHrsPerJob: 2,
  setupHrsPerExtraRoom: 0.5,
  billableRatePerHr: 65,
  loadedLabourCostPerHr: 27,
  productiveHrsPerDay: 7,
  soloCrewMaxHrs: 21, // 3 productive days solo
  openings: { doorSqft: 20, windowSqft: 15, doorWidthFt: 3 },
  paint: {
    coverageSqftPerGallon: 350,
    wastePct: 0.1,
    pricePerGallon: { good: 35, better: 50, best: 70 },
    primerPerGallon: 20,
    trimQuartPerRoom: 20,
  },
  sundriesPerRoom: 25,
  patchPerRoom: 15,
  drywallRepairAllowance: 300,
  materialsMarkupPct: 0.2,
  minimumJob: 350,
  wallHeightFt: { "8ft": 8, "9-10ft": 9.5, vaulted: 12 },
  multipliers: {
    condition: { good: 1.0, fair: 1.15, poor: 1.35 },
    height: { "8ft": 1.0, "9-10ft": 1.1, vaulted: 1.25 },
    colour: { same: 0.65, new: 1.0, darkToLight: 1.4 },
    furnished: { empty: 1.0, furnished: 1.1 },
  },
  coats: { same: 1, new: 2, darkToLight: 2 },
  range: { lowPct: 0.9, highPct: 1.15 },
  regionalFactor: {
    CA: 1.43,
    NY: 1.24,
    FL: 1.03,
    NC: 0.97,
    IL: 0.95,
    PA: 0.95,
    OH: 0.94,
    TX: 0.92,
    GA: 0.91,
    MI: 0.91,
  },
};

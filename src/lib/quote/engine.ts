import type { CeilingHeight, ColourChange, Condition, PaintTier, RateSheet } from "./rates";
import { US_DEMO_RATES } from "./rates";
import { zipToState } from "./zip";

export type RoomType = "bedroom" | "living" | "kitchen" | "bathroom" | "hallway" | "stairway" | "other";

export interface RoomInput {
  type: RoomType;
  lengthFt: number;
  widthFt: number;
  walls: boolean;
  ceiling: boolean;
  trim: boolean;
  doors: number;
  windows: number;
}

export interface QuoteInput {
  zip: string;
  rooms: RoomInput[];
  ceilingHeight: CeilingHeight;
  condition: Condition;
  colourChange: ColourChange;
  paintTier: PaintTier;
  furnished: boolean;
}

export interface LineItem {
  label: string;
  amount: number;
}

export interface RoomBreakdown {
  type: RoomType;
  wallSqft: number;
  ceilingSqft: number;
  trimLf: number;
  hours: number;
}

export interface QuoteResult {
  state: string | null;
  regionalFactor: number;
  rooms: RoomBreakdown[];
  hours: number;
  crew: number;
  days: number;
  paintGallons: number;
  primerGallons: number;
  labour: number;
  materials: number;
  lineItems: LineItem[];
  subtotal: number;
  total: number;
  low: number;
  high: number;
  minimumApplied: boolean;
  rateLabel: string;
}

export class QuoteInputError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Round for display: nearest $10. */
export const roundDisplay = (n: number) => Math.round(n / 10) * 10;

function validate(input: QuoteInput) {
  if (!input.rooms.length) throw new QuoteInputError("Add at least one room.");
  if (input.rooms.length > 10) throw new QuoteInputError("Up to 10 rooms per quote.");
  for (const r of input.rooms) {
    if (!(r.lengthFt > 0 && r.lengthFt <= 60) || !(r.widthFt > 0 && r.widthFt <= 60))
      throw new QuoteInputError("Room sizes must be between 1 and 60 ft.");
    if (r.doors < 0 || r.windows < 0 || r.doors > 10 || r.windows > 20)
      throw new QuoteInputError("Check the door and window counts.");
    if (!r.walls && !r.ceiling && !r.trim && r.doors === 0 && r.windows === 0)
      throw new QuoteInputError("Pick at least one thing to paint in each room.");
  }
}

export function calculateQuote(input: QuoteInput, rates: RateSheet = US_DEMO_RATES): QuoteResult {
  validate(input);
  const p = rates.production;
  const m = rates.multipliers;
  const wallH = rates.wallHeightFt[input.ceilingHeight];
  const multiplier =
    m.condition[input.condition] *
    m.height[input.ceilingHeight] *
    m.colour[input.colourChange] *
    (input.furnished ? m.furnished.furnished : m.furnished.empty);

  let paintSqft = 0;
  let primerSqft = 0;
  let trimRooms = 0;

  const rooms: RoomBreakdown[] = input.rooms.map((r) => {
    const perimeter = 2 * (r.lengthFt + r.widthFt);
    const wallSqft = r.walls
      ? Math.max(0, perimeter * wallH - r.doors * rates.openings.doorSqft - r.windows * rates.openings.windowSqft)
      : 0;
    const ceilingSqft = r.ceiling ? r.lengthFt * r.widthFt : 0;
    const trimLf = r.trim ? Math.max(0, perimeter - r.doors * rates.openings.doorWidthFt) : 0;

    const base =
      wallSqft / p.wallsSqftPerHr +
      ceilingSqft / p.ceilingSqftPerHr +
      trimLf / p.trimLfPerHr +
      r.doors * p.doorHrsEach +
      r.windows * p.windowHrsEach;

    paintSqft += wallSqft + ceilingSqft;
    if (input.colourChange === "darkToLight" || input.condition === "poor") primerSqft += wallSqft;
    if (r.trim || r.doors > 0 || r.windows > 0) trimRooms += 1;

    return { type: r.type, wallSqft, ceilingSqft, trimLf, hours: round2(base * multiplier) };
  });

  const taskHours = rooms.reduce((s, r) => s + r.hours, 0);
  const hours = round2(taskHours + rates.setupHrsPerJob + rates.setupHrsPerExtraRoom * (rooms.length - 1));
  const crew = hours <= rates.soloCrewMaxHrs ? 1 : 2;
  const days = Math.ceil(hours / (crew * rates.productiveHrsPerDay));

  const coats = rates.coats[input.colourChange];
  const gallonsFor = (sqft: number, c: number) =>
    sqft > 0 ? Math.ceil(((sqft * c) / rates.paint.coverageSqftPerGallon) * (1 + rates.paint.wastePct)) : 0;
  const paintGallons = gallonsFor(paintSqft, coats);
  const primerGallons = gallonsFor(primerSqft, 1);

  const n = rooms.length;
  const rawMaterials: LineItem[] = [
    { label: `Paint (${paintGallons} gal, ${input.paintTier})`, amount: paintGallons * rates.paint.pricePerGallon[input.paintTier] },
    { label: `Primer (${primerGallons} gal)`, amount: primerGallons * rates.paint.primerPerGallon },
    { label: "Trim paint", amount: trimRooms * rates.paint.trimQuartPerRoom },
    { label: "Tape, plastic, caulk", amount: n * rates.sundriesPerRoom },
    { label: "Patching filler", amount: input.condition === "good" ? 0 : n * rates.patchPerRoom },
  ].filter((li) => li.amount > 0);

  const markup = 1 + rates.materialsMarkupPct;
  const materials = round2(rawMaterials.reduce((s, li) => s + li.amount, 0) * markup);
  const labour = round2(hours * rates.billableRatePerHr);

  const lineItems: LineItem[] = [
    { label: `Labour (${Math.round(hours * 10) / 10} hrs)`, amount: labour },
    ...rawMaterials.map((li) => ({ label: li.label, amount: round2(li.amount * markup) })),
  ];
  if (input.condition === "poor") {
    lineItems.push({ label: "Drywall repair allowance", amount: rates.drywallRepairAllowance });
  }

  const subtotal = round2(lineItems.reduce((s, li) => s + li.amount, 0));
  const state = zipToState(input.zip);
  const regionalFactor = (state && rates.regionalFactor[state]) || 1;
  if (regionalFactor !== 1) {
    lineItems.push({ label: `Regional adjustment (${state})`, amount: round2(subtotal * (regionalFactor - 1)) });
  }

  const raw = round2(subtotal * regionalFactor);
  const minimumApplied = raw < rates.minimumJob;
  const total = Math.max(raw, rates.minimumJob);
  const low = Math.max(rates.minimumJob, round2(total * rates.range.lowPct));
  const high = round2(total * rates.range.highPct);

  return {
    state,
    regionalFactor,
    rooms,
    hours,
    crew,
    days,
    paintGallons,
    primerGallons,
    labour,
    materials,
    lineItems,
    subtotal,
    total,
    low,
    high,
    minimumApplied,
    rateLabel: rates.label,
  };
}

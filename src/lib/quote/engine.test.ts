import { describe, expect, it } from "vitest";
import { calculateQuote, QuoteInputError, type QuoteInput, type RoomInput } from "./engine";
import { zipToState } from "./zip";

const bedroom: RoomInput = {
  type: "bedroom", lengthFt: 12, widthFt: 15, walls: true, ceiling: true, trim: true, doors: 1, windows: 2,
};

const base: QuoteInput = {
  zip: "60601", // Chicago, IL (factor 0.95) — overridden per test where needed
  rooms: [bedroom],
  ceilingHeight: "8ft",
  condition: "fair",
  colourChange: "new",
  paintTier: "better",
  furnished: true,
};

const national = { ...base, zip: "97201" }; // Portland, OR: no factor (1.00)

describe("scope worked example (12x15 bedroom)", () => {
  it("fair, furnished, national: about $1,371, range $1,234 to $1,576", () => {
    const q = calculateQuote(national);
    expect(q.rooms[0].wallSqft).toBe(382);
    expect(q.rooms[0].ceilingSqft).toBe(180);
    expect(q.rooms[0].trimLf).toBe(51);
    expect(q.hours).toBeCloseTo(16.29, 1);
    expect(q.crew).toBe(1);
    expect(q.days).toBe(3);
    expect(q.paintGallons).toBe(4);
    expect(q.labour).toBeCloseTo(1059, 0);
    expect(q.materials).toBeCloseTo(312, 0);
    expect(q.total).toBeCloseTo(1371, -1);
    expect(q.low).toBeCloseTo(1234, -1);
    expect(q.high).toBeCloseTo(1576, -1);
  });

  it("good condition, empty: range about $1,042 to $1,332", () => {
    const q = calculateQuote({ ...national, condition: "good", furnished: false });
    expect(q.low).toBeCloseTo(1042, -1);
    expect(q.high).toBeCloseTo(1332, -1);
  });

  it("California applies 1.43: range about $1,764 to $2,254", () => {
    const q = calculateQuote({ ...national, zip: "94103" });
    expect(q.state).toBe("CA");
    expect(q.regionalFactor).toBe(1.43);
    expect(q.low).toBeCloseTo(1764, -1);
    expect(q.high).toBeCloseTo(2254, -1);
  });
});

describe("pricing rules", () => {
  it("line items add up to the total", () => {
    const q = calculateQuote({ ...base, zip: "94103", condition: "poor" });
    const sum = q.lineItems.reduce((s, li) => s + li.amount, 0);
    expect(sum).toBeCloseTo(q.total, 1);
  });

  it("poor condition adds primer and drywall allowance", () => {
    const q = calculateQuote({ ...national, condition: "poor" });
    expect(q.primerGallons).toBeGreaterThan(0);
    expect(q.lineItems.some((l) => l.label.startsWith("Drywall"))).toBe(true);
  });

  it("same colour (1 coat) is cheaper than new colour, dark to light is dearer", () => {
    const same = calculateQuote({ ...national, colourChange: "same" }).total;
    const neu = calculateQuote(national).total;
    const dark = calculateQuote({ ...national, colourChange: "darkToLight" }).total;
    expect(same).toBeLessThan(neu);
    expect(dark).toBeGreaterThan(neu);
  });

  it("higher ceilings and better paint cost more", () => {
    const t = calculateQuote(national).total;
    expect(calculateQuote({ ...national, ceilingHeight: "vaulted" }).total).toBeGreaterThan(t);
    expect(calculateQuote({ ...national, paintTier: "best" }).total).toBeGreaterThan(t);
  });

  it("big jobs get a 2-person crew", () => {
    const q = calculateQuote({ ...national, rooms: [bedroom, bedroom, bedroom] });
    expect(q.crew).toBe(2);
    expect(q.hours).toBeCloseTo(16.29 * 3 - 2 * 2 + 1, 0);
  });

  it("minimum job charge applies to tiny jobs", () => {
    const q = calculateQuote({
      ...national,
      condition: "good",
      furnished: false,
      rooms: [{ type: "bathroom", lengthFt: 5, widthFt: 5, walls: false, ceiling: false, trim: false, doors: 1, windows: 0 }],
    });
    expect(q.minimumApplied).toBe(true);
    expect(q.total).toBe(350);
    expect(q.low).toBe(350);
  });

  it("rejects bad input", () => {
    expect(() => calculateQuote({ ...national, rooms: [] })).toThrow(QuoteInputError);
    expect(() => calculateQuote({ ...national, rooms: [{ ...bedroom, lengthFt: 0 }] })).toThrow(QuoteInputError);
    expect(() =>
      calculateQuote({ ...national, rooms: [{ ...bedroom, walls: false, ceiling: false, trim: false, doors: 0, windows: 0 }] }),
    ).toThrow(QuoteInputError);
  });
});

describe("zipToState", () => {
  it.each([
    ["10001", "NY"], ["90210", "CA"], ["73301", "TX"], ["77001", "TX"], ["33101", "FL"],
    ["60601", "IL"], ["30301", "GA"], ["48201", "MI"], ["02108", "MA"], ["12345-6789", "NY"],
  ])("%s -> %s", (zip, st) => expect(zipToState(zip)).toBe(st));
  it("invalid zip returns null and uses factor 1", () => {
    expect(zipToState("abc")).toBeNull();
    expect(calculateQuote({ ...national, zip: "abc" }).regionalFactor).toBe(1);
  });
});

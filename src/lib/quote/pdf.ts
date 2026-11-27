import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { QuoteInput, QuoteResult } from "./engine";
import { roundDisplay } from "./engine";

const INK = rgb(0.094, 0.094, 0.106);
const MUTED = rgb(0.44, 0.44, 0.47);
const LINE = rgb(0.89, 0.89, 0.9);
const SOFT = rgb(0.965, 0.965, 0.97);

const ROOM_LABEL: Record<string, string> = {
  bedroom: "Bedroom", living: "Living room", kitchen: "Kitchen", bathroom: "Bathroom",
  hallway: "Hallway", stairway: "Stairway", other: "Other room",
};

const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
const usd10 = (n: number) => "$" + roundDisplay(n).toLocaleString("en-US");
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export interface PdfMeta {
  quoteId: string;
  name?: string;
  date?: Date;
}

export async function buildQuotePdf(input: QuoteInput, q: QuoteResult, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Painting quote ${meta.quoteId}`);
  doc.setAuthor("Northfield Painting (demo)");
  doc.setCreator("painting-instant-quote by devshaarif.com");

  let page = doc.addPage([612, 792]); // US Letter
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const L = 48;
  const R = 612 - 48;
  const date = meta.date ?? new Date();
  const valid = new Date(date.getTime() + 30 * 86400000);

  const text = (p: PDFPage, s: string, x: number, y: number, size = 10, font: PDFFont = reg, color = INK) =>
    p.drawText(s, { x, y, size, font, color });
  const right = (p: PDFPage, s: string, x: number, y: number, size = 10, font: PDFFont = reg, color = INK) =>
    p.drawText(s, { x: x - font.widthOfTextAtSize(s, size), y, size, font, color });
  const hr = (y: number) => page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.6, color: LINE });

  let y = 740;
  /** Start a new page when the next block would run into the footer. */
  const ensure = (h: number) => {
    if (y - h < 90) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
  };

  // Header
  text(page, "Northfield Painting", L, y, 18, bold);
  right(page, "QUOTE", R, y + 2, 9, bold, MUTED);
  y -= 16;
  text(page, "Interior painting", L, y, 10, reg, MUTED);
  right(page, meta.quoteId, R, y, 11, bold);
  y -= 14;
  right(page, `Issued ${fmtDate(date)}  ·  Valid until ${fmtDate(valid)}`, R, y, 9, reg, MUTED);
  y -= 18;
  hr(y);

  // Customer + location
  y -= 24;
  text(page, "PREPARED FOR", L, y, 8, bold, MUTED);
  text(page, "PROPERTY", 300, y, 8, bold, MUTED);
  y -= 15;
  text(page, meta.name?.trim() || "Homeowner", L, y, 11, bold);
  text(page, `ZIP ${input.zip}${q.state ? ` (${q.state})` : ""}`, 300, y, 11, bold);

  // Estimate box
  y -= 30;
  page.drawRectangle({ x: L, y: y - 74, width: R - L, height: 86, color: SOFT });
  text(page, "ESTIMATED PRICE RANGE", L + 16, y - 8, 8, bold, MUTED);
  text(page, `${usd10(q.low)} - ${usd10(q.high)}`, L + 16, y - 40, 26, bold);
  text(page, "Final price confirmed at a free site visit.", L + 16, y - 60, 9, reg, MUTED);
  const stats: Array<[string, string]> = [
    ["Labour", `${Math.round(q.hours * 10) / 10} hrs`],
    ["Crew", `${q.crew} painter${q.crew > 1 ? "s" : ""}`],
    ["On site", `${q.days} day${q.days > 1 ? "s" : ""}`],
    ["Paint", `${q.paintGallons + q.primerGallons} gal`],
  ];
  stats.forEach(([k, v], i) => {
    const x = 340 + i * 58;
    text(page, k.toUpperCase(), x, y - 22, 7, bold, MUTED);
    text(page, v, x, y - 38, 10, bold);
  });
  y -= 104;

  // Line items
  text(page, "Price breakdown", L, y, 12, bold);
  y -= 18;
  for (const li of q.lineItems) {
    ensure(22);
    text(page, li.label, L, y, 10, reg, rgb(0.25, 0.25, 0.28));
    right(page, usd(li.amount), R, y, 10);
    y -= 8;
    hr(y);
    y -= 14;
  }
  text(page, "Estimate", L, y, 11, bold);
  right(page, usd(q.total), R, y, 11, bold);
  y -= 14;
  text(page, "Range is -10% / +15% of the estimate to cover what can only be seen on site.", L, y, 8, reg, MUTED);

  // Rooms
  y -= 30;
  ensure(70);
  text(page, "Rooms", L, y, 12, bold);
  y -= 18;
  const cols = [L, 260, 350, 440, R];
  text(page, "ROOM", cols[0], y, 7, bold, MUTED);
  right(page, "WALLS", cols[1] + 40, y, 7, bold, MUTED);
  right(page, "CEILING", cols[2] + 40, y, 7, bold, MUTED);
  right(page, "TRIM", cols[3] + 40, y, 7, bold, MUTED);
  right(page, "HOURS", cols[4], y, 7, bold, MUTED);
  y -= 8;
  hr(y);
  y -= 14;
  q.rooms.forEach((r, i) => {
    ensure(22);
    const src = input.rooms[i];
    text(page, `${i + 1}. ${ROOM_LABEL[r.type]} (${src.lengthFt} x ${src.widthFt} ft)`, cols[0], y, 10);
    right(page, `${Math.round(r.wallSqft)} sq ft`, cols[1] + 40, y, 10);
    right(page, `${Math.round(r.ceilingSqft)} sq ft`, cols[2] + 40, y, 10);
    right(page, `${Math.round(r.trimLf)} ft`, cols[3] + 40, y, 10);
    right(page, `${Math.round(r.hours * 10) / 10}`, cols[4], y, 10);
    y -= 8;
    hr(y);
    y -= 14;
  });
  const setupHrs = Math.round((q.hours - q.rooms.reduce((t, r) => t + r.hours, 0)) * 10) / 10;
  if (setupHrs > 0) {
    ensure(22);
    text(page, "Setup and clean-up", cols[0], y, 10, reg, MUTED);
    right(page, `${setupHrs}`, cols[4], y, 10, reg, MUTED);
    y -= 22;
  }

  // Included + selections
  y -= 10;
  ensure(100);
  text(page, "What's included", L, y, 11, bold);
  text(page, "Your selections", 330, y, 11, bold);
  y -= 16;
  const included = [
    "Floor and furniture protection, masking, clean-up",
    "Filling small holes and light sanding",
    q.primerGallons > 0 ? "Primer where needed, plus finish coats" : "Finish coats as selected",
    "Paint and materials supplied",
  ];
  const picks = [
    `Ceilings: ${{ "8ft": "8 ft", "9-10ft": "9 to 10 ft", vaulted: "Vaulted / over 10 ft" }[input.ceilingHeight]}`,
    `Wall condition: ${input.condition}`,
    `Colour: ${{ same: "same colour, 1 coat", new: "new colour, 2 coats", darkToLight: "dark to light, primer + 2 coats" }[input.colourChange]}`,
    `Paint: ${input.paintTier}`,
    `Rooms: ${input.furnished ? "furnished" : "empty"}`,
  ];
  const lines = Math.max(included.length, picks.length);
  for (let i = 0; i < lines; i++) {
    if (included[i]) text(page, `•  ${included[i]}`, L, y, 9, reg, rgb(0.3, 0.3, 0.33));
    if (picks[i]) text(page, picks[i], 330, y, 9, reg, rgb(0.3, 0.3, 0.33));
    y -= 14;
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: L, y: 70 }, end: { x: R, y: 70 }, thickness: 0.6, color: LINE });
    text(pg, "Demo quote. Northfield Painting is a fictional company and these are demo rates from public", L, 54, 8, reg, MUTED);
    text(pg, "industry averages (PaintScout, Angi, BLS), not a real contractor's prices.", L, 43, 8, reg, MUTED);
    right(pg, "Developed by devshaarif.com", R, 54, 8, bold, MUTED);
    right(pg, `${meta.quoteId}  ·  Page ${i + 1} of ${pages.length}`, R, 43, 8, reg, MUTED);
  });

  return doc.save();
}

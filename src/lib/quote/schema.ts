import { z } from "zod";

const room = z.object({
  type: z.enum(["bedroom", "living", "kitchen", "bathroom", "hallway", "stairway", "other"]),
  lengthFt: z.number().positive().max(60),
  widthFt: z.number().positive().max(60),
  walls: z.boolean(),
  ceiling: z.boolean(),
  trim: z.boolean(),
  doors: z.number().int().min(0).max(10),
  windows: z.number().int().min(0).max(20),
});

export const quoteInputSchema = z.object({
  zip: z.string().max(10),
  rooms: z.array(room).min(1).max(10),
  ceilingHeight: z.enum(["8ft", "9-10ft", "vaulted"]),
  condition: z.enum(["good", "fair", "poor"]),
  colourChange: z.enum(["same", "new", "darkToLight"]),
  paintTier: z.enum(["good", "better", "best"]),
  furnished: z.boolean(),
});

export const timelineSchema = z.enum(["asap", "2weeks", "month", "planning"]);
export type Timeline = z.infer<typeof timelineSchema>;

export const TIMELINE_LABEL: Record<Timeline, string> = {
  asap: "As soon as possible",
  "2weeks": "Within 2 weeks",
  month: "Within a month",
  planning: "Just planning",
};

export const leadSchema = z.object({
  input: quoteInputSchema,
  timeline: timelineSchema,
  contact: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    phone: z.string().trim().max(30).optional().default(""),
  }),
  /** Honeypot: real users never fill this. */
  company: z.string().max(0).optional(),
});

export const pdfRequestSchema = z.object({
  input: quoteInputSchema,
  quoteId: z.string().regex(/^NP-[0-9A-Z-]{4,20}$/).optional(),
  name: z.string().trim().max(80).optional(),
});

export function newQuoteId(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `NP-${d}-${r}`;
}

/** Simple lead temperature: how soon and how big. */
export function leadScore(timeline: Timeline, total: number): "hot" | "warm" | "cold" {
  if (timeline === "planning") return "cold";
  if ((timeline === "asap" || timeline === "2weeks") && total >= 2000) return "hot";
  return "warm";
}

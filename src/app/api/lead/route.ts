import { calculateQuote, roundDisplay } from "@/lib/quote/engine";
import { buildQuotePdf } from "@/lib/quote/pdf";
import { isDemoAddress, sendQuoteEmail, smtpConfigured } from "@/lib/quote/mailer";
import { leadSchema, leadScore, newQuoteId, TIMELINE_LABEL } from "@/lib/quote/schema";

// Best-effort per-instance rate limit: 5 leads per IP per 10 minutes.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

/**
 * POST a lead. Recalculates the quote on the server, builds the PDF and forwards
 * everything to the Google Apps Script web app (Sheet row + emails + follow-up).
 * Without APPS_SCRIPT_URL set, the quote still works and saved=false is returned.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });

  const parsed = leadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check your name and email." }, { status: 400 });
  const { input, timeline, contact, company } = parsed.data;

  const quoteId = newQuoteId();
  // Honeypot filled: pretend success, store nothing.
  if (company) return Response.json({ ok: true, quoteId, saved: false });

  const quote = calculateQuote(input);
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.LEAD_SECRET;
  const pdf = await buildQuotePdf(input, quote, { quoteId, name: contact.name });

  // Homeowner email goes from your own domain over SMTP when configured.
  let emailed = false;
  if (smtpConfigured() && !isDemoAddress(contact.email)) {
    try {
      await sendQuoteEmail({
        to: contact.email,
        name: contact.name,
        quoteId,
        low: roundDisplay(quote.low),
        high: roundDisplay(quote.high),
        rooms: input.rooms.length,
        hours: Math.round(quote.hours * 10) / 10,
        crew: quote.crew,
        days: quote.days,
        pdf,
      });
      emailed = true;
    } catch (err) {
      console.error("quote email failed", err);
    }
  }

  if (!url || !secret) return Response.json({ ok: true, quoteId, saved: false, emailed });
  const payload = {
    secret,
    quoteId,
    createdAt: new Date().toISOString(),
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    zip: input.zip,
    state: quote.state ?? "",
    rooms: input.rooms.length,
    roomsSummary: input.rooms.map((r) => `${r.type} ${r.lengthFt}x${r.widthFt}`).join(", "),
    low: roundDisplay(quote.low),
    high: roundDisplay(quote.high),
    total: Math.round(quote.total),
    hours: Math.round(quote.hours * 10) / 10,
    crew: quote.crew,
    days: quote.days,
    timeline: TIMELINE_LABEL[timeline],
    score: leadScore(timeline, quote.total),
    pdfBase64: Buffer.from(pdf).toString("base64"),
    // When SMTP is set up, the app emails the homeowner and Apps Script must not.
    homeownerHandled: smtpConfigured(),
    homeownerEmailed: emailed,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; emailed?: boolean } | null;
    if (!res.ok || !body?.ok) throw new Error(`Apps Script responded ${res.status}`);
    return Response.json({ ok: true, quoteId, saved: true, emailed: emailed || Boolean(body.emailed) });
  } catch (err) {
    console.error("lead forward failed", err);
    // The homeowner still gets their breakdown; the lead is just not stored.
    return Response.json({ ok: true, quoteId, saved: false, emailed });
  }
}

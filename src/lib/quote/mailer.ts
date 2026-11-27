import nodemailer from "nodemailer";

export interface QuoteEmail {
  to: string;
  name: string;
  quoteId: string;
  low: number;
  high: number;
  rooms: number;
  hours: number;
  crew: number;
  days: number;
  pdf: Uint8Array;
}

const money = (n: number) => "$" + n.toLocaleString("en-US");
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Addresses on example.com are demo/test addresses and are never emailed. */
export const isDemoAddress = (email: string) => /@example\.com$/i.test(email);

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Sends the homeowner their quote from your own domain (e.g. Hostinger SMTP). */
export async function sendQuoteEmail(q: QuoteEmail) {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const company = process.env.COMPANY_NAME || "Northfield Painting";
  const from = process.env.SMTP_FROM || `${company} <${process.env.SMTP_USER}>`;
  const first = q.name.trim().split(/\s+/)[0] || "there";
  const demo = "This is a demo quote tool built by devshaarif.com. Northfield Painting is a fictional company and the prices are demo rates.";

  const text = [
    `Hi ${first},`,
    "",
    `Thanks for using the instant quote. Your estimate for ${q.rooms} room(s) is ${money(q.low)} to ${money(q.high)}.`,
    `That is about ${q.hours} labour hours, ${q.crew} painter(s), ${q.days} day(s) on site.`,
    "",
    `The full breakdown is attached as a PDF (quote ${q.quoteId}, valid 30 days).`,
    "",
    company,
    "",
    "--",
    demo,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#18181b;max-width:520px;line-height:1.5">
<p>Hi ${esc(first)},</p>
<p>Thanks for using the instant quote. Your estimate for ${q.rooms} room(s):</p>
<p style="font-size:26px;font-weight:bold;margin:8px 0">${money(q.low)} to ${money(q.high)}</p>
<p style="color:#71717a;margin-top:0">About ${q.hours} labour hours, ${q.crew} painter(s), ${q.days} day(s) on site.</p>
<p>The full breakdown is attached as a PDF (quote <b>${esc(q.quoteId)}</b>, valid 30 days).</p>
<p>${esc(company)}</p>
<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 12px">
<p style="font-size:12px;color:#71717a">This is a demo quote tool built by <a href="https://devshaarif.com" style="color:#71717a">devshaarif.com</a>. Northfield Painting is a fictional company and the prices are demo rates.</p>
</div>`;

  await transport.sendMail({
    from,
    to: q.to,
    replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_USER,
    subject: `Your painting quote ${q.quoteId}`,
    text,
    html,
    attachments: [{ filename: `${q.quoteId}.pdf`, content: Buffer.from(q.pdf), contentType: "application/pdf" }],
  });
}

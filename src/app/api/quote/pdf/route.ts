import { calculateQuote } from "@/lib/quote/engine";
import { buildQuotePdf } from "@/lib/quote/pdf";
import { newQuoteId, pdfRequestSchema } from "@/lib/quote/schema";

/** POST { input, quoteId?, name? } -> quote PDF. Price is recalculated on the server. */
export async function POST(req: Request) {
  const parsed = pdfRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid quote." }, { status: 400 });
  const { input, name } = parsed.data;
  const quoteId = parsed.data.quoteId ?? newQuoteId();
  const quote = calculateQuote(input);
  const pdf = await buildQuotePdf(input, quote, { quoteId, name });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quoteId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

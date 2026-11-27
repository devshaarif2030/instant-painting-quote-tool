import QuoteWizard from "@/components/QuoteWizard";
import DevCredit from "@/components/DevCredit";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 pt-6 sm:px-8">
        <p className="text-[17px] font-semibold tracking-tight">
          Northfield Painting
        </p>
        <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600">Demo rates</span>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 max-w-3xl px-2 sm:px-0">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-[40px] sm:leading-[1.1]">
            Interior painting quote in about a minute
          </h1>
          <p className="mt-3 text-zinc-500">
            Answer a few questions about your rooms. You get a price range right away, and a full breakdown by email.
          </p>
        </div>
        <QuoteWizard />
      </main>

      <footer className="mx-auto flex w-full max-w-[1280px] flex-col gap-1 px-5 pb-16 text-xs sm:pb-8 text-zinc-500 sm:flex-row sm:justify-between sm:px-8">
        <p>Demo rates based on public industry averages (PaintScout, Angi, BLS). Not a real contractor&apos;s prices.</p>
      </footer>
      <DevCredit />
    </div>
  );
}

"use client";

import { useState } from "react";
import { calculateQuote, roundDisplay, type QuoteInput, type QuoteResult, type RoomInput, type RoomType } from "@/lib/quote/engine";
import type { CeilingHeight, ColourChange, Condition, PaintTier } from "@/lib/quote/rates";
import { zipToState } from "@/lib/quote/zip";

type Timeline = "asap" | "2weeks" | "month" | "planning";
type Lead = { quoteId: string; name: string; saved: boolean; emailed: boolean };
type Room = RoomInput & { id: number; size: "S" | "M" | "L" | "custom" };

const ROOM_TYPES: Array<{ value: RoomType; label: string; sizes: Record<"S" | "M" | "L", [number, number]> }> = [
  { value: "bedroom", label: "Bedroom", sizes: { S: [10, 10], M: [12, 14], L: [14, 16] } },
  { value: "living", label: "Living room", sizes: { S: [12, 14], M: [14, 18], L: [18, 22] } },
  { value: "kitchen", label: "Kitchen", sizes: { S: [8, 10], M: [10, 12], L: [12, 16] } },
  { value: "bathroom", label: "Bathroom", sizes: { S: [5, 8], M: [8, 10], L: [10, 12] } },
  { value: "hallway", label: "Hallway", sizes: { S: [3, 10], M: [4, 15], L: [5, 20] } },
  { value: "stairway", label: "Stairway", sizes: { S: [4, 10], M: [4, 14], L: [5, 18] } },
  { value: "other", label: "Other room", sizes: { S: [10, 10], M: [12, 14], L: [16, 18] } },
];

const STEPS = ["Location", "Rooms", "Ceilings", "Condition", "Colour", "Paint", "Furniture", "Timeline", "Quote"] as const;

let nextId = 1;
function newRoom(type: RoomType = "bedroom"): Room {
  const [l, w] = ROOM_TYPES.find((t) => t.value === type)!.sizes.M;
  return { id: nextId++, type, size: "M", lengthFt: l, widthFt: w, walls: true, ceiling: true, trim: true, doors: 1, windows: 1 };
}

const money = (n: number) => "$" + roundDisplay(n).toLocaleString("en-US");
const money2 = (n: number) =>
  (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const hrs = (n: number) => (Math.round(n * 10) / 10).toString();

export default function QuoteWizard() {
  const [step, setStepRaw] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const setStep = (v: number | ((s: number) => number)) =>
    setStepRaw((s) => {
      const n = typeof v === "function" ? v(s) : v;
      setMaxStep((m) => Math.max(m, n));
      return n;
    });
  const [zip, setZip] = useState("");
  const [rooms, setRooms] = useState<Room[]>(() => [newRoom()]);
  const [ceilingHeight, setCeilingHeight] = useState<CeilingHeight | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [colourChange, setColourChange] = useState<ColourChange | null>(null);
  const [paintTier, setPaintTier] = useState<PaintTier | null>(null);
  const [furnished, setFurnished] = useState<boolean | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);

  const zipValid = zipToState(zip) !== null;
  const roomsValid = rooms.every(
    (r) => r.lengthFt > 0 && r.widthFt > 0 && (r.walls || r.ceiling || r.trim || r.doors > 0 || r.windows > 0),
  );

  const input: QuoteInput | null =
    ceilingHeight && condition && colourChange && paintTier && furnished !== null
      ? { zip, rooms, ceilingHeight, condition, colourChange, paintTier, furnished }
      : null;

  let quote: QuoteResult | null = null;
  if (input && zipValid && roomsValid) {
    try {
      quote = calculateQuote(input);
    } catch {
      quote = null;
    }
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const pick = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setTimeout(next, 160);
  };

  const restart = () => {
    setStepRaw(0);
    setMaxStep(0);
    setRooms([newRoom()]);
    setCeilingHeight(null);
    setCondition(null);
    setColourChange(null);
    setPaintTier(null);
    setFurnished(null);
    setTimeline(null);
    setLead(null);
  };

  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.18)]">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_440px]">
        <nav aria-label="Quote steps" className="hidden border-r border-black/[0.06] px-6 py-8 lg:block">
          <ol className="relative">
            {STEPS.map((label, i) => {
              const done = i < step;
              const current = i === step;
              const reachable = i <= maxStep;
              return (
                <li key={label} className="relative pb-6 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={`absolute left-[9px] top-6 h-[calc(100%-20px)] w-px ${i < step ? "bg-zinc-900" : "bg-zinc-200"}`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!reachable || current}
                    onClick={() => setStep(i)}
                    aria-current={current ? "step" : undefined}
                    className="group flex items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span
                      className={`grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border transition ${
                        done
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : current
                            ? "border-zinc-900 bg-white ring-4 ring-zinc-900/10"
                            : "border-zinc-300 bg-white"
                      }`}
                    >
                      {done ? (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2.5 6.5l2.2 2L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : current ? (
                        <span className="h-[7px] w-[7px] rounded-full bg-zinc-900" />
                      ) : null}
                    </span>
                    <span
                      className={`text-sm ${
                        current ? "font-semibold text-zinc-900" : done ? "text-zinc-700 group-hover:text-zinc-900" : "text-zinc-400"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="min-w-0 px-5 py-7 sm:px-12 sm:py-10">
          <div className="mb-8 lg:hidden">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500">
              <span>
                Step {step + 1} of {STEPS.length} · {STEPS[step]}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

        <div key={step}>
        {step === 0 && (
          <StepShell title="Where is the property?" hint="Your ZIP code sets local labour and material pricing.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (zipValid) next();
              }}
              className="max-w-xs"
            >
              <label className="text-sm font-medium" htmlFor="zip">
                ZIP code
              </label>
              <input
                id="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={10}
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="e.g. 78701"
                className="mt-1.5 w-full rounded-lg border border-black/15 px-4 py-3 text-lg outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100"
              />
              {zip.length >= 5 && !zipValid && <p className="mt-2 text-sm text-red-600">Enter a valid US ZIP code.</p>}
              {zipValid && <p className="mt-2 text-sm text-accent-600">Pricing for {zipToState(zip)}</p>}
              <NavButtons onNext={next} nextDisabled={!zipValid} submit />
            </form>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="Which rooms are we painting?" hint="Pick a size or enter exact measurements. Add up to 10 rooms.">
            <div className="space-y-4">
              {rooms.map((r, i) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  index={i}
                  canRemove={rooms.length > 1}
                  onChange={(nr) => setRooms((rs) => rs.map((x) => (x.id === r.id ? nr : x)))}
                  onRemove={() => setRooms((rs) => rs.filter((x) => x.id !== r.id))}
                />
              ))}
            </div>
            {rooms.length < 10 && (
              <button
                type="button"
                onClick={() => setRooms((rs) => [...rs, newRoom()])}
                className="mt-4 w-full rounded-xl border-2 border-dashed border-black/10 py-3 text-sm font-medium text-black/60 hover:border-accent-500 hover:text-accent-600"
              >
                + Add another room
              </button>
            )}
            {!roomsValid && <p className="mt-3 text-sm text-red-600">Each room needs a size and at least one thing to paint.</p>}
            <NavButtons onBack={back} onNext={next} nextDisabled={!roomsValid} />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="How high are the ceilings?" hint="Taller walls mean more area and ladder work.">
            <Options<CeilingHeight>
              value={ceilingHeight}
              onPick={pick(setCeilingHeight)}
              options={[
                { value: "8ft", label: "Standard (8 ft)", desc: "Most bedrooms and older homes" },
                { value: "9-10ft", label: "9 to 10 ft", desc: "Newer builds, open plan" },
                { value: "vaulted", label: "Vaulted or over 10 ft", desc: "Needs tall ladders or scaffold" },
              ]}
            />
            <NavButtons onBack={back} onNext={next} nextDisabled={!ceilingHeight} />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="What shape are the walls in?" hint="Be honest, it keeps the quote accurate. Prep is where most surprises come from.">
            <Options<Condition>
              value={condition}
              onPick={pick(setCondition)}
              options={[
                { value: "good", label: "Good", desc: "Clean, no visible damage" },
                { value: "fair", label: "Fair", desc: "Nail holes, scuffs, small dents" },
                { value: "poor", label: "Poor", desc: "Cracks, peeling, water marks, needs repair" },
              ]}
            />
            <NavButtons onBack={back} onNext={next} nextDisabled={!condition} />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Are you changing the colour?" hint="This decides how many coats and whether primer is needed.">
            <Options<ColourChange>
              value={colourChange}
              onPick={pick(setColourChange)}
              options={[
                { value: "same", label: "Same or similar colour", desc: "Refresh, 1 coat" },
                { value: "new", label: "New colour", desc: "2 coats" },
                { value: "darkToLight", label: "Dark to light", desc: "Primer plus 2 coats" },
              ]}
            />
            <NavButtons onBack={back} onNext={next} nextDisabled={!colourChange} />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell title="Which paint quality?" hint="All options are trade-grade washable paint.">
            <Options<PaintTier>
              value={paintTier}
              onPick={pick(setPaintTier)}
              options={[
                { value: "good", label: "Good", desc: "Contractor grade, great for rentals" },
                { value: "better", label: "Better", desc: "Most popular. Scrubbable, low odour" },
                { value: "best", label: "Best", desc: "Premium line, best coverage and finish" },
              ]}
            />
            <NavButtons onBack={back} onNext={next} nextDisabled={!paintTier} />
          </StepShell>
        )}

        {step === 6 && (
          <StepShell title="Will the rooms be empty?" hint="We move and cover furniture if needed.">
            <Options<"empty" | "furnished">
              value={furnished === null ? null : furnished ? "furnished" : "empty"}
              onPick={pick((v: "empty" | "furnished") => setFurnished(v === "furnished"))}
              options={[
                { value: "empty", label: "Empty", desc: "Furniture already moved out" },
                { value: "furnished", label: "Furnished", desc: "We move, cover and put back" },
              ]}
            />
            <NavButtons onBack={back} onNext={next} nextDisabled={furnished === null} />
          </StepShell>
        )}

        {step === 7 && (
          <StepShell title="When do you want it done?" hint="Helps us plan crew availability.">
            <Options<Timeline>
              value={timeline}
              onPick={pick(setTimeline)}
              options={[
                { value: "asap", label: "As soon as possible" },
                { value: "2weeks", label: "Within 2 weeks" },
                { value: "month", label: "Within a month" },
                { value: "planning", label: "Just planning" },
              ]}
            />
            <NavButtons onBack={back} onNext={next} nextDisabled={!timeline} nextLabel="See my quote" />
          </StepShell>
        )}

        {step === 8 && quote && (
          <Result quote={quote} input={input!} timeline={timeline ?? "planning"} lead={lead} onLead={setLead} onBack={back} onRestart={restart} />
        )}
        {step === 8 && !quote && (
          <div>
            <p className="text-sm text-red-600">Something is missing. Go back and check your answers.</p>
            <NavButtons onBack={back} />
          </div>
        )}
        </div>
        </section>

        <VisualPanel
          zip={zipValid ? `${zip} · ${zipToState(zip)}` : null}
          rooms={rooms.length}
          picks={[
            ceilingHeight && { "8ft": "8 ft ceilings", "9-10ft": "9-10 ft ceilings", vaulted: "Vaulted" }[ceilingHeight],
            condition && `${condition[0].toUpperCase()}${condition.slice(1)} walls`,
            colourChange && { same: "Same colour", new: "New colour", darkToLight: "Dark to light" }[colourChange],
            paintTier && `${paintTier[0].toUpperCase()}${paintTier.slice(1)} paint`,
            furnished !== null && (furnished ? "Furnished" : "Empty rooms"),
          ].filter((x): x is string => Boolean(x))}
          estimate={step === STEPS.length - 1 && quote ? `${money(quote.low)} to ${money(quote.high)}` : null}
        />
      </div>
    </div>
  );
}

function StepShell({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="anim-fade-up text-xl font-semibold sm:text-2xl">{title}</h2>
      {hint && (
        <p style={{ "--d": "60ms" } as React.CSSProperties} className="anim-fade-up mt-1 text-sm text-black/55">
          {hint}
        </p>
      )}
      <div style={{ "--d": "120ms" } as React.CSSProperties} className="anim-fade-up mt-6">
        {children}
      </div>
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
  submit,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  submit?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-black/60 hover:bg-black/5">
          Back
        </button>
      )}
      {onNext && (
        <button
          type={submit ? "submit" : "button"}
          onClick={submit ? undefined : onNext}
          disabled={nextDisabled}
          className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function Options<T extends string>({
  value,
  onPick,
  options,
}: {
  value: T | null;
  onPick: (v: T) => void;
  options: Array<{ value: T; label: string; desc?: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            aria-pressed={active}
            style={{ "--d": `${140 + i * 60}ms` } as React.CSSProperties}
            className={`anim-fade-up rounded-xl border-2 p-4 text-left transition duration-200 hover:-translate-y-0.5 active:scale-[0.99] ${
              active ? "border-accent-500 bg-accent-50" : "border-black/10 hover:border-black/25"
            }`}
          >
            <p className="font-semibold">{o.label}</p>
            {o.desc && <p className="mt-0.5 text-sm text-black/55">{o.desc}</p>}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ label, value, onChange, max }: { label: string; value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-7 w-7 rounded-md bg-black/5 font-semibold hover:bg-black/10"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-7 w-7 rounded-md bg-black/5 font-semibold hover:bg-black/10"
        >
          +
        </button>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  room: Room;
  index: number;
  canRemove: boolean;
  onChange: (r: Room) => void;
  onRemove: () => void;
}) {
  const typeDef = ROOM_TYPES.find((t) => t.value === room.type)!;
  const setSize = (size: Room["size"]) => {
    if (size === "custom") return onChange({ ...room, size });
    const [l, w] = typeDef.sizes[size];
    onChange({ ...room, size, lengthFt: l, widthFt: w });
  };
  const setType = (type: RoomType) => {
    const def = ROOM_TYPES.find((t) => t.value === type)!;
    const sz = room.size === "custom" ? "M" : room.size;
    const [l, w] = def.sizes[sz];
    onChange({ ...room, type, size: sz, lengthFt: l, widthFt: w });
  };
  const toggle = (k: "walls" | "ceiling" | "trim") => onChange({ ...room, [k]: !room[k] });

  return (
    <div className="rounded-xl border border-black/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700">{index + 1}</span>
          <select
            aria-label="Room type"
            value={room.type}
            onChange={(e) => setType(e.target.value as RoomType)}
            className="rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm font-medium"
          >
            {ROOM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-medium text-black/45 hover:text-red-600">
            Remove
          </button>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/45">Size</p>
        <div className="flex flex-wrap gap-2">
          {(["S", "M", "L"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                room.size === s ? "border-accent-500 bg-accent-50 font-semibold text-accent-700" : "border-black/10"
              }`}
            >
              {{ S: "Small", M: "Medium", L: "Large" }[s]}{" "}
              <span className="text-black/45">
                {typeDef.sizes[s][0]}×{typeDef.sizes[s][1]}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSize("custom")}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              room.size === "custom" ? "border-accent-500 bg-accent-50 font-semibold text-accent-700" : "border-black/10"
            }`}
          >
            Exact size
          </button>
        </div>
        {room.size === "custom" && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <NumberField label="Length (ft)" value={room.lengthFt} onChange={(n) => onChange({ ...room, lengthFt: n })} />
            <span className="pt-5 text-black/40">×</span>
            <NumberField label="Width (ft)" value={room.widthFt} onChange={(n) => onChange({ ...room, widthFt: n })} />
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/45">What to paint</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["walls", "Walls"],
              ["ceiling", "Ceiling"],
              ["trim", "Baseboards & trim"],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                room[k] ? "border-accent-500 bg-accent-50 text-accent-700" : "border-black/10"
              }`}
            >
              <input type="checkbox" checked={room[k]} onChange={() => toggle(k)} className="accent-accent-600" />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Stepper label="Doors" value={room.doors} max={10} onChange={(n) => onChange({ ...room, doors: n })} />
          <Stepper label="Window frames" value={room.windows} max={20} onChange={(n) => onChange({ ...room, windows: n })} />
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-black/50">{label}</span>
      <input
        type="number"
        min={1}
        max={60}
        value={value || ""}
        onChange={(e) => onChange(Math.min(60, Math.max(0, Number(e.target.value))))}
        className="w-24 rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-accent-500"
      />
    </label>
  );
}

function Result({
  quote,
  input,
  timeline,
  lead,
  onLead,
  onBack,
  onRestart,
}: {
  quote: QuoteResult;
  input: QuoteInput;
  timeline: Timeline;
  lead: Lead | null;
  onLead: (l: Lead) => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = name.trim().length > 1 && emailOk && !sending;
  const unlocked = lead !== null;

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, timeline, contact: { name, email, phone }, company }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Something went wrong.");
      onLead({ quoteId: body.quoteId, name: name.trim(), saved: body.saved, emailed: Boolean(body.emailed) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = async () => {
    if (!lead) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/quote/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, quoteId: lead.quoteId, name: lead.name }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lead.quoteId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <p className="anim-fade-up text-sm font-medium text-accent-600">Your instant estimate</p>
      <p style={{ "--d": "80ms" } as React.CSSProperties} className="anim-fade-up mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
        {money(quote.low)} <span className="text-black/30">to</span> {money(quote.high)}
      </p>
      <p className="mt-2 text-sm text-black/55">
        Final price confirmed at a free site visit.
        {quote.minimumApplied && " Includes our minimum job charge."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat i={0} k="Labour" v={`${hrs(quote.hours)} hrs`} />
        <Stat i={1} k="Crew" v={`${quote.crew} painter${quote.crew > 1 ? "s" : ""}`} />
        <Stat i={2} k="On site" v={`${quote.days} day${quote.days > 1 ? "s" : ""}`} />
        <Stat i={3} k="Paint" v={`${quote.paintGallons + quote.primerGallons} gal`} />
      </div>

      {!unlocked ? (
        <form
          style={{ "--d": "460ms" } as React.CSSProperties}
          className="anim-fade-up mt-8 rounded-xl border border-black/10 bg-accent-50/50 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void submit();
          }}
        >
          <p className="font-semibold">See the full breakdown</p>
          <p className="mt-1 text-sm text-black/55">Line items, room by room, plus a copy by email. No spam.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={name} onChange={setName} autoComplete="name" />
            <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
          </div>
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-40"
          >
            {sending ? "Preparing your quote..." : "Show breakdown"}
          </button>
        </form>
      ) : (
        <div className="anim-fade-up mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 text-sm">
            <p className="text-black/70">
              Quote <span className="font-semibold text-black">{lead.quoteId}</span>
              {lead.emailed ? " · A copy is on its way to your inbox." : ""}
            </p>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="rounded-lg border border-black/15 px-4 py-2 font-medium hover:bg-black/5 disabled:opacity-50"
            >
              {downloading ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>
          <div>
            <p className="mb-2 font-semibold">Price breakdown</p>
            <table className="w-full text-sm">
              <tbody>
                {quote.lineItems.map((li) => (
                  <tr key={li.label} className="border-b border-black/5">
                    <td className="py-2 text-black/70">{li.label}</td>
                    <td className="py-2 text-right tabular-nums">{money2(li.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 font-semibold">Estimate</td>
                  <td className="pt-3 text-right font-semibold tabular-nums">{money2(quote.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-black/45">
              Range shown above is -10% / +15% of this estimate to cover what we can only see on site.
            </p>
          </div>

          <div>
            <p className="mb-2 font-semibold">Rooms</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead className="text-left text-xs text-black/45">
                  <tr>
                    <th className="py-1 font-medium">Room</th>
                    <th className="py-1 text-right font-medium">Walls</th>
                    <th className="py-1 text-right font-medium">Ceiling</th>
                    <th className="py-1 text-right font-medium">Trim</th>
                    <th className="py-1 text-right font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.rooms.map((r, i) => (
                    <tr key={i} className="border-t border-black/5">
                      <td className="py-2 capitalize">
                        {i + 1}. {ROOM_TYPES.find((t) => t.value === r.type)?.label}
                      </td>
                      <td className="py-2 text-right tabular-nums">{Math.round(r.wallSqft)} sq ft</td>
                      <td className="py-2 text-right tabular-nums">{Math.round(r.ceilingSqft)} sq ft</td>
                      <td className="py-2 text-right tabular-nums">{Math.round(r.trimLf)} ft</td>
                      <td className="py-2 text-right tabular-nums">{hrs(r.hours)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-black/5 text-black/50">
                    <td className="py-2" colSpan={4}>
                      Setup and clean-up
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {hrs(quote.hours - quote.rooms.reduce((t, r) => t + r.hours, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl bg-black/[0.03] p-4 text-sm text-black/65">
            <p className="font-semibold text-black/80">What&apos;s included</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Floor and furniture protection, masking and clean-up</li>
              <li>Filling small holes and light sanding</li>
              <li>{quote.primerGallons > 0 ? "Primer coat where needed, plus finish coats" : "Finish coats as selected"}</li>
              <li>Paint and materials supplied</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              title="Booking is not live in the demo"
              className="rounded-lg bg-accent-600 px-6 py-2.5 text-sm font-semibold text-white opacity-60"
            >
              Book free site visit (demo)
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-3 border-t border-black/5 pt-5">
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5">
          Change answers
        </button>
        <button type="button" onClick={onRestart} className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5">
          Start over
        </button>
      </div>
      <p className="mt-4 text-xs text-black/40">{quote.rateLabel}</p>
    </div>
  );
}

function Stat({ k, v, i = 0 }: { k: string; v: string; i?: number }) {
  return (
    <div style={{ "--d": `${180 + i * 70}ms` } as React.CSSProperties} className="anim-fade-up rounded-xl border border-black/5 bg-black/[0.02] p-3">
      <p className="text-xs text-black/45">{k}</p>
      <p className="mt-0.5 font-semibold">{v}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-black/60">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100"
      />
    </label>
  );
}

const SWATCHES = [
  { hex: "#E9E4DA", name: "Linen", code: "NP-014", r: -28 },
  { hex: "#D9B26F", name: "Ochre", code: "NP-097", r: -14 },
  { hex: "#C46A4A", name: "Terracotta", code: "NP-118", r: 0 },
  { hex: "#8FA3BF", name: "Morning Blue", code: "NP-305", r: 14 },
  { hex: "#2F3A4F", name: "Harbor Navy", code: "NP-221", r: 28 },
];

function VisualPanel({
  zip,
  rooms,
  picks,
  estimate,
}: {
  zip: string | null;
  rooms: number;
  picks: string[];
  estimate: string | null;
}) {
  return (
    <aside className="relative hidden h-[720px] self-start overflow-hidden rounded-[22px] bg-[#0c0c0e] xl:sticky xl:top-6 xl:block">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#C46A4A] opacity-25 blur-3xl" />
      <div aria-hidden className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-[#2F3A4F] opacity-60 blur-3xl" />

      <div aria-hidden className="absolute inset-x-0 top-0 h-[64%]">
        {SWATCHES.map((s, i) => (
          <div
            key={s.code}
            className="anim-fan absolute left-1/2 top-[13%] flex h-[250px] w-[88px] flex-col rounded-[10px] bg-white p-1.5 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.7)]"
            style={
              {
                transform: `translateX(-50%) rotate(${s.r}deg)`,
                transformOrigin: "50% 125%",
                "--r": `${s.r}deg`,
                "--d": `${300 + i * 90}ms`,
              } as React.CSSProperties
            }
          >
            <div className="flex-1 rounded-md" style={{ background: s.hex }} />
            <div className="px-0.5 pb-0.5 pt-2">
              <p className="truncate text-[10px] font-semibold text-zinc-900">{s.name}</p>
              <p className="text-[9px] text-zinc-400">{s.code}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-7 pb-7 pt-24 text-white">
        {estimate ? (
          <div key={estimate} className="anim-fade-up">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">Your estimate</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{estimate}</p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">Priced the way pros do</p>
            <p className="mt-2 text-lg font-medium leading-snug">
              Surface area, crew production rates and local labour costs. Not a guess per square foot.
            </p>
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-1.5">
          {zip && <Chip>{zip}</Chip>}
          <Chip>
            {rooms} room{rooms > 1 ? "s" : ""}
          </Chip>
          {picks.map((p) => (
            <Chip key={p}>{p}</Chip>
          ))}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-white/45">
          Final price is confirmed at a free site visit. Demo rates from public industry averages.
        </p>
      </div>
    </aside>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80">{children}</span>;
}

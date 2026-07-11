"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Visitor tool: report a barrier in YOUR community and leave with a
 * ready-to-send letter. The letter itself is never stored; the optional
 * "Add it to SPARC's list" step files a report the team can act on.
 * leaves via the visitor's own email app, clipboard, or printer.
 */

const BARRIER_GROUPS = [
  {
    group: "Getting there",
    items: [
      { id: "parking", label: "Parking", hint: "no accessible or van spaces, blocked access aisles, no curb ramp from the lot" },
      { id: "dropoff", label: "Drop-off or passenger loading", hint: "nowhere level or safe to get out of a vehicle" },
      { id: "path", label: "Sidewalk, path, or curb ramps", hint: "broken pavement, no curb cuts, obstacles, gravel, unshoveled snow or ice" },
      { id: "transit", label: "Bus stop or transit access", hint: "stop unreachable by wheelchair, no announcements, no shelter access" },
    ],
  },
  {
    group: "Getting in",
    items: [
      { id: "entrance", label: "Entrance or steps", hint: "steps with no ramp, accessible entrance locked or around back" },
      { id: "ramp", label: "Ramp problems", hint: "too steep, no handrails, no level landing, blocked" },
      { id: "door", label: "Doors", hint: "too heavy, no automatic opener, opener broken, doorway too narrow" },
    ],
  },
  {
    group: "Getting around inside",
    items: [
      { id: "aisles", label: "Aisles and circulation", hint: "too narrow for a wheelchair or walker, blocked by displays or clutter" },
      { id: "elevator", label: "Elevator or lift", hint: "none where needed, out of service, buttons unreachable, no braille" },
      { id: "stairs", label: "Stairs", hint: "no handrails, no visual contrast on edges, only route is stairs" },
      { id: "seating", label: "Seating and tables", hint: "no wheelchair seating, fixed booths only, no companion seating" },
    ],
  },
  {
    group: "Facilities",
    items: [
      { id: "restroom", label: "Restroom", hint: "stall too small, no grab bars, sink or dryer too high, accessible stall broken or used for storage" },
      { id: "counter", label: "Counter or checkout", hint: "counter too high, no lowered section, card reader unreachable" },
      { id: "fitting", label: "Fitting room or exam room", hint: "too small, no bench, no grab bars, equipment not adjustable" },
    ],
  },
  {
    group: "Information and communication",
    items: [
      { id: "signage", label: "Signs and wayfinding", hint: "no braille or raised letters, low contrast, missing or confusing" },
      { id: "hearing", label: "Hearing access", hint: "no interpreter, no captioning, no hearing loop, staff won't write things down" },
      { id: "vision", label: "Vision access", hint: "no large-print or braille menus, poor lighting, no audible signals" },
      { id: "digital", label: "Website, app, or kiosk", hint: "can't be used with a screen reader or keyboard, online-only services with no alternative" },
    ],
  },
  {
    group: "People and policies",
    items: [
      { id: "service_animal", label: "Service animal refused", hint: "turned away or challenged beyond the two questions the law allows" },
      { id: "staff", label: "Staff or policy problem", hint: "refused a reasonable accommodation, no assistance policy, told to come back with help" },
      { id: "sensory", label: "Sensory environment", hint: "overwhelming noise, flashing or harsh lighting, no quieter option" },
      { id: "temporary", label: "Temporary blockage", hint: "construction, displays, or parked items blocking the accessible route" },
    ],
  },
  {
    group: "",
    items: [{ id: "other", label: "Something else", hint: "" }],
  },
] as const;

type BarrierType = { id: string; label: string; hint: string };
const BARRIER_TYPES: BarrierType[] = BARRIER_GROUPS.flatMap((g) => [...g.items]);

type Place = { display_name: string; lat: string; lon: string };

export default function ReportPage() {
  // intake
  const [type, setType] = useState<string>("");
  const [desc, setDesc] = useState("");
  // place
  const [placeQuery, setPlaceQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [searching, setSearching] = useState(false);
  // recipient
  const [party, setParty] = useState("");
  const [partyEmail, setPartyEmail] = useState("");
  // letter
  const [tone, setTone] = useState<"collaborative" | "firm">("collaborative");
  const [letter, setLetter] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "add to SPARC's list" path
  const [repName, setRepName] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [filing, setFiling] = useState(false);
  const [filed, setFiled] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const letterRef = useRef<HTMLTextAreaElement>(null);

  const typeLabel = BARRIER_TYPES.find((t) => t.id === type)?.label ?? "";
  const placeText = place ? place.display_name : placeQuery.trim();
  const ready = desc.trim().length > 0;

  async function searchPlace() {
    if (!placeQuery.trim()) return;
    setSearching(true);
    setErr(null);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(placeQuery)}`,
        { headers: { Accept: "application/json" } }
      );
      const data = (await r.json()) as Place[];
      setResults(data);
      if (data.length === 0) setErr("No matches — try adding a city or zip code, or just describe the place in words.");
    } catch {
      setErr("Address search isn't available right now. Describing the place in words works just as well.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function templateLetter(): string {
    const what = desc.trim();
    const where = placeText ? ` at ${placeText}` : "";
    const kind = typeLabel ? ` (${typeLabel.toLowerCase()})` : "";
    if (tone === "firm") {
      return `To whom it may concern,

I am writing about an accessibility barrier${where} that prevents people with disabilities from using this place like everyone else${kind}.

${what}

The Americans with Disabilities Act requires public accommodations to be accessible. This barrier excludes people, and it is fixable. Please let me know, within 30 days, what you will do to remove it and on what timeline.

I look forward to your response.

Sincerely,
[Your name]`;
    }
    return `Hello,

I'm reaching out about an accessibility barrier${where} that I hope you can help fix${kind}.

${what}

Barriers like this keep people with disabilities from taking part in everyday life, and the Americans with Disabilities Act asks places that serve the public to be accessible to everyone. I'd love to know if a fix is possible and what the timeline might look like — I'm happy to share more detail if that helps.

Thank you for your time,
[Your name]`;
  }

  async function aiDraft() {
    setDrafting(true);
    setErr(null);
    try {
      const assistBase =
        typeof window !== "undefined" && window.location.hostname.endsWith("netlify.app")
          ? ""
          : "https://stepstowardaccess.netlify.app";
      const r = await fetch(`${assistBase}/ART/api/letter-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barrier: desc.trim(),
          place: placeText || undefined,
          party: party.trim() || undefined,
          tone,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.draft) throw new Error(data.error || "Drafting failed");
      setLetter(data.draft + "\n\nSincerely,\n[Your name]");
      letterRef.current?.focus();
    } catch (e) {
      setErr(
        (e instanceof Error ? e.message : "Drafting failed") +
          " — the template below still works."
      );
      setLetter(templateLetter());
    } finally {
      setDrafting(false);
    }
  }

  async function fileWithSparc() {
    if (website) return; // honeypot tripped: silently drop
    setFiling(true); setFileErr(null);
    const { error } = await supabase.from("access_public_reports").insert({
      barrier_type: type || null,
      barrier_desc: desc.trim(),
      place_desc: placeText || null,
      lat: place ? parseFloat(place.lat) : null,
      lon: place ? parseFloat(place.lon) : null,
      party_guess: party.trim() || null,
      reporter_name: repName.trim() || null,
      reporter_email: repEmail.trim() || null,
    });
    setFiling(false);
    if (error) setFileErr("That didn't go through — please try again in a moment.");
    else setFiled(true);
  }

  const subject = `Accessibility barrier${placeText ? ` at ${placeText.split(",")[0]}` : ""} — request for a fix`;
  const mailto = `mailto:${encodeURIComponent(partyEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;

  async function copyLetter() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${letter}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6 print:hidden">
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">← Accessibility in Real Time</Link>
      </p>

      <div className="print:hidden">
        <h1 className="font-display text-4xl font-bold text-pine">Report a barrier in your community</h1>
        <p className="mt-3 max-w-prose text-lg">
          Tell us what&rsquo;s in the way. Add it to SPARC&rsquo;s list so the Agents of
          Change team can take it up — or write the letter yourself, or both.
          Only what you choose to send to SPARC is saved; the letter tool
          stores nothing.
        </p>

        {/* 1 — the barrier */}
        <section aria-labelledby="s1" className="mt-10 max-w-prose">
          <h2 id="s1" className="font-display text-2xl font-semibold text-pine">1. What kind of barrier is it?</h2>
          <fieldset className="mt-4">
            <legend className="sr-only">Barrier type</legend>
            {BARRIER_GROUPS.map((g) => (
            <div key={g.group || "other"} className="mt-4 first:mt-0">
              {g.group && <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-moss">{g.group}</h3>}
              <div className="grid gap-2 sm:grid-cols-2">
              {g.items.map((t) => (
                <label
                  key={t.id}
                  className={`cursor-pointer rounded-xl border-2 p-3 ${type === t.id ? "border-fern bg-fern/10" : "border-moss/30 bg-paper hover:border-moss"}`}
                >
                  <input
                    type="radio"
                    name="btype"
                    value={t.id}
                    checked={type === t.id}
                    onChange={() => setType(t.id)}
                    className="mr-2"
                  />
                  <span className="font-bold">{t.label}</span>
                  {t.hint && <span className="mt-0.5 block pl-6 text-sm text-moss">{t.hint}</span>}
                </label>
              ))}
              </div>
            </div>
            ))}
          </fieldset>

          <label htmlFor="desc" className="mt-6 block font-bold">
            Describe it in your own words
          </label>
          <p className="mt-1 text-sm text-moss">What&rsquo;s there, and what does it stop you (or someone else) from doing?</p>
          <textarea
            id="desc"
            rows={5}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3"
          />
        </section>

        {/* 2 — where */}
        <section aria-labelledby="s2" className="mt-10 max-w-prose">
          <h2 id="s2" className="font-display text-2xl font-semibold text-pine">2. Where is it?</h2>
          <label htmlFor="place" className="mt-4 block font-bold">Search for the address or place</label>
          <div className="mt-2 flex gap-2">
            <input
              id="place"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } }}
              placeholder="e.g., 123 Main St, Leesburg VA — or a business name and town"
              className="w-full rounded-lg border border-moss/50 bg-paper px-4 py-3"
            />
            <button
              type="button"
              onClick={searchPlace}
              disabled={searching}
              className="shrink-0 rounded-lg bg-fern px-5 py-3 font-semibold text-white hover:bg-pine disabled:opacity-60"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="mt-2 text-sm text-moss">Search is optional — you can also just describe the place in your letter.</p>

          {results && results.length > 0 && (
            <fieldset className="mt-4 rounded-xl border border-moss/30 bg-paper p-4">
              <legend className="px-1 font-bold">Which one is it?</legend>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <label key={i} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="placepick"
                      className="mt-1"
                      checked={place?.display_name === r.display_name}
                      onChange={() => setPlace(r)}
                    />
                    <span>{r.display_name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {place && (
            <p role="status" className="mt-3 rounded-lg bg-fern/10 p-3 text-sm">
              Selected: <strong>{place.display_name}</strong>
            </p>
          )}
        </section>

        {/* 3 — who */}
        <section aria-labelledby="s3" className="mt-10 max-w-prose">
          <h2 id="s3" className="font-display text-2xl font-semibold text-pine">3. Who should hear about it?</h2>
          <p className="mt-2 text-sm text-moss">Both optional — a letter &ldquo;to whom it may concern&rdquo; still counts.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="party" className="block font-bold">Business or organization</label>
              <input id="party" value={party} onChange={(e) => setParty(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
            </div>
            <div>
              <label htmlFor="pemail" className="block font-bold">Their email, if you know it</label>
              <input id="pemail" type="email" value={partyEmail} onChange={(e) => setPartyEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
            </div>
          </div>
        </section>

        {/* 4 — add to SPARC's list */}
        <section aria-labelledby="s4" className="mt-10 max-w-prose">
          <h2 id="s4" className="font-display text-2xl font-semibold text-pine">4. Add it to SPARC&rsquo;s list</h2>
          {filed ? (
            <p role="status" className="mt-3 rounded-lg bg-fern/10 p-4">
              <strong>It&rsquo;s on the list.</strong> The Agents of Change team reviews
              every report and decides where to take action. Thank you for
              speaking up{repName ? `, ${repName.split(" ")[0]}` : ""}.
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-prose">
                Send this report to SPARC&rsquo;s Agents of Change team — self-advocates
                who document barriers and write to the people responsible. Your
                contact details are optional and only used to follow up.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rname" className="block font-bold">Your name <span className="font-normal text-moss">(optional)</span></label>
                  <input id="rname" value={repName} onChange={(e) => setRepName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
                </div>
                <div>
                  <label htmlFor="remail" className="block font-bold">Your email <span className="font-normal text-moss">(optional)</span></label>
                  <input id="remail" type="email" value={repEmail} onChange={(e) => setRepEmail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
                </div>
              </div>
              <div aria-hidden="true" className="absolute left-[-9999px]">
                <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
              </div>
              {fileErr && <p role="alert" className="mt-3 rounded-lg bg-s_documented/10 p-3 text-sm font-semibold text-s_documented">{fileErr}</p>}
              <p className="mt-3 text-sm text-moss">
                Your report may appear on our public community board — your
                name and email are never shown, only the barrier itself.
              </p>
              <button type="button" disabled={!ready || filing} onClick={fileWithSparc}
                className="mt-4 rounded-lg bg-pine px-6 py-3 font-semibold text-white hover:bg-fern disabled:opacity-50">
                {filing ? "Sending…" : "Send it to the team"}
              </button>
              {!ready && <p className="mt-2 text-sm text-moss">Describe the barrier in step 1 first.</p>}
            </>
          )}
        </section>

        {/* 5 — the letter */}
        <section aria-labelledby="s5" className="mt-10 max-w-prose">
          <h2 id="s5" className="font-display text-2xl font-semibold text-pine">5. Or write the letter yourself</h2>

          <fieldset className="mt-4">
            <legend className="font-bold">How should it sound?</legend>
            <div className="mt-2 flex gap-3">
              {(["collaborative", "firm"] as const).map((t) => (
                <label key={t} className={`cursor-pointer rounded-full border-2 px-4 py-2 font-semibold ${tone === t ? "border-fern bg-fern/10 text-pine" : "border-moss/40 text-moss"}`}>
                  <input type="radio" name="tone" className="sr-only" checked={tone === t} onChange={() => setTone(t)} />
                  {t === "collaborative" ? "Constructive" : "Firm"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={!ready} onClick={() => { setLetter(templateLetter()); letterRef.current?.focus(); }}
              className="rounded-lg border-2 border-fern px-5 py-2.5 font-semibold text-fern hover:bg-fern/10 disabled:opacity-50">
              Use a template
            </button>
            <button type="button" disabled={!ready || drafting} onClick={aiDraft}
              className="rounded-lg bg-fern px-5 py-2.5 font-semibold text-white hover:bg-pine disabled:opacity-50">
              {drafting ? "Writing…" : "Help me say this"}
            </button>
          </div>
          {!ready && <p className="mt-2 text-sm text-moss">Describe the barrier in step 1 first.</p>}
          {err && <p role="alert" className="mt-3 rounded-lg bg-s_documented/10 p-3 text-sm font-semibold text-s_documented">{err}</p>}

          {letter && (
            <>
              <label htmlFor="letter" className="mt-6 block font-bold">
                Read it, make it yours, then send it
              </label>
              <textarea
                id="letter"
                ref={letterRef}
                rows={14}
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3 font-body leading-relaxed"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={mailto}
                  className={`rounded-lg px-5 py-2.5 font-semibold ${letter ? "bg-fern text-white hover:bg-pine" : "pointer-events-none bg-moss/30 text-white"}`}
                >
                  Open in my email{partyEmail ? "" : " (add the address there)"}
                </a>
                <button type="button" onClick={copyLetter}
                  className="rounded-lg border-2 border-fern px-5 py-2.5 font-semibold text-fern hover:bg-fern/10">
                  {copied ? "Copied ✓" : "Copy the letter"}
                </button>
                <button type="button" onClick={() => window.print()}
                  className="rounded-lg border-2 border-fern px-5 py-2.5 font-semibold text-fern hover:bg-fern/10">
                  Print it
                </button>
              </div>
              <p aria-live="polite" className="sr-only">{copied ? "Letter copied to clipboard" : ""}</p>
            </>
          )}
        </section>
      </div>

      {/* print-only formatted letter */}
      <div className="hidden print:block">
        <p className="mb-8">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        {party && <p className="mb-8 font-bold">{party}</p>}
        <p className="mb-4 font-bold">Re: {subject}</p>
        <div className="whitespace-pre-wrap leading-relaxed">{letter}</div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState } from "react";

/**
 * Visitor tool: report a barrier in YOUR community and leave with a
 * ready-to-send letter. Nothing typed here is stored anywhere — the letter
 * leaves via the visitor's own email app, clipboard, or printer.
 */

const BARRIER_TYPES = [
  { id: "entrance", label: "Entrance or door", hint: "steps with no ramp, heavy doors, no automatic opener" },
  { id: "path", label: "Path or sidewalk", hint: "broken pavement, no curb cuts, blocked routes" },
  { id: "parking", label: "Parking", hint: "no accessible spaces, blocked access aisles" },
  { id: "restroom", label: "Restroom", hint: "too small, no grab bars, out of service" },
  { id: "counter", label: "Counter or service area", hint: "too high, no lowered section" },
  { id: "signage", label: "Signs or information", hint: "no braille, hard to read, missing" },
  { id: "digital", label: "Website or kiosk", hint: "can't be used with a screen reader or keyboard" },
  { id: "other", label: "Something else", hint: "" },
] as const;

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
      const r = await fetch("/accessibility/api/letter-assist", {
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
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">← Steps Toward Access</Link>
      </p>

      <div className="print:hidden">
        <h1 className="font-display text-4xl font-bold text-pine">Report a barrier in your community</h1>
        <p className="mt-3 max-w-prose text-lg">
          Tell us what&rsquo;s in the way, and leave with a ready-to-send letter.
          Nothing you type here is saved or sent anywhere by us — the letter is
          yours, and it goes out from your own email.
        </p>

        {/* 1 — the barrier */}
        <section aria-labelledby="s1" className="mt-10 max-w-prose">
          <h2 id="s1" className="font-display text-2xl font-semibold text-pine">1. What kind of barrier is it?</h2>
          <fieldset className="mt-4">
            <legend className="sr-only">Barrier type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BARRIER_TYPES.map((t) => (
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

        {/* 4 — the letter */}
        <section aria-labelledby="s4" className="mt-10 max-w-prose">
          <h2 id="s4" className="font-display text-2xl font-semibold text-pine">4. Your letter</h2>

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

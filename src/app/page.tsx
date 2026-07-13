"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RtcMap } from "@/components/RtcMap";
import { StatusBadge } from "@/components/StatusBadge";
import { uploadReportPhoto, reportPhotoUrl } from "@/lib/images";
import { RTC_BOX } from "@/lib/geo";

/** ONE page: the map of documented barriers, a form to add what you found,
 *  and everything the community has reported — for staff and public alike. */

type Barrier = {
  id: string; label: string; status: string; summary: string | null;
  lat: number | null; lon: number | null; x: number | null; y: number | null;
};
type Report = {
  id: string; barrier_type: string | null; barrier_desc: string;
  place_desc: string | null; lat: number | null; lon: number | null;
  status: string; created_at: string;
  still_there_count: number; gone_count: number;
  photo_paths: string[] | null;
  linked_location_id: string | null;
};
type Geo = { display_name: string; lat: string; lon: string };
type Pending = { file: File; preview: string };

const TYPES = [
  ["parking","Parking"],["path","Sidewalk / curb ramps"],["entrance","Entrance / steps"],
  ["ramp","Ramp"],["door","Doors"],["elevator","Elevator / lift"],["restroom","Restroom"],
  ["counter","Counter / checkout"],["seating","Seating"],["signage","Signs / braille"],
  ["hearing","Hearing access"],["vision","Vision access"],["digital","Website / kiosk"],
  ["service_animal","Service animal refused"],["staff","Staff / policy"],
  ["sensory","Sensory environment"],["temporary","Temporary blockage"],["other","Something else"],
] as const;
const TYPE_LABEL = Object.fromEntries(TYPES);
const REPORT_STATUS: Record<string,string> = { new:"Reported", taken_up:"Taken up by the team", handled:"Handled" };

export default function OnePage() {
  const [barriers, setBarriers] = useState<Barrier[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [stats, setStats] = useState<{ documented_barriers: number; community_reports: number } | null>(null);
  const [spot, setSpot] = useState<{ lat: number; lon: number } | null>(null);
  // form
  const [type, setType] = useState(""); const [desc, setDesc] = useState("");
  const [place, setPlace] = useState(""); const [name, setName] = useState("");
  const [email, setEmail] = useState(""); const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false); const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // address / place-name search
  const [geoResults, setGeoResults] = useState<Geo[] | null>(null);
  const [geoSearching, setGeoSearching] = useState(false);
  // photos to attach (uploaded on submit)
  const [photos, setPhotos] = useState<Pending[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadReports() {
    const { data } = await supabase
      .from("access_community_board")
      .select("id, barrier_type, barrier_desc, place_desc, lat, lon, status, created_at, still_there_count, gone_count, photo_paths, linked_location_id")
      .order("created_at", { ascending: false }).limit(100);
    setReports((data as Report[]) ?? []);
  }

  // Look up an address or business/place name and drop a pin on it.
  async function searchPlace() {
    const q = place.trim();
    if (!q) return;
    setGeoSearching(true); setErr(null);
    try {
      const box = `${RTC_BOX.west},${RTC_BOX.north},${RTC_BOX.east},${RTC_BOX.south}`;
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&viewbox=${box}&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      const data = (await r.json()) as Geo[];
      setGeoResults(data);
      if (data.length === 0) setErr("No matches — you can still type the place in the box above and post it as-is.");
    } catch {
      setErr("Address lookup isn't available right now — typing the place in the box works too.");
      setGeoResults(null);
    } finally {
      setGeoSearching(false);
    }
  }

  function pickGeo(g: Geo) {
    setPlace(g.display_name);
    setSpot({ lat: parseFloat(g.lat), lon: parseFloat(g.lon) });
    setGeoResults(null);
    setSent(false);
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos((ps) => [...ps, ...next]);
  }
  function removePhoto(i: number) {
    setPhotos((ps) => {
      const target = ps[i];
      if (target) URL.revokeObjectURL(target.preview);
      return ps.filter((_, j) => j !== i);
    });
  }
  useEffect(() => {
    supabase.from("access_public_stats").select("*").maybeSingle()
      .then(({ data }) => setStats(data as { documented_barriers: number; community_reports: number } | null));
    supabase.from("access_locations")
      .select("id, label, status, summary, lat, lon, x, y")
      .eq("published", true).order("updated_at", { ascending: false })
      .then(({ data }) => setBarriers((data as Barrier[]) ?? []));
    loadReports();
  }, []);

  const [checked, setChecked] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("art-checks") ?? "{}"); } catch { return {}; }
  });
  async function check(r: Report, verdict: "still_there" | "gone") {
    if (checked[r.id]) return;
    const next = { ...checked, [r.id]: verdict };
    setChecked(next);
    localStorage.setItem("art-checks", JSON.stringify(next));
    await supabase.from("access_barrier_checks").insert({ report_id: r.id, verdict });
    loadReports();
  }

  async function submit() {
    if (website) return; // honeypot
    if (desc.trim().length < 10) { setErr("Tell us a little more — at least a sentence."); return; }
    setSending(true); setErr(null);

    // Upload any attached photos first (public bucket, no login needed).
    let photoPaths: string[] = [];
    try {
      photoPaths = await Promise.all(photos.map((p) => uploadReportPhoto(supabase, p.file)));
    } catch {
      setSending(false);
      setErr("A photo didn't upload — remove it and try again, or post without it.");
      return;
    }

    const { error } = await supabase.from("access_public_reports").insert({
      barrier_type: type || null,
      barrier_desc: desc.trim(),
      place_desc: place.trim() || null,
      lat: spot?.lat ?? null,
      lon: spot?.lon ?? null,
      reporter_name: name.trim() || null,
      reporter_email: email.trim() || null,
      photo_paths: photoPaths.length ? photoPaths : null,
    });
    setSending(false);
    if (error) { setErr("That didn't go through — try again in a moment."); return; }
    setSent(true); setType(""); setDesc(""); setPlace(""); setSpot(null);
    setGeoResults(null);
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadReports();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-moss/15 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="https://sparcsolutions.org" className="shrink-0"><img src="/ART/SPARC_logo.png" alt="SPARC home" className="h-9 w-auto" /></a>
            <span aria-hidden="true" className="hidden h-8 w-px bg-moss/25 sm:block" />
            <p className="font-display text-lg font-bold leading-tight text-fern">
              Accessibility in Real Time
              <span className="ml-2 hidden font-body text-sm font-normal text-moss sm:inline">Reston Town Center</span>
            </p>
          </div>
          <nav aria-label="More">
            <ul className="flex items-center gap-2 text-sm font-semibold sm:gap-4">
              <li><Link href="#partner" className="rounded-lg px-2 py-1 text-pine underline-offset-4 hover:underline">Partner with us</Link></li>
              <li><Link href="/report" className="rounded-lg px-2 py-1 text-pine underline-offset-4 hover:underline">Write a letter</Link></li>
              <li><Link href="/console" className="rounded-lg border border-moss/30 px-3 py-1.5 text-moss transition-colors hover:border-fern hover:text-fern">Team console</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:pt-14">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-moss/15 bg-gradient-to-br from-pine to-fern px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-kelly/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-prose">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white ring-1 ring-white/25">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-kelly" />
              SPARC Agents of Change
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-[2.7rem] sm:leading-[1.1]">
              Making Reston Town Center more accessible, together.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/90">
              Accessibility in Real Time began with three of SPARC&rsquo;s Agents of Change
              — Katherine, Numi, and Jonah — who spend time at Reston Town Center. We note
              the accessibility barriers we find and work with the businesses, property
              teams, and neighbors here to fix them.
            </p>
          </div>
          {/* stat pills */}
          <dl className="relative mt-8 flex flex-wrap gap-3" aria-live="polite">
            {stats ? (
              <>
                <div className="rounded-2xl bg-white/[0.12] px-5 py-3 ring-1 ring-white/20 backdrop-blur-sm">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/80">Spotted in all</dt>
                  <dd className="font-display text-2xl font-bold">{stats.documented_barriers + stats.community_reports}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.12] px-5 py-3 ring-1 ring-white/20 backdrop-blur-sm">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/80">Noted by our team</dt>
                  <dd className="font-display text-2xl font-bold">{stats.documented_barriers}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.12] px-5 py-3 ring-1 ring-white/20 backdrop-blur-sm">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-white/80">Shared by community</dt>
                  <dd className="font-display text-2xl font-bold">{stats.community_reports}</dd>
                </div>
              </>
            ) : (
              <div className="h-[70px]" />
            )}
          </dl>
        </section>

        <p className="sr-only" aria-live="polite">
          {stats
            ? `${stats.documented_barriers + stats.community_reports} accessibility barriers noted at Reston Town Center — ${stats.documented_barriers} by our team, ${stats.community_reports} by the community.`
            : "\u00A0"}
        </p>

        {/* AN INVITATION, NOT A REPORT CARD */}
        <section aria-labelledby="together-h" className="mt-8 overflow-hidden rounded-2xl border border-fern/25 bg-fern/[0.06] p-6 sm:p-7">
          <h2 id="together-h" className="flex items-center gap-2 font-display text-xl font-semibold text-pine">
            <span aria-hidden="true" className="inline-block h-5 w-1 rounded-full bg-kelly" />
            An invitation, not a report card
          </h2>
          <p className="mt-3 leading-relaxed">
            We share what we notice so we can work on it <em>with</em> Reston Town
            Center. Each note below is a starting point for a fix, not a callout. If
            you help run, own, or serve this community, we&rsquo;d like to hear from you.
          </p>
          <p className="mt-4">
            <Link href="#partner" className="font-semibold text-fern underline underline-offset-4 hover:text-pine">
              Partner with us →
            </Link>
          </p>
        </section>

        {/* THE MAP */}
        {barriers === null ? (
          <p role="status" className="mt-8 text-moss">Loading the map…</p>
        ) : (
          <RtcMap
            barriers={barriers}
            snapToAddress
            onPlacePick={(pl) => {
              setPlace(pl.addr ? `${pl.name}, ${pl.addr}` : pl.name);
              setSpot({ lat: pl.lat, lon: pl.lon });
              setGeoResults(null);
              setSent(false);
              document.getElementById("add")?.scrollIntoView({ behavior: "smooth", block: "start" });
              setTimeout(() => document.getElementById("bdesc")?.focus(), 450);
            }}
            reports={(reports ?? []).map((r) => ({
              id: r.id,
              snippet: (r.place_desc || r.barrier_desc).slice(0, 60),
              lat: r.lat, lon: r.lon,
            }))}
          />
        )}
        {barriers && barriers.length > 0 && (
          <ul className="mt-6 space-y-3">
            {barriers.map((b, i) => (
              <li key={b.id} className="card p-4 transition-shadow hover:shadow-md sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-pine font-display text-sm font-bold text-white ring-2 ring-pine/10">{i + 1}</span>
                  <StatusBadge status={b.status} />
                  <h2 className="font-display text-lg font-semibold text-pine">
                    <Link href={`/barrier?id=${b.id}`} className="hover:underline">{b.label}</Link>
                  </h2>
                </div>
                {b.summary && <p className="mt-2 line-clamp-2 max-w-prose text-sm text-ink/90">{b.summary}</p>}
              </li>
            ))}
          </ul>
        )}

        {/* SUBMIT */}
        <section aria-labelledby="add-h" className="mt-16 scroll-mt-20" id="add">
          <h2 id="add-h" className="font-display text-2xl font-semibold text-pine sm:text-3xl">Noticed something that could work better? Share it.</h2>
          <p className="mt-3 leading-relaxed">
            Anyone can add a note — the SPARC team and community alike. It appears
            below right away as something to work on together, and it&rsquo;s a
            starting point for a conversation, not a complaint on file. Your name
            and email are optional and never shown.
          </p>
          {place && spot && (
            <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-fern/20 bg-fern/10 px-4 py-3 text-sm font-semibold text-pine">
              <span aria-hidden="true" className="text-base">📍</span>
              Reporting at: {place}
            </p>
          )}
          {sent && (
            <p role="status" className="mt-4 rounded-xl border border-kelly/30 bg-kelly/10 p-4">
              <strong>Thank you.</strong> It&rsquo;s on the board below.
            </p>
          )}
          <div className="card mt-5 space-y-5 p-6 sm:p-7">
            <div>
              <label htmlFor="btype" className="block font-bold text-pine">What did you notice?</label>
              <select id="btype" value={type} onChange={(e) => setType(e.target.value)}
                className="field mt-2">
                <option value="">Choose one (optional)</option>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bdesc" className="block font-bold text-pine">What&rsquo;s in the way? <span aria-hidden="true" className="text-s_documented">*</span></label>
              <textarea id="bdesc" rows={4} required value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Say it the way you'd tell a friend."
                className="field mt-2" />
            </div>
            <div>
              <label htmlFor="bplace" className="block font-bold text-pine">Where is it?</label>
              <p className="mt-1 text-sm text-moss">Type an address or place name and tap Find to drop a pin — or hover the map above and click an address.</p>
              <div className="mt-2 flex gap-2">
                <input id="bplace" value={place}
                  onChange={(e) => { setPlace(e.target.value); setSpot(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } }}
                  placeholder="Business name, address, or landmark"
                  className="field" />
                <button type="button" onClick={searchPlace} disabled={geoSearching || !place.trim()}
                  className="btn btn-outline shrink-0 px-5 py-3">
                  {geoSearching ? "Finding…" : "Find"}
                </button>
              </div>
              {geoResults && geoResults.length > 0 && (
                <fieldset className="mt-3 rounded-xl border border-moss/25 bg-mist/60 p-4">
                  <legend className="px-1 text-sm font-bold text-pine">Which one is it?</legend>
                  <div className="space-y-2">
                    {geoResults.map((g, i) => (
                      <label key={i} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input type="radio" name="geopick" className="mt-1"
                          checked={spot?.lat === parseFloat(g.lat) && spot?.lon === parseFloat(g.lon)}
                          onChange={() => pickGeo(g)} />
                        <span>{g.display_name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {spot && place && (
                <p role="status" className="mt-2 text-sm font-semibold text-s_resolved">Pin dropped ✓</p>
              )}
            </div>

            <div>
              <label htmlFor="bphotos" className="block font-bold text-pine">Add a photo <span className="font-normal text-moss">(optional)</span></label>
              <p className="mt-1 text-sm text-moss">Show the barrier — snap one with your phone or upload from your device. Location data is stripped automatically.</p>
              <label htmlFor="bphotos" className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-moss/40 bg-mist/50 px-5 py-3 font-semibold text-fern transition-colors hover:border-fern hover:bg-fern/5">
                + Add photos
                <input id="bphotos" ref={fileInputRef} type="file" accept="image/*" multiple
                  className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
              {photos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {photos.map((p, i) => (
                    <li key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt={`Selected photo ${i + 1}`} className="h-24 w-24 rounded-lg border border-moss/30 object-cover" />
                      <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-moss/40 bg-paper font-bold text-moss shadow hover:text-s_documented">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bname" className="block font-bold text-pine">Your name <span className="font-normal text-moss">(optional, never shown)</span></label>
                <input id="bname" value={name} onChange={(e) => setName(e.target.value)}
                  className="field mt-2" />
              </div>
              <div>
                <label htmlFor="bemail" className="block font-bold text-pine">Your email <span className="font-normal text-moss">(optional, never shown)</span></label>
                <input id="bemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="field mt-2" />
              </div>
            </div>
            <div aria-hidden="true" className="absolute left-[-9999px]">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>
            {err && <p role="alert" className="rounded-xl border border-s_documented/20 bg-s_documented/10 p-3 font-semibold text-s_documented">{err}</p>}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button type="button" disabled={sending} onClick={submit}
                className="btn btn-primary">
                {sending ? "Sharing…" : "Share it"}
              </button>
              <p className="text-base text-pine">
                Want to send a letter too? <Link href="/report" className="font-semibold text-fern underline underline-offset-4 hover:text-pine">We&rsquo;ll help you write one.</Link>
              </p>
            </div>
          </div>
        </section>

        {/* THE BOARD */}
        <section aria-labelledby="board-h" className="mt-16">
          <h2 id="board-h" className="font-display text-2xl font-semibold text-pine sm:text-3xl">What the community has noticed</h2>
          {reports === null ? (
            <p role="status" className="mt-4 text-moss">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="mt-4 max-w-prose text-moss">Nothing yet — yours can be the first.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {reports.map((r) => (
                <li key={r.id} id={`report-${r.id}`} tabIndex={-1} className="card p-5 scroll-mt-20 transition-shadow hover:shadow-md focus:outline-3 focus:outline-fern sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {r.barrier_type && (
                      <span className="rounded-full bg-fern/15 px-3 py-0.5 text-sm font-bold text-pine">
                        {TYPE_LABEL[r.barrier_type] ?? r.barrier_type}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-moss">{REPORT_STATUS[r.status] ?? "Reported"}</span>
                    <span className="font-mono text-xs text-moss">
                      {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-3 max-w-prose whitespace-pre-wrap leading-relaxed">{r.barrier_desc}</p>
                  {r.place_desc && <p className="mt-2 flex items-center gap-1.5 text-sm text-moss"><span aria-hidden="true">📍</span>{r.place_desc}</p>}
                  {r.photo_paths && r.photo_paths.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-3">
                      {r.photo_paths.map((path, i) => (
                        <li key={i}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reportPhotoUrl(supabase, path)} alt={`Photo of the reported barrier${r.place_desc ? ` at ${r.place_desc}` : ""}`}
                            className="h-32 w-32 rounded-xl border border-moss/20 object-cover" />
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.linked_location_id && (
                    <p className="mt-3">
                      <Link href={`/barrier?id=${r.linked_location_id}`}
                        className="inline-flex items-center gap-1 font-semibold text-fern underline underline-offset-4">
                        See the team&rsquo;s progress on this barrier →
                      </Link>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Is this barrier still there?">
                    <span className="text-sm font-bold">Still there?</span>
                    <button type="button" disabled={!!checked[r.id]} onClick={() => check(r, "still_there")}
                      aria-pressed={checked[r.id] === "still_there"}
                      className="rounded-full border-2 border-s_awaiting px-3 py-1 text-sm font-semibold text-s_awaiting hover:bg-s_awaiting/10 disabled:opacity-60">
                      Yes, still there ({r.still_there_count})
                    </button>
                    <button type="button" disabled={!!checked[r.id]} onClick={() => check(r, "gone")}
                      aria-pressed={checked[r.id] === "gone"}
                      className="rounded-full border-2 border-s_resolved px-3 py-1 text-sm font-semibold text-s_resolved hover:bg-s_resolved/10 disabled:opacity-60">
                      No, it&rsquo;s gone ({r.gone_count})
                    </button>
                    {checked[r.id] && <span className="text-sm text-moss">Thanks — counted.</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* PARTNER WITH US */}
        <section aria-labelledby="partner-h" id="partner" className="relative mt-16 scroll-mt-20 overflow-hidden rounded-3xl border border-pine/15 bg-gradient-to-br from-pine to-fern p-7 text-white shadow-sm sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-kelly/25 blur-3xl" />
          <h2 id="partner-h" className="relative font-display text-2xl font-semibold sm:text-3xl">Partner with us</h2>
          <p className="relative mt-3 leading-relaxed text-white/90">
            Property managers, businesses, and county partners: whether you&rsquo;d like
            to weigh in on something you see here or team up on a change, we&rsquo;d like
            to hear from you. No barrier report required.
          </p>
          <Link href="/partner"
            className="btn relative mt-5 bg-white text-pine shadow-sm hover:bg-kelly hover:text-white">
            Partner with us
          </Link>
        </section>
      </main>

    </>
  );
}

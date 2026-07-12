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
      .select("id, barrier_type, barrier_desc, place_desc, lat, lon, status, created_at, still_there_count, gone_count, photo_paths")
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
      <header className="border-b border-moss/30 bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="https://sparcsolutions.org"><img src="/ART/SPARC_logo.png" alt="SPARC home" className="h-10 w-auto" /></a>
            <p className="font-display text-lg font-bold text-fern">
              Accessibility in Real Time
              <span className="ml-2 hidden font-body text-sm font-normal text-moss sm:inline">Reston Town Center</span>
            </p>
          </div>
          <nav aria-label="More">
            <ul className="flex gap-5 text-sm font-semibold">
              <li><Link href="/report" className="text-pine underline-offset-4 hover:underline">Write a letter</Link></li>
              <li><Link href="/console" className="text-moss underline-offset-4 hover:underline">Team console</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="max-w-prose font-display text-3xl font-bold leading-tight text-pine sm:text-4xl">
          The barriers in Reston Town Center — and the steps taken to fix them.
        </h1>
        <p className="mt-3 font-display text-lg font-semibold text-pine" aria-live="polite">
          {stats
            ? `${stats.documented_barriers + stats.community_reports} barriers identified so far — ${stats.documented_barriers} documented by the team, ${stats.community_reports} reported by the community.`
            : "\u00A0"}
        </p>

        {/* THE MAP */}
        {barriers === null ? (
          <p role="status" className="mt-8 text-moss">Loading the map…</p>
        ) : (
          <RtcMap
            barriers={barriers}
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
              <li key={b.id} className="rounded-xl border border-moss/30 bg-paper p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-pine font-display text-sm font-bold text-white">{i + 1}</span>
                  <StatusBadge status={b.status} />
                  <h2 className="font-display text-lg font-semibold text-pine">
                    <Link href={`/barrier?id=${b.id}`} className="hover:underline">{b.label}</Link>
                  </h2>
                </div>
                {b.summary && <p className="mt-2 line-clamp-2 max-w-prose text-sm">{b.summary}</p>}
              </li>
            ))}
          </ul>
        )}

        {/* SUBMIT */}
        <section aria-labelledby="add-h" className="mt-14 max-w-prose scroll-mt-6" id="add">
          <h2 id="add-h" className="font-display text-2xl font-semibold text-pine">Found a barrier? Add it.</h2>
          {place && spot && (
            <p role="status" className="mt-2 rounded-lg bg-fern/10 px-3 py-2 text-sm font-semibold text-pine">
              Reporting at: {place}
            </p>
          )}
          <p className="mt-2">
            Anyone can post — SPARC team and community alike. It appears below
            right away. Your name and email are optional and never shown.
          </p>
          {sent && (
            <p role="status" className="mt-4 rounded-lg bg-fern/10 p-4">
              <strong>Posted.</strong> It&rsquo;s on the board below. Thank you for speaking up.
            </p>
          )}
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="btype" className="block font-bold">What kind of barrier?</label>
              <select id="btype" value={type} onChange={(e) => setType(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3">
                <option value="">Choose one (optional)</option>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bdesc" className="block font-bold">What&rsquo;s in the way? <span aria-hidden="true" className="text-s_documented">*</span></label>
              <textarea id="bdesc" rows={4} required value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Say it the way you'd tell a friend."
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
            </div>
            <div>
              <label htmlFor="bplace" className="block font-bold">Where is it?</label>
              <p className="mt-1 text-sm text-moss">Type an address or place name and tap Find to drop a pin — or click the spot on the map above.</p>
              <div className="mt-2 flex gap-2">
                <input id="bplace" value={place}
                  onChange={(e) => { setPlace(e.target.value); setSpot(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } }}
                  placeholder="Business name, address, or landmark"
                  className="w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
                <button type="button" onClick={searchPlace} disabled={geoSearching || !place.trim()}
                  className="shrink-0 rounded-lg border-2 border-fern px-5 py-3 font-semibold text-fern hover:bg-fern/10 disabled:opacity-50">
                  {geoSearching ? "Finding…" : "Find"}
                </button>
              </div>
              {geoResults && geoResults.length > 0 && (
                <fieldset className="mt-3 rounded-xl border border-moss/30 bg-paper p-4">
                  <legend className="px-1 text-sm font-bold">Which one is it?</legend>
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
                <p role="status" className="mt-2 text-sm font-semibold text-pine">Pin dropped ✓</p>
              )}
            </div>

            <div>
              <label htmlFor="bphotos" className="block font-bold">Add a photo <span className="font-normal text-moss">(optional)</span></label>
              <p className="mt-1 text-sm text-moss">Show the barrier — snap one with your phone or upload from your device. Location data is stripped automatically.</p>
              <label htmlFor="bphotos" className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-moss/50 bg-paper px-5 py-3 font-semibold text-fern hover:border-fern">
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
                <label htmlFor="bname" className="block font-bold">Your name <span className="font-normal text-moss">(optional, never shown)</span></label>
                <input id="bname" value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
              </div>
              <div>
                <label htmlFor="bemail" className="block font-bold">Your email <span className="font-normal text-moss">(optional, never shown)</span></label>
                <input id="bemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
              </div>
            </div>
            <div aria-hidden="true" className="absolute left-[-9999px]">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>
            {err && <p role="alert" className="rounded-lg bg-s_documented/10 p-3 font-semibold text-s_documented">{err}</p>}
            <button type="button" disabled={sending} onClick={submit}
              className="rounded-lg bg-fern px-6 py-3 font-semibold text-white hover:bg-pine disabled:opacity-60">
              {sending ? "Posting…" : "Post the barrier"}
            </button>
            <p className="text-base text-pine sm:text-lg">
              Want to send a letter about it too? <Link href="/report" className="font-semibold text-fern underline underline-offset-4">We&rsquo;ll help you write one.</Link>
            </p>
          </div>
        </section>

        {/* THE BOARD */}
        <section aria-labelledby="board-h" className="mt-14">
          <h2 id="board-h" className="font-display text-2xl font-semibold text-pine">What people have reported</h2>
          {reports === null ? (
            <p role="status" className="mt-4 text-moss">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="mt-4 max-w-prose text-moss">Nothing yet — yours can be the first.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {reports.map((r) => (
                <li key={r.id} id={`report-${r.id}`} tabIndex={-1} className="rounded-xl border border-moss/30 bg-paper p-5 scroll-mt-4 focus:outline-3 focus:outline-fern">
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
                  <p className="mt-3 max-w-prose whitespace-pre-wrap">{r.barrier_desc}</p>
                  {r.place_desc && <p className="mt-2 text-sm text-moss">{r.place_desc}</p>}
                  {r.photo_paths && r.photo_paths.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-3">
                      {r.photo_paths.map((path, i) => (
                        <li key={i}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={reportPhotoUrl(supabase, path)} alt={`Photo of the reported barrier${r.place_desc ? ` at ${r.place_desc}` : ""}`}
                            className="h-32 w-32 rounded-lg border border-moss/30 object-cover" />
                        </li>
                      ))}
                    </ul>
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
      </main>

    </>
  );
}

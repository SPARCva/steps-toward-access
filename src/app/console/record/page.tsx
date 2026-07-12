"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";
import { uploadPhoto } from "@/lib/images";
import { fromPercent, toPercent } from "@/lib/geo";

type Party = { id: string; name: string };
type Photo = { id?: string; src: string; alt: string; caption: string | null; sort: number; uploading?: boolean };
type Ev = { id?: string; when_label: string; occurred_on: string | null; dir: string; txt: string; sort: number };

const STATUSES = [
  ["documented", "Documented"],
  ["contacted", "Letter sent"],
  ["awaiting", "Awaiting response"],
  ["resolved", "Resolved"],
] as const;

function RecordInner() {
  const routeId = useSearchParams().get("id") ?? "";
  const isNew = routeId === "new";
  const router = useRouter();
  const { session, staff, loading } = useStaff();

  const [id, setId] = useState<string | null>(isNew ? null : routeId);
  const [label, setLabel] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<string>("documented");
  const [published, setPublished] = useState(isNew); // new barriers publish on save — no approval step
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState("");
  const [newParty, setNewParty] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from("access_parties").select("id, name").order("name")
      .then(({ data }) => setParties((data as Party[]) ?? []));
    if (isNew) return;
    (async () => {
      const { data: b } = await supabase.from("access_locations")
        .select("*").eq("id", routeId).maybeSingle();
      if (!b) { setErr("Barrier not found (or you don't have access)."); return; }
      setLabel(b.label ?? ""); setSummary(b.summary ?? ""); setStatus(b.status ?? "documented");
      setPublished(!!b.published); setPartyId(b.party_id ?? "");
      setLat(b.lat != null ? String(b.lat) : ""); setLon(b.lon != null ? String(b.lon) : "");
      const { data: ph } = await supabase.from("access_photos")
        .select("id, src, alt, caption, sort").eq("location_id", routeId).order("sort");
      setPhotos((ph as Photo[]) ?? []);
      const { data: ev } = await supabase.from("access_events")
        .select("id, when_label, occurred_on, dir, txt, sort").eq("location_id", routeId).order("sort");
      setEvents((ev as Ev[]) ?? []);
    })();
  }, [session, routeId, isNew]);

  if (loading) return <Shell><p role="status" className="text-moss">Loading…</p></Shell>;
  if (!session || !staff)
    return <Shell><p><Link href="/console" className="font-semibold text-fern underline underline-offset-4">Sign in</Link> to edit the record.</p></Shell>;

  const isEditor = staff.role !== "contributor";
  const pin = lat && lon ? toPercent(parseFloat(lat), parseFloat(lon)) : null;
  const photosOk = photos.every((p) => p.alt.trim() !== "" && !p.uploading);

  function placePin(e: React.MouseEvent) {
    const el = mapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const { lat: la, lon: lo } = fromPercent(
      ((e.clientX - r.left) / r.width) * 100,
      ((e.clientY - r.top) / r.height) * 100
    );
    setLat(la.toFixed(6)); setLon(lo.toFixed(6));
  }

  async function save(next?: { published?: boolean }) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (!label.trim()) throw new Error("The barrier needs a name.");
      if (!photosOk) throw new Error("Every photo needs a description before saving.");
      let pid = partyId || null;
      if (!pid && newParty.trim()) {
        const { data, error } = await supabase.from("access_parties")
          .insert({ name: newParty.trim() }).select("id").single();
        if (error) throw error;
        pid = data.id;
        setParties((ps) => [...ps, { id: data.id, name: newParty.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
        setPartyId(data.id); setNewParty("");
      }
      const fields = {
        label: label.trim(),
        summary: summary.trim() || null,
        status,
        party: parties.find((p) => p.id === pid)?.name ?? newParty.trim() ?? "To be determined",
        party_id: pid,
        lat: lat ? parseFloat(lat) : null,
        lon: lon ? parseFloat(lon) : null,
        ...(next ?? {}),
      };
      let bid = id;
      if (!bid) {
        // New barriers are public immediately — no separate approval step.
        const pub = next?.published ?? true;
        const { data, error } = await supabase.from("access_locations")
          .insert({ ...fields, published: pub, created_by: staff!.email }).select("id").single();
        if (error) throw error;
        bid = data.id; setId(bid);
        setPublished(pub);
        window.history.replaceState(null, "", `/ART/console/record?id=${bid}`);
      } else {
        const { error } = await supabase.from("access_locations").update(fields).eq("id", bid);
        if (error) throw error;
      }
      // reconcile photos + events (simple replace strategy)
      await supabase.from("access_photos").delete().eq("location_id", bid);
      if (photos.length) {
        const { error } = await supabase.from("access_photos").insert(
          photos.map((p, i) => ({ location_id: bid, src: p.src, alt: p.alt.trim(), caption: p.caption?.trim() || null, sort: i })));
        if (error) throw error;
      }
      await supabase.from("access_events").delete().eq("location_id", bid);
      const evs = events.filter((e) => e.txt.trim() || e.dir.trim());
      if (evs.length) {
        const { error } = await supabase.from("access_events").insert(
          evs.map((e, i) => ({
            location_id: bid, when_label: e.when_label.trim() || "—",
            occurred_on: e.occurred_on || null, dir: e.dir.trim() || "Step",
            txt: e.txt.trim(), sort: i,
          })));
        if (error) throw error;
      }
      if (next?.published !== undefined) setPublished(next.published);
      setMsg(next?.published === true ? "Published — it's on the public record now."
        : next?.published === false ? "Unpublished — hidden from the public record."
        : "Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const i = photos.length;
      setPhotos((ps) => [...ps, { src: "", alt: "", caption: null, sort: i, uploading: true }]);
      try {
        const url = await uploadPhoto(supabase, `barriers/${id ?? "new"}`, f);
        setPhotos((ps) => ps.map((p, j) => (j === i ? { ...p, src: url, uploading: false } : p)));
      } catch {
        setPhotos((ps) => ps.filter((_, j) => j !== i));
        setErr("A photo didn't upload — try again.");
      }
    }
  }

  async function destroy() {
    if (!id || !confirm("Delete this barrier and its photos and timeline? This can't be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("access_locations").delete().eq("id", id);
    setBusy(false);
    if (error) setErr(error.message);
    else router.push("/console/record");
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-pine">{isNew && !id ? "New barrier" : "Edit barrier"}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${published ? "bg-fern text-white" : "border border-moss/50 text-moss"}`}>
          {published ? "PUBLISHED" : "DRAFT"}
        </span>
      </div>

      {msg && <p role="status" className="mt-4 rounded-lg bg-fern/10 p-3 font-semibold text-pine">{msg}</p>}
      {err && <p role="alert" className="mt-4 rounded-lg bg-s_documented/10 p-3 font-semibold text-s_documented">{err}</p>}

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="label" className="block font-bold">Name (public headline)</label>
            <input id="label" value={label} onChange={(e) => setLabel(e.target.value)}
              className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
          </div>
          <div>
            <label htmlFor="summary" className="block font-bold">Plain-language summary</label>
            <textarea id="summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)}
              className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className="block font-bold">Status</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3">
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="party" className="block font-bold">Responsible party</label>
              <select id="party" value={partyId} onChange={(e) => setPartyId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3">
                <option value="">— New party —</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {!partyId && (
                <input aria-label="New party name" value={newParty} onChange={(e) => setNewParty(e.target.value)}
                  placeholder="Party name" className="mt-2 w-full rounded-lg border border-moss/50 px-4 py-3" />
              )}
            </div>
          </div>

          <fieldset>
            <legend className="font-bold">Pin on the map</legend>
            <p className="mt-1 text-sm text-moss">Click the map to place it, or type coordinates.</p>
            <div ref={mapRef} onClick={placePin} className="relative mt-3 cursor-crosshair overflow-hidden rounded-xl border border-moss/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ART/rtc-basemap.svg" alt="" className="block w-full select-none" draggable={false} />
              {pin && pin.x >= 0 && pin.x <= 100 && pin.y >= 0 && pin.y <= 100 && (
                <span aria-hidden="true" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pine ring-4 ring-fern" />
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lat" className="block text-sm font-bold">Latitude</label>
                <input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-moss/50 px-3 py-2 font-mono text-sm" />
              </div>
              <div>
                <label htmlFor="lon" className="block text-sm font-bold">Longitude</label>
                <input id="lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-moss/50 px-3 py-2 font-mono text-sm" />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="ph-h">
            <h2 id="ph-h" className="font-display text-xl font-semibold text-pine">Photos</h2>
            <label className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-moss/50 bg-paper p-5 text-center hover:border-fern">
              <span className="font-semibold text-fern">+ Add photos</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
            </label>
            <ul className="mt-4 space-y-3">
              {photos.map((p, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-moss/30 bg-paper p-3">
                  {p.uploading
                    ? <div role="status" className="flex h-16 w-16 items-center justify-center rounded-lg bg-mist text-xs text-moss">…</div>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={p.src} alt="" className="h-16 w-16 rounded-lg object-cover" />}
                  <div className="flex-1 space-y-2">
                    <input aria-label={`Photo ${i + 1} description (required)`} value={p.alt} placeholder="Description (required)"
                      onChange={(e) => setPhotos((ps) => ps.map((q, j) => j === i ? { ...q, alt: e.target.value } : q))}
                      className="w-full rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                    <input aria-label={`Photo ${i + 1} caption (optional)`} value={p.caption ?? ""} placeholder="Caption (optional)"
                      onChange={(e) => setPhotos((ps) => ps.map((q, j) => j === i ? { ...q, caption: e.target.value } : q))}
                      className="w-full rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                  </div>
                  <button type="button" aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="rounded-lg border border-moss/40 px-3 py-2 font-bold text-moss hover:text-s_documented">✕</button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="ev-h">
            <div className="flex items-baseline justify-between">
              <h2 id="ev-h" className="font-display text-xl font-semibold text-pine">The paper trail</h2>
              <button type="button"
                onClick={() => setEvents((es) => [...es, { when_label: "", occurred_on: null, dir: "", txt: "", sort: es.length }])}
                className="text-sm font-semibold text-fern underline underline-offset-4">+ Add a step</button>
            </div>
            <ul className="mt-3 space-y-3">
              {events.map((ev, i) => (
                <li key={i} className="rounded-xl border border-moss/30 bg-paper p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input aria-label={`Step ${i + 1} date label`} value={ev.when_label} placeholder="e.g., Mar 12, 2026"
                      onChange={(e) => setEvents((es) => es.map((q, j) => j === i ? { ...q, when_label: e.target.value } : q))}
                      className="rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                    <input aria-label={`Step ${i + 1} date`} type="date" value={ev.occurred_on ?? ""}
                      onChange={(e) => setEvents((es) => es.map((q, j) => j === i ? { ...q, occurred_on: e.target.value || null } : q))}
                      className="rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                    <input aria-label={`Step ${i + 1} type`} value={ev.dir} placeholder="e.g., Letter sent / Response"
                      onChange={(e) => setEvents((es) => es.map((q, j) => j === i ? { ...q, dir: e.target.value } : q))}
                      className="rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                  </div>
                  <textarea aria-label={`Step ${i + 1} details`} rows={2} value={ev.txt} placeholder="What happened"
                    onChange={(e) => setEvents((es) => es.map((q, j) => j === i ? { ...q, txt: e.target.value } : q))}
                    className="mt-2 w-full rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => setEvents((es) => es.filter((_, j) => j !== i))}
                    className="mt-2 text-sm font-semibold text-moss underline underline-offset-4 hover:text-s_documented">Remove step</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-moss/30 pt-6">
        <button type="button" disabled={busy} onClick={() => save()}
          className="rounded-lg bg-fern px-6 py-3 font-semibold text-white hover:bg-pine disabled:opacity-60">
          {busy ? "Working…" : "Save"}
        </button>
        {isEditor && (published ? (
          <button type="button" disabled={busy} onClick={() => save({ published: false })}
            className="rounded-lg border-2 border-s_awaiting px-6 py-3 font-semibold text-s_awaiting hover:bg-s_awaiting/10 disabled:opacity-60">
            Unpublish
          </button>
        ) : (
          <button type="button" disabled={busy || !id} onClick={() => save({ published: true })}
            className="rounded-lg bg-pine px-6 py-3 font-semibold text-white hover:bg-fern disabled:opacity-60">
            Publish to the record
          </button>
        ))}
        {id && (
          <button type="button" disabled={busy} onClick={destroy}
            className="ml-auto rounded-lg border border-moss/50 px-4 py-2 text-sm font-semibold text-moss hover:border-s_documented hover:text-s_documented disabled:opacity-60">
            Delete barrier
          </button>
        )}
      </div>
      {!isEditor && <p className="mt-3 text-sm text-moss">You can edit and save; publishing is for editors.</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-10">
      <p className="mb-6"><Link href="/console/record" className="text-sm font-semibold text-fern underline underline-offset-4">← The record</Link></p>
      {children}
    </main>
  );
}


export default function RecordPage() {
  return (
    <Suspense fallback={<main id="main" className="mx-auto max-w-5xl px-5 py-10"><p role="status" className="text-moss">Loading…</p></main>}>
      <RecordInner />
    </Suspense>
  );
}

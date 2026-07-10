"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";

type Submission = {
  id: string;
  created_by: string;
  status: string;
  barrier_desc: string;
  place_desc: string | null;
  party_guess: string | null;
  review_note: string | null;
  merged_location_id: string | null;
  created_at: string;
};
type Photo = { id: string; src: string; alt: string; sort: number };
type Party = { id: string; name: string };

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session, staff, loading } = useStaff();
  const [sub, setSub] = useState<Submission | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // convert form state
  const [converting, setConverting] = useState(false);
  const [label, setLabel] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<string>("");
  const [newParty, setNewParty] = useState("");

  async function load() {
    const { data } = await supabase
      .from("access_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setSub(data as Submission | null);
    setNote((data as Submission | null)?.review_note ?? "");
    const { data: ph } = await supabase
      .from("access_submission_photos")
      .select("id, src, alt, sort")
      .eq("submission_id", id)
      .order("sort");
    setPhotos((ph as Photo[]) ?? []);
  }

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  useEffect(() => {
    if (converting) {
      supabase
        .from("access_parties")
        .select("id, name")
        .order("name")
        .then(({ data }) => setParties((data as Party[]) ?? []));
      if (sub && !label) setLabel(sub.place_desc ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [converting]);

  if (loading) return <Shell><p role="status" className="text-moss">Loading…</p></Shell>;
  if (!session || !staff)
    return (
      <Shell>
        <p><Link href="/console" className="font-semibold text-fern underline underline-offset-4">Sign in</Link> to review reports.</p>
      </Shell>
    );
  if (!sub) return <Shell><p role="status" className="text-moss">Loading report…</p></Shell>;

  const isEditor = staff.role !== "contributor";
  const mine = sub.created_by === staff.email;

  async function setStatus(status: string, extra: Partial<Submission> = {}) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase
      .from("access_submissions")
      .update({ status, ...extra })
      .eq("id", id);
    setBusy(false);
    if (error) setErr(error.message);
    else { setMsg("Saved."); load(); }
  }

  async function convert() {
    if (!sub) return;
    setBusy(true); setErr(null);
    try {
      let pid = partyId || null;
      if (!pid && newParty.trim()) {
        const { data, error } = await supabase
          .from("access_parties")
          .insert({ name: newParty.trim() })
          .select("id")
          .single();
        if (error) throw error;
        pid = data.id;
      }
      const { data: loc, error: le } = await supabase
        .from("access_locations")
        .insert({
          label: label.trim() || sub.place_desc || "New barrier",
          party: newParty.trim() || parties.find((p) => p.id === pid)?.name || sub.party_guess || "To be determined",
          party_id: pid,
          summary: sub.barrier_desc,
          status: "documented",
          published: false,
          created_by: staff!.email,
        })
        .select("id")
        .single();
      if (le) throw le;
      if (photos.length) {
        const { error: pe } = await supabase.from("access_photos").insert(
          photos.map((p, i) => ({
            location_id: loc.id,
            src: p.src,
            alt: p.alt,
            sort: i,
          }))
        );
        if (pe) throw pe;
      }
      const { error: ee } = await supabase.from("access_events").insert({
        location_id: loc.id,
        when_label: new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        occurred_on: sub.created_at.slice(0, 10),
        dir: "Documented",
        txt: sub.barrier_desc,
        sort: 0,
      });
      if (ee) throw ee;
      await supabase
        .from("access_submissions")
        .update({ status: "merged", merged_location_id: loc.id })
        .eq("id", id);
      setMsg("Converted to a draft barrier. It stays unpublished until an editor publishes it.");
      setConverting(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-pine">Report review</h1>
        <p className="font-mono text-xs text-moss">
          {new Date(sub.created_at).toLocaleString()} · {sub.created_by}
        </p>
      </div>

      {msg && <p role="status" className="mt-4 rounded-lg bg-fern/10 p-3 font-semibold text-pine">{msg}</p>}
      {err && <p role="alert" className="mt-4 rounded-lg bg-s_documented/10 p-3 font-semibold text-s_documented">{err}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="font-display text-xl font-semibold text-pine">The barrier</h2>
          <p className="mt-2 max-w-prose whitespace-pre-wrap">{sub.barrier_desc}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="inline font-bold">Where: </dt><dd className="inline">{sub.place_desc || "—"}</dd></div>
            <div><dt className="inline font-bold">Responsible party (their guess): </dt><dd className="inline">{sub.party_guess || "Not sure"}</dd></div>
            <div><dt className="inline font-bold">Status: </dt><dd className="inline font-semibold">{sub.status.replace("_", " ")}</dd></div>
          </dl>

          <h2 className="mt-8 font-display text-xl font-semibold text-pine">Photos ({photos.length})</h2>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="rounded-xl border border-moss/30 bg-paper p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} className="aspect-square w-full rounded-lg object-cover" />
                <p className="mt-2 px-1 text-xs text-moss">{p.alt}</p>
              </li>
            ))}
          </ul>
        </div>

        {isEditor && (
          <aside aria-label="Editor actions" className="h-fit rounded-xl border border-moss/30 bg-paper p-5">
            <h2 className="font-display text-lg font-semibold text-pine">Actions</h2>

            {sub.status === "merged" && sub.merged_location_id ? (
              <p className="mt-3 text-sm">
                Merged into the record.{" "}
                <Link href={`/barrier/${sub.merged_location_id}`} className="font-semibold text-fern underline underline-offset-4">
                  View the barrier
                </Link>{" "}
                (publish it from the record when it&rsquo;s ready).
              </p>
            ) : converting ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor="label" className="block text-sm font-bold">Barrier name (public)</label>
                  <input id="label" value={label} onChange={(e) => setLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label htmlFor="party" className="block text-sm font-bold">Responsible party</label>
                  <select id="party" value={partyId} onChange={(e) => setPartyId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-moss/50 bg-paper px-3 py-2 text-sm">
                    <option value="">— New party —</option>
                    {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {!partyId && (
                    <input aria-label="New party name" value={newParty} onChange={(e) => setNewParty(e.target.value)}
                      placeholder={sub.party_guess || "Party name"}
                      className="mt-2 w-full rounded-lg border border-moss/50 px-3 py-2 text-sm" />
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={convert} disabled={busy}
                    className="rounded-lg bg-fern px-4 py-2 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">
                    {busy ? "Converting…" : "Create draft barrier"}
                  </button>
                  <button onClick={() => setConverting(false)}
                    className="rounded-lg border border-moss/50 px-4 py-2 text-sm font-semibold text-moss">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {sub.status === "submitted" && (
                  <button onClick={() => setStatus("in_review")} disabled={busy}
                    className="rounded-lg bg-fern px-4 py-2.5 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">
                    Start review
                  </button>
                )}
                <button onClick={() => setConverting(true)} disabled={busy}
                  className="rounded-lg bg-pine px-4 py-2.5 text-sm font-semibold text-white hover:bg-fern disabled:opacity-60">
                  Approve → create draft barrier
                </button>
                <div className="mt-2">
                  <label htmlFor="note" className="block text-sm font-bold">Note to {sub.created_by.split("@")[0]}</label>
                  <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-moss/50 px-3 py-2 text-sm"
                    placeholder="e.g., Can you get a photo of the whole entrance?" />
                  <button onClick={() => setStatus("needs_info", { review_note: note })} disabled={busy || !note.trim()}
                    className="mt-2 rounded-lg border-2 border-s_awaiting px-4 py-2 text-sm font-semibold text-s_awaiting hover:bg-s_awaiting/10 disabled:opacity-50">
                    Request more info
                  </button>
                </div>
                <button onClick={() => setStatus("declined")} disabled={busy}
                  className="mt-2 rounded-lg border border-moss/50 px-4 py-2 text-sm font-semibold text-moss hover:border-s_documented hover:text-s_documented disabled:opacity-60">
                  Decline
                </button>
              </div>
            )}
          </aside>
        )}

        {!isEditor && mine && sub.status === "needs_info" && sub.review_note && (
          <aside className="h-fit rounded-xl border-2 border-s_awaiting bg-paper p-5">
            <h2 className="font-display text-lg font-semibold text-pine">The review team asked:</h2>
            <p className="mt-2">{sub.review_note}</p>
            <p className="mt-3 text-sm text-moss">
              Reply by submitting an updated report, or bring it to the next team meeting.
            </p>
          </aside>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-10">
      <p className="mb-6">
        <Link href="/console/queue" className="text-sm font-semibold text-fern underline underline-offset-4">← Queue</Link>
      </p>
      {children}
    </main>
  );
}

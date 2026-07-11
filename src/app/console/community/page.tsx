"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";

type Report = {
  id: string;
  status: "new" | "taken_up" | "handled" | "dismissed";
  shown_publicly?: boolean;
  barrier_type: string | null;
  barrier_desc: string;
  place_desc: string | null;
  lat: number | null;
  lon: number | null;
  party_guess: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  team_note: string | null;
  linked_location_id: string | null;
  created_at: string;
};

const TABS = [
  ["new", "New"],
  ["taken_up", "Taken up"],
  ["handled", "Handled"],
  ["dismissed", "Dismissed"],
] as const;

export default function CommunityQueue() {
  const { session, staff, loading } = useStaff();
  const router = useRouter();
  const [tab, setTab] = useState<Report["status"]>("new");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("access_public_reports")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setReports((data as Report[]) ?? []);
  }
  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab]);

  if (loading) return <Shell><p role="status" className="text-moss">Loading…</p></Shell>;
  if (!session || !staff)
    return <Shell><p><Link href="/console" className="font-semibold text-fern underline underline-offset-4">Sign in</Link> to see community reports.</p></Shell>;

  async function toggleShown(r: Report) {
    setBusy(r.id);
    const next = !r.shown_publicly;
    const { error } = await supabase.from("access_public_reports")
      .update({ shown_publicly: next, shown_at: next ? new Date().toISOString() : null })
      .eq("id", r.id);
    setBusy(null);
    if (!error) load();
  }

  async function setStatus(r: Report, status: Report["status"]) {
    setBusyId(r.id); setErr(null);
    const { error } = await supabase.from("access_public_reports").update({ status }).eq("id", r.id);
    setBusyId(null);
    if (error) setErr(error.message);
    else load();
  }

  async function takeUp(r: Report) {
    // create a draft barrier from the report and link it
    setBusyId(r.id); setErr(null);
    try {
      const { data: loc, error: le } = await supabase
        .from("access_locations")
        .insert({
          label: r.place_desc?.split(",")[0] || "Community-reported barrier",
          party: r.party_guess || "To be determined",
          summary: r.barrier_desc,
          status: "documented",
          published: false,
          lat: r.lat, lon: r.lon,
          created_by: staff!.email,
        })
        .select("id").single();
      if (le) throw le;
      await supabase.from("access_events").insert({
        location_id: loc.id,
        when_label: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        occurred_on: r.created_at.slice(0, 10),
        dir: "Reported by the community",
        txt: r.barrier_desc,
        sort: 0,
      });
      await supabase.from("access_public_reports")
        .update({ status: "taken_up", linked_location_id: loc.id }).eq("id", r.id);
      router.push(`/console/record?id=${loc.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't take this up.");
      setBusyId(null);
    }
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl font-bold text-pine">Community reports</h1>
      <p className="mt-2 max-w-prose text-moss">
        Barriers flagged by the public. Take one up to start a draft barrier
        the team can document and act on — or mark it handled or dismissed.
      </p>

      <div role="tablist" aria-label="Report status" className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === v ? "bg-pine text-white" : "border border-moss/40 text-moss hover:border-fern hover:text-fern"}`}>
            {l}
          </button>
        ))}
      </div>

      {err && <p role="alert" className="mt-4 rounded-lg bg-s_documented/10 p-3 font-semibold text-s_documented">{err}</p>}

      {reports === null ? (
        <p role="status" className="mt-6 text-moss">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-6 max-w-prose text-moss">Nothing {tab === "new" ? "new" : `in “${TABS.find(([v]) => v === tab)?.[1]}”`} right now.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-moss/30 bg-paper p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-pine">{r.barrier_type ? r.barrier_type[0].toUpperCase() + r.barrier_type.slice(1) : "Barrier"}</span>
                <span className="font-mono text-xs text-moss">
                  {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{r.barrier_desc}</p>
              <dl className="mt-3 space-y-1 text-sm text-moss">
                {r.place_desc && <div><dt className="inline font-bold">Where: </dt><dd className="inline">{r.place_desc}</dd></div>}
                {r.party_guess && <div><dt className="inline font-bold">Responsible (their guess): </dt><dd className="inline">{r.party_guess}</dd></div>}
                <div>
                  <dt className="inline font-bold">Reported by: </dt>
                  <dd className="inline">
                    {r.reporter_name || "Anonymous"}
                    {r.reporter_email && <> · <a className="font-semibold text-fern underline underline-offset-4" href={`mailto:${r.reporter_email}`}>{r.reporter_email}</a></>}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={busyId === r.id} onClick={() => toggleShown(r)}
                  aria-pressed={!!r.shown_publicly}
                  className={r.shown_publicly
                    ? "rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white hover:bg-fern disabled:opacity-60"
                    : "rounded-lg border-2 border-pine px-4 py-2 text-sm font-semibold text-pine hover:bg-pine/10 disabled:opacity-60"}>
                  {r.shown_publicly ? "Shown on the public board ✓ (hide)" : "Show on the public board"}
                </button>
                {r.status === "new" && (
                  <>
                    <button disabled={busyId === r.id} onClick={() => takeUp(r)}
                      className="rounded-lg bg-fern px-4 py-2 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">
                      {busyId === r.id ? "Working…" : "Take it up → draft barrier"}
                    </button>
                    <button disabled={busyId === r.id} onClick={() => setStatus(r, "handled")}
                      className="rounded-lg border-2 border-fern px-4 py-2 text-sm font-semibold text-fern hover:bg-fern/10 disabled:opacity-60">
                      Mark handled
                    </button>
                    <button disabled={busyId === r.id} onClick={() => setStatus(r, "dismissed")}
                      className="rounded-lg border border-moss/50 px-4 py-2 text-sm font-semibold text-moss hover:border-s_documented hover:text-s_documented disabled:opacity-60">
                      Dismiss
                    </button>
                  </>
                )}
                {r.status !== "new" && r.linked_location_id && (
                  <Link href={`/console/record?id=${r.linked_location_id}`}
                    className="rounded-lg border-2 border-fern px-4 py-2 text-sm font-semibold text-fern hover:bg-fern/10">
                    Open the barrier
                  </Link>
                )}
                {r.status !== "new" && (
                  <button disabled={busyId === r.id} onClick={() => setStatus(r, "new")}
                    className="rounded-lg border border-moss/50 px-4 py-2 text-sm font-semibold text-moss disabled:opacity-60">
                    Back to New
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-10">
      <p className="mb-6"><Link href="/console" className="text-sm font-semibold text-fern underline underline-offset-4">← Team console</Link></p>
      {children}
    </main>
  );
}

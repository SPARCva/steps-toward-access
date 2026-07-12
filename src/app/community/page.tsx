"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { reportPhotoUrl } from "@/lib/images";

type Report = {
  id: string;
  barrier_type: string | null;
  barrier_desc: string;
  place_desc: string | null;
  status: string;
  created_at: string;
  photo_paths: string[] | null;
};

const TYPE_LABEL: Record<string, string> = {
  parking: "Parking", dropoff: "Drop-off", path: "Sidewalk / curb ramps", transit: "Transit access",
  entrance: "Entrance / steps", ramp: "Ramp", door: "Doors",
  aisles: "Aisles", elevator: "Elevator / lift", stairs: "Stairs", seating: "Seating",
  restroom: "Restroom", counter: "Counter / checkout", fitting: "Fitting / exam room",
  signage: "Signs / wayfinding", hearing: "Hearing access", vision: "Vision access", digital: "Digital access",
  service_animal: "Service animal refused", staff: "Staff / policy", sensory: "Sensory environment",
  temporary: "Temporary blockage", other: "Other",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Reported", taken_up: "Taken up by the team", handled: "Handled", dismissed: "Reported",
};

export default function CommunityBoard() {
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    supabase
      .from("access_community_board")
      .select("id, barrier_type, barrier_desc, place_desc, status, created_at, photo_paths")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setReports((data as Report[]) ?? []));
  }, []);

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6">
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">← Accessibility in Real Time</Link>
      </p>
      <h1 className="font-display text-4xl font-bold text-pine">Community reports</h1>
      <p className="mt-3 max-w-prose text-lg">
        Barriers that people across the community have flagged. Reports appear
        here right away, and reporters&rsquo; names are never shown. When the team
        takes one up, it can become a fully documented entry on <Link href="/map" className="font-semibold text-fern underline underline-offset-4">the record</Link>.
      </p>

      {reports === null ? (
        <p role="status" className="mt-10 text-moss">Loading reports…</p>
      ) : reports.length === 0 ? (
        <p className="mt-10 max-w-prose rounded-xl border border-moss/30 bg-paper p-6 text-moss">
          No community reports yet — <Link href="/report" className="font-semibold text-fern underline underline-offset-4">be the first to flag one</Link>.
        </p>
      ) : (
        <ul className="mt-10 space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-moss/30 bg-paper p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {r.barrier_type && (
                  <span className="rounded-full bg-fern/15 px-3 py-0.5 text-sm font-bold text-pine">
                    {TYPE_LABEL[r.barrier_type] ?? r.barrier_type}
                  </span>
                )}
                <span className="text-sm font-semibold text-moss">{STATUS_LABEL[r.status] ?? "Reported"}</span>
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
            </li>
          ))}
        </ul>
      )}

      <aside className="mt-12 max-w-prose rounded-xl border border-moss/30 bg-paper p-6">
        <h2 className="font-display text-xl font-semibold text-pine">See something where you live?</h2>
        <p className="mt-2">Add it to the board — and we&rsquo;ll help you write the letter, too.</p>
        <Link href="/report" className="mt-4 inline-block rounded-lg bg-fern px-5 py-2.5 font-semibold text-white hover:bg-pine">
          Report a barrier
        </Link>
      </aside>
    </main>
  );
}

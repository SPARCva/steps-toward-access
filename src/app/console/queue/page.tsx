"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";

type Submission = {
  id: string;
  created_by: string;
  status: string;
  barrier_desc: string;
  place_desc: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Waiting for review",
  in_review: "In review",
  needs_info: "Needs more info",
  approved: "Approved",
  merged: "Published to the record",
  declined: "Not moving forward",
};

export default function QueuePage() {
  const { session, staff, loading } = useStaff();
  const [subs, setSubs] = useState<Submission[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("access_submissions")
      .select("id, created_by, status, barrier_desc, place_desc, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setSubs((data as Submission[]) ?? []));
  }, [session]);

  if (loading) return <Shell><p role="status" className="text-moss">Loading…</p></Shell>;
  if (!session || !staff)
    return (
      <Shell>
        <p>
          <Link href="/console" className="font-semibold text-fern underline underline-offset-4">Sign in</Link>{" "}
          to see the queue.
        </p>
      </Shell>
    );

  const isEditor = staff.role !== "contributor";

  return (
    <Shell>
      <h1 className="font-display text-3xl font-bold text-pine">
        {isEditor ? "Review queue" : "My reports"}
      </h1>
      {subs === null ? (
        <p role="status" className="mt-4 text-moss">Loading reports…</p>
      ) : subs.length === 0 ? (
        <p className="mt-4 max-w-prose text-moss">
          Nothing here yet. When {isEditor ? "the team reports a barrier" : "you send a report"},
          it shows up in this queue.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {subs.map((s) => (
            <li key={s.id} className="rounded-xl border border-moss/30 bg-paper p-5 hover:border-fern">
              <Link href={`/console/queue/${s.id}`} className="block">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="rounded-full bg-fern/15 px-3 py-1 text-sm font-semibold text-pine">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                <span className="font-mono text-xs text-moss">
                  {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {isEditor && <> · {s.created_by}</>}
                </span>
              </div>
              <p className="mt-3 line-clamp-2">{s.barrier_desc}</p>
              {s.place_desc && <p className="mt-1 text-sm text-moss">{s.place_desc}</p>}
              </Link>
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
      <p className="mb-6">
        <Link href="/console" className="text-sm font-semibold text-fern underline underline-offset-4">← Team console</Link>
      </p>
      {children}
    </main>
  );
}

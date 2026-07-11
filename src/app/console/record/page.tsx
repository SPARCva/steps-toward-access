"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaff } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";

type Row = {
  id: string; label: string; status: string; published: boolean;
  updated_at: string; access_parties: { name: string } | { name: string }[] | null;
};

export default function RecordAdminPage() {
  const { session, staff, loading } = useStaff();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("access_locations")
      .select("id, label, status, published, updated_at, access_parties(name)")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [session]);

  if (loading) return <Shell><p role="status" className="text-moss">Loading…</p></Shell>;
  if (!session || !staff)
    return <Shell><p><Link href="/console" className="font-semibold text-fern underline underline-offset-4">Sign in</Link> to manage the record.</p></Shell>;

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-pine">The record</h1>
        <Link href="/console/record/new" className="rounded-lg bg-fern px-4 py-2 text-sm font-semibold text-white hover:bg-pine">
          + New barrier
        </Link>
      </div>
      {rows === null ? (
        <p role="status" className="mt-4 text-moss">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 max-w-prose text-moss">
          No barriers yet. Create one, or approve a report from the queue.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const party = Array.isArray(r.access_parties) ? r.access_parties[0] : r.access_parties;
            return (
              <li key={r.id}>
                <Link href={`/console/record/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moss/30 bg-paper p-4 hover:border-fern">
                  <span className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${r.published ? "bg-fern text-white" : "border border-moss/50 text-moss"}`}>
                      {r.published ? "PUBLISHED" : "DRAFT"}
                    </span>
                    <StatusBadge status={r.status} />
                    <span className="font-display text-lg font-semibold text-pine">{r.label}</span>
                  </span>
                  <span className="text-sm text-moss">{party?.name ?? "No party set"}</span>
                </Link>
              </li>
            );
          })}
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

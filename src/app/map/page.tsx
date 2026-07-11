"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { RtcMap } from "@/components/RtcMap";

type Row = {
  id: string; label: string; status: string; summary: string | null;
  lat: number | null; lon: number | null; x: number | null; y: number | null;
  access_parties: { name: string } | { name: string }[] | null;
  access_photos: { src: string; alt: string; sort: number }[] | null;
};

export default function RecordPage() {
  const [barriers, setBarriers] = useState<Row[] | null>(null);

  useEffect(() => {
    supabase
      .from("access_locations")
      .select("id, label, status, summary, lat, lon, x, y, access_parties(name), access_photos(src, alt, sort)")
      .eq("published", true)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setBarriers((data as Row[]) ?? []));
  }, []);

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6">
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">← Accessibility in Real Time</Link>
      </p>
      <h1 className="font-display text-4xl font-bold text-pine">The record</h1>
      <p className="mt-3 max-w-prose text-lg">
        Every barrier the Agents of Change team has documented at Reston Town
        Center, and every step taken since. Pins on the map and entries in the
        list are the same record, two ways.
      </p>

      {barriers === null ? (
        <p role="status" className="mt-10 text-moss">Loading the record…</p>
      ) : barriers.length === 0 ? (
        <p className="mt-10 max-w-prose rounded-xl border border-moss/30 bg-paper p-6 text-moss">
          The first entries are being prepared by the team. Check back soon —
          see <Link href="/community" className="font-semibold text-fern underline underline-offset-4">community reports</Link>, or <Link href="/report" className="font-semibold text-fern underline underline-offset-4">report a barrier in your own community</Link>.
        </p>
      ) : (
        <>
          <RtcMap
            barriers={barriers.map((b) => ({
              id: b.id, label: b.label, status: b.status,
              lat: b.lat, lon: b.lon, x: b.x, y: b.y,
            }))}
          />
          <ul className="mt-10 space-y-6">
            {barriers.map((b) => {
              const photos = (b.access_photos ?? []).slice().sort((x, y) => x.sort - y.sort);
              const party = Array.isArray(b.access_parties) ? b.access_parties[0] : b.access_parties;
              return (
                <li key={b.id} className="rounded-xl border border-moss/30 bg-paper p-5 sm:flex sm:gap-6">
                  {photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[0].src} alt={photos[0].alt} className="h-40 w-full rounded-lg object-cover sm:w-56" />
                  )}
                  <div className="mt-4 sm:mt-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={b.status} />
                      {party?.name && <span className="text-sm text-moss">Responsible: {party.name}</span>}
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-pine">
                      <Link href={`/barrier?id=${b.id}`} className="hover:underline">{b.label}</Link>
                    </h2>
                    {b.summary && <p className="mt-2 line-clamp-2 max-w-prose">{b.summary}</p>}
                    <Link href={`/barrier?id=${b.id}`} className="mt-3 inline-block font-semibold text-fern underline underline-offset-4">
                      Read the paper trail
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

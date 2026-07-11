import Link from "next/link";
import { publicClient } from "@/lib/supabase-server";
import { StatusBadge } from "@/components/StatusBadge";
import { RtcMap } from "@/components/RtcMap";

export const revalidate = 60;

export const metadata = { title: "The record" };

export default async function RecordPage() {
  const supabase = publicClient();
  const { data: barriers } = await supabase
    .from("access_locations")
    .select("id, label, status, summary, updated_at, lat, lon, x, y, party_id, access_parties(name), access_photos(src, alt, sort)")
    .eq("published", true)
    .order("updated_at", { ascending: false });

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6">
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">← Steps Toward Access</Link>
      </p>
      <h1 className="font-display text-4xl font-bold text-pine">The record</h1>
      <p className="mt-3 max-w-prose text-lg">
        Every barrier the Agents of Change team has documented at Reston Town
        Center, and every step taken since. Pins on the map and entries in the
        list are the same record, two ways.
      </p>

      {barriers && barriers.length > 0 && (
        <RtcMap
          barriers={barriers.map((b) => ({
            id: b.id, label: b.label, status: b.status,
            lat: b.lat, lon: b.lon, x: b.x, y: b.y,
          }))}
        />
      )}

      {!barriers || barriers.length === 0 ? (
        <p className="mt-10 max-w-prose rounded-xl border border-moss/30 bg-paper p-6 text-moss">
          The first entries are being prepared by the team. Check back soon —
          or <Link href="/report" className="font-semibold text-fern underline underline-offset-4">report a barrier in your own community</Link>.
        </p>
      ) : (
        <ul className="mt-10 space-y-6">
          {barriers.map((b) => {
            const photos = (b.access_photos ?? []).sort((x, y) => x.sort - y.sort);
            const party = Array.isArray(b.access_parties) ? b.access_parties[0] : b.access_parties;
            return (
              <li key={b.id} className="rounded-xl border border-moss/30 bg-paper p-5 sm:flex sm:gap-6">
                {photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0].src} alt={photos[0].alt}
                    className="h-40 w-full rounded-lg object-cover sm:w-56" />
                )}
                <div className="mt-4 sm:mt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={b.status} />
                    {party?.name && (
                      <Link href={`/party/${b.party_id}`} className="text-sm font-semibold text-moss underline underline-offset-4 hover:text-fern">
                        Responsible: {party.name}
                      </Link>
                    )}
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-pine">
                    <Link href={`/barrier/${b.id}`} className="hover:underline">{b.label}</Link>
                  </h2>
                  {b.summary && <p className="mt-2 line-clamp-2 max-w-prose">{b.summary}</p>}
                  <Link href={`/barrier/${b.id}`} className="mt-3 inline-block font-semibold text-fern underline underline-offset-4">
                    Read the paper trail
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

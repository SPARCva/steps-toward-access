import Link from "next/link";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase-server";
import { StatusBadge } from "@/components/StatusBadge";

export const revalidate = 60;

export default async function BarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = publicClient();
  const { data: b } = await supabase
    .from("access_locations")
    .select("id, label, status, summary, created_at, party_id, access_parties(name, org_type), access_photos(src, alt, caption, sort), access_events(when_label, occurred_on, dir, txt, sort)")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();

  if (!b) notFound();

  const photos = (b.access_photos ?? []).sort((x, y) => x.sort - y.sort);
  const events = (b.access_events ?? []).sort((x, y) => x.sort - y.sort);
  const party = Array.isArray(b.access_parties) ? b.access_parties[0] : b.access_parties;

  const firstContact = events.find((e) => /sent|letter|contact/i.test(e.dir))?.occurred_on;
  const daysWaiting =
    firstContact && b.status !== "resolved"
      ? Math.floor((Date.now() - new Date(firstContact).getTime()) / 86400000)
      : null;

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6">
        <Link href="/map" className="text-sm font-semibold text-fern underline underline-offset-4">← The record</Link>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={b.status} />
        {daysWaiting !== null && (
          <span className="font-mono text-sm text-moss">
            {daysWaiting} day{daysWaiting === 1 ? "" : "s"} since first contact
          </span>
        )}
      </div>
      <h1 className="mt-3 font-display text-4xl font-bold text-pine">{b.label}</h1>
      {party?.name && (
        <p className="mt-2 text-moss">
          Responsible party:{" "}
          <Link href={`/party/${b.party_id}`} className="font-bold text-fern underline underline-offset-4">
            {party.name}
          </Link>
          {party.org_type ? ` (${party.org_type})` : ""}
        </p>
      )}
      {b.summary && <p className="mt-5 max-w-prose text-lg leading-relaxed">{b.summary}</p>}

      {photos.length > 0 && (
        <section aria-labelledby="photos-h" className="mt-10">
          <h2 id="photos-h" className="font-display text-2xl font-semibold text-pine">What it looks like</h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p, i) => (
              <li key={i}>
                <figure className="rounded-xl border border-moss/30 bg-paper p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  {p.caption && <figcaption className="p-2 text-sm text-moss">{p.caption}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="trail-h" className="mt-12 max-w-prose">
        <h2 id="trail-h" className="font-display text-2xl font-semibold text-pine">The paper trail</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-moss">Steps will appear here as the team takes them.</p>
        ) : (
          <ol className="ledger mt-6 space-y-7">
            {events.map((e, i) => (
              <li key={i}>
                <p className="font-mono text-xs uppercase tracking-wider text-moss">{e.when_label}</p>
                <h3 className="mt-0.5 font-bold">{e.dir}</h3>
                <p className="mt-1 whitespace-pre-wrap">{e.txt}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="mt-14 max-w-prose rounded-xl border border-moss/30 bg-paper p-6">
        <h2 className="font-display text-xl font-semibold text-pine">Found something like this where you live?</h2>
        <p className="mt-2">
          You don&rsquo;t have to be part of the team to speak up. We&rsquo;ll help you
          write the letter.
        </p>
        <Link href="/report" className="mt-4 inline-block rounded-lg bg-fern px-5 py-2.5 font-semibold text-white hover:bg-pine">
          Report a barrier in your community
        </Link>
      </aside>
    </main>
  );
}

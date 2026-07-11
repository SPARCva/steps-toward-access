import Link from "next/link";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase-server";
import { StatusBadge } from "@/components/StatusBadge";

export const revalidate = 60;

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = publicClient();
  const { data: party } = await supabase
    .from("access_parties").select("id, name, org_type").eq("id", id).maybeSingle();
  if (!party) notFound();
  const { data: barriers } = await supabase
    .from("access_locations")
    .select("id, label, status, summary, created_at")
    .eq("party_id", id).eq("published", true)
    .order("created_at");
  const list = barriers ?? [];
  const open = list.filter((b) => b.status !== "resolved").length;
  const first = list[0]?.created_at;

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6"><Link href="/map" className="text-sm font-semibold text-fern underline underline-offset-4">← The record</Link></p>
      <p className="font-mono text-sm uppercase tracking-widest text-moss">Responsible party</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-pine">{party.name}</h1>
      {party.org_type && <p className="mt-1 text-moss">{party.org_type}</p>}
      <p className="mt-4 max-w-prose text-lg">
        {list.length} documented barrier{list.length === 1 ? "" : "s"}
        {open > 0 && <> · <strong>{open} still open</strong></>}
        {first && <> · on the record since {new Date(first).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</>}
      </p>
      <ul className="mt-8 space-y-4">
        {list.map((b) => (
          <li key={b.id} className="rounded-xl border border-moss/30 bg-paper p-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={b.status} />
              <h2 className="font-display text-xl font-semibold text-pine">
                <Link href={`/barrier/${b.id}`} className="hover:underline">{b.label}</Link>
              </h2>
            </div>
            {b.summary && <p className="mt-2 line-clamp-2 max-w-prose">{b.summary}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}

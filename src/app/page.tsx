import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="border-b border-moss/30 bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <p className="font-display text-lg font-semibold text-pine">
            Accessibility in Real Time
            <span className="ml-2 font-body text-sm font-normal text-moss">
              a SPARC Agents of Change project
            </span>
          </p>
          <nav aria-label="Primary">
            <ul className="flex gap-6 text-sm font-semibold">
              <li><Link href="/map" className="text-pine underline-offset-4 hover:underline">The record</Link></li>
              <li><Link href="/community" className="text-pine underline-offset-4 hover:underline">Community reports</Link></li>
              <li><Link href="/report" className="text-pine underline-offset-4 hover:underline">Report a barrier</Link></li>
              <li><Link href="/console" className="text-moss underline-offset-4 hover:underline">Team console</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-5 py-14">
        <section aria-labelledby="hero-h" className="max-w-prose">
          <p className="font-mono text-sm uppercase tracking-widest text-moss">
            Reston Town Center · Virginia
          </p>
          <h1 id="hero-h" className="mt-3 font-display text-4xl font-bold leading-tight text-pine sm:text-5xl">
            When a place isn&rsquo;t built for everyone, we put it on the record.
          </h1>
          <p className="mt-5 text-lg leading-relaxed">
            SPARC&rsquo;s Agents of Change — self-advocates with disabilities — are
            documenting the barriers that keep people out of Reston Town Center,
            writing to the people responsible, and publishing every step here:
            the photos, the letters, the replies, and how long change takes.
            Found a barrier yourself? Flag it, and the team takes it from there.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/map"
              className="rounded-lg bg-fern px-6 py-3 font-semibold text-white hover:bg-pine"
            >
              See the record
            </Link>
            <Link
              href="/report"
              className="rounded-lg border-2 border-fern px-6 py-3 font-semibold text-fern hover:bg-fern/10"
            >
              Report a barrier anywhere
            </Link>
          </div>
        </section>

        <section aria-labelledby="how-h" className="mt-20 max-w-prose">
          <h2 id="how-h" className="font-display text-2xl font-semibold text-pine">
            How the paper trail works
          </h2>
          <ol className="ledger mt-6 space-y-6">
            <li>
              <h3 className="font-bold">Documented</h3>
              <p className="text-moss">A barrier is photographed and described by the team.</p>
            </li>
            <li>
              <h3 className="font-bold">Letter sent</h3>
              <p className="text-moss">We write to whoever is responsible and ask for a fix.</p>
            </li>
            <li>
              <h3 className="font-bold">Awaiting response</h3>
              <p className="text-moss">The clock is public. Every reply — or silence — is recorded.</p>
            </li>
            <li>
              <h3 className="font-bold">Resolved</h3>
              <p className="text-moss">The barrier is fixed, and the record shows how it happened.</p>
            </li>
          </ol>
        </section>
      </main>

      <footer className="mt-16 border-t border-moss/30 bg-paper">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-moss">
          <p>
            A project of{" "}
            <a href="https://sparcsolutions.org" className="text-fern underline underline-offset-4">
              SPARC
            </a>{" "}
            — Specially Adapted Resource Clubs. Funded by the Agents of Change grant.
          </p>
        </div>
      </footer>
    </>
  );
}

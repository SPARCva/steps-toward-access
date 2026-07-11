import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-20">
      <h1 className="font-display text-4xl font-bold text-pine">That page isn&rsquo;t here</h1>
      <p className="mt-4 max-w-prose text-lg">
        It may have been unpublished, or the link may be old.
      </p>
      <div className="mt-6 flex gap-4">
        <Link href="/map" className="rounded-lg bg-fern px-5 py-2.5 font-semibold text-white hover:bg-pine">The record</Link>
        <Link href="/" className="rounded-lg border-2 border-fern px-5 py-2.5 font-semibold text-fern hover:bg-fern/10">Home</Link>
      </div>
    </main>
  );
}

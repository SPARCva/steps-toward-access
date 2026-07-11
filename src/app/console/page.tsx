"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useEffect } from "react";
import { sendMagicLink, signOut, useStaff } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ConsolePage() {
  const { session, staff, loading } = useStaff();
  const [newReports, setNewReports] = useState<number | null>(null);
  useEffect(() => {
    if (!session) return;
    supabase.from("access_public_reports")
      .select("id", { count: "exact", head: true }).eq("status", "new")
      .then(({ count }) => setNewReports(count ?? 0));
  }, [session]);

  if (loading) {
    return (
      <Shell>
        <p role="status" className="text-moss">Checking your session…</p>
      </Shell>
    );
  }

  if (!session) return <SignIn />;

  if (!staff) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-bold text-pine">Not on the team roster</h1>
        <p className="mt-4 max-w-prose">
          You&rsquo;re signed in as <strong>{session.user.email}</strong>, but this
          address isn&rsquo;t on the Accessibility in Real Time staff list. If you&rsquo;re part
          of the Agents of Change team, ask Erica to add you.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-6 rounded-lg border-2 border-fern px-5 py-2.5 font-semibold text-fern hover:bg-fern/10"
        >
          Sign out
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-pine">Team console</h1>
        <p className="text-sm text-moss">
          {staff.displayName || staff.email} · {staff.role}
          <button onClick={() => signOut()} className="ml-3 font-semibold text-fern underline underline-offset-4">
            Sign out
          </button>
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/console/submit"
          className="rounded-xl border border-moss/30 bg-paper p-6 hover:border-fern"
        >
          <h2 className="font-display text-xl font-semibold text-pine">Report a barrier</h2>
          <p className="mt-2 text-moss">
            Document something you found in the field — photos first, a few
            questions, done. Your draft saves as you go.
          </p>
        </Link>
        <Link
          href="/console/community"
          className="rounded-xl border border-moss/30 bg-paper p-6 hover:border-fern"
        >
          <h2 className="font-display text-xl font-semibold text-pine">
            Community reports
            {newReports !== null && newReports > 0 && (
              <span className="ml-2 rounded-full bg-s_awaiting px-2.5 py-0.5 text-sm text-white">{newReports} new</span>
            )}
          </h2>
          <p className="mt-2 text-moss">
            Barriers flagged by the public. Take one up, or mark it handled.
          </p>
        </Link>
        <Link
          href="/console/record"
          className="rounded-xl border border-moss/30 bg-paper p-6 hover:border-fern"
        >
          <h2 className="font-display text-xl font-semibold text-pine">The record</h2>
          <p className="mt-2 text-moss">
            Every barrier, draft and published. Edit details, place pins,
            manage photos and the paper trail{staff.role !== "contributor" ? ", and publish" : ""}.
          </p>
        </Link>
        <Link
          href="/console/queue"
          className="rounded-xl border border-moss/30 bg-paper p-6 hover:border-fern"
        >
          <h2 className="font-display text-xl font-semibold text-pine">
            Review queue {staff.role === "contributor" && <span className="text-sm font-normal text-moss">(your submissions)</span>}
          </h2>
          <p className="mt-2 text-moss">
            {staff.role === "contributor"
              ? "See where your reports are in review."
              : "Review new reports, request info, and merge them into the public record."}
          </p>
        </Link>
      </div>
    </Shell>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendMagicLink(email.trim());
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl font-bold text-pine">Team sign-in</h1>
      {sent ? (
        <p role="status" className="mt-4 max-w-prose rounded-lg bg-fern/10 p-4">
          Check your email — we sent a sign-in link to <strong>{email}</strong>.
          It works on this device or your phone.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 max-w-sm">
          <label htmlFor="email" className="block font-bold">
            Your SPARC email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3"
          />
          {error && (
            <p role="alert" className="mt-3 font-semibold text-s_documented">
              Couldn&rsquo;t send the link: {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-lg bg-fern px-6 py-3 font-semibold text-white hover:bg-pine disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send me a sign-in link"}
          </button>
          <p className="mt-3 text-sm text-moss">
            No password needed. Only team addresses can sign in.
          </p>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-8">
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">
          ← Accessibility in Real Time
        </Link>
      </p>
      {children}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * "Partner with us" — property managers, businesses, and county partners
 * leave their contact details and a message, which is emailed straight to
 * SPARC on submit. If server-side email isn't configured, the form falls
 * back to opening the visitor's own email app so it is never a dead end.
 */

const INBOX = "debi@sparcsolutions.org";

export default function PartnerPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ready = name.trim() && email.trim() && message.trim();

  // Reston Town Center is proxied at sparcsolutions.org/ART; the API lives on
  // the app's own Netlify deployment, so post there when we're not already on it.
  function apiBase() {
    return typeof window !== "undefined" && window.location.hostname.endsWith("netlify.app")
      ? ""
      : "https://stepstowardaccess.netlify.app";
  }

  function mailtoFallback() {
    const bodyLines = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      org.trim() ? `Organization: ${org.trim()}` : null,
      "",
      message.trim(),
    ].filter((l) => l !== null);
    return `mailto:${INBOX}?subject=${encodeURIComponent(
      `Partner inquiry — ${name.trim()}${org.trim() ? ` (${org.trim()})` : ""}`
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setErr(null);
    try {
      const r = await fetch(`${apiBase()}/ART/api/partner-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), org: org.trim(), message: message.trim(), website }),
      });
      if (r.status === 503) {
        // Email isn't wired up yet — hand off to the visitor's own mail app.
        window.location.href = mailtoFallback();
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Sending failed");
      setSent(true);
    } catch (e) {
      setErr(
        (e instanceof Error ? e.message : "Sending failed") +
          " — you can also email us directly."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-6">
        <Link href="/" className="text-sm font-semibold text-fern underline underline-offset-4">← Accessibility in Real Time</Link>
      </p>

      <div className="max-w-prose">
        <h1 className="font-display text-4xl font-bold text-pine">Partner with us</h1>
        <p className="mt-3 text-lg">
          Property managers, businesses, and county partners: whether you&rsquo;d
          like to weigh in on something you see here or team up on a change,
          we&rsquo;d like to hear from you. Leave your details and a note, and
          SPARC&rsquo;s Agents of Change team will be in touch. No barrier report
          required.
        </p>

        {sent ? (
          <div role="status" className="mt-8 rounded-2xl border border-fern/30 bg-fern/10 p-6">
            <h2 className="font-display text-2xl font-semibold text-pine">Thank you{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}.</h2>
            <p className="mt-2">
              Your message is on its way to the team. We&rsquo;ll reply to{" "}
              <strong>{email.trim()}</strong> as soon as we can.
            </p>
            <p className="mt-4">
              <Link href="/" className="font-semibold text-fern underline underline-offset-4 hover:text-pine">
                ← Back to Accessibility in Real Time
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="p-name" className="block font-bold">Your name</label>
                <input
                  id="p-name" required value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3"
                />
              </div>
              <div>
                <label htmlFor="p-email" className="block font-bold">Your email</label>
                <input
                  id="p-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3"
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="p-org" className="block font-bold">
                Business or organization <span className="font-normal text-moss">(optional)</span>
              </label>
              <input
                id="p-org" value={org} onChange={(e) => setOrg(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3"
              />
            </div>

            <div className="mt-5">
              <label htmlFor="p-message" className="block font-bold">Your message</label>
              <p className="mt-1 text-sm text-moss">Tell us what you&rsquo;d like to talk about, or how you&rsquo;d like to help.</p>
              <textarea
                id="p-message" required rows={7} value={message} onChange={(e) => setMessage(e.target.value)}
                className="mt-2 w-full rounded-lg border border-moss/50 bg-paper px-4 py-3 font-body leading-relaxed"
              />
            </div>

            {/* honeypot — off-screen, humans never see or fill it */}
            <div aria-hidden="true" className="absolute left-[-9999px]">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>

            {err && (
              <p role="alert" className="mt-5 rounded-lg bg-s_documented/10 p-3 text-sm font-semibold text-s_documented">
                {err}{" "}
                <a href={mailtoFallback()} className="underline underline-offset-2">Email {INBOX}</a>
              </p>
            )}

            <button
              type="submit" disabled={!ready || sending}
              className="mt-6 rounded-lg bg-pine px-6 py-3 font-semibold text-white hover:bg-fern disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send message"}
            </button>
            {!ready && <p className="mt-2 text-sm text-moss">Add your name, email, and a message to send.</p>}
          </form>
        )}
      </div>
    </main>
  );
}

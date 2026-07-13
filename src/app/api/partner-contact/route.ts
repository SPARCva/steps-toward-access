import { NextRequest, NextResponse } from "next/server";

/**
 * Partner outreach intake. A property manager, business, or county partner
 * fills out the "Partner with us" form; on submit we email the message to
 * SPARC so the team can follow up. Nothing is stored — the message is
 * relayed and forgotten, with the sender's address set as Reply-To so a
 * reply goes straight back to them.
 *
 * Delivery uses Resend's REST API (no SDK dependency). Until RESEND_API_KEY
 * is set in Netlify env the route reports itself unconfigured (503) and the
 * form falls back to the visitor's own email app, so it is never a dead end.
 */

const ALLOWED_ORIGINS = ["https://sparcsolutions.org", "https://stepstowardaccess.netlify.app"];
function cors(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: cors(req) });
}

const INBOX = process.env.PARTNER_INBOX || "debi@sparcsolutions.org";
const FROM = process.env.PARTNER_FROM || "Accessibility in Real Time <partners@sparcsolutions.org>";

export async function POST(req: NextRequest) {
  const headers = cors(req);
  const body = await req.json().catch(() => ({}));

  // Honeypot — humans never see the "website" field; a filled one is a bot.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }, { headers });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const org = String(body.org ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Please add your name, email, and a message." }, { status: 400, headers });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400, headers });
  }
  if (name.length > 200 || email.length > 200 || org.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: "That's a bit long — please shorten it and try again." }, { status: 400, headers });
  }

  const subject = `Partner inquiry — ${name}${org ? ` (${org})` : ""}`;
  const text =
    `New partner inquiry from Accessibility in Real Time\n\n` +
    `Name:  ${name}\n` +
    `Email: ${email}\n` +
    (org ? `Organization: ${org}\n` : "") +
    `\nMessage:\n${message}\n`;

  const web3Key = process.env.WEB3FORMS_ACCESS_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  // Web3Forms — the no-DNS path. Sends from Web3Forms' own verified domain to
  // whatever address the access key is bound to (debi@), so nothing needs to
  // be set up in DNS. The visitor's address rides along as Reply-To.
  if (web3Key) {
    const r = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: web3Key,
        subject,
        from_name: "Accessibility in Real Time",
        name,
        email,        // Web3Forms uses this as Reply-To
        organization: org || undefined,
        message: text,
        botcheck: false,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      console.error("partner-contact: Web3Forms send failed", r.status, data);
      return NextResponse.json({ error: "Sending failed — please try again in a moment." }, { status: 502, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  }

  // Resend — the alternative, for when the sending domain is verified in DNS.
  if (resendKey) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [INBOX], reply_to: email, subject, text }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("partner-contact: Resend send failed", r.status, detail);
      return NextResponse.json({ error: "Sending failed — please try again in a moment." }, { status: 502, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  }

  // Nothing configured yet — tell the client so it can offer the mailto fallback.
  return NextResponse.json({ error: "unconfigured" }, { status: 503, headers });
}

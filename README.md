# Accessibility in Real Time

SPARC's Agents of Change accessibility advocacy app. Public record of
barriers at Reston Town Center + the steps taken to call for change, plus a
visitor tool that drafts advocacy letters for barriers anywhere.

**Live at:** https://sparcsolutions.org/ART (proxied from the main
site to this app's own Netlify deployment; `basePath: "/ART"`).

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind, Radix UI primitives
- Supabase (existing SPARC project): Postgres + Auth (magic link, role-gated
  via `access_staff_emails` allow-list in RLS) + Storage
- Anthropic API (server-side only) for the visitor letter assist
- Fonts: Zilla Slab (display), **Atkinson Hyperlegible** (body — designed by
  the Braille Institute for low-vision readers), IBM Plex Mono (record dates)

## Accessibility is the product
WCAG 2.2 AA floor. Skip link, landmark structure, visible focus (3px fern),
prefers-reduced-motion respected globally, status never conveyed by color
alone, alt text required at upload, list view has full parity with the map.
CI will fail PRs that introduce axe-core violations (Phase 4).

## Architecture decisions of record
- **Centerpiece stays an illustrated map** (funder redirected away from an
  interactive map; see Andrew O'Dell's 2026-06-23 email). Real mapping tech
  (Nominatim geocoding + optional MapLibre/OpenFreeMap confirm map) is used
  only in the visitor report tool.
- **No server-side email sending** for visitor barrier reports (mailto/copy
  only) and no storage of visitor submissions — standing liability decisions.
  (The separate `/partner` outreach form *does* email SPARC — via Web3Forms
  when there's no DNS access, or Resend when the domain is verified; either
  way it relays the message and stores nothing. See `.env.example`.)
- Tables are namespaced `access_*` on the shared Supabase project.

## Local dev
```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for letter assist
npm run dev                  # http://localhost:3000/ART
```

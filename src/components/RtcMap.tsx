"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPercent } from "@/lib/geo";

/**
 * The record's centerpiece: an illustrated map (real OSM geometry, restyled)
 * with barrier pins. Accessibility model:
 *  - Pins are real <button>s in DOM order (tab through barriers 1..n);
 *    each names itself fully; Enter/Space opens the barrier page.
 *  - Zoom via buttons (and +/- keys on the region); panning is native
 *    scrolling, so arrow keys / touch / trackpad all work for free.
 *  - The list below the map is the equal-parity representation; the map is
 *    an enhancement, never the only path.
 */

export type MapBarrier = {
  id: string;
  label: string;
  status: string;
  lat: number | null;
  lon: number | null;
  x: number | null; // legacy percentage fallback
  y: number | null;
};

const STATUS_RING: Record<string, string> = {
  documented: "ring-s_documented",
  contacted: "ring-s_contacted",
  awaiting: "ring-s_awaiting",
  resolved: "ring-s_resolved",
};
const STATUS_TEXT: Record<string, string> = {
  documented: "Documented",
  contacted: "Letter sent",
  awaiting: "Awaiting response",
  resolved: "Resolved",
};

export function RtcMap({ barriers }: { barriers: MapBarrier[] }) {
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);

  const pins = barriers
    .map((b, i) => {
      const pos =
        b.lat != null && b.lon != null
          ? toPercent(b.lat, b.lon)
          : b.x != null && b.y != null
            ? { x: b.x, y: b.y }
            : null;
      return pos ? { ...b, n: i + 1, ...pos } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100);

  function setZoomKeepCenter(next: number) {
    const el = scroller.current;
    if (!el) return setZoom(next);
    const cx = (el.scrollLeft + el.clientWidth / 2) / (el.scrollWidth || 1);
    const cy = (el.scrollTop + el.clientHeight / 2) / (el.scrollHeight || 1);
    setZoom(next);
    requestAnimationFrame(() => {
      el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2;
      el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2;
    });
  }
  const zoomIn = () => setZoomKeepCenter(Math.min(3, +(zoom + 0.5).toFixed(1)));
  const zoomOut = () => setZoomKeepCenter(Math.max(1, +(zoom - 0.5).toFixed(1)));

  return (
    <section aria-label="Map of documented barriers" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-moss">
          {pins.length} pinned barrier{pins.length === 1 ? "" : "s"} · every pin is
          also in the list below
        </p>
        <div className="flex gap-2" role="group" aria-label="Map zoom">
          <button type="button" onClick={zoomOut} disabled={zoom <= 1} aria-label="Zoom out"
            className="h-11 w-11 rounded-lg border-2 border-fern bg-paper text-xl font-bold text-fern hover:bg-fern/10 disabled:opacity-40">
            −
          </button>
          <button type="button" onClick={zoomIn} disabled={zoom >= 3} aria-label="Zoom in"
            className="h-11 w-11 rounded-lg border-2 border-fern bg-paper text-xl font-bold text-fern hover:bg-fern/10 disabled:opacity-40">
            +
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label={`Illustrated map of Reston Town Center, zoom ${zoom} of 3. ${pins.length} barrier pins follow as buttons. Use plus and minus keys to zoom; arrow keys scroll when zoomed.`}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
          if (e.key === "-") { e.preventDefault(); zoomOut(); }
        }}
        className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-moss/30 bg-[#eef2ed]"
      >
        <div className="relative" style={{ width: `${zoom * 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/accessibility/rtc-basemap.svg"
            alt=""
            className="block w-full select-none"
            draggable={false}
          />
          {pins.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/barrier/${p.id}`)}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ${STATUS_RING[p.status] ?? "ring-s_documented"} h-9 w-9 bg-pine font-display text-base font-bold text-white shadow-md hover:bg-fern focus-visible:bg-fern`}
            >
              {p.n}
              <span className="sr-only">
                : {p.label} — {STATUS_TEXT[p.status] ?? p.status}. Open the paper trail.
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-pine px-2.5 py-1 font-body text-xs font-semibold text-white group-hover:block group-focus-visible:block"
              >
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-moss">
        Illustration drawn from OpenStreetMap data · © OpenStreetMap contributors
      </p>
    </section>
  );
}

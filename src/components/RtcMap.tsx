"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fromPercent, RTC_BOX } from "@/lib/geo";
import placesData from "@/data/places.json";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker as MLMarker, Popup as MLPopup } from "maplibre-gl";

/**
 * The Town Center map — a real interactive vector map (MapLibre GL + free
 * OpenFreeMap tiles). Street names are rendered by the map engine, so they fit
 * the streets, follow curves, and reveal smaller streets as you zoom.
 *  - Clicking a street / building / spot starts a barrier report there
 *    (calls onPlacePick with the place name + real lat/lon). You can also just
 *    type the address or place name into the report form.
 *  - With `snapToAddress`, hovering the map surfaces the nearest known street
 *    address as a floating label you can click to report at that exact address
 *    — not just a business name.
 *  - Every barrier is a red pin you can click: documented barriers open their
 *    paper trail; community reports jump to their entry on the board below.
 */

export type MapBarrier = {
  id: string; label: string; status: string;
  lat: number | null; lon: number | null; x: number | null; y: number | null;
};
export type MapReport = { id: string; snippet: string; lat: number | null; lon: number | null };
export type MapPlace = { name: string; addr: string | null; lat: number; lon: number };
export type MapPick = { lat: number; lon: number };

/** A known Reston Town Center address, enriched from src/data/places.json:
 *  `street` is the numbered street address; `title` the business/place name. */
type SnapPlace = { street: string | null; title: string | null; lat: number; lon: number };
type RawPlace = { name: string; addr: string | null; lat: number; lon: number };

const startsWithNumber = (s: string) => /^\s*\d/.test(s);

/** Pre-computed address book for hover-snapping. Places whose `name` is itself
 *  a numbered address (e.g. "11714 Sunset Hills Road") become the street; named
 *  businesses keep their name as the title and any `addr` as the street. */
const ADDRESSES: SnapPlace[] = (placesData as RawPlace[]).map((p) => ({
  street: p.addr ?? (startsWithNumber(p.name) ? p.name : null),
  title: startsWithNumber(p.name) && !p.addr ? null : p.name,
  lat: p.lat,
  lon: p.lon,
}));

/** How close (metres) the cursor must be to a known address to snap to it. */
const SNAP_METERS = 55;

/** Rough great-circle distance in metres (equirectangular — plenty at this scale). */
function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, toRad = Math.PI / 180;
  const x = (bLon - aLon) * toRad * Math.cos(((aLat + bLat) / 2) * toRad);
  const y = (bLat - aLat) * toRad;
  return Math.sqrt(x * x + y * y) * R;
}

/** Nearest known address to a point, or null if nothing is within SNAP_METERS. */
function nearestAddress(lat: number, lon: number): SnapPlace | null {
  let best: SnapPlace | null = null;
  let bestD = SNAP_METERS;
  for (const a of ADDRESSES) {
    const d = metersBetween(lat, lon, a.lat, a.lon);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

/** Turn a snapped address into the {name, addr} the report form expects. */
function placeFromAddress(a: SnapPlace): MapPlace {
  const street = a.street ?? a.title ?? "Selected spot";
  return {
    name: a.title ?? street,
    addr: a.title ? a.street : null,
    lat: a.lat,
    lon: a.lon,
  };
}

const STATUS_TEXT: Record<string, string> = {
  documented: "Documented", contacted: "Letter sent",
  awaiting: "Awaiting response", resolved: "Resolved",
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const RED = "#C62828";
const FERN = "#00539B"; // SPARC royal blue — the console editor's placed pin

/** A teardrop pin element (anchored at its tip). Red by default. */
function pinElement(fill: string = RED): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.style.cssText = "background:none;border:0;padding:0;cursor:pointer;line-height:0;display:block";
  el.innerHTML =
    `<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M14 1C7.4 1 2 6.3 2 12.9 2 21.5 14 37 14 37s12-15.5 12-24.1C26 6.3 20.6 1 14 1z" ` +
    `fill="${fill}" stroke="#fff" stroke-width="2"/>` +
    `<circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`;
  return el;
}

/** A small red dot element (anchored at its center). */
function dotElement(): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.style.cssText =
    `width:16px;height:16px;border-radius:50%;background:${RED};border:2px solid #fff;` +
    `box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;padding:0`;
  return el;
}

/** best geographic coordinate for a barrier/report: real lat/lon, else the
 *  legacy pixel position converted back through the basemap projection. */
function lngLatOf(o: { lat: number | null; lon: number | null; x?: number | null; y?: number | null }): [number, number] | null {
  if (o.lat != null && o.lon != null) return [o.lon, o.lat];
  if (o.x != null && o.y != null) { const g = fromPercent(o.x, o.y); return [g.lon, g.lat]; }
  return null;
}

export function RtcMap({ barriers, reports = [], onPlacePick, picked = null, hint, snapToAddress = false }: {
  barriers: MapBarrier[]; reports?: MapReport[];
  onPlacePick?: (p: MapPlace) => void;
  /** When set, drops a distinct "you picked this" pin (used by the console
   *  editor to place a barrier). Does not navigate on click. */
  picked?: MapPick | null;
  /** Optional override for the instructional line above the map. */
  hint?: string;
  /** Public report flow only: hover reveals the nearest numbered street
   *  address, and clicking snaps the report to that exact address. */
  snapToAddress?: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<MLMarker[]>([]);
  const hoverRef = useRef<{ popup: MLPopup | null; key: string | null }>({ popup: null, key: null });
  const readyRef = useRef(false);
  // keep latest props/handlers reachable from map events without rebuilding the map
  const dataRef = useRef({ barriers, reports, onPlacePick, picked, snapToAddress });
  dataRef.current = { barriers, reports, onPlacePick, picked, snapToAddress };

  // build the map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        bounds: [[RTC_BOX.west, RTC_BOX.south], [RTC_BOX.east, RTC_BOX.north]],
        fitBoundsOptions: { padding: 12 },
        maxBounds: [[RTC_BOX.west - 0.006, RTC_BOX.south - 0.006], [RTC_BOX.east + 0.006, RTC_BOX.north + 0.006]],
        minZoom: 13, maxZoom: 19,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

      map.on("load", () => {
        warmPalette(map);
        readyRef.current = true;
        drawMarkers(maplibregl, map);
      });

      // click a street / building / spot -> start a report there. When snapping
      // is on, prefer the nearest known numbered address over the tile name.
      map.on("click", (e) => {
        if (!dataRef.current.onPlacePick) return;
        if (dataRef.current.snapToAddress) {
          const near = nearestAddress(e.lngLat.lat, e.lngLat.lng);
          if (near) { dataRef.current.onPlacePick(placeFromAddress(near)); return; }
        }
        const { name, addr } = describe(map, e.point);
        dataRef.current.onPlacePick({ name, addr, lat: e.lngLat.lat, lon: e.lngLat.lng });
      });

      map.on("mousemove", (e) => {
        const canvas = map.getCanvas();
        if (dataRef.current.snapToAddress && dataRef.current.onPlacePick) {
          const near = nearestAddress(e.lngLat.lat, e.lngLat.lng);
          if (near) {
            canvas.style.cursor = "pointer";
            showAddressHint(maplibregl, map, near);
            return;
          }
          hideAddressHint();
          canvas.style.cursor = "crosshair";
          return;
        }
        if (!dataRef.current.onPlacePick) { canvas.style.cursor = ""; return; }
        const hit = describe(map, e.point).name !== "Selected spot";
        canvas.style.cursor = hit ? "pointer" : "crosshair";
      });
      map.on("mouseout", hideAddressHint);
    })();

    // Floating "nearest address" label shown while hovering (snap mode).
    function showAddressHint(maplibregl: typeof import("maplibre-gl"), map: MLMap, a: SnapPlace) {
      const key = `${a.lat},${a.lon}`;
      const hover = hoverRef.current;
      if (hover.key === key && hover.popup?.isOpen()) return;
      hover.key = key;
      if (!hover.popup) {
        hover.popup = new maplibregl.Popup({
          closeButton: false, closeOnClick: false, offset: 18,
          className: "art-addr-popup", maxWidth: "260px",
        });
      }
      hover.popup.setDOMContent(addressHintNode(a)).setLngLat([a.lon, a.lat]);
      if (!hover.popup.isOpen()) hover.popup.addTo(map);
    }
    function hideAddressHint() {
      const hover = hoverRef.current;
      if (hover.popup) hover.popup.remove();
      hover.key = null;
    }

    return () => {
      cancelled = true;
      hoverRef.current.popup?.remove();
      hoverRef.current = { popup: null, key: null };
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw markers whenever barriers/reports change
  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (mapRef.current) drawMarkers(maplibregl, mapRef.current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barriers, reports, picked]);

  function drawMarkers(maplibregl: typeof import("maplibre-gl"), map: MLMap) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const { barriers, reports, picked } = dataRef.current;

    // the "you picked this spot" pin (console editor) — fern, non-navigating
    if (picked) {
      const el = pinElement(FERN);
      el.setAttribute("aria-label", "The barrier's pin. Click elsewhere on the map to move it.");
      markersRef.current.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([picked.lon, picked.lat]).addTo(map));
    }

    // community reports — small red dots that jump to their board entry
    reports.forEach((r) => {
      const ll = lngLatOf(r);
      if (!ll) return;
      const el = dotElement();
      el.setAttribute("aria-label", `Reported barrier: ${r.snippet}. Jump to it on the board.`);
      el.title = r.snippet;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const node = document.getElementById(`report-${r.id}`);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        (node as HTMLElement | null)?.focus();
      });
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map));
    });

    // documented barriers — red pins that open the paper trail
    barriers.forEach((b, i) => {
      const ll = lngLatOf(b);
      if (!ll) return;
      const el = pinElement();
      el.setAttribute("aria-label", `Barrier ${i + 1}: ${b.label} — ${STATUS_TEXT[b.status] ?? b.status}. Open the paper trail.`);
      el.title = b.label;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        router.push(`/barrier?id=${b.id}`);
      });
      markersRef.current.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(ll).addTo(map));
    });
  }

  return (
    <section aria-label="Map of Reston Town Center barriers" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-medium text-pine sm:text-lg">
          {hint
            ? hint
            : snapToAddress && onPlacePick
            ? <>Hover the map to reveal the nearest street address, then click it to report a barrier at that exact address — or type an address or place name in the form below. Red pins are existing barriers; click one to open it.</>
            : onPlacePick
            ? <>Tap any street, building, or spot to report a barrier there — or type the address or place name in the form below. Red pins are barriers; click one to open it.</>
            : <>Red pins are barriers; click one to open it. Zoom in for more street names.</>}
        </p>
      </div>

      <div
        ref={containerRef}
        role="application"
        aria-label="Interactive map of Reston Town Center. Zoom and pan to explore; select a location to report an accessibility barrier. Documented barriers and community reports are marked."
        className="mt-3 overflow-hidden rounded-2xl border border-moss/25 shadow-sm ring-1 ring-black/5"
        style={{ height: "clamp(420px, 70vh, 720px)" }}
      />
    </section>
  );
}

/** The floating label shown on hover: a numbered street address you can click
 *  to report there. Purely informational (pointer-events are disabled in CSS) —
 *  the map click underneath does the snapping — so it never blocks the cursor. */
function addressHintNode(a: SnapPlace): HTMLElement {
  const street = a.street ?? a.title ?? "Selected spot";
  const wrap = document.createElement("div");
  wrap.className = "art-addr-card";
  const pin =
    `<svg class="art-addr-pin" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">` +
    `<path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>`;
  const title = a.title && a.title !== street
    ? `<span class="art-addr-title">${escapeHtml(a.title)}</span>` : "";
  wrap.innerHTML =
    `<span class="art-addr-head">${pin}<span class="art-addr-street">${escapeHtml(street)}</span></span>` +
    title +
    `<span class="art-addr-cta">Click to report at this address</span>`;
  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** best human name + address under a clicked point, from the vector tiles */
function describe(map: MLMap, point: { x: number; y: number }): { name: string; addr: string | null } {
  const feats = map.queryRenderedFeatures([point.x, point.y]);
  const streetF = feats.find((f) => f.properties?.name &&
    /transportation|road|street/i.test(String(f.sourceLayer ?? f.layer.id)));
  const namedF = feats.find((f) => f.properties?.name &&
    /poi|place|building|landuse|park|water/i.test(String(f.sourceLayer ?? f.layer.id)))
    ?? feats.find((f) => f.properties?.name);
  const house = feats.find((f) => f.properties?.housenumber)?.properties?.housenumber as string | undefined;
  const street = streetF?.properties?.name as string | undefined;
  const name = (namedF?.properties?.name as string | undefined) ?? street ?? "Selected spot";
  const addr = house ? `${house}${street ? ` ${street}` : ""}` : (street && namedF ? street : null);
  return { name, addr };
}

/** warm/tan palette to echo the SPARC illustrated basemap */
function warmPalette(map: MLMap) {
  const layers = map.getStyle().layers ?? [];
  for (const L of layers) {
    try {
      const id = L.id.toLowerCase();
      if (L.type === "background") map.setPaintProperty(L.id, "background-color", "#f3ece0");
      else if (L.type === "fill") {
        if (/water/.test(id)) map.setPaintProperty(L.id, "fill-color", "#b7c9d6");
        else if (/building/.test(id)) map.setPaintProperty(L.id, "fill-color", "#ded2ba");
        else if (/(park|wood|grass|forest|green|cemetery|pitch|golf|landcover|landuse)/.test(id)) map.setPaintProperty(L.id, "fill-color", "#d9e0c6");
        else if (/(residential|suburb|neighbourhood|built)/.test(id)) map.setPaintProperty(L.id, "fill-color", "#efe7d8");
      } else if (L.type === "line") {
        if (/water|river|stream|canal/.test(id)) map.setPaintProperty(L.id, "line-color", "#b7c9d6");
        else if (/casing/.test(id)) map.setPaintProperty(L.id, "line-color", "#e7dcc4");
        else if (/(motorway|trunk|primary)/.test(id)) map.setPaintProperty(L.id, "line-color", "#fbf3e0");
        else if (/(road|street|transportation|secondary|tertiary|service|path|pedestrian)/.test(id)) map.setPaintProperty(L.id, "line-color", "#fbf6ec");
      } else if (L.type === "symbol") {
        if (map.getLayoutProperty(L.id, "text-field") !== undefined) {
          map.setPaintProperty(L.id, "text-color", "#5c503b");
          map.setPaintProperty(L.id, "text-halo-color", "#f7f1e6");
          map.setPaintProperty(L.id, "text-halo-width", 1.4);
        }
      }
    } catch { /* layer lacks that property — skip */ }
  }
}

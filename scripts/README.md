# Basemap pipeline
`rtc_basemap.py` fetches Reston Town Center geometry from OpenStreetMap
(Overpass API) and renders `public/rtc-basemap.svg` in the app palette.
Re-run with a wider bounding box when barriers fall outside the frame.
The projection box (W/E/S/N) MUST stay in sync with `src/lib/geo.ts`.
Attribution "© OpenStreetMap contributors" is required and baked into the SVG.

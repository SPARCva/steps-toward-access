/** Projection box for public/rtc-basemap.svg — MUST match scripts/rtc_basemap.py */
export const RTC_BOX = { west: -77.3608, east: -77.354, south: 38.9572, north: 38.9612 };

/** lat/lon -> percentage position on the basemap (0-100). */
export function toPercent(lat: number, lon: number) {
  const x = ((lon - RTC_BOX.west) / (RTC_BOX.east - RTC_BOX.west)) * 100;
  const y = ((RTC_BOX.north - lat) / (RTC_BOX.north - RTC_BOX.south)) * 100;
  return { x, y };
}

export function inFrame(lat: number, lon: number) {
  const { x, y } = toPercent(lat, lon);
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

/** percentage position on the basemap -> lat/lon (inverse of toPercent). */
export function fromPercent(xPct: number, yPct: number) {
  const lon = RTC_BOX.west + (xPct / 100) * (RTC_BOX.east - RTC_BOX.west);
  const lat = RTC_BOX.north - (yPct / 100) * (RTC_BOX.north - RTC_BOX.south);
  return { lat, lon };
}

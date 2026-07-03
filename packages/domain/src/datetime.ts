// Canonical date/time formatters for the whole app (mobile + web), so the same
// display logic isn't re-implemented per screen. Deterministic (fixed English
// short names) — no locale/Intl variance across platforms.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Wed, 10 Jul" */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "14:00" (24h) */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Wed, 10 Jul · 14:00" */
export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

/** "Jul 2026" */
export function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Compact relative age: "now" / "5m" / "3h" / "2d" (empty for null). */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

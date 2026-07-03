import { formatAmount } from "@inkora/domain";

/** App-wide currency formatter (re-exported from the domain Money helper). */
export const money = formatAmount;

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

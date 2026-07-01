const SYMBOL: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

export function money(amount: number | null | undefined, currency = "EUR"): string {
  if (amount == null) return "—";
  return `${SYMBOL[currency] ?? currency + " "}${Math.round(amount)}`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

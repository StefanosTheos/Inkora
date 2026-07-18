// Canonical money representation + the single formatter for the whole app.
// Amounts are stored as INTEGER minor units (cents) to avoid float drift.
// In Inkora money is display-only (quotes/estimates) — no payments happen in
// the app — but a value object keeps currency + precision correct everywhere.

export type CurrencyCode = string; // "EUR" | "USD" | "GBP" | …

/** A currency amount: integer minor units + ISO currency code. */
export interface Money {
  minor: number;
  currency: CurrencyCode;
}

const SYMBOL: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

/** The currency's symbol (€/$/£) or a "CODE " fallback for compact formatting. */
export function currencySymbol(currency: CurrencyCode = "EUR"): string {
  return SYMBOL[currency] ?? `${currency} `;
}

/** Common currencies offered in pickers. Symbol ones first for clean display. */
export const CURRENCY_OPTIONS: CurrencyCode[] = ["EUR", "USD", "GBP", "CAD", "AUD", "CHF", "SEK"];

/** Build Money from a decimal major-unit value (e.g. 90.5 EUR → { minor: 9050 }). */
export function money(major: number, currency: CurrencyCode = "EUR"): Money {
  return { minor: Math.round(major * 100), currency };
}

/** Format a Money value for display (e.g. €90, £140.50). */
export function formatMoney(m: Money | null | undefined): string {
  if (!m) return "—";
  const sym = SYMBOL[m.currency] ?? `${m.currency} `;
  const major = m.minor / 100;
  return `${sym}${Number.isInteger(major) ? String(major) : major.toFixed(2)}`;
}

/** Convenience: format a decimal amount + currency in one call. */
export function formatAmount(major: number | null | undefined, currency: CurrencyCode = "EUR"): string {
  if (major == null) return "—";
  return formatMoney(money(major, currency));
}

/** Format a min–max band (used by the price estimator / budget ranges). */
export function formatRange(min: number | null | undefined, max: number | null | undefined, currency: CurrencyCode = "EUR"): string {
  return `${formatAmount(min, currency)} – ${formatAmount(max, currency)}`;
}

import type { AppointmentStatus, OfferStatus, RequestStatus } from "@inkora/domain";
import { formatAmount, statusTone } from "@inkora/domain";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { imageUrl } from "../../../lib/images";

// Currency + date/time formatters (re-exported from the domain so screens have
// one import site; the canonical implementations live in @inkora/domain).
export const money = formatAmount;
export { fmtDate, fmtDateTime, fmtTime } from "@inkora/domain";

/** Human label for a client's suggested budget: "€100–€200" / "from €100" /
 *  "up to €200" (empty when they gave no budget). */
export function budgetRangeLabel(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${money(min)}–${money(max)}`;
  if (min != null) return `from ${money(min)}`;
  if (max != null) return `up to ${money(max)}`;
  return "";
}

/** Validates an offer price against the client's suggested budget. Returns an
 *  error message when the price falls outside the range, else null. */
export function offerBudgetError(price: number, min: number | null, max: number | null): string | null {
  if (min != null && price < min) return `Your offer is below the client's budget (min ${money(min)}). Adjust the price to stay within their range.`;
  if (max != null && price > max) return `Your offer is above the client's budget (max ${money(max)}). Adjust the price to stay within their range.`;
  return null;
}

const TONE_COLORS = {
  positive: { bg: "#DCFCE7", fg: "#166534" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
  danger: { bg: "#FEE2E2", fg: "#991B1B" },
  neutral: { bg: "#F4F4F5", fg: "#52525B" },
} as const;

export function StatusChip({ status, label }: { status: RequestStatus | AppointmentStatus | OfferStatus; label: string }) {
  const tone = TONE_COLORS[statusTone(status)];
  return (
    <View style={[cs.chip, { backgroundColor: tone.bg }]}>
      <Text style={[cs.chipText, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ path, name, size = 44 }: { path: string | null; name: string; size?: number }) {
  const url = imageUrl(path, size);
  return (
    <View style={[cs.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Text style={[cs.avatarInitial, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  avatar: { backgroundColor: "#1F1B2E", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarInitial: { color: "#fff", fontWeight: "800" },
});

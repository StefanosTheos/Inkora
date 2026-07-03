import type { AppointmentStatus, OfferStatus, RequestStatus } from "@inkora/domain";
import { formatAmount, statusTone } from "@inkora/domain";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { publicStorageUrl } from "@inkora/data-access";
import { env } from "../../../lib/env";

// Currency + date/time formatters (re-exported from the domain so screens have
// one import site; the canonical implementations live in @inkora/domain).
export const money = formatAmount;
export { fmtDate, fmtDateTime, fmtTime } from "@inkora/domain";

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
  const url = path ? publicStorageUrl(env.SUPABASE_URL, path) : undefined;
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

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** A consistent, friendly empty state: icon in a soft circle, a title, an
 *  optional explanation, and an optional call-to-action button — replacing the
 *  app's flat one-line gray "nothing here" texts. */
export function EmptyState({ icon, title, message, actionLabel, onAction, compact }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[s.wrap, compact && s.wrapCompact]}>
      <View style={s.iconCircle}><Ionicons name={icon} size={28} color="#B4B4B8" /></View>
      <Text style={s.title}>{title}</Text>
      {message ? <Text style={s.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={s.btn} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={s.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 32, paddingTop: 56, gap: 8 },
  wrapCompact: { paddingTop: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 16, fontWeight: "800", color: "#18181B", textAlign: "center" },
  message: { fontSize: 13.5, color: "#A1A1AA", textAlign: "center", lineHeight: 19 },
  btn: { marginTop: 12, backgroundColor: "#18181B", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

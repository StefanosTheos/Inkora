import { StyleSheet, Text, View } from "react-native";

/** Small red count pill for list rows (mirrors the notification bell badge). */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={s.badge} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={s.text}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  text: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

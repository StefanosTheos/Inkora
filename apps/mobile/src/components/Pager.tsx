import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** Numbered page control: ‹ prev · 1 2 3 · next ›. Renders nothing for a single
 *  page. `page` is 0-indexed. */
export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <View style={s.pager}>
      <Pressable disabled={page === 0} onPress={() => onChange(page - 1)} hitSlop={6} style={[s.arrow, page === 0 && s.off]} accessibilityRole="button" accessibilityLabel="Previous page">
        <Ionicons name="chevron-back" size={18} color={page === 0 ? "#D4D4D8" : "#18181B"} />
      </Pressable>
      {Array.from({ length: totalPages }, (_, i) => (
        <Pressable key={i} onPress={() => onChange(i)} style={[s.num, i === page && s.numActive]} accessibilityRole="button" accessibilityLabel={`Page ${i + 1}`}>
          <Text style={[s.numText, i === page && s.numTextActive]}>{i + 1}</Text>
        </Pressable>
      ))}
      <Pressable disabled={page >= totalPages - 1} onPress={() => onChange(page + 1)} hitSlop={6} style={[s.arrow, page >= totalPages - 1 && s.off]} accessibilityRole="button" accessibilityLabel="Next page">
        <Ionicons name="chevron-forward" size={18} color={page >= totalPages - 1 ? "#D4D4D8" : "#18181B"} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, marginTop: 16 },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
  num: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F4F5" },
  numActive: { backgroundColor: "#18181B" },
  numText: { fontWeight: "700", color: "#52525B", fontSize: 14 },
  numTextActive: { color: "#fff" },
});

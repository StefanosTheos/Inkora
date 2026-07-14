import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** The page tokens to render: real page indices interspersed with "…" gaps.
 *  Windows around the current page so the control never grows past one row —
 *  first, last, current and its immediate neighbours, ellipsis for the rest.
 *  e.g. 0 … 8 9 10 … 19 (all 0-indexed). */
function pageWindow(page: number, total: number): (number | "dots")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const first = 0;
  const last = total - 1;
  const left = Math.max(first + 1, page - 1);
  const right = Math.min(last - 1, page + 1);
  const out: (number | "dots")[] = [first];
  if (left > first + 1) out.push("dots");
  for (let i = left; i <= right; i++) out.push(i);
  if (right < last - 1) out.push("dots");
  out.push(last);
  return out;
}

/** Numbered page control: ‹ prev · 1 2 3 · next ›. Renders nothing for a single
 *  page. `page` is 0-indexed. Arrows and numbers always stay on one row — the
 *  numbers window with ellipses once there are more than 7 pages. */
export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const tokens = pageWindow(page, totalPages);
  return (
    <View style={s.pager}>
      <Pressable disabled={page === 0} onPress={() => onChange(page - 1)} hitSlop={6} style={[s.arrow, page === 0 && s.off]} accessibilityRole="button" accessibilityLabel="Previous page">
        <Ionicons name="chevron-back" size={18} color={page === 0 ? "#D4D4D8" : "#18181B"} />
      </Pressable>
      {tokens.map((t, i) =>
        t === "dots" ? (
          <View key={`dots-${i}`} style={s.dots}><Text style={s.dotsText}>…</Text></View>
        ) : (
          <Pressable key={t} onPress={() => onChange(t)} style={[s.num, t === page && s.numActive]} accessibilityRole="button" accessibilityLabel={`Page ${t + 1}`}>
            <Text style={[s.numText, t === page && s.numTextActive]}>{t + 1}</Text>
          </Pressable>
        ),
      )}
      <Pressable disabled={page >= totalPages - 1} onPress={() => onChange(page + 1)} hitSlop={6} style={[s.arrow, page >= totalPages - 1 && s.off]} accessibilityRole="button" accessibilityLabel="Next page">
        <Ionicons name="chevron-forward" size={18} color={page >= totalPages - 1 ? "#D4D4D8" : "#18181B"} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 16 },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
  num: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F4F5" },
  numActive: { backgroundColor: "#18181B" },
  numText: { fontWeight: "700", color: "#52525B", fontSize: 14 },
  numTextActive: { color: "#fff" },
  dots: { minWidth: 20, height: 34, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  dotsText: { color: "#A1A1AA", fontWeight: "800", fontSize: 15 },
});

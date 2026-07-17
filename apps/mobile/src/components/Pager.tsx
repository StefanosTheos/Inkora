import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** The page tokens to render: real page indices interspersed with "…" gaps.
 *  Keeps the control to a single row by showing at most four numbers — the
 *  current page and the next one (low side) plus the last two pages (high side),
 *  with an ellipsis bridging the gap. e.g. 5 6 … 19 20 (all 0-indexed).
 *  Small page counts (≤4) are shown in full. */
function pageWindow(page: number, total: number): (number | "dots")[] {
  const last = total - 1;
  if (total <= 4) return Array.from({ length: total }, (_, i) => i);
  const set = new Set<number>();
  set.add(page); // current
  if (page + 1 <= last) set.add(page + 1); // next
  set.add(last - 1); // second to last
  set.add(last); // last
  const nums = [...set].filter((n) => n >= 0 && n <= last).sort((a, b) => a - b);
  const out: (number | "dots")[] = [];
  let prev: number | null = null;
  for (const n of nums) {
    if (prev !== null && n - prev > 1) out.push("dots");
    out.push(n);
    prev = n;
  }
  return out;
}

/** Numbered page control: ‹ prev · 1 2 3 · next ›. Renders nothing for a single
 *  page. `page` is 0-indexed. Arrows and numbers always stay on one row — the
 *  numbers window (current + next, then the last two) with an ellipsis once
 *  there are more than 4 pages. */
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

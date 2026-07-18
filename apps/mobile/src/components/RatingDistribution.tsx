import { StyleSheet, Text, View } from "react-native";

/** Average + total + a 5→1 star histogram, computed from a set of reviews.
 *  Renders nothing when there are no reviews. */
export function RatingDistribution({ reviews }: { reviews: { overallRating: number }[] }) {
  const total = reviews.length;
  if (total === 0) return null;
  const avg = reviews.reduce((sum, r) => sum + r.overallRating, 0) / total;
  const rounded = Math.round(avg);

  return (
    <View style={s.wrap}>
      <View style={s.avgCol} accessible accessibilityLabel={`${avg.toFixed(1)} out of 5, ${total} reviews`}>
        <Text style={s.avgNum}>{avg.toFixed(1)}</Text>
        <Text style={s.avgStars}>{"★".repeat(rounded)}{"☆".repeat(5 - rounded)}</Text>
        <Text style={s.avgCount}>{total} review{total === 1 ? "" : "s"}</Text>
      </View>
      <View style={s.bars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = reviews.filter((r) => r.overallRating === star).length;
          const frac = count / total;
          return (
            <View key={star} style={s.barRow} accessible accessibilityLabel={`${star} stars: ${count}`}>
              <Text style={s.barLabel}>{star}</Text>
              <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.round(frac * 100)}%` }]} /></View>
              <Text style={s.barCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 20, paddingVertical: 12, paddingHorizontal: 4 },
  avgCol: { alignItems: "center", width: 88 },
  avgNum: { fontSize: 40, fontWeight: "900", color: "#18181B", lineHeight: 44 },
  avgStars: { color: "#E5484D", fontSize: 14, marginTop: 2 },
  avgCount: { color: "#A1A1AA", fontSize: 12, marginTop: 4, fontWeight: "600" },
  bars: { flex: 1, gap: 5 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 10, textAlign: "center", color: "#71717A", fontSize: 12, fontWeight: "700" },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: "#F1F1F3", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: "#E5484D" },
  barCount: { width: 22, textAlign: "right", color: "#A1A1AA", fontSize: 12, fontVariant: ["tabular-nums"] },
});

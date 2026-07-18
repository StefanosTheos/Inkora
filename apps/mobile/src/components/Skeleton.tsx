import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, StyleSheet, View, type ViewStyle } from "react-native";

/** A single shimmering placeholder block. Reserves real layout space so the
 *  screen doesn't jump when the content loads in (unlike a centered spinner). */
export function Skeleton({ width = "100%", height = 12, radius = 8, style }: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: "#ECECEE", opacity }, style]} />;
}

/** Avatar + two text lines — mirrors a list row (conversations, bookings). */
export function RowSkeleton() {
  return (
    <View style={s.row}>
      <Skeleton width={48} height={48} radius={24} />
      <View style={s.rowLines}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="80%" height={11} />
      </View>
    </View>
  );
}

/** A horizontal rail of card placeholders (Home artist/studio rails). */
export function RailSkeleton({ count = 4, cardWidth = 128 }: { count?: number; cardWidth?: number }) {
  return (
    <View style={s.rail}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: cardWidth, gap: 8 }}>
          <Skeleton width={cardWidth} height={cardWidth} radius={16} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="45%" height={10} />
        </View>
      ))}
    </View>
  );
}

/** A two-column masonry-ish grid of tile placeholders (Home/Discover feeds). */
export function TileGridSkeleton({ count = 6 }: { count?: number }) {
  const heights = [180, 140, 200, 150, 190, 160];
  return (
    <View style={s.grid}>
      {[0, 1].map((col) => (
        <View key={col} style={s.gridCol}>
          {Array.from({ length: Math.ceil(count / 2) }).map((_, i) => (
            <Skeleton key={i} width="100%" height={heights[(col + i * 2) % heights.length]} radius={14} />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowLines: { flex: 1, gap: 8 },
  rail: { flexDirection: "row", gap: 12, paddingLeft: 16, paddingRight: 12 },
  grid: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  gridCol: { flex: 1, gap: 8 },
});

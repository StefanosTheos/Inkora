import type { RewardTier } from "@inkora/domain";
import { StyleSheet, View } from "react-native";

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lerpColor = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
};

/** Dependency-free vertical gradient: stacked equal-height strips of interpolated
 *  colour (no native module → works on a plain reload). Render as an absolute-fill
 *  background behind card content. */
export function GradientBg({ from, to, steps = 24 }: { from: string; to: string; steps?: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: steps }).map((_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: lerpColor(from, to, i / (steps - 1)) }} />
      ))}
    </View>
  );
}

/** Per-tier gradient (tier-tinted dark → deeper dark), kept dark enough that
 *  white text stays legible; pair with a TIER_COLOR bloom for the accent. */
export const TIER_GRADIENT: Record<RewardTier, { from: string; to: string }> = {
  bronze: { from: "#5A3A16", to: "#1A120A" },
  silver: { from: "#3C4048", to: "#15171C" },
  gold: { from: "#5A4310", to: "#1A1408" },
  platinum: { from: "#3A2A5E", to: "#160F26" },
};

import { colors, radius, spacing } from "./index";

/**
 * Shared Tailwind/NativeWind preset built from the raw tokens.
 * web: tailwind.config -> presets: [inkoraPreset]
 * mobile: same preset fed to NativeWind.
 */
export const inkoraPreset = {
  theme: {
    extend: {
      colors,
      borderRadius: radius,
      // TODO: map spacing/typography into Tailwind theme scale
      spacing,
    },
  },
};

export default inkoraPreset;

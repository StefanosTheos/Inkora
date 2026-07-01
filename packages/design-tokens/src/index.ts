// Raw, platform-agnostic token values. PLACEHOLDER — finalize with brand.
export const colors = {
  // TODO: real palette
  brand: { DEFAULT: "#1F1B2E", accent: "#E5484D" },
  bg: { DEFAULT: "#FFFFFF", muted: "#F4F4F5" },
  fg: { DEFAULT: "#18181B", muted: "#71717A" },
} as const;

export const spacing = {
  // TODO: real scale (4-pt baseline)
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
} as const;

export const typography = {
  // TODO: real type scale + font families per platform
  fontFamily: { sans: "Inter", display: "Inter" },
  size: { sm: 14, base: 16, lg: 18, xl: 24, "2xl": 32 },
} as const;

export const radius = { sm: 6, md: 12, lg: 20, full: 9999 } as const;

import type { Config } from "tailwindcss";
// Shares the SAME preset as mobile (NativeWind) from @inkora/design-tokens.
// import { inkoraPreset } from "@inkora/design-tokens/tailwind-preset";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui-web/src/**/*.{ts,tsx}",
  ],
  // presets: [inkoraPreset], // TODO: enable once finalized
  theme: { extend: {} },
  plugins: [],
};

export default config;

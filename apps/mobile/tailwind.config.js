// NativeWind config — shares the SAME preset as web (from @inkora/design-tokens).
// const { inkoraPreset } = require("@inkora/design-tokens/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  // presets: [inkoraPreset], // TODO: enable once design-tokens preset is finalized
  theme: { extend: {} },
  plugins: [],
};

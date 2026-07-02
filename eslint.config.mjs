import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Flat ESLint config for the whole monorepo (mobile RN, web Next, shared TS).
 * Focus: real bugs (rules-of-hooks, unused vars) over style — Prettier owns
 * formatting. Generated code, native folders, and Deno Edge Functions are
 * excluded (different globals/module systems).
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/android/**",
      "**/ios/**",
      "**/*.config.*",
      "**/database.types.ts", // generated
      "supabase/functions/**", // Deno runtime (remote imports, Deno globals)
      "supabase/storage/**", // Node ops scripts
      "supabase/**/*.sql",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __DEV__: "readonly" },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // pragmatic: the data layer uses deliberate casts; formatting is Prettier's job
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);

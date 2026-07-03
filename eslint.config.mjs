import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

/**
 * Flat ESLint config for the whole monorepo (mobile RN, web Next, shared TS).
 * Focus: real bugs (rules-of-hooks, floating promises, exhaustive deps) plus
 * deterministic import ordering. Prettier still owns whitespace/quotes.
 * Generated code, native folders, and Deno Edge Functions are excluded
 * (different globals/module systems).
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
      parserOptions: {
        // Type-aware linting so no-floating-promises / no-misused-promises work.
        // projectService auto-discovers each package's nearest tsconfig.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // --- Real-bug rules, promoted to errors ---
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // --- Deterministic import/export ordering ---
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // --- Pragmatic opt-outs (the data layer uses deliberate casts) ---
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // Test files: allow floating expect-style promises and looser typing.
    files: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
);

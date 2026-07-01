// Local entry so Metro/HMR resolves the entry from THIS package (pnpm monorepo:
// expo-router is hoisted to the repo root, which breaks HMR's project-relative lookup).
// The bare import below resolves via metro.config nodeModulesPaths (root).
import "expo-router/entry";

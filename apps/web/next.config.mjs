/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile TS directly from workspace packages (no prebuild step).
  transpilePackages: [
    "@inkora/domain",
    "@inkora/data-access",
    "@inkora/ui-web",
    "@inkora/design-tokens",
    "@inkora/analytics",
    "@inkora/ai",
  ],
  images: {
    // TODO: allow the Supabase Storage / CDN host for next/image
    remotePatterns: [],
  },
};

export default nextConfig;

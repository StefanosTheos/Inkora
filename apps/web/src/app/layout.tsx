import "./globals.css";

import type { Metadata } from "next";

import { Providers } from "../providers";

export const metadata: Metadata = {
  title: { default: "Inkora", template: "%s · Inkora" },
  description: "Discover tattoo artists, find inspiration, and book your next piece.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

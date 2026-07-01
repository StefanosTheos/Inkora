// Authenticated browse shell. Providers live in the root layout; this is a thin wrapper.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}

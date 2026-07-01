// Route: / (marketing landing). Minimal placeholder with a valid default export
// so the route type-checks and renders. TODO: real SEO landing page.
import Link from "next/link";

export const metadata = {
  title: "Inkora — Discover tattoo artists",
  description: "Find tattoo artists, get inspired, and book your next piece.",
};

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-extrabold">Inkora</h1>
      <p className="text-zinc-500">Discover artists. Find your next tattoo.</p>
      <div className="flex justify-center gap-3">
        <Link href="/signup" className="rounded bg-[#E5484D] px-5 py-3 font-semibold text-white">Get started</Link>
        <Link href="/login" className="rounded border px-5 py-3 font-medium">Sign in</Link>
      </div>
    </main>
  );
}

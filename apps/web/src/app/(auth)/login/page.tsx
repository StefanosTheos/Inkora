"use client";
import { useAuth } from "@inkora/data-access";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { env } from "../../../lib/env";

export default function LoginPage() {
  const { signInWithPassword, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const redirectTo = useSearchParams().get("redirectTo") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    else router.replace(redirectTo); // cookie session is set; middleware/layout take over
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="rounded border p-3" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded border p-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="rounded bg-[#E5484D] p-3 font-semibold text-white" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="text-center text-sm text-zinc-400">or</div>
      <button className="rounded border p-3 font-medium" onClick={() => signInWithGoogle()}>Continue with Google</button>
      {env.APPLE_AUTH_ENABLED && (
        <button className="rounded bg-black p-3 font-medium text-white" onClick={() => signInWithApple()}>Continue with Apple</button>
      )}
      <Link href="/signup" className="mt-4 text-center font-semibold text-[#E5484D]">
        Don&apos;t have an account? Sign up
      </Link>
    </main>
  );
}

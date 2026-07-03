"use client";
import { useAuth } from "@inkora/data-access";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { env } from "../../../lib/env";

export default function SignupPage() {
  const { signUpWithPassword, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signUpWithPassword({ email: email.trim(), password, displayName: displayName.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    if (res.value.needsEmailConfirmation) setNotice("Check your email to confirm your account, then sign in.");
    else router.replace("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-bold">Create your account</h1>
      {notice && <p className="text-sm text-green-600">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="rounded border p-3" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <input className="rounded border p-3" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded border p-3" type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="rounded bg-[#E5484D] p-3 font-semibold text-white" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <div className="text-center text-sm text-zinc-400">or</div>
      <button className="rounded border p-3 font-medium" onClick={() => signInWithGoogle()}>Continue with Google</button>
      {env.APPLE_AUTH_ENABLED && (
        <button className="rounded bg-black p-3 font-medium text-white" onClick={() => signInWithApple()}>Continue with Apple</button>
      )}
      <Link href="/login" className="mt-4 text-center font-semibold text-[#E5484D]">
        Already have an account? Sign in
      </Link>
    </main>
  );
}

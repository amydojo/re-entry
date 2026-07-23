"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Action } from "@/components/ui/action";

export function LoginForm({ demoMode = false }: { demoMode?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null);
    if (demoMode) { router.replace("/desk"); router.refresh(); return; }
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError("The email or password was not accepted."); setLoading(false); return; }
    router.replace("/desk"); router.refresh();
  }

  return <form onSubmit={submit} className="stack-lg">
    <div className="field"><label htmlFor="email">Provider email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <Action type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in to Skin Pass desk"}</Action>
  </form>;
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hasSupabaseClient, supabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (!hasSupabaseClient()) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-stone-600">
        Sign-in isn&apos;t configured yet — this will work once the site is connected to its
        database.
      </p>
    );
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg bg-moss/10 p-6 text-center">
        <p className="text-2xl">📬</p>
        <p className="mt-2 font-semibold text-moss-dark">Check your email</p>
        <p className="mt-1 text-sm text-stone-600">
          We sent a sign-in link to <strong>{email}</strong>. Click it to finish signing in — you
          can close this tab.
        </p>
      </div>
    );
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      setError(err.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <form onSubmit={sendLink} className="space-y-4">
      <p className="text-sm text-stone-600">
        No password needed — enter your email and we&apos;ll send you a sign-in link.
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-moss focus:outline-none"
        autoComplete="email"
      />
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full bg-moss py-2.5 font-semibold text-white hover:bg-moss-dark disabled:bg-stone-300"
      >
        {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-stone-800">Sign in</h1>
      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

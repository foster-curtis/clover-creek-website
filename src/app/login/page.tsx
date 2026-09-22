"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/Heading";
import { Input } from "@/components/ui/Field";
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
    // Supabase's redirect allow-list is an exact match, so "next" can't ride
    // along as a query string on emailRedirectTo — it's stashed in a cookie
    // instead and read back by /auth/callback.
    document.cookie = `sb-auth-next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit" loading={status === "sending"} className="w-full">
        {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <PageTitle className="text-center">Sign in</PageTitle>
      <Card variant="flat" className="mt-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}

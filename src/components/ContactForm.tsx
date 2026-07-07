"use client";

import { useState } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to send — please email us directly.");
      }
      setStatus("sent");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
      setStatus("error");
    }
  }

  const inputCls =
    "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none";

  if (status === "sent") {
    return (
      <p className="rounded-lg bg-moss/10 px-4 py-6 text-center text-moss-dark">
        Thanks — your message is on its way. We&apos;ll get back to you soon!
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm text-stone-700">
        Your name
        <input name="name" required minLength={2} className={inputCls + " mt-1"} />
      </label>
      <label className="block text-sm text-stone-700">
        Email
        <input name="email" type="email" required className={inputCls + " mt-1"} />
      </label>
      <label className="block text-sm text-stone-700">
        Message
        <textarea name="body" required minLength={10} rows={5} className={inputCls + " mt-1"} />
      </label>
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-moss px-6 py-2.5 font-semibold text-white hover:bg-moss-dark disabled:bg-stone-300"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

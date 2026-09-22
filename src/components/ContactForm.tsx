"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

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

  if (status === "sent") {
    return (
      <p className="rounded-lg bg-moss/10 px-4 py-6 text-center text-moss-dark">
        Thanks — your message is on its way. We&apos;ll get back to you soon!
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Your name" htmlFor="contact-name">
        <Input id="contact-name" name="name" required minLength={2} />
      </Field>
      <Field label="Email" htmlFor="contact-email">
        <Input id="contact-email" name="email" type="email" required />
      </Field>
      <Field label="Message" htmlFor="contact-body">
        <Textarea id="contact-body" name="body" required minLength={10} rows={5} />
      </Field>
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="primary" size="md" loading={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

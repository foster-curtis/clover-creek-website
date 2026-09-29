"use client";

// Admin actions report failure by throwing (see actions.ts), which without a
// boundary means the owner gets Next's blank error page for something as
// ordinary as Stripe declining a refund. The messages those actions throw are
// written to be read by the owner, so show them, and offer the retry — the
// failures worth showing here are mostly transient or fixable.

import { useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PageTitle } from "@/components/ui/Heading";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-8">
      <PageTitle>That didn&apos;t go through</PageTitle>
      <Card variant="flat" className="mt-4 p-5">
        <p className="text-ink">{error.message}</p>
        {error.digest && (
          // Production replaces the message with a generic one; the digest is
          // the only handle on the real error in the server logs.
          <p className="mt-2 text-xs text-ink-subtle">Reference: {error.digest}</p>
        )}
        <Button variant="secondary" size="sm" className="mt-4" onClick={reset}>
          Try again
        </Button>
      </Card>
    </div>
  );
}

"use client";

import { useId, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import { CloseIcon, HelpIcon } from "@/components/ui/icons";

/**
 * The "these are estimates" notice, dismissible and re-openable.
 *
 * Collapsed, it stays a single line rather than disappearing: the figures on
 * this page look exactly like the ones that go on a return, and the one-line
 * caveat is the only thing on screen saying they are unverified — worth keeping
 * for whoever reads the page months from now. Only the detail folds away.
 *
 * Whether it starts open is decided on the server from the dismissal cookie
 * (see NOTICE_COOKIE), so the tall card never flashes up on a visit where it
 * has already been dismissed.
 *
 * Re-opening is deliberately temporary — it does not clear the cookie, so the
 * next visit is collapsed again. Reading it once more should not undo the
 * dismissal.
 */

export const NOTICE_COOKIE = "cc-tax-estimate-notice-dismissed";

/** The browser cap is 400 days; anything longer is silently clamped. */
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export default function EstimateNotice({
  defaultOpen,
  summary,
  title,
  children,
}: {
  defaultOpen: boolean;
  /** The one line that stays visible when collapsed. */
  summary: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  function dismiss() {
    document.cookie = `${NOTICE_COOKIE}=1; path=/admin/taxes; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    setOpen(false);
  }

  if (!open) {
    return (
      <Card
        variant="flat"
        className="mt-6 flex items-center justify-between gap-3 border-l-4 border-l-clay px-4 py-2 text-sm"
      >
        <span className="text-ink-muted">{summary}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          // No aria-controls here: the body is not in the DOM while collapsed,
          // and pointing at a missing id is worse than leaving it off.
          aria-expanded={false}
          title={title}
          className="-mr-1 shrink-0 rounded-full p-1 text-ink-subtle hover:bg-moss/10 hover:text-moss-dark"
        >
          <HelpIcon className="h-5 w-5" />
          <span className="sr-only">{title}</span>
        </button>
      </Card>
    );
  }

  return (
    <Card variant="flat" className="mt-6 border-l-4 border-l-clay p-5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-ink">{title}</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-expanded
          aria-controls={bodyId}
          title="Dismiss this notice"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-ink-subtle hover:bg-moss/10 hover:text-moss-dark"
        >
          <CloseIcon className="h-5 w-5" />
          <span className="sr-only">Dismiss this notice</span>
        </button>
      </div>
      <div id={bodyId}>{children}</div>
    </Card>
  );
}

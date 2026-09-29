import type { ReactNode } from "react";
import DismissibleNotice from "@/components/DismissibleNotice";

/**
 * The calendar-sync explainer on /admin/calendar — which link goes where, and
 * which one is private.
 *
 * Collapses to a line rather than vanishing, like the tax notice: it is
 * reference material you need on the day you add a listing and never again
 * until the next one, but the surviving line has to keep saying that one of
 * these links carries guest names. See @/components/DismissibleNotice.
 */

export const SYNC_NOTICE_COOKIE = "cc-calendar-sync-notice-dismissed";

export default function SyncNotice({
  defaultOpen,
  summary,
  title,
  children,
}: {
  defaultOpen: boolean;
  summary: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <DismissibleNotice
      cookieName={SYNC_NOTICE_COOKIE}
      cookiePath="/admin/calendar"
      defaultOpen={defaultOpen}
      summary={summary}
      title={title}
    >
      {children}
    </DismissibleNotice>
  );
}

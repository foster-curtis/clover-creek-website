import type { ReactNode } from "react";
import DismissibleNotice from "@/components/DismissibleNotice";

/**
 * The "these are estimates" notice on /admin/taxes.
 *
 * The figures on that page look exactly like the ones that go on a return, and
 * this is the only thing on screen saying they are unverified — so it collapses
 * to a line rather than vanishing. The mechanics live in DismissibleNotice;
 * what's here is the dismissal's scope.
 */

export const NOTICE_COOKIE = "cc-tax-estimate-notice-dismissed";

export default function EstimateNotice({
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
      cookieName={NOTICE_COOKIE}
      cookiePath="/admin/taxes"
      defaultOpen={defaultOpen}
      summary={summary}
      title={title}
    >
      {children}
    </DismissibleNotice>
  );
}

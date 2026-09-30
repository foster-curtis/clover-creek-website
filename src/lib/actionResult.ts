// What an admin action hands back when the owner has to read the outcome.
//
// Next.js redacts a thrown Server Action message down to a generic string and a
// digest in production, so an action whose failure text matters returns it as a
// value instead. It lives here rather than in admin/actions.ts because a
// "use server" file may export only async functions.
//
// The two severities are not decoration:
//   blocked      nothing happened; retrying is reasonable.
//   money-moved  the money has left and the database does not know it; retrying
//                would send it twice, so the UI has to lock the controls.
// The type is what makes each call site say which one it means.

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; severity: "blocked" | "money-moved" };

export const blocked = (message: string): ActionResult => ({
  ok: false,
  message,
  severity: "blocked",
});

export const moneyMoved = (message: string): ActionResult => ({
  ok: false,
  message,
  severity: "money-moved",
});

export const done = (message?: string): ActionResult => ({ ok: true, message });

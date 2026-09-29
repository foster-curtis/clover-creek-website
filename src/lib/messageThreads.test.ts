import { describe, expect, it } from "vitest";
import { buildThreads, isActiveStay, type ThreadBooking, type ThreadMessage } from "./messageThreads";

const TODAY = "2026-10-01";

function booking(over: Partial<ThreadBooking> & { id: string }): ThreadBooking {
  return {
    guest_name: "Guest",
    stay: "[2026-10-10,2026-10-12)",
    status: "confirmed",
    ...over,
  };
}

function message(over: Partial<ThreadMessage> & { booking_id: string }): ThreadMessage {
  return {
    body: "hello",
    from_admin: false,
    read_at: null,
    created_at: "2026-09-30T12:00:00Z",
    ...over,
  };
}

describe("isActiveStay", () => {
  it("counts a stay that hasn't checked out yet", () => {
    expect(isActiveStay(booking({ id: "a", stay: "[2026-09-28,2026-10-03)" }), TODAY)).toBe(true);
  });

  it("counts checkout day itself — they're still there that morning", () => {
    expect(isActiveStay(booking({ id: "a", stay: "[2026-09-28,2026-10-01)" }), TODAY)).toBe(true);
  });

  it("drops a stay that has ended", () => {
    expect(isActiveStay(booking({ id: "a", stay: "[2026-09-20,2026-09-30)" }), TODAY)).toBe(false);
  });

  it("drops a cancelled stay even when it's still ahead", () => {
    expect(isActiveStay(booking({ id: "a", status: "cancelled" }), TODAY)).toBe(false);
  });
});

describe("buildThreads", () => {
  it("lists an active booking nobody has written on", () => {
    const threads = buildThreads([], [booking({ id: "a", guest_name: "Ada" })], TODAY);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ bookingId: "a", guestName: "Ada", last: null, unread: 0 });
  });

  it("keeps a conversation on a stay that is over", () => {
    const past = booking({ id: "a", stay: "[2026-09-01,2026-09-05)", status: "completed" });
    expect(buildThreads([message({ booking_id: "a" })], [past], TODAY)).toHaveLength(1);
  });

  it("drops a finished stay with no history", () => {
    const past = booking({ id: "a", stay: "[2026-09-01,2026-09-05)", status: "completed" });
    expect(buildThreads([], [past], TODAY)).toEqual([]);
  });

  it("takes the preview from the newest message whatever order they arrive in", () => {
    const [thread] = buildThreads(
      [
        message({ booking_id: "a", body: "first", created_at: "2026-09-30T10:00:00Z" }),
        message({ booking_id: "a", body: "newest", created_at: "2026-09-30T18:00:00Z" }),
        message({ booking_id: "a", body: "middle", created_at: "2026-09-30T12:00:00Z" }),
      ],
      [booking({ id: "a" })],
      TODAY
    );
    expect(thread.last).toBe("newest");
    expect(thread.lastAt).toBe("2026-09-30T18:00:00Z");
  });

  it("counts only unread messages from the guest", () => {
    const [thread] = buildThreads(
      [
        message({ booking_id: "a" }),
        message({ booking_id: "a", read_at: "2026-09-30T13:00:00Z" }),
        message({ booking_id: "a", from_admin: true }),
      ],
      [booking({ id: "a" })],
      TODAY
    );
    expect(thread.unread).toBe(1);
  });

  it("puts conversations above silent stays, newest reply first", () => {
    const threads = buildThreads(
      [
        message({ booking_id: "b", created_at: "2026-09-29T09:00:00Z" }),
        message({ booking_id: "c", created_at: "2026-09-30T09:00:00Z" }),
      ],
      [
        booking({ id: "a", stay: "[2026-10-05,2026-10-07)" }),
        booking({ id: "b" }),
        booking({ id: "c" }),
      ],
      TODAY
    );
    expect(threads.map((t) => t.bookingId)).toEqual(["c", "b", "a"]);
  });

  it("orders silent stays by check-in", () => {
    const threads = buildThreads(
      [],
      [
        booking({ id: "late", stay: "[2026-11-01,2026-11-03)" }),
        booking({ id: "soon", stay: "[2026-10-02,2026-10-04)" }),
      ],
      TODAY
    );
    expect(threads.map((t) => t.bookingId)).toEqual(["soon", "late"]);
  });

  it("lists a booking once even when it is passed twice", () => {
    const threads = buildThreads([], [booking({ id: "a" }), booking({ id: "a" })], TODAY);
    expect(threads).toHaveLength(1);
  });
});
